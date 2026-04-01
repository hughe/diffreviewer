package git

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// DiffFile represents a file change in a git diff
type DiffFile struct {
	Path      string `json:"path"`
	OldPath   string `json:"old_path"`
	OldMode   string `json:"old_mode"`
	NewMode   string `json:"new_mode"`
	OldHash   string `json:"old_hash"`
	NewHash   string `json:"new_hash"`
	Status    string `json:"status"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
}

// GetDiff returns a structured representation of the Git diff between two branches
// If 'to' is empty, compares 'from' against the working directory
func GetDiff(repoDir, from, to string) ([]DiffFile, error) {
	// Build command arguments based on whether we're comparing to working directory
	var rawArgs, numstatArgs []string

	if to == "" {
		// Compare against working directory (omit 'to' argument)
		rawArgs = []string{"-C", repoDir, "diff", "--raw", "--abbrev=40", "-M", "-C", "--find-copies-harder", from, "--"}
		numstatArgs = []string{"-C", repoDir, "diff", "--numstat", from, "--"}
	} else {
		// Compare two commits
		rawArgs = []string{"-C", repoDir, "diff", "--raw", "--abbrev=40", "-M", "-C", "--find-copies-harder", from, to, "--"}
		numstatArgs = []string{"-C", repoDir, "diff", "--numstat", from, to, "--"}
	}

	rawCmd := exec.Command("git", rawArgs...)
	numstatCmd := exec.Command("git", numstatArgs...)

	rawOut, err := rawCmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("error executing git diff --raw: %w - %s", err, string(rawOut))
	}

	numstatOut, err := numstatCmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("error executing git diff --numstat: %w - %s", err, string(numstatOut))
	}

	files, err := parseRawDiffWithNumstat(string(rawOut), string(numstatOut))
	if err != nil {
		return nil, err
	}

	// When comparing against working directory, also include untracked files
	if to == "" {
		untrackedFiles, err := getUntrackedFiles(repoDir)
		if err != nil {
			return nil, fmt.Errorf("error getting untracked files: %w", err)
		}
		files = append(files, untrackedFiles...)
	}

	return files, nil
}

// GetFileContent returns the content of a file at a specific git hash
// If hash is all zeros (0000000000000000000000000000000000000000), this indicates either:
// - A working directory file (when path is provided) - read from disk
// - A deleted file (when path is empty or file doesn't exist) - return empty content
func GetFileContent(repoDir, hash, path string) (string, error) {
	// Check if hash is all zeros - working directory file or deleted file
	if hash == "0000000000000000000000000000000000000000" {
		if path != "" {
			// Try to read from working directory
			fullPath := filepath.Join(repoDir, path)
			content, err := os.ReadFile(fullPath)
			if err != nil {
				if os.IsNotExist(err) {
					// File was deleted from working directory
					return "", nil
				}
				return "", fmt.Errorf("error reading working directory file: %w", err)
			}
			return string(content), nil
		}
		// No path provided - deleted file
		return "", nil
	}

	cmd := exec.Command("git", "-C", repoDir, "show", hash)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("error executing git show: %w - %s", err, string(out))
	}
	return string(out), nil
}

// ValidateBranch checks if a branch or commit exists in the repository
func ValidateBranch(repoDir, ref string) error {
	cmd := exec.Command("git", "-C", repoDir, "rev-parse", "--verify", ref)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ref %q does not exist", ref)
	}
	return nil
}

// ResolveRef resolves a git reference to its full commit hash
func ResolveRef(repoDir, ref string) (string, error) {
	cmd := exec.Command("git", "-C", repoDir, "rev-parse", ref)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("error resolving ref %q: %w - %s", ref, err, string(out))
	}
	return strings.TrimSpace(string(out)), nil
}

// GitLogEntry represents a commit in git history
type GitLogEntry struct {
	Hash    string   `json:"hash"`    // The full commit hash
	Refs    []string `json:"refs"`    // References (branches, tags) pointing to this commit
	Subject string   `json:"subject"` // The commit subject/message
}

// GetCommitHistory returns the commit history from initialCommit to HEAD
// This mimics Sketch's GitRecentLog functionality
func GetCommitHistory(repoDir, initialCommit string) ([]GitLogEntry, error) {
	if initialCommit == "" {
		return nil, fmt.Errorf("initial commit hash must be provided")
	}

	// Get commit log starting from HEAD, limited by max count
	// We use --max-count to limit results rather than ranges
	args := []string{
		"-C", repoDir,
		"log",
		"--format=%H%x00%D%x00%s",
		"--decorate=full",
		"--max-count=50", // Limit to 50 most recent commits
		"HEAD",
	}

	cmd := exec.Command("git", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("error executing git log: %w - %s", err, string(out))
	}

	var entries []GitLogEntry
	scanner := bufio.NewScanner(strings.NewReader(strings.TrimSpace(string(out))))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, "\x00")
		if len(parts) < 3 {
			continue
		}

		entry := GitLogEntry{
			Hash:    parts[0],
			Subject: parts[2],
		}

		// Parse refs if present
		if parts[1] != "" {
			refs := strings.Split(parts[1], ", ")
			for _, ref := range refs {
				ref = strings.TrimSpace(ref)
				if ref != "" {
					entry.Refs = append(entry.Refs, ref)
				}
			}
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

// getCommitInfo gets info for a single commit
func getCommitInfo(repoDir, commit string) (GitLogEntry, error) {
	cmd := exec.Command("git", "-C", repoDir, "log", "-1", "--format=%H%x00%D%x00%s", "--decorate=full", commit)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return GitLogEntry{}, fmt.Errorf("error getting commit info: %w - %s", err, string(out))
	}

	line := strings.TrimSpace(string(out))
	parts := strings.Split(line, "\x00")
	if len(parts) < 3 {
		return GitLogEntry{}, fmt.Errorf("unexpected git log output format")
	}

	entry := GitLogEntry{
		Hash:    parts[0],
		Subject: parts[2],
	}

	// Parse refs if present
	if parts[1] != "" {
		refs := strings.Split(parts[1], ", ")
		for _, ref := range refs {
			ref = strings.TrimSpace(ref)
			if ref != "" {
				entry.Refs = append(entry.Refs, ref)
			}
		}
	}

	return entry, nil
}

// GetBaseCommitRef returns the base commit for diffing (HEAD by default)
func GetBaseCommitRef(repoDir string) (string, error) {
	return ResolveRef(repoDir, "HEAD")
}

// getUntrackedFiles returns DiffFile entries for untracked files in the working directory
func getUntrackedFiles(repoDir string) ([]DiffFile, error) {
	cmd := exec.Command("git", "-C", repoDir, "ls-files", "--others", "--exclude-standard")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("error listing untracked files: %w - %s", err, string(out))
	}

	output := strings.TrimSpace(string(out))
	if output == "" {
		return nil, nil
	}

	zeroHash := "0000000000000000000000000000000000000000"
	var files []DiffFile

	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		path := scanner.Text()
		if path == "" {
			continue
		}

		// Count lines for additions stat
		fullPath := filepath.Join(repoDir, path)
		content, err := os.ReadFile(fullPath)
		additions := 0
		if err == nil {
			additions = strings.Count(string(content), "\n")
			if len(content) > 0 && content[len(content)-1] != '\n' {
				additions++ // count last line without trailing newline
			}
		}

		files = append(files, DiffFile{
			Path:      path,
			OldMode:   "000000",
			NewMode:   "100644",
			OldHash:   zeroHash,
			NewHash:   zeroHash,
			Status:    "A",
			Additions: additions,
			Deletions: 0,
		})
	}

	return files, nil
}

func parseRawDiffWithNumstat(rawOutput, numstatOutput string) ([]DiffFile, error) {
	files, err := parseRawDiff(rawOutput)
	if err != nil {
		return nil, err
	}

	numstatMap := make(map[string]struct{ additions, deletions int })

	if numstatOutput != "" {
		scanner := bufio.NewScanner(strings.NewReader(strings.TrimSpace(numstatOutput)))
		for scanner.Scan() {
			line := scanner.Text()
			parts := strings.Split(line, "\t")
			if len(parts) >= 3 {
				additions := 0
				deletions := 0

				if parts[0] != "-" {
					if _, err := fmt.Sscanf(parts[0], "%d", &additions); err != nil {
						additions = 0
					}
				}
				if parts[1] != "-" {
					if _, err := fmt.Sscanf(parts[1], "%d", &deletions); err != nil {
						deletions = 0
					}
				}

				filePath := strings.Join(parts[2:], "\t")
				numstatMap[filePath] = struct{ additions, deletions int }{additions, deletions}
			}
		}
	}

	for i := range files {
		if stats, found := numstatMap[files[i].Path]; found {
			files[i].Additions = stats.additions
			files[i].Deletions = stats.deletions
		}
	}

	return files, nil
}

func parseRawDiff(diffOutput string) ([]DiffFile, error) {
	var files []DiffFile
	if diffOutput == "" {
		return files, nil
	}

	scanner := bufio.NewScanner(strings.NewReader(strings.TrimSpace(diffOutput)))
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, ":") {
			continue
		}

		parts := strings.Fields(line[1:])
		if len(parts) < 5 {
			continue
		}

		oldMode := parts[0]
		newMode := parts[1]
		oldHash := parts[2]
		newHash := parts[3]
		status := parts[4]

		tabIndex := strings.Index(line, "\t")
		if tabIndex == -1 {
			continue
		}

		pathPart := line[tabIndex+1:]

		if strings.HasPrefix(status, "R") || strings.HasPrefix(status, "C") {
			pathParts := strings.Split(pathPart, "\t")
			if len(pathParts) == 2 {
				files = append(files, DiffFile{
					Path:    pathParts[1],
					OldPath: pathParts[0],
					OldMode: oldMode,
					NewMode: newMode,
					OldHash: oldHash,
					NewHash: newHash,
					Status:  status,
				})
			} else {
				files = append(files, DiffFile{
					Path:    pathPart,
					OldPath: "",
					OldMode: oldMode,
					NewMode: newMode,
					OldHash: oldHash,
					NewHash: newHash,
					Status:  status,
				})
			}
		} else {
			files = append(files, DiffFile{
				Path:    pathPart,
				OldPath: "",
				OldMode: oldMode,
				NewMode: newMode,
				OldHash: oldHash,
				NewHash: newHash,
				Status:  status,
			})
		}
	}

	return files, nil
}
