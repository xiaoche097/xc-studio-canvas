package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"xcai-server/internal/models"
)

type Store struct {
	mu           sync.RWMutex
	dataDir      string
	userFilePath string
	telemPath    string
	users        map[string]*models.UserAccount
	telemetry    []*models.TelemetryLog
}

func New(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data dir: %w", err)
	}

	s := &Store{
		dataDir:      dataDir,
		userFilePath: filepath.Join(dataDir, "users.json"),
		telemPath:    filepath.Join(dataDir, "telemetry.json"),
		users:        make(map[string]*models.UserAccount),
		telemetry:    make([]*models.TelemetryLog, 0),
	}

	s.loadUsers()
	s.loadTelemetry()

	return s, nil
}

func (s *Store) loadUsers() {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.userFilePath)
	if err == nil && len(data) > 0 {
		var list []*models.UserAccount
		if err := json.Unmarshal(data, &list); err == nil {
			for _, u := range list {
				// 避免假占位数据
				if u.ID != "u_101" && u.ID != "u_102" {
					s.users[u.ID] = u
				}
			}
			return
		}
	}

	// 默认初始化一个系统超级管理员账号
	defaultAdmin := &models.UserAccount{
		ID:        "u_admin",
		Name:      "系统管理员",
		Handle:    "@admin",
		Email:     "admin@xcai.local",
		Password:  "admin123456",
		Credits:   9999,
		Role:      "admin",
		RoleLabel: "管理员",
		Status:    "active",
		CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
		Notes:     "系统预设初始超级管理员",
		UpdatedAt: time.Now(),
	}
	s.users[defaultAdmin.ID] = defaultAdmin
	s.saveUsersLocked()
}

func (s *Store) saveUsersLocked() error {
	list := make([]*models.UserAccount, 0, len(s.users))
	for _, u := range s.users {
		list = append(list, u)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.userFilePath, data, 0644)
}

func (s *Store) loadTelemetry() {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.telemPath)
	if err == nil && len(data) > 0 {
		_ = json.Unmarshal(data, &s.telemetry)
	}
}

func (s *Store) saveTelemetryLocked() error {
	data, err := json.MarshalIndent(s.telemetry, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.telemPath, data, 0644)
}

// GetUsers returns all users
func (s *Store) GetUsers() []*models.UserAccount {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*models.UserAccount, 0, len(s.users))
	for _, u := range s.users {
		result = append(result, u)
	}
	return result
}

// GetUserByID returns user by ID
func (s *Store) GetUserByID(id string) (*models.UserAccount, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	u, ok := s.users[id]
	return u, ok
}

// FindUserByUsername finds by handle or name
func (s *Store) FindUserByUsername(username string) (*models.UserAccount, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	clean := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	for _, u := range s.users {
		h := strings.ToLower(strings.TrimPrefix(u.Handle, "@"))
		n := strings.ToLower(u.Name)
		if h == clean || n == clean {
			return u, true
		}
	}
	return nil, false
}

func generateID() string {
	bytes := make([]byte, 4)
	_, _ = rand.Read(bytes)
	return fmt.Sprintf("u_%d_%s", time.Now().UnixMilli(), hex.EncodeToString(bytes))
}

// CreateUser adds a new user
func (s *Store) CreateUser(req models.CreateUserRequest) (*models.UserAccount, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cleanHandle := strings.TrimSpace(req.Handle)
	if !strings.HasPrefix(cleanHandle, "@") {
		cleanHandle = "@" + cleanHandle
	}

	role := req.Role
	roleLabel := "普通用户"

	// 如果未指定角色，检测是否为首位自主注册者
	if role == "" {
		hasOtherAdmins := false
		for _, ex := range s.users {
			if ex.Role == "admin" && ex.ID != "u_admin" {
				hasOtherAdmins = true
				break
			}
		}
		if !hasOtherAdmins {
			role = "admin"
			roleLabel = "开发者"
			if req.Notes == "" {
				req.Notes = "系统首位注册开发者 (自动获得开发者后台权限)"
			}
			if req.Credits < 9999 {
				req.Credits = 9999
			}
		} else {
			role = "user"
			roleLabel = "普通用户"
		}
	} else if role == "admin" {
		roleLabel = "开发者"
	} else if role == "vip" {
		roleLabel = "VIP用户"
	}

	status := req.Status
	if status == "" {
		status = "active"
	}

	credits := req.Credits
	if credits <= 0 {
		credits = 100
	}

	u := &models.UserAccount{
		ID:        generateID(),
		Name:      strings.TrimSpace(req.Name),
		Handle:    cleanHandle,
		Email:     strings.TrimSpace(req.Email),
		Password:  strings.TrimSpace(req.Password),
		Credits:   credits,
		Role:      role,
		RoleLabel: roleLabel,
		Status:    status,
		CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
		Notes:     strings.TrimSpace(req.Notes),
		UpdatedAt: time.Now(),
	}

	s.users[u.ID] = u
	_ = s.saveUsersLocked()
	return u, nil
}

// UpdateUser updates user fields
func (s *Store) UpdateUser(id string, req models.UpdateUserRequest) (*models.UserAccount, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, ok := s.users[id]
	if !ok {
		return nil, fmt.Errorf("user not found")
	}

	if req.Name != "" {
		u.Name = strings.TrimSpace(req.Name)
	}
	if req.Handle != "" {
		h := strings.TrimSpace(req.Handle)
		if !strings.HasPrefix(h, "@") {
			h = "@" + h
		}
		u.Handle = h
	}
	if req.Email != "" {
		u.Email = strings.TrimSpace(req.Email)
	}
	if req.Password != "" {
		u.Password = strings.TrimSpace(req.Password)
	}
	if req.Role != "" {
		u.Role = req.Role
		if u.Role == "admin" {
			u.RoleLabel = "管理员"
		} else if u.Role == "vip" {
			u.RoleLabel = "VIP用户"
		} else {
			u.RoleLabel = "普通用户"
		}
	}
	if req.Status != "" {
		u.Status = req.Status
	}
	if req.Credits != nil {
		u.Credits = *req.Credits
	}
	if req.Notes != "" {
		u.Notes = strings.TrimSpace(req.Notes)
	}
	u.UpdatedAt = time.Now()

	_ = s.saveUsersLocked()
	return u, nil
}

// DeleteUser removes a user
func (s *Store) DeleteUser(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.users[id]; ok {
		delete(s.users, id)
		_ = s.saveUsersLocked()
		return true
	}
	return false
}

// AddTelemetry records a telemetry item
func (s *Store) AddTelemetry(item *models.TelemetryLog) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if item.ID == "" {
		item.ID = fmt.Sprintf("req_%d", time.Now().UnixNano())
	}
	if item.Timestamp == 0 {
		item.Timestamp = time.Now().UnixMilli()
	}
	if item.TimeString == "" {
		item.TimeString = time.Now().Format("2006-01-02 15:04:05")
	}

	// Keep newest first, max 1000 items
	s.telemetry = append([]*models.TelemetryLog{item}, s.telemetry...)
	if len(s.telemetry) > 1000 {
		s.telemetry = s.telemetry[:1000]
	}
	_ = s.saveTelemetryLocked()
}

// GetTelemetry returns logs
func (s *Store) GetTelemetry() []*models.TelemetryLog {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*models.TelemetryLog, len(s.telemetry))
	copy(result, s.telemetry)
	return result
}

// ClearTelemetry removes all logs
func (s *Store) ClearTelemetry() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.telemetry = make([]*models.TelemetryLog, 0)
	_ = s.saveTelemetryLocked()
}
