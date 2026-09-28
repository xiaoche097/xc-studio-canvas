package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"xcai-server/internal/config"
	"xcai-server/internal/handlers"
	"xcai-server/internal/middleware"
	"xcai-server/internal/store"
)

func main() {
	cfg := config.Load()

	st, err := store.New(cfg.DataDir)
	if err != nil {
		log.Fatalf("Failed to initialize data store: %v", err)
	}

	// Handlers
	healthH := handlers.NewHealthHandler()
	userH := handlers.NewUserHandler(st)
	deepseekH := handlers.NewDeepSeekHandler(cfg)
	imageDownloadH := handlers.NewImageDownloadHandler()
	imgbbH := handlers.NewImgBBHandler(cfg)
	virseH := handlers.NewVirseHandler()
	telemetryH := handlers.NewTelemetryHandler(st)

	mux := http.NewServeMux()

	// API Routes
	mux.HandleFunc("GET /api/health", healthH.Health)

	// Auth & Users
	mux.HandleFunc("POST /api/auth/login", userH.Login)
	mux.HandleFunc("GET /api/users", userH.ListUsers)
	mux.HandleFunc("POST /api/users", userH.CreateUser)
	mux.HandleFunc("PUT /api/users/{id}", userH.UpdateUser)
	mux.HandleFunc("DELETE /api/users/{id}", userH.DeleteUser)

	// AI Proxies & Relays
	mux.HandleFunc("POST /api/deepseek/chat", deepseekH.Chat)
	mux.HandleFunc("GET /api/image-download", imageDownloadH.Download)
	mux.HandleFunc("GET /api/imgbb", imgbbH.Upload)
	mux.HandleFunc("POST /api/imgbb", imgbbH.Upload)
	mux.HandleFunc("POST /api/virse", virseH.Handle)

	// Telemetry & Logs
	mux.HandleFunc("GET /api/telemetry/logs", telemetryH.GetLogs)
	mux.HandleFunc("POST /api/telemetry/logs", telemetryH.RecordLog)
	mux.HandleFunc("DELETE /api/telemetry/logs", telemetryH.ClearLogs)

	// Optional Static File Serving for Standalone Mode
	if info, err := os.Stat(cfg.StaticDir); err == nil && info.IsDir() {
		fs := http.FileServer(http.Dir(cfg.StaticDir))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			path := filepath.Join(cfg.StaticDir, r.URL.Path)
			if _, err := os.Stat(path); os.IsNotExist(err) {
				http.ServeFile(w, r, filepath.Join(cfg.StaticDir, "index.html"))
				return
			}
			fs.ServeHTTP(w, r)
		})
	}

	handler := middleware.Chain(mux, middleware.Logger, middleware.CORS, middleware.Recoverer)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 180 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("=====================================================")
		log.Printf("🚀 XC-AI Go 真实后端服务正在启动...")
		log.Printf("📡 监听地址: http://0.0.0.0:%s", cfg.Port)
		log.Printf("📁 数据目录: %s", cfg.DataDir)
		log.Printf("✨ 接口就绪: /api/health, /api/users, /api/auth/login,")
		log.Printf("           /api/deepseek/chat, /api/image-download,")
		log.Printf("           /api/virse, /api/imgbb, /api/telemetry/logs")
		log.Printf("=====================================================")

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server listen error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Printf("正在平滑关闭服务...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Printf("服务已安全退出。")
}
