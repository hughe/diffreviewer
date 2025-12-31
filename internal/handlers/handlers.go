package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/hughe/diffreviewer/internal/git"
	"github.com/hughe/diffreviewer/internal/notes"
)

// Config holds the configuration for handlers
type Config struct {
	RepoDir       string
	BaseCommit    string
	ChangedCommit string
	NotesStorage  *notes.Storage
	ShutdownChan  chan struct{}
}

// HandleDiff returns the diff between commits
// Supports optional query parameters 'from' and 'to' to override defaults
func HandleDiff(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Allow override via query parameters
		fromCommit := r.URL.Query().Get("from")
		toCommit := r.URL.Query().Get("to")

		if fromCommit == "" {
			fromCommit = cfg.BaseCommit
		} else {
			// Resolve the provided ref
			resolved, err := git.ResolveRef(cfg.RepoDir, fromCommit)
			if err != nil {
				http.Error(w, fmt.Sprintf("Invalid from ref: %v", err), http.StatusBadRequest)
				return
			}
			fromCommit = resolved
		}

		if toCommit == "" {
			toCommit = cfg.ChangedCommit
		} else if toCommit == "CURRENT" {
			// CURRENT means compare against working directory
			// Git diff will compare against working directory if we pass empty string
			toCommit = ""
		} else {
			// Resolve the provided ref
			resolved, err := git.ResolveRef(cfg.RepoDir, toCommit)
			if err != nil {
				http.Error(w, fmt.Sprintf("Invalid to ref: %v", err), http.StatusBadRequest)
				return
			}
			toCommit = resolved
		}


		files, err := git.GetDiff(cfg.RepoDir, fromCommit, toCommit)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get diff: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(files)
	}
}

// HandleFileContent returns file content by git hash
func HandleFileContent(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		hash := r.URL.Query().Get("hash")
		path := r.URL.Query().Get("path")

		if hash == "" {
			http.Error(w, "hash parameter required", http.StatusBadRequest)
			return
		}

		content, err := git.GetFileContent(cfg.RepoDir, hash, path)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get file content: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(content))
	}
}

// HandleSaveFile saves edited file content
func HandleSaveFile(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		filePath := filepath.Join(cfg.RepoDir, req.Path)
		if err := os.WriteFile(filePath, []byte(req.Content), 0644); err != nil {
			http.Error(w, fmt.Sprintf("Failed to save file: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

// HandleGetNotes returns all notes
func HandleGetNotes(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		lineNotes, generalNotes := cfg.NotesStorage.GetAll()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"lineNotes":    lineNotes,
			"generalNotes": generalNotes,
		})
	}
}

// HandleAddOrUpdateNote adds or updates a line note
func HandleAddOrUpdateNote(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var note notes.Note
		if err := json.NewDecoder(r.Body).Decode(&note); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := cfg.NotesStorage.AddOrUpdate(note); err != nil {
			http.Error(w, fmt.Sprintf("Failed to save note: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

// HandleDeleteNote deletes a line note
func HandleDeleteNote(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			File string `json:"file"`
			Line int    `json:"line"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := cfg.NotesStorage.Delete(req.File, req.Line); err != nil {
			http.Error(w, fmt.Sprintf("Failed to delete note: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

// HandleGetGeneralNotes returns general notes
func HandleGetGeneralNotes(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		text := cfg.NotesStorage.GetGeneralNotes()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"text": text,
		})
	}
}

// HandleUpdateGeneralNotes updates general notes
func HandleUpdateGeneralNotes(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Text string `json:"text"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := cfg.NotesStorage.UpdateGeneralNotes(req.Text); err != nil {
			http.Error(w, fmt.Sprintf("Failed to update general notes: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

// HandleShutdown triggers graceful shutdown
func HandleShutdown(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			GeneralNotes string `json:"generalNotes"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Update general notes before shutdown
		if err := cfg.NotesStorage.UpdateGeneralNotes(req.GeneralNotes); err != nil {
			http.Error(w, fmt.Sprintf("Failed to update notes: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Shutting down...",
		})

		// Trigger shutdown after response is sent
		go func() {
			close(cfg.ShutdownChan)
		}()
	}
}

// HandleNotFound serves a custom 404 for API routes
func HandleNotFound() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Not Found",
		})
	}
}

// Helper to get int query param
func getIntQueryParam(r *http.Request, name string, defaultValue int) int {
	val := r.URL.Query().Get(name)
	if val == "" {
		return defaultValue
	}
	if i, err := strconv.Atoi(val); err == nil {
		return i
	}
	return defaultValue
}

// HandleCommitHistory returns the commit history (mimics Sketch's /git/recentlog)
func HandleCommitHistory(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Get initialCommit from query, default to base commit from config
		initialCommit := r.URL.Query().Get("initialCommit")
		if initialCommit == "" {
			initialCommit = cfg.BaseCommit
		}

		commits, err := git.GetCommitHistory(cfg.RepoDir, initialCommit)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get commit history: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(commits)
	}
}

// HandleBaseCommit returns the base commit reference
func HandleBaseCommit(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		baseRef, err := git.GetBaseCommitRef(cfg.RepoDir)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get base commit: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"base_commit": baseRef,
		})
	}
}
