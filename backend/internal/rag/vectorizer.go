package rag

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/THARUN-BART/whyline/backend/internal/seed"
)

var wordRegex = regexp.MustCompile(`[a-zA-Z0-9_\-]+`)

// Vectorizer handles chunk generation, text embedding, and cosine similarity.
type Vectorizer struct {
	geminiKey  string
	httpClient *http.Client

	// In-memory TF-IDF index
	mu          sync.RWMutex
	vocabulary  map[string]int     // term -> index
	idf         []float64          // term index -> idf weight
	numDocs     int
	chunks      []Chunk
	useGemini   bool
}

// NewVectorizer creates and initializes the text vectorizer over seed data.
func NewVectorizer(geminiKey string) *Vectorizer {
	v := &Vectorizer{
		geminiKey: geminiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		vocabulary: make(map[string]int),
		useGemini:  geminiKey != "",
	}

	// 1. Ingest seed chunks
	v.ingestSeedChunks()

	// 2. Build local TF-IDF vocabulary and IDF weights
	v.buildTFIDF()

	// 3. Compute in-memory vector embeddings for all chunks
	v.embedAllChunks()

	return v
}

// ingestSeedChunks converts seed tickets, threads, documents, and decisions into searchable text chunks.
func (v *Vectorizer) ingestSeedChunks() {
	var chunks []Chunk

	// Decisions
	for _, d := range seed.DefaultDecisions {
		chunks = append(chunks, Chunk{
			ID:         "chk_" + d.ID,
			SourceType: "Decision",
			SourceID:   d.ID,
			Title:      d.Title,
			Content:    fmt.Sprintf("%s. Status: %s. Date: %s. Summary: %s. Aliases: %s", d.Title, d.Status, d.Date, d.Summary, strings.Join(d.Aliases, ", ")),
			Metadata: map[string]string{
				"date":   d.Date,
				"status": d.Status,
			},
		})
	}

	// Tickets
	for _, t := range seed.DefaultTickets {
		chunks = append(chunks, Chunk{
			ID:         "chk_" + strings.ToLower(t.ID),
			SourceType: "Ticket",
			SourceID:   t.ID,
			Title:      t.Title,
			Content:    fmt.Sprintf("%s. %s URL: %s", t.Title, t.Description, t.URL),
			Metadata: map[string]string{
				"url": t.URL,
			},
		})
	}

	// Slack Threads
	for _, th := range seed.DefaultThreads {
		chunks = append(chunks, Chunk{
			ID:         "chk_" + strings.ToLower(th.ID),
			SourceType: "Thread",
			SourceID:   th.ID,
			Title:      fmt.Sprintf("Thread %s (%s)", th.ID, th.Channel),
			Content:    fmt.Sprintf("Slack channel %s: %s. Excerpt: %s. Discussion Body: %s", th.Channel, th.Excerpt, th.Excerpt, th.Body),
			Metadata: map[string]string{
				"channel": th.Channel,
			},
		})
	}

	// Documents / RFCs
	for _, doc := range seed.DefaultDocuments {
		chunks = append(chunks, Chunk{
			ID:         "chk_" + strings.ToLower(doc.ID),
			SourceType: "Document",
			SourceID:   doc.ID,
			Title:      doc.Title,
			Content:    fmt.Sprintf("%s. URL: %s. Document text: %s", doc.Title, doc.URL, doc.Text),
			Metadata: map[string]string{
				"url": doc.URL,
			},
		})
	}

	v.chunks = chunks
}

func tokenize(text string) []string {
	lower := strings.ToLower(text)
	raw := wordRegex.FindAllString(lower, -1)
	var tokens []string
	for _, t := range raw {
		if len(t) > 1 {
			tokens = append(tokens, t)
		}
	}
	return tokens
}

// buildTFIDF builds vocabulary and Inverse Document Frequency for in-memory vectorization.
func (v *Vectorizer) buildTFIDF() {
	v.mu.Lock()
	defer v.mu.Unlock()

	v.numDocs = len(v.chunks)
	docFreq := make(map[string]int)

	for _, chk := range v.chunks {
		tokens := tokenize(chk.Content + " " + chk.Title)
		seen := make(map[string]bool)
		for _, tok := range tokens {
			if !seen[tok] {
				seen[tok] = true
				docFreq[tok]++
			}
		}
	}

	idx := 0
	for term := range docFreq {
		v.vocabulary[term] = idx
		idx++
	}

	v.idf = make([]float64, len(v.vocabulary))
	for term, df := range docFreq {
		tIdx := v.vocabulary[term]
		// Standard smooth IDF
		v.idf[tIdx] = math.Log(1.0 + float64(v.numDocs)/float64(df+1)) + 1.0
	}
}

// embedTextLocal converts text to an in-memory normalized vector using TF-IDF.
func (v *Vectorizer) embedTextLocal(text string) []float32 {
	v.mu.RLock()
	defer v.mu.RUnlock()

	vec := make([]float32, len(v.vocabulary))
	tokens := tokenize(text)
	tf := make(map[string]float64)
	for _, tok := range tokens {
		tf[tok]++
	}

	var sumSq float64
	for tok, count := range tf {
		idx, ok := v.vocabulary[tok]
		if !ok {
			continue
		}
		// Sublinear term frequency scaling
		subTf := 1.0 + math.Log(count)
		tfidf := subTf * v.idf[idx]
		vec[idx] = float32(tfidf)
		sumSq += tfidf * tfidf
	}

	// L2 Normalize
	if sumSq > 0 {
		norm := math.Sqrt(sumSq)
		for i := range vec {
			vec[i] = float32(float64(vec[i]) / norm)
		}
	}

	return vec
}

// embedAllChunks precomputes vectors for all indexed chunks.
func (v *Vectorizer) embedAllChunks() {
	for i := range v.chunks {
		v.chunks[i].Vector = v.embedTextLocal(v.chunks[i].Content + " " + v.chunks[i].Title)
	}
}

// CosineSimilarity computes the cosine similarity between two vectors.
func CosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, normA, normB float64
	for i := 0; i < len(a); i++ {
		dot += float64(a[i] * b[i])
		normA += float64(a[i] * a[i])
		normB += float64(b[i] * b[i])
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

// EmbedQuery returns an embedding vector for a query string.
func (v *Vectorizer) EmbedQuery(query string) []float32 {
	return v.embedTextLocal(query)
}

// GeminiEmbedRequest models the Gemini embedding payload.
type GeminiEmbedRequest struct {
	Model   string `json:"model"`
	Content struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	} `json:"content"`
}

// GeminiEmbedResponse models the Gemini embedding response.
type GeminiEmbedResponse struct {
	Embedding struct {
		Values []float32 `json:"values"`
	} `json:"embedding"`
}

// EmbedWithGemini attempts to embed text using Google Gemini's text-embedding-004.
func (v *Vectorizer) EmbedWithGemini(text string) ([]float32, error) {
	if v.geminiKey == "" {
		return nil, fmt.Errorf("gemini api key not configured")
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=%s", v.geminiKey)
	var reqBody GeminiEmbedRequest
	reqBody.Model = "models/text-embedding-004"
	reqBody.Content.Parts = []struct {
		Text string `json:"text"`
	}{{Text: text}}

	b, _ := json.Marshal(reqBody)
	resp, err := v.httpClient.Post(url, "application/json", bytes.NewBuffer(b))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini embedding api error: status %d", resp.StatusCode)
	}

	var geminiResp GeminiEmbedResponse
	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return nil, err
	}

	return geminiResp.Embedding.Values, nil
}
