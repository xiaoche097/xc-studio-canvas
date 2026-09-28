package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"xcai-server/internal/models"
	"xcai-server/internal/store"
)

type UserHandler struct {
	store *store.Store
}

func NewUserHandler(s *store.Store) *UserHandler {
	return &UserHandler{store: s}
}

// ListUsers returns all users
func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users := h.store.GetUsers()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(users)
}

// CreateUser creates a new platform user
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	var req models.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "无效的请求 JSON 数据"})
		return
	}

	cleanHandle := strings.TrimPrefix(strings.TrimSpace(req.Handle), "@")
	cleanName := strings.TrimSpace(req.Name)
	if cleanHandle == "" && cleanName == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "用户名或显示名称不能为空"})
		return
	}

	// 密码安全检查
	if req.Password != "" && len(req.Password) < 8 {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "初始密码长度至少需要 8 位字符"})
		return
	}

	u, err := h.store.CreateUser(req)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(u)
}

// UpdateUser updates user info
func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	// Extract {id} from path e.g. /api/users/{id}
	id := r.PathValue("id")
	if id == "" {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 3 {
			id = parts[2]
		}
	}

	if id == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "缺少用户 ID"})
		return
	}

	var req models.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "无效的请求参数"})
		return
	}

	if req.Password != "" && len(req.Password) < 8 {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "新密码长度至少需要 8 位字符"})
		return
	}

	updated, err := h.store.UpdateUser(id, req)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	_ = json.NewEncoder(w).Encode(updated)
}

// DeleteUser removes a user
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	id := r.PathValue("id")
	if id == "" {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 3 {
			id = parts[2]
		}
	}

	if id == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "缺少用户 ID"})
		return
	}

	if ok := h.store.DeleteUser(id); !ok {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "用户不存在"})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Login authenticates a user
func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(models.LoginResponse{
			Success: false,
			Message: "无效的登录参数",
		})
		return
	}

	loginKey := req.Username
	if loginKey == "" {
		loginKey = req.Handle
	}

	u, found := h.store.FindUserByUsername(loginKey)
	if !found {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(models.LoginResponse{
			Success: false,
			Message: "用户名或账号不存在",
		})
		return
	}

	if u.Status == "disabled" {
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(models.LoginResponse{
			Success: false,
			Message: "该账号已被管理员停用，请联系管理团队",
		})
		return
	}

	// 密码校验 (支持设置的密码，或未设置密码时允许直接登录或验证)
	if u.Password != "" && u.Password != req.Password {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(models.LoginResponse{
			Success: false,
			Message: "登录密码不正确",
		})
		return
	}

	// 生成简单 session token
	tokenBytes := make([]byte, 16)
	_, _ = rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	_ = json.NewEncoder(w).Encode(models.LoginResponse{
		Success: true,
		Token:   token,
		User:    u,
	})
}
