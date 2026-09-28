package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	Port            string
	DataDir         string
	DeepSeekAPIKey  string
	DeepSeekBaseURL string
	ImgBBAPIKey     string
	StaticDir       string
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}
	_ = os.MkdirAll(dataDir, 0755)

	deepSeekBaseURL := os.Getenv("DEEPSEEK_BASE_URL")
	if deepSeekBaseURL == "" {
		deepSeekBaseURL = "https://api.deepseek.com"
	}

	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = filepath.Join("..", "dist")
	}

	return &Config{
		Port:            port,
		DataDir:         dataDir,
		DeepSeekAPIKey:  os.Getenv("DEEPSEEK_API_KEY"),
		DeepSeekBaseURL: deepSeekBaseURL,
		ImgBBAPIKey:     os.Getenv("IMGBB_API_KEY"),
		StaticDir:       staticDir,
	}
}
