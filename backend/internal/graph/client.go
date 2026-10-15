package graph

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/gomodule/redigo/redis"
)

type Client struct {
	pool *redis.Pool
}

func NewClient(host, port, password string) (*Client, error) {
	addr := fmt.Sprintf("%s:%s", host, port)

	pool := &redis.Pool{
		MaxIdle:     10,
		MaxActive:   50,
		IdleTimeout: 240 * time.Second,
		Dial: func() (redis.Conn, error) {
			var opts []redis.DialOption
			opts = append(opts, redis.DialConnectTimeout(5*time.Second))
			opts = append(opts, redis.DialReadTimeout(10*time.Second))
			opts = append(opts, redis.DialWriteTimeout(5*time.Second))

			if password != "" {
				opts = append(opts, redis.DialPassword(password))
			}

			c, err := redis.Dial("tcp", addr, opts...)
			if err != nil {
				return nil, err
			}
			return c, nil
		},
		TestOnBorrow: func(c redis.Conn, t time.Time) error {
			if time.Since(t) < time.Minute {
				return nil
			}
			_, err := c.Do("PING")
			return err
		},
	}

	// Verify initial connection
	conn := pool.Get()
	defer conn.Close()

	if _, err := conn.Do("PING"); err != nil {
		return nil, fmt.Errorf("failed to ping FalkorDB at %s: %w", addr, err)
	}

	log.Printf("[INFO] Successfully connected to FalkorDB at %s", addr)
	return &Client{pool: pool}, nil
}

// Close closes the underlying Redis connection pool.
func (c *Client) Close() error {
	return c.pool.Close()
}

// Query executes a Cypher query on the specified graph with optional parameters.
func (c *Client) Query(ctx context.Context, graphName, cypher string, params map[string]interface{}) (*QueryResult, error) {
	conn, err := c.pool.GetContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection from pool: %w", err)
	}
	defer conn.Close()

	queryStr := cypher
	if len(params) > 0 {
		queryStr = injectParams(cypher, params)
	}

	raw, err := conn.Do("GRAPH.QUERY", graphName, queryStr)
	if err != nil {
		return nil, fmt.Errorf("cypher query failed [%s]: %w", queryStr, err)
	}

	return ParseReply(raw)
}

// ROQuery executes a read-only Cypher query using GRAPH.RO_QUERY.
func (c *Client) ROQuery(ctx context.Context, graphName, cypher string, params map[string]interface{}) (*QueryResult, error) {
	conn, err := c.pool.GetContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection from pool: %w", err)
	}
	defer conn.Close()

	queryStr := cypher
	if len(params) > 0 {
		queryStr = injectParams(cypher, params)
	}

	raw, err := conn.Do("GRAPH.RO_QUERY", graphName, queryStr)
	if err != nil {
		return nil, fmt.Errorf("read-only cypher query failed [%s]: %w", queryStr, err)
	}

	return ParseReply(raw)
}

// CountNodes returns the total number of nodes in the graph.
func (c *Client) CountNodes(ctx context.Context, graphName string) (int, error) {
	res, err := c.ROQuery(ctx, graphName, "MATCH (n) RETURN count(n) AS cnt", nil)
	if err != nil {
		// Graph might not exist yet
		return 0, nil
	}
	if len(res.Records) > 0 {
		if cnt, ok := res.Records[0]["cnt"].(int64); ok {
			return int(cnt), nil
		}
	}
	return 0, nil
}

// CountEdges returns the total number of relationships in the graph.
func (c *Client) CountEdges(ctx context.Context, graphName string) (int, error) {
	res, err := c.ROQuery(ctx, graphName, "MATCH ()-[r]->() RETURN count(r) AS cnt", nil)
	if err != nil {
		return 0, nil
	}
	if len(res.Records) > 0 {
		if cnt, ok := res.Records[0]["cnt"].(int64); ok {
			return int(cnt), nil
		}
	}
	return 0, nil
}

// DeleteGraph deletes the entire graph from FalkorDB.
func (c *Client) DeleteGraph(ctx context.Context, graphName string) error {
	conn, err := c.pool.GetContext(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	_, err = conn.Do("GRAPH.DELETE", graphName)
	if err != nil && !strings.Contains(err.Error(), "key does not exist") {
		return err
	}
	return nil
}

// injectParams replaces $param in Cypher queries with properly serialized and sanitized literals.
func injectParams(query string, params map[string]interface{}) string {
	if len(params) == 0 {
		return query
	}

	// Sort keys by length descending to prevent shorter prefix placeholders (e.g. $q) from corrupting longer ones ($query)
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		return len(keys[i]) > len(keys[j])
	})

	res := query
	for _, k := range keys {
		v := params[k]
		placeholder := "$" + k
		var valStr string
		switch val := v.(type) {
		case string:
			// Security fix: Escape backslashes first, then escape single quotes to prevent injection
			escaped := strings.ReplaceAll(val, "\\", "\\\\")
			escaped = strings.ReplaceAll(escaped, "'", "\\'")
			valStr = fmt.Sprintf("'%s'", escaped)
		case int, int64, float64:
			valStr = fmt.Sprintf("%v", val)
		case bool:
			valStr = fmt.Sprintf("%t", val)
		default:
			b, _ := json.Marshal(val)
			valStr = string(b)
		}

		re := regexp.MustCompile(regexp.QuoteMeta(placeholder) + `\b`)
		res = re.ReplaceAllLiteralString(res, valStr)
	}
	return res
}
