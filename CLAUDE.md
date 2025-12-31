# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DiffReviewer is a standalone CLI tool that displays git diffs in a web UI with Monaco Editor. It allows code reviewers to navigate diffs, edit files, and add notes that export to markdown. The tool runs as a local HTTP server serving an embedded web UI (TypeScript/Lit/Monaco).

**Key Architecture**: Single binary with embedded frontend assets. Backend is Go with no external dependencies; frontend is TypeScript/Lit bundled with Vite.

## Build Commands

```bash
# Full build (frontend + backend)
make build

# Frontend only (Node.js + Vite)
make build-frontend

# Backend only (Go + embed assets)
make build-backend

# Development mode (frontend hot reload)
make dev

# Clean all artifacts
make clean

# Install to /usr/local/bin
make install

# Run tests
make test
```

### Build Process Details

1. Frontend build creates `web/dist/` with bundled JS/CSS
2. `build-backend` copies `web/dist/` → `cmd/diffreviewer/web-dist/`
3. Go's `//go:embed all:web-dist` embeds assets into binary
4. Final artifact: `bin/diffreviewer` (single executable)

**Important**: The `cmd/diffreviewer/web-dist/` directory is created during build. You'll see `pattern all:web-dist: no matching files found` error if running `go build` before `make build-frontend` - this is expected.

## Running & Testing

```bash
# Compare current branch to HEAD~1 (default)
./bin/diffreviewer

# Compare specific commits/branches
./bin/diffreviewer main feature-branch
./bin/diffreviewer abc1234 def5678

# Save notes to file
./bin/diffreviewer --notes review.md feature-branch

# Custom port
./bin/diffreviewer --port 8080 feature-branch

# Notes to stdout (default if --notes not specified)
./bin/diffreviewer feature-branch
```

**Flags must come before positional arguments!**

## Code Architecture

### Backend (Go)

**Package Structure:**
- `cmd/diffreviewer/main.go` - CLI entry point, HTTP server setup, graceful shutdown
- `internal/git/diff.go` - Git operations (diff, file content, commit history, ref resolution)
- `internal/handlers/handlers.go` - HTTP API handlers
- `internal/notes/notes.go` - Notes storage and markdown export

**Key Patterns:**
- All git commands use `exec.Command("git", "-C", repoDir, ...)` for consistent repo path handling
- File content for working directory uses hash `0000000000000000000000000000000000000000` as special marker
- Graceful shutdown via channel: `shutdownChan` closes → writes notes → server.Shutdown()
- Notes output: file if `--notes` specified, stdout otherwise (with separator lines)

**API Endpoints:**
- `GET /api/diff?from=<hash>&to=<hash>` - Returns `DiffFile[]` (supports override via query params)
- `GET /api/file-content?hash=<hash>&path=<path>` - Returns file content (hash or working directory)
- `POST /api/save-file` - Save edited file to working directory
- `GET /api/commits?initialCommit=<hash>` - Returns commit history (max 50)
- `GET /api/base-commit` - Returns HEAD commit hash
- `GET /api/notes` - Returns `{lineNotes: Note[], generalNotes: string}`
- `POST /api/notes` - Add/update line note
- `DELETE /api/notes` - Delete line note
- `GET /api/general-notes` - Returns `{text: string}`
- `POST /api/general-notes` - Update general notes
- `POST /api/shutdown` - Trigger graceful shutdown (saves notes first)

### Frontend (TypeScript/Lit)

**Component Structure:**
- `app-shell.ts` - Main app container, manages general notes and shutdown
- `diff-viewer.ts` - File selector, diff loading, file switching
- `monaco-view.ts` - Monaco diff editor wrapper with inline note popups
- `range-picker.ts` - Commit range selection dropdown
- `general-notes-input.ts` - Auto-saving textarea for review notes
- `done-button.ts` - Graceful shutdown button
- `diffreviewer-element.ts` - Base element (disables Shadow DOM for Monaco CSS)

**Key Patterns:**
- **Shadow DOM disabled**: All components extend `DiffReviewerElement` which returns `this` from `createRenderRoot()`. This allows global CSS (including Monaco styles) to reach component internals. Component styles must be in `web/src/styles.css` with scoped selectors.
- **Monaco integration**: Loaded via dynamic `import('monaco-editor')`, created with `createDiffEditor()`
- **Inline notes**: Click glyph margin → popup appears → note formatted as `@file:line\n\`\`\`\nlineContent\n\`\`\`\nnoteText` → appended to general notes
- **File editing**: Modified editor is editable, Cmd/Ctrl+S triggers save via `monaco-save` event
- **Reactivity workaround**: With Shadow DOM disabled, property binding doesn't always trigger updates. Use direct method calls (e.g., `diffViewer.loadDiffForRange(range)`) and explicit `requestUpdate()` calls after state changes.

**Services:**
- `services/api.ts` - API client with typed functions (fetchDiff, fetchFileContent, saveFile, shutdown, etc.)
- `services/notes.ts` - Notes API client (fetchNotes, addNote, updateGeneralNotes)

### Build Configuration

**Frontend (`web/vite.config.ts`):**
- `cssCodeSplit: false` - Critical! Prevents Monaco CSS from being split into separate file
- `build.rollupOptions.output.entryFileNames/chunkFileNames/assetFileNames` - Disable hashing for predictable filenames
- Monaco loaded via dynamic import in component

**Why cssCodeSplit: false?**
Vite's default CSS code-splitting extracts Monaco CSS into a separate bundle that isn't linked in HTML. Setting `cssCodeSplit: false` ensures all CSS is in a single file that's properly loaded.

## Common Development Tasks

### Adding a New API Endpoint

1. Add handler function in `internal/handlers/handlers.go`
2. Register route in `cmd/diffreviewer/main.go` (mux.HandleFunc)
3. Add corresponding function in `web/src/services/api.ts`
4. Update TypeScript types in `web/src/types.ts` if needed

### Modifying Git Operations

Edit `internal/git/diff.go`. Key functions:
- `GetDiff()` - Runs `git diff --raw` + `git diff --numstat`, parses into `DiffFile[]`
- `GetFileContent()` - Runs `git show <hash>` or reads working directory
- `ResolveRef()` - Converts branch/tag/ref to commit hash
- `GetCommitHistory()` - Returns recent commits for range picker

### Frontend Component Changes

1. Edit component in `web/src/components/`
2. Remember: no Shadow DOM, so styles go in `web/src/styles.css` with scoped selectors
3. Use `this.requestUpdate()` after state changes if reactivity isn't working
4. Rebuild frontend: `make build-frontend`
5. Rebuild backend to embed new assets: `make build-backend`

### Monaco Editor Customization

Edit `web/src/components/monaco-view.ts`:
- `initializeEditor()` - Creates diff editor, sets options
- `setupLineClickListener()` - Handles glyph margin clicks for notes
- `initializeGlyphDecorations()` - Adds speech bubble decorations to every line
- `toggleGlyphVisibility()` - Shows/hides speech bubble on hover

Monaco CSS must be loaded globally (already configured in `main.ts` and `vite.config.ts`).

## Important Constraints

1. **No Shadow DOM**: Components don't use Shadow DOM to allow Monaco CSS to reach editor elements. All component styles must be in global CSS with proper scoping.

2. **Embedded Assets**: Frontend assets are embedded at compile time via `//go:embed`. After changing frontend, you must rebuild backend to update the binary.

3. **CSS Code Splitting**: Must remain disabled in Vite config or Monaco styles won't load.

4. **Working Directory Files**: Use hash `0000000000000000000000000000000000000000` when fetching from working directory (not committed yet).

5. **Graceful Shutdown**: Always save notes before shutdown. Done button triggers: save general notes → POST /api/shutdown → server writes notes → server.Shutdown().

6. **Relative URLs**: API calls use relative URLs (`./api/...`) for proxy compatibility.

## Relationship to Sketch

DiffReviewer is extracted and simplified from the Sketch project (parent directory). When implementing new features:
- Check Sketch codebase first: `../sketch/git_tools/`, `../sketch/webui/src/components/`
- Monaco integration patterns come from `../sketch/webui/src/components/sketch-monaco-view.ts`
- Tailwind/Shadow DOM pattern from `../sketch/webui/src/components/sketch-tailwind-element.ts`
- Diff parsing logic extracted from Sketch's `git_tools.go`

## Project Status

MVP is complete and working. See `TESTING_NOTES.md` for test results and `diffreviewer.md` for implementation details.

**Working Features:**
- Side-by-side diff viewing with Monaco Editor
- File navigation with statistics
- General notes with auto-save
- Inline notes via glyph margin click
- File editing and saving (Cmd/Ctrl+S)
- Range picker for commit selection
- Markdown export to file or stdout
- Graceful shutdown

**Not Yet Implemented:**
- Keyboard shortcuts (j/k navigation, n for note)
- Dark mode toggle
- Line-specific note jump functionality

## Session Completion Checklist

This project uses **beads** (`bd`) for issue tracking. When ending a work session:

1. Create issues for remaining work: `bd create --title="..." --type=task --priority=2`
2. Run quality gates: `make test`, `make build`
3. Update issue status: `bd close <id>` for completed work
4. Stage and commit code changes: `git add ...`, `git commit -m "..."`
5. Sync beads changes: `bd sync`
6. Push to remote: `git push`
7. Run `bd sync` again to sync beads with remote

**Work is not done until pushed to remote.**

# IMPORTANT: Task Tracking

This project uses **bd** (beads) for issue tracking.  **Do not** use
 markdown files or the todo list.  Run `bd quickstart` to learn how.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

When you commit some changes.  Please add the IDs of the tasks that were closed to the commit message.  E.g., 

```
Closes: bd-123, bd-abc
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. 

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Hand off** - Provide context for next session

**DO NOT PUSH** wait for the human to do a code review.  The human will push.


