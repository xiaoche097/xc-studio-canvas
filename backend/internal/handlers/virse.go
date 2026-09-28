package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type VirseHandler struct {
	client *http.Client
}

func NewVirseHandler() *VirseHandler {
	return &VirseHandler{
		client: &http.Client{
			Timeout: 90 * time.Second,
		},
	}
}

type mcpRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id,omitempty"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

type mcpResponse struct {
	JSONRPC string                 `json:"jsonrpc"`
	ID      interface{}            `json:"id,omitempty"`
	Result  map[string]interface{} `json:"result,omitempty"`
	Error   map[string]interface{} `json:"error,omitempty"`
}

func (h *VirseHandler) postMCP(ctx context.Context, endpoint string, apiKey string, reqPayload interface{}, sessionID string) (*mcpResponse, string, error) {
	data, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, "", err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(data))
	if err != nil {
		return nil, "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json, text/event-stream;q=0.9")
	if sessionID != "" {
		httpReq.Header.Set("mcp-session-id", sessionID)
	}

	resp, err := h.client.Do(httpReq)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	respSessionID := resp.Header.Get("mcp-session-id")
	if respSessionID == "" {
		respSessionID = sessionID
	}

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	if resp.StatusCode >= 400 {
		return nil, "", fmt.Errorf("Virse HTTP %d: %s", resp.StatusCode, string(raw))
	}

	var mcpResp mcpResponse
	// Handle SSE format if any
	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(contentType, "text/event-stream") {
		lines := strings.Split(string(raw), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "data:") {
				_ = json.Unmarshal([]byte(strings.TrimSpace(strings.TrimPrefix(line, "data:"))), &mcpResp)
			}
		}
	} else {
		if err := json.Unmarshal(raw, &mcpResp); err != nil {
			return nil, "", fmt.Errorf("invalid jsonrpc response: %w", err)
		}
	}

	return &mcpResp, respSessionID, nil
}

func (h *VirseHandler) Handle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"Failed to read request body"}`, http.StatusBadRequest)
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		http.Error(w, `{"error":"Invalid request JSON"}`, http.StatusBadRequest)
		return
	}

	apiKey, _ := payload["apiKey"].(string)
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		http.Error(w, `{"error":"缺少 Virse API Key"}`, http.StatusBadRequest)
		return
	}

	baseURL, _ := payload["baseUrl"].(string)
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		baseURL = "https://api.virse.ai"
	}
	baseURL = strings.TrimRight(baseURL, "/")
	mcpEndpoint := baseURL + "/mcp"

	ctx := r.Context()

	// 1. Initialize MCP
	initResp, sessionID, err := h.postMCP(ctx, mcpEndpoint, apiKey, mcpRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "initialize",
		Params: map[string]interface{}{
			"protocolVersion": "2025-03-26",
			"capabilities":    map[string]interface{}{},
			"clientInfo":      map[string]string{"name": "xcai-go-backend", "version": "1.0.0"},
		},
	}, "")
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"Virse MCP 初始化失败: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	if initResp.Error != nil {
		errMsg, _ := initResp.Error["message"].(string)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, errMsg), http.StatusBadRequest)
		return
	}

	// 2. Initialized Notification
	_, _, _ = h.postMCP(ctx, mcpEndpoint, apiKey, mcpRequest{
		JSONRPC: "2.0",
		Method:  "notifications/initialized",
		Params:  map[string]interface{}{},
	}, sessionID)

	op, _ := payload["operation"].(string)
	if op == "list_tools" {
		listResp, _, err := h.postMCP(ctx, mcpEndpoint, apiKey, mcpRequest{
			JSONRPC: "2.0",
			ID:      2,
			Method:  "tools/list",
			Params:  map[string]interface{}{},
		}, sessionID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"工具列表获取失败: %s"}`, err.Error()), http.StatusBadGateway)
			return
		}

		tools, _ := listResp.Result["tools"]
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"data": tools})
		return
	}

	// Default: call tool
	toolName, _ := payload["tool"].(string)
	args, _ := payload["args"].(map[string]interface{})
	if args == nil {
		args = make(map[string]interface{})
	}

	callResp, _, err := h.postMCP(ctx, mcpEndpoint, apiKey, mcpRequest{
		JSONRPC: "2.0",
		ID:      3,
		Method:  "tools/call",
		Params: map[string]interface{}{
			"name":      toolName,
			"arguments": args,
		},
	}, sessionID)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"Virse %s 调用失败: %s"}`, toolName, err.Error()), http.StatusBadGateway)
		return
	}

	if callResp.Error != nil {
		errMsg, _ := callResp.Error["message"].(string)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, errMsg), http.StatusBadRequest)
		return
	}

	result := callResp.Result
	structuredData := result["structuredContent"]
	if structuredData == nil {
		structuredData = result["structured_content"]
	}
	if structuredData == nil {
		structuredData = result["data"]
	}

	content, _ := result["content"].([]interface{})

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    structuredData,
		"content": content,
	})
}
