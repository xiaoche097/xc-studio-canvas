package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"xcai-server/internal/config"
	"xcai-server/internal/models"
)

type ImgBBHandler struct {
	cfg    *config.Config
	client *http.Client
}

func NewImgBBHandler(cfg *config.Config) *ImgBBHandler {
	return &ImgBBHandler{
		cfg: cfg,
		client: &http.Client{
			Timeout: 75 * time.Second,
		},
	}
}

func cleanBase64Image(val string) string {
	val = strings.TrimSpace(val)
	if idx := strings.Index(val, ";base64,"); idx != -1 {
		return val[idx+8:]
	}
	return val
}

func (h *ImgBBHandler) Upload(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "service": "xcai-imgbb-relay-go"})
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req models.ImgBBRelayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	apiKey := strings.TrimSpace(req.Key)
	if apiKey == "" {
		apiKey = strings.TrimSpace(h.cfg.ImgBBAPIKey)
	}
	if apiKey == "" {
		http.Error(w, `{"error":"ImgBB API key is required"}`, http.StatusBadRequest)
		return
	}

	imageData := cleanBase64Image(req.Image)
	if imageData == "" {
		http.Error(w, `{"error":"Image data is required"}`, http.StatusBadRequest)
		return
	}

	formData := url.Values{}
	formData.Set("key", apiKey)
	formData.Set("image", imageData)
	if req.Name != "" {
		formData.Set("name", req.Name)
	}
	if req.Expiration >= 60 && req.Expiration <= 15552000 {
		formData.Set("expiration", strconv.Itoa(req.Expiration))
	}

	upstreamReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://api.imgbb.com/1/upload", strings.NewReader(formData.Encode()))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	upstreamReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := h.client.Do(upstreamReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"ImgBB upload failed: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}
