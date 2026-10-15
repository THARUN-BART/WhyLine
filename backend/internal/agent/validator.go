package agent

import (
	"context"

	"github.com/THARUN-BART/whyline/backend/internal/graph"
)

// IDValidator verifies cited entity IDs against FalkorDB to prevent hallucination.
type IDValidator struct {
	client    *graph.Client
	graphName string
}

func NewIDValidator(client *graph.Client, graphName string) *IDValidator {
	return &IDValidator{
		client:    client,
		graphName: graphName,
	}
}

// ValidateIDs checks each candidate ID against FalkorDB and returns valid vs invalid lists.
func (v *IDValidator) ValidateIDs(ctx context.Context, ids []string) (valid []string, invalid []string) {
	for _, id := range ids {
		if id == "" {
			continue
		}

		cypher := "MATCH (n {id: $id}) RETURN n.id LIMIT 1"
		res, err := v.client.ROQuery(ctx, v.graphName, cypher, map[string]interface{}{"id": id})
		if err == nil && len(res.Records) > 0 {
			valid = append(valid, id)
		} else {
			invalid = append(invalid, id)
		}
	}
	return valid, invalid
}
