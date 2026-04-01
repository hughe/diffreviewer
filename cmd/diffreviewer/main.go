package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/hughe/diffreviewer/internal/git"
	"github.com/hughe/diffreviewer/internal/handlers"
	"github.com/hughe/diffreviewer/internal/notes"
)

// NOTE: web-dist directory is created during build (make build-backend)
//
//go:embed all:web-dist
var webDist embed.FS

// openBrowserWindow opens the URL in a new browser window (not a tab).
// Best-effort: failures are silently ignored.
func openBrowserWindow(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		// AppleScript tells the default browser to open a new window
		cmd = exec.Command("osascript", "-e",
			fmt.Sprintf(`tell application "System Events" to set frontApp to name of first application process whose frontmost is true
tell application frontApp to open location %q`, url))
		// Fallback: just use 'open' which often opens a new window
		if err := cmd.Start(); err != nil {
			exec.Command("open", url).Start()
		}
		return
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	default: // linux, freebsd, etc.
		// Try common browsers with --new-window, fall back to xdg-open
		for _, browser := range []string{"google-chrome", "chromium-browser", "chromium", "firefox"} {
			if path, err := exec.LookPath(browser); err == nil {
				exec.Command(path, "--new-window", url).Start()
				return
			}
		}
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}

// tryFindPort attempts to find an available port in the range 2000-10000
func tryFindPort() (int, error) {
	const (
		minPort = 2000
		maxPort = 10000
		maxTries = 50
	)

	tried := make(map[int]bool)
	for i := 0; i < maxTries; i++ {
		port := minPort + rand.Intn(maxPort-minPort+1)
		if tried[port] {
			continue
		}
		tried[port] = true

		// Try to bind to this port
		listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			listener.Close()
			return port, nil
		}
	}

	return 0, fmt.Errorf("could not find available port after %d attempts", maxTries)
}

func main() {
	var (
		port          = flag.Int("port", 8000, "Port number")
		notesFile     = flag.String("notes", "", "Notes file path (optional, if not specified notes go to stdout)")
		repoDir       = flag.String("repo", ".", "Repository path")
		noBrowser     = flag.Bool("no-browser", false, "Don't open browser automatically")
		baseCommit    string
		changedCommit string
	)

	flag.Parse()

	// Track if port was explicitly set by user
	portExplicitlySet := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == "port" {
			portExplicitlySet = true
		}
	})

	// Get commits from remaining args
	args := flag.Args()

	// If no args provided, default to HEAD~1..HEAD
	if len(args) == 0 {
		// Resolve HEAD~1 as base
		base, err := git.ResolveRef(*repoDir, "HEAD~1")
		if err != nil {
			log.Fatalf("Failed to resolve HEAD~1: %v", err)
		}
		baseCommit = base

		// Resolve HEAD as changed
		changed, err := git.ResolveRef(*repoDir, "HEAD")
		if err != nil {
			log.Fatalf("Failed to resolve HEAD: %v", err)
		}
		changedCommit = changed
	} else if len(args) == 1 {
		// Only base commit provided, compare to working directory (CURRENT)
		base, err := git.ResolveRef(*repoDir, args[0])
		if err != nil {
			log.Fatalf("Invalid base ref %q: %v", args[0], err)
		}
		baseCommit = base

		// Empty string signals working directory comparison
		changedCommit = ""
	} else {
		// Both commits provided
		base, err := git.ResolveRef(*repoDir, args[0])
		if err != nil {
			log.Fatalf("Invalid base ref %q: %v", args[0], err)
		}
		baseCommit = base

		changed, err := git.ResolveRef(*repoDir, args[1])
		if err != nil {
			log.Fatalf("Invalid changed ref %q: %v", args[1], err)
		}
		changedCommit = changed
	}

	// Create notes storage
	notesStorage := notes.NewStorage(*notesFile)

	// Create shutdown channel
	shutdownChan := make(chan struct{})

	// Create handler config
	cfg := &handlers.Config{
		RepoDir:       *repoDir,
		BaseCommit:    baseCommit,
		ChangedCommit: changedCommit,
		NotesStorage:  notesStorage,
		ShutdownChan:  shutdownChan,
	}

	// Set up HTTP routes
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/diff", handlers.HandleDiff(cfg))
	mux.HandleFunc("/api/file-content", handlers.HandleFileContent(cfg))
	mux.HandleFunc("/api/save-file", handlers.HandleSaveFile(cfg))
	mux.HandleFunc("/api/commits", handlers.HandleCommitHistory(cfg))
	mux.HandleFunc("/api/base-commit", handlers.HandleBaseCommit(cfg))
	mux.HandleFunc("/api/notes", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.HandleGetNotes(cfg)(w, r)
		case http.MethodPost:
			handlers.HandleAddOrUpdateNote(cfg)(w, r)
		case http.MethodDelete:
			handlers.HandleDeleteNote(cfg)(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/general-notes", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.HandleGetGeneralNotes(cfg)(w, r)
		case http.MethodPost:
			handlers.HandleUpdateGeneralNotes(cfg)(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/shutdown", handlers.HandleShutdown(cfg))

	// Serve embedded web files
	distFS, err := fs.Sub(webDist, "web-dist")
	if err != nil {
		log.Fatal(err)
	}
	mux.Handle("/", http.FileServer(http.FS(distFS)))

	// Determine which port to use
	actualPort := *port

	// Create HTTP server
	addr := fmt.Sprintf(":%d", actualPort)
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		select {
		case <-shutdownChan:
			fmt.Fprintln(os.Stderr, "\nShutdown requested via API...")
		case <-sigChan:
			fmt.Fprintln(os.Stderr, "\nShutdown signal received...")
		}

		// Write notes to stdout or file
		if *notesFile == "" {
			fmt.Println(strings.Repeat("=", 80))
			notesStorage.WriteToStdout()
			fmt.Println(strings.Repeat("=", 80))
		} else {
			fmt.Fprintf(os.Stderr, "Notes saved to: %s\n", *notesFile)
		}

		// Shutdown server
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("Server shutdown error: %v", err)
		}
	}()

	// Try to start server, with port retry if needed
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		// If port was not explicitly set and we failed to bind, try random ports
		if !portExplicitlySet {
			newPort, findErr := tryFindPort()
			if findErr != nil {
				log.Fatalf("Failed to find available port: %v", findErr)
			}
			actualPort = newPort
			addr = fmt.Sprintf(":%d", actualPort)
			server.Addr = addr
			listener, err = net.Listen("tcp", addr)
			if err != nil {
				log.Fatalf("Failed to start server on port %d: %v", actualPort, err)
			}
		} else {
			log.Fatalf("Failed to start server on port %d: %v", actualPort, err)
		}
	}

	fmt.Fprintf(os.Stderr, "DiffReviewer starting on http://localhost:%d\n", actualPort)
	if changedCommit == "" {
		fmt.Fprintf(os.Stderr, "Comparing %s...CURRENT (working directory)\n", baseCommit[:8])
	} else {
		fmt.Fprintf(os.Stderr, "Comparing %s...%s\n", baseCommit[:8], changedCommit[:8])
	}
	if *notesFile != "" {
		fmt.Fprintf(os.Stderr, "Notes will be saved to: %s\n", *notesFile)
	} else {
		fmt.Fprintln(os.Stderr, "Notes will be printed to stdout on exit")
	}

	if !*noBrowser {
		serverURL := fmt.Sprintf("http://localhost:%d", actualPort)
		openBrowserWindow(serverURL)
	}

	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
