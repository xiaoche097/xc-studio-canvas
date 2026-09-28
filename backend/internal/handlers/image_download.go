package handlers

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const maxImageBytes = 40 * 1024 * 1024 // 40MB

var allowedHostSuffixes = []string{
	"aiproxy.vip",
	"apilio.ai",
	"pinimg.com",
	"pinterest.com",
	"images.unsplash.com",
	"unsplash.com",
	"xhscdn.com",
	"xiaohongshu.com",
	"cdninstagram.com",
	"fbcdn.net",
	"media-amazon.com",
	"ssl-images-amazon.com",
	"alicdn.com",
	"i.ibb.co",
	"ibb.co",
	"imgur.com",
	"googleusercontent.com",
	"gstatic.com",
	"storage.googleapis.com",
	"cloudfront.net",
}

type ImageDownloadHandler struct {
	client *http.Client
}

func NewImageDownloadHandler() *ImageDownloadHandler {
	return &ImageDownloadHandler{
		client: &http.Client{
			Timeout: 45 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 4 {
					return fmt.Errorf("too many redirects")
				}
				if !isAllowedURL(req.URL) {
					return fmt.Errorf("redirected to disallowed host: %s", req.URL.Host)
				}
				return nil
			},
		},
	}
}

func isAllowedURL(u *url.URL) bool {
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "storage.googleapis.com" && strings.HasPrefix(u.Path, "/virse-images/") {
		return true
	}
	for _, suffix := range allowedHostSuffixes {
		if host == suffix || strings.HasSuffix(host, "."+suffix) {
			return true
		}
	}
	return false
}

func (h *ImageDownloadHandler) Download(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	rawURL := strings.TrimSpace(r.URL.Query().Get("url"))
	if rawURL == "" {
		http.Error(w, `{"error":"Missing url parameter"}`, http.StatusBadRequest)
		return
	}

	parsed, err := url.Parse(rawURL)
	if err != nil || !isAllowedURL(parsed) {
		http.Error(w, `{"error":"Invalid or unsupported image URL host"}`, http.StatusBadRequest)
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, rawURL, nil)
	if err != nil {
		http.Error(w, `{"error":"Failed to create request"}`, http.StatusInternalServerError)
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) XC-AI-Studio/1.0")

	resp, err := h.client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"Image fetch failed: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf(`{"error":"Upstream returned HTTP %d"}`, resp.StatusCode), resp.StatusCode)
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		http.Error(w, `{"error":"Remote content is not an image"}`, http.StatusUnsupportedMediaType)
		return
	}

	ext := "png"
	if strings.Contains(contentType, "jpeg") {
		ext = "jpg"
	} else if strings.Contains(contentType, "webp") {
		ext = "webp"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="generated-image.%s"`, ext))
	w.Header().Set("Cache-Control", "private, max-age=300")

	limitedReader := io.LimitReader(resp.Body, maxImageBytes)
	_, _ = io.Copy(w, limitedReader)
}
