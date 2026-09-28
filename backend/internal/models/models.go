package models

import "time"

// UserAccount represents a platform user account
type UserAccount struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Handle    string    `json:"handle"`
	Email     string    `json:"email"`
	Password  string    `json:"password,omitempty"` // Included in admin views, omitted in public tokens
	Avatar    string    `json:"avatar,omitempty"`
	Credits   int       `json:"credits"`
	Role      string    `json:"role"` // "admin" | "user" | "vip"
	RoleLabel string    `json:"roleLabel"`
	Status    string    `json:"status"` // "active" | "disabled"
	CreatedAt string    `json:"createdAt"`
	Notes     string    `json:"notes,omitempty"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CreateUserRequest payload for creating a new user
type CreateUserRequest struct {
	Name     string `json:"name"`
	Handle   string `json:"handle"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
	Status   string `json:"status"`
	Credits  int    `json:"credits"`
	Notes    string `json:"notes"`
}

// UpdateUserRequest payload for editing an existing user
type UpdateUserRequest struct {
	Name     string `json:"name,omitempty"`
	Handle   string `json:"handle,omitempty"`
	Email    string `json:"email,omitempty"`
	Password string `json:"password,omitempty"`
	Role     string `json:"role,omitempty"`
	Status   string `json:"status,omitempty"`
	Credits  *int   `json:"credits,omitempty"`
	Notes    string `json:"notes,omitempty"`
}

// LoginRequest credentials
type LoginRequest struct {
	Username string `json:"username,omitempty"`
	Handle   string `json:"handle,omitempty"`
	Password string `json:"password"`
}

// LoginResponse auth response
type LoginResponse struct {
	Success bool         `json:"success"`
	Message string       `json:"message,omitempty"`
	Token   string       `json:"token,omitempty"`
	User    *UserAccount `json:"user,omitempty"`
}

// TelemetryLog audit and performance log item
type TelemetryLog struct {
	ID               string                 `json:"id"`
	Timestamp        int64                  `json:"timestamp"`
	TimeString       string                 `json:"timeString"`
	UserID           string                 `json:"userId"`
	UserName         string                 `json:"userName"`
	UserHandle       string                 `json:"userHandle"`
	ModelID          string                 `json:"modelId"`
	ModelName        string                 `json:"modelName"`
	ChannelID        string                 `json:"channelId"`
	ChannelName      string                 `json:"channelName"`
	Capability       string                 `json:"capability"`
	Status           string                 `json:"status"` // "success" | "error"
	HTTPStatus       int                    `json:"httpStatus"`
	LatencyMs        int64                  `json:"latencyMs"`
	TokensPrompt     int                    `json:"tokensPrompt"`
	TokensCompletion int                    `json:"tokensCompletion"`
	TokensCached     int                    `json:"tokensCached"`
	CostCredits      int                    `json:"costCredits"`
	ErrorMessage     string                 `json:"errorMessage,omitempty"`
	RequestPayload   map[string]interface{} `json:"requestPayload,omitempty"`
	ResponsePreview  string                 `json:"responsePreview,omitempty"`
}

// DeepSeekRelayRequest wrapper from frontend
type DeepSeekRelayRequest struct {
	APIKey  string                 `json:"apiKey"`
	BaseURL string                 `json:"baseUrl"`
	Request map[string]interface{} `json:"request"`
}

// ImgBBRelayRequest wrapper for image upload
type ImgBBRelayRequest struct {
	Key        string `json:"key"`
	Image      string `json:"image"`
	Name       string `json:"name,omitempty"`
	Expiration int    `json:"expiration,omitempty"`
}
