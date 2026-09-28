package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"xcai-server/internal/config"
	"xcai-server/internal/models"
)

type DeepSeekHandler struct {
	cfg    *config.Config
	client *http.Client
}

func NewDeepSeekHandler(cfg *config.Config) *DeepSeekHandler {
	return &DeepSeekHandler{
		cfg: cfg,
		client: &http.Client{
			Timeout: 180 * time.Second,
		},
	}
}

func (h *DeepSeekHandler) Chat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"Failed to read request body"}`, http.StatusBadRequest)
		return
	}

	var relayReq models.DeepSeekRelayRequest
	if err := json.Unmarshal(bodyBytes, &relayReq); err != nil {
		http.Error(w, `{"error":"Invalid JSON payload"}`, http.StatusBadRequest)
		return
	}

	apiKey := strings.TrimSpace(relayReq.APIKey)
	if apiKey == "" {
		apiKey = strings.TrimSpace(h.cfg.DeepSeekAPIKey)
	}

	baseURL := strings.TrimSpace(relayReq.BaseURL)
	if baseURL == "" {
		baseURL = h.cfg.DeepSeekBaseURL
	}
	baseURL = strings.TrimRight(baseURL, "/")

	if apiKey == "" {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": map[string]string{
				"message": "DeepSeek API Key 未配置，请在前端配置或后端环境变量中指定 DEEPSEEK_API_KEY",
			},
		})
		return
	}

	upstreamURL := fmt.Sprintf("%s/chat/completions", baseURL)

	upstreamReqBytes, err := json.Marshal(relayReq.Request)
	if err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	isStream := false
	if s, ok := relayReq.Request["stream"].(bool); ok && s {
		isStream = true
	}

	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, upstreamURL, bytes.NewReader(upstreamReqBytes))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	if isStream {
		httpReq.Header.Set("Accept", "text/event-stream")
	} else {
		httpReq.Header.Set("Accept", "application/json")
	}

	resp, err := h.client.Do(httpReq)
	if err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": map[string]string{
				"message": fmt.Sprintf("DeepSeek 上游调用失败: %s", err.Error()),
			},
		})
		return
	}
	defer resp.Body.Close()

	if isStream && resp.StatusCode == http.StatusOK {
		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
			return
		}

		buf := make([]byte, 4096)
		for {
			n, err := resp.Body.Read(buf)
			if n > 0 {
				_, _ = w.Write(buf[:n])
				flusher.Flush()
			}
			if err != nil {
				break
			}
		}
		return
	}

	// Non-streaming response
	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}
