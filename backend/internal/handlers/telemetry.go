package handlers

import (
	"encoding/json"
	"net/http"

	"xcai-server/internal/models"
	"xcai-server/internal/store"
)

type TelemetryHandler struct {
	store *store.Store
}

func NewTelemetryHandler(s *store.Store) *TelemetryHandler {
	return &TelemetryHandler{store: s}
}

func (h *TelemetryHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	logs := h.store.GetTelemetry()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(logs)
}

func (h *TelemetryHandler) RecordLog(w http.ResponseWriter, r *http.Request) {
	var item models.TelemetryLog
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, `{"error":"Invalid telemetry JSON"}`, http.StatusBadRequest)
		return
	}

	h.store.AddTelemetry(&item)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(item)
}

func (h *TelemetryHandler) ClearLogs(w http.ResponseWriter, r *http.Request) {
	h.store.ClearTelemetry()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
