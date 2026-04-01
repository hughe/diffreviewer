package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestGetDiffIncludesUntrackedFiles(t *testing.T) {
	repoDir := "/tmp/test-repo"
	if _, err := os.Stat(repoDir); os.IsNotExist(err) {
		t.Skip("test repo not set up")
	}

	files, err := GetDiff(repoDir, "HEAD", "")
	if err != nil {
		t.Fatalf("GetDiff failed: %v", err)
	}

	// Check that untracked files are included
	found := map[string]bool{}
	for _, f := range files {
		found[f.Path] = true
		t.Logf("file: %s status: %s additions: %d", f.Path, f.Status, f.Additions)
	}

	if !found["untracked.txt"] {
		t.Error("expected untracked.txt in diff output")
	}
	if !found["untracked2.txt"] {
		t.Error("expected untracked2.txt in diff output")
	}
}

func TestGetUntrackedFiles(t *testing.T) {
	repoDir := "/tmp/test-repo"
	if _, err := os.Stat(repoDir); os.IsNotExist(err) {
		t.Skip("test repo not set up")
	}

	files, err := getUntrackedFiles(repoDir)
	if err != nil {
		t.Fatalf("getUntrackedFiles failed: %v", err)
	}

	found := map[string]bool{}
	for _, f := range files {
		found[f.Path] = true
		if f.Status != "A" {
			t.Errorf("expected status A for %s, got %s", f.Path, f.Status)
		}
		if f.OldMode != "000000" {
			t.Errorf("expected old mode 000000 for %s, got %s", f.Path, f.OldMode)
		}
		if f.Additions < 1 {
			t.Errorf("expected at least 1 addition for %s, got %d", f.Path, f.Additions)
		}
	}

	if !found["untracked.txt"] {
		t.Error("expected untracked.txt")
	}
	if !found["untracked2.txt"] {
		t.Error("expected untracked2.txt")
	}
}

func TestGetUntrackedFilesEmpty(t *testing.T) {
	// Test with a repo that has no untracked files
	dir := t.TempDir()

	// init a git repo
	initGitRepo(t, dir)

	files, err := getUntrackedFiles(dir)
	if err != nil {
		t.Fatalf("getUntrackedFiles failed: %v", err)
	}
	if len(files) != 0 {
		t.Errorf("expected no untracked files, got %d", len(files))
	}
}

func TestGetDiffNoUntrackedWhenComparingCommits(t *testing.T) {
	repoDir := "/tmp/test-repo"
	if _, err := os.Stat(repoDir); os.IsNotExist(err) {
		t.Skip("test repo not set up")
	}

	// When comparing two commits (not working dir), untracked files should NOT appear
	files, err := GetDiff(repoDir, "HEAD", "HEAD")
	if err != nil {
		t.Fatalf("GetDiff failed: %v", err)
	}

	for _, f := range files {
		if f.Path == "untracked.txt" || f.Path == "untracked2.txt" {
			t.Errorf("untracked file %s should not appear when comparing commits", f.Path)
		}
	}
}

func initGitRepo(t *testing.T, dir string) {
	t.Helper()
	run(t, dir, "git", "init")
	run(t, dir, "git", "config", "user.email", "test@test.com")
	run(t, dir, "git", "config", "user.name", "Test")
	// Create a file and commit so HEAD exists
	os.WriteFile(filepath.Join(dir, "init.txt"), []byte("init\n"), 0644)
	run(t, dir, "git", "add", "init.txt")
	run(t, dir, "git", "commit", "-m", "init")
}

func run(t *testing.T, dir string, name string, args ...string) {
	t.Helper()
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("%s %v failed: %v\n%s", name, args, err, out)
	}
}
