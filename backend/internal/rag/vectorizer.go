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

)

var wordRegex = regexp.MustCompile(`[a-zA-Z0-9_\-]+`)

// Vectorizer handles chunk generation, text embedding, and cosine similarity.
type Vectorizer struct {
	geminiKey  string
	httpClient *http.Client

	// In-memory TF-IDF index
	mu         sync.RWMutex
	vocabulary map[string]int // term -> index
	idf        []float64      // term index -> idf weight
	numDocs    int
	chunks     []Chunk
	useGemini  bool
}

// NewVectorizer creates and initializes the text vectorizer.
func NewVectorizer(geminiKey string) *Vectorizer {
	v := &Vectorizer{
		geminiKey: geminiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		vocabulary: make(map[string]int),
		chunks:     make([]Chunk, 0),
		useGemini:  geminiKey != "",
	}

	return v
}

// SetChunks updates the text chunks and rebuilds the vector index.
func (v *Vectorizer) SetChunks(chunks []Chunk) {
	v.chunks = chunks
	v.buildTFIDF()
	v.embedAllChunks()
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

	// Fix #11: Pass API key via header instead of URL query param.
	url := "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
	var reqBody GeminiEmbedRequest
	reqBody.Model = "models/text-embedding-004"
	reqBody.Content.Parts = []struct {
		Text string `json:"text"`
	}{{Text: text}}

	b, _ := json.Marshal(reqBody)
	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(b))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-goog-api-key", v.geminiKey)
	resp, err := v.httpClient.Do(httpReq)
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
