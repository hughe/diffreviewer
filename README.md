# DiffReviewer

A standalone CLI tool for reviewing git diffs with a web UI and markdown notes export.

## Status

✅ **Working** - Core functionality complete and tested

### Features

- ✅ Side-by-side diff viewing with Monaco Editor
- ✅ Syntax highlighting for all file types
- ✅ File navigation with statistics (+/- lines)
- ✅ General notes with auto-save
- ✅ Notes export to markdown file or stdout
- ✅ Graceful shutdown with notes persistence
- ✅ Single binary distribution with embedded web assets

### Coming Soon

- Line-specific notes with Monaco integration
- File editing and saving
- Keyboard shortcuts for navigation
- Dark mode support

## Project Structure

```
diffreviewer/
├── cmd/diffreviewer/       # CLI entry point
├── internal/               # Internal packages
│   ├── server/            # HTTP server
│   ├── git/               # Git operations
│   ├── notes/             # Notes management
│   └── handlers/          # HTTP handlers
├── web/                   # Frontend (TypeScript/Lit/Vite)
│   ├── src/
│   │   ├── components/   # Web components
│   │   └── services/     # API services
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── Makefile              # Build system
└── go.mod               # Go module
```

## Installation

### From Source

```bash
cd diffreviewer
make build

# Binary will be at bin/diffreviewer
# Optionally, install to /usr/local/bin:
make install
```

### Requirements

- Go 1.21 or later (for building)
- Node.js 18 or later (for frontend build)
- npm (comes with Node.js)

## Usage

### Basic Usage

```bash
# Compare current branch to main
diffreviewer my-feature-branch

# Compare two specific branches
diffreviewer main feature-branch

# Compare with commit hash
diffreviewer abc1234 feature-branch
```

### With Notes File

```bash
# Save notes to a markdown file
diffreviewer --notes review-notes.md feature-branch

# Notes will be saved when you click "Done" or press Ctrl+C
```

### Without Notes File (Stdout)

```bash
# Print notes to stdout on exit
diffreviewer feature-branch

# Notes will be printed when you click "Done"
```

### Advanced Options

```bash
# Custom port (default: 8000)
diffreviewer --port 8080 feature-branch

# Custom repository path (default: current directory)
diffreviewer --repo /path/to/repo feature-branch

# Full example
diffreviewer --port 8080 --notes review.md --repo ~/projects/myapp main feature-branch
```

**Important:** Flags must come *before* positional arguments!

### CLI Help

```bash
diffreviewer -h
```

## Workflow

1. **Start the server:**
   ```bash
   diffreviewer --notes review.md my-feature-branch
   ```
   
2. **Open your browser** to http://localhost:8000

3. **Review the diff:**
   - Use the dropdown to navigate between files
   - View side-by-side diff with syntax highlighting
   - See file statistics (additions/deletions)

4. **Add notes:**
   - Type general review notes in the textarea at the bottom
   - Notes auto-save as you type
   - Click "Show Notes" to see the notes panel

5. **Finish:**
   - Click the green "Done" button
   - Notes are exported to the markdown file
   - Server shuts down gracefully

## Notes Format

The exported notes file uses markdown format:

```markdown
# Diff Review Notes

## General Notes

Your review notes appear here.
Multiple lines are preserved.
```

## Building

```bash
# Build both frontend and backend
make build

# Build frontend only
make build-frontend

# Build backend only
make build-backend

# Clean build artifacts
make clean

# Development mode (frontend dev server)
make dev
```

The build process:
1. Compiles TypeScript and bundles with Vite
2. Copies web assets to cmd/diffreviewer/web-dist/
3. Embeds web assets into Go binary
4. Produces single executable: `bin/diffreviewer`


## Architecture

### Backend (Go)

- **Git Operations:** Uses git commands to generate diffs and fetch file contents
- **HTTP Server:** Serves web UI and API endpoints
- **Notes Storage:** In-memory storage with markdown export on shutdown
- **Embedded Assets:** Web UI bundled into binary for single-file distribution

### Frontend (TypeScript + Lit + Monaco Editor)

- **Lit Web Components:** Lightweight reactive components
- **Monaco Editor:** Full-featured code editor with diff view
- **Vite:** Fast build tool with hot module replacement
- **Tailwind CSS:** Utility-first CSS framework

### API Endpoints

- `GET /api/diff` - List of changed files
- `GET /api/file-content?hash=<hash>` - File content by git hash
- `POST /api/save-file` - Save edited file (future feature)
- `GET /api/notes` - Get all notes
- `POST /api/notes` - Add/update line note (future feature)
- `DELETE /api/notes` - Delete line note (future feature)
- `GET /api/general-notes` - Get general notes
- `POST /api/general-notes` - Update general notes
- `POST /api/shutdown` - Trigger graceful shutdown

## Testing

See [TESTING_NOTES.md](TESTING_NOTES.md) for detailed test results and status.

## Troubleshooting

### Port Already in Use

```bash
# Use a different port
diffreviewer --port 8080 feature-branch
```

### Browser Doesn't Open

Manually navigate to http://localhost:8000 (or your custom port)

### Git Branch Not Found

Make sure you're in a git repository and the branch exists:
```bash
git branch  # list local branches
git branch -r  # list remote branches
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

## License

MIT License - see LICENSE file for details.

## Project Status

For detailed implementation status and TODO items, see:
- [diffreviewer-todo.md](../diffreviewer-todo.md) - Full implementation plan
- [TESTING_NOTES.md](TESTING_NOTES.md) - Test results and current status
