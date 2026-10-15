package graph

import (
	"fmt"
	"strconv"
	"strings"
)

// ParseReply parses FalkorDB raw RESP output into QueryResult.
func ParseReply(reply interface{}) (*QueryResult, error) {
	arr, ok := reply.([]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected FalkorDB reply type: %T", reply)
	}

	result := &QueryResult{
		Stats: make(map[string]interface{}),
	}

	// FalkorDB returns up to 3 array elements:
	// 0: Header (columns)
	// 1: Records (rows)
	// 2: Statistics (query time, nodes created, etc.)
	// Or for write-only queries:
	// 0: Statistics
	if len(arr) == 1 {
		// Only statistics returned (e.g., CREATE query without RETURN)
		parseStats(arr[0], result.Stats)
		return result, nil
	}

	if len(arr) >= 2 {
		// Parse Header / Columns
		if headerArr, ok := arr[0].([]interface{}); ok {
			for _, col := range headerArr {
				result.Columns = append(result.Columns, toString(col))
			}
		}

		// Parse Records
		if recordsArr, ok := arr[1].([]interface{}); ok {
			for _, rowRaw := range recordsArr {
				if rowArr, ok := rowRaw.([]interface{}); ok {
					record := make(Record)
					for colIdx, valRaw := range rowArr {
						colName := fmt.Sprintf("col_%d", colIdx)
						if colIdx < len(result.Columns) {
							colName = result.Columns[colIdx]
						}
						parsedVal := parseValue(valRaw, result)
						record[colName] = parsedVal
					}
					result.Records = append(result.Records, record)
				}
			}
		}
	}

	if len(arr) >= 3 {
		parseStats(arr[2], result.Stats)
	}

	return result, nil
}

func parseStats(statsRaw interface{}, statsMap map[string]interface{}) {
	if statsArr, ok := statsRaw.([]interface{}); ok {
		for _, s := range statsArr {
			str := toString(s)
			parts := strings.SplitN(str, ": ", 2)
			if len(parts) == 2 {
				statsMap[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
			} else {
				statsMap[str] = true
			}
		}
	}
}

func parseValue(raw interface{}, res *QueryResult) interface{} {
	if raw == nil {
		return nil
	}

	// Check if raw is a Node or Edge structure (which is a nested array of pairs)
	if arr, ok := raw.([]interface{}); ok {
		if node, isNode := tryParseNode(arr); isNode {
			res.Nodes = append(res.Nodes, *node)
			return *node
		}
		if edge, isEdge := tryParseEdge(arr); isEdge {
			res.Edges = append(res.Edges, *edge)
			return *edge
		}
		if path, isPath := tryParsePath(arr, res); isPath {
			res.Paths = append(res.Paths, *path)
			return *path
		}

		// Generic list
		var list []interface{}
		for _, item := range arr {
			list = append(list, parseValue(item, res))
		}
		return list
	}

	// Primitive types
	switch v := raw.(type) {
	case []byte:
		return string(v)
	case int64:
		return v
	case int:
		return int64(v)
	case string:
		return v
	default:
		return v
	}
}

func tryParseNode(arr []interface{}) (*Node, bool) {
	// A Node array in FalkorDB has elements: [["id", <id>], ["labels", [<label>...]], ["properties", [[<key>, <val>]]]]
	var id int64
	var labels []string
	properties := make(map[string]interface{})
	hasID := false

	for _, item := range arr {
		pair, ok := item.([]interface{})
		if !ok || len(pair) < 2 {
			return nil, false
		}
		key := toString(pair[0])
		switch key {
		case "id":
			id = toInt64(pair[1])
			hasID = true
		case "labels":
			if lArr, ok := pair[1].([]interface{}); ok {
				for _, l := range lArr {
					labels = append(labels, toString(l))
				}
			}
		case "properties":
			if pArr, ok := pair[1].([]interface{}); ok {
				for _, propItem := range pArr {
					if pPair, ok := propItem.([]interface{}); ok && len(pPair) >= 2 {
						propKey := toString(pPair[0])
						propVal := parsePrimitive(pPair[1])
						properties[propKey] = propVal
					}
				}
			}
		}
	}

	if hasID && len(labels) > 0 {
		return &Node{
			ID:         id,
			Labels:     labels,
			Properties: properties,
		}, true
	}
	return nil, false
}

func tryParseEdge(arr []interface{}) (*Edge, bool) {
	// An Edge array has elements: [["id", <id>], ["type", <type>], ["src_node", <src>], ["dest_node", <dest>], ["properties", [...]]]
	var id, src, dest int64
	var edgeType string
	properties := make(map[string]interface{})
	hasID := false
	hasType := false

	for _, item := range arr {
		pair, ok := item.([]interface{})
		if !ok || len(pair) < 2 {
			return nil, false
		}
		key := toString(pair[0])
		switch key {
		case "id":
			id = toInt64(pair[1])
			hasID = true
		case "type":
			edgeType = toString(pair[1])
			hasType = true
		case "src_node":
			src = toInt64(pair[1])
		case "dest_node":
			dest = toInt64(pair[1])
		case "properties":
			if pArr, ok := pair[1].([]interface{}); ok {
				for _, propItem := range pArr {
					if pPair, ok := propItem.([]interface{}); ok && len(pPair) >= 2 {
						propKey := toString(pPair[0])
						propVal := parsePrimitive(pPair[1])
						properties[propKey] = propVal
					}
				}
			}
		}
	}

	if hasID && hasType {
		return &Edge{
			ID:         id,
			Type:       edgeType,
			SourceNode: src,
			TargetNode: dest,
			Properties: properties,
		}, true
	}
	return nil, false
}

func tryParsePath(arr []interface{}, res *QueryResult) (*Path, bool) {
	// A Path contains arrays of nodes and edges alternating
	if len(arr) < 2 {
		return nil, false
	}
	var nodes []Node
	var edges []Edge

	for _, item := range arr {
		itemArr, ok := item.([]interface{})
		if !ok {
			return nil, false
		}
		if node, ok := tryParseNode(itemArr); ok {
			nodes = append(nodes, *node)
		} else if edge, ok := tryParseEdge(itemArr); ok {
			edges = append(edges, *edge)
		} else {
			return nil, false
		}
	}

	if len(nodes) > 0 {
		return &Path{
			Nodes: nodes,
			Edges: edges,
		}, true
	}
	return nil, false
}

func parsePrimitive(val interface{}) interface{} {
	switch v := val.(type) {
	case []byte:
		return string(v)
	case int64:
		return v
	case int:
		return int64(v)
	default:
		return v
	}
}

func toString(val interface{}) string {
	switch v := val.(type) {
	case []byte:
		return string(v)
	case string:
		return v
	case int64:
		return strconv.FormatInt(v, 10)
	case int:
		return strconv.Itoa(v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func toInt64(val interface{}) int64 {
	switch v := val.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case []byte:
		n, _ := strconv.ParseInt(string(v), 10, 64)
		return n
	case string:
		n, _ := strconv.ParseInt(v, 10, 64)
		return n
	default:
		return 0
	}
}
