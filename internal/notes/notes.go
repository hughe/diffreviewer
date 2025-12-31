package notes

import (
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"sync"
)

// Note represents a line-specific note
type Note struct {
	File        string `json:"file"`
	Line        int    `json:"line"`
	LineContent string `json:"lineContent"`
	Text        string `json:"text"`
}

// Storage manages notes in memory and persists to markdown
type Storage struct {
	mu           sync.RWMutex
	lineNotes    []Note
	generalNotes string
	filePath     string // empty means stdout
}

// NewStorage creates a new notes storage
func NewStorage(filePath string) *Storage {
	return &Storage{
		lineNotes: []Note{},
		filePath:  filePath,
	}
}

// GetAll returns all notes
func (s *Storage) GetAll() ([]Note, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lineNotes, s.generalNotes
}

// AddOrUpdate adds or updates a line note
func (s *Storage) AddOrUpdate(note Note) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Find existing note for this file/line
	for i, n := range s.lineNotes {
		if n.File == note.File && n.Line == note.Line {
			s.lineNotes[i] = note
			return s.persist()
		}
	}

	// Add new note
	s.lineNotes = append(s.lineNotes, note)
	return s.persist()
}

// Delete removes a line note
func (s *Storage) Delete(file string, line int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, n := range s.lineNotes {
		if n.File == file && n.Line == line {
			s.lineNotes = append(s.lineNotes[:i], s.lineNotes[i+1:]...)
			return s.persist()
		}
	}

	return nil
}

// UpdateGeneralNotes updates the general notes text
func (s *Storage) UpdateGeneralNotes(text string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.generalNotes = text
	return s.persist()
}

// GetGeneralNotes returns the general notes text
func (s *Storage) GetGeneralNotes() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.generalNotes
}

// persist writes notes to file or returns markdown for stdout
func (s *Storage) persist() error {
	if s.filePath == "" {
		// Will be written to stdout on shutdown
		return nil
	}

	md := s.toMarkdown()
	return os.WriteFile(s.filePath, []byte(md), 0644)
}

// WriteToStdout writes notes to stdout
func (s *Storage) WriteToStdout() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	md := s.toMarkdown()
	fmt.Println(md)
}

// WriteToWriter writes notes to an io.Writer
func (s *Storage) WriteToWriter(w io.Writer) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	md := s.toMarkdown()
	_, err := w.Write([]byte(md))
	return err
}

func (s *Storage) toMarkdown() string {
	var sb strings.Builder

	sb.WriteString("# Review Notes\n\n")

	if s.generalNotes != "" {
		sb.WriteString(s.generalNotes)
		sb.WriteString("\n\n")
	}

	if len(s.lineNotes) > 0 {
		// Group notes by file
		fileGroups := make(map[string][]Note)
		for _, note := range s.lineNotes {
			fileGroups[note.File] = append(fileGroups[note.File], note)
		}

		// Sort files
		files := make([]string, 0, len(fileGroups))
		for file := range fileGroups {
			files = append(files, file)
		}
		sort.Strings(files)

		// Write each file's notes
		for _, file := range files {
			sb.WriteString(fmt.Sprintf("## %s\n", file))
			notes := fileGroups[file]

			// Sort notes by line number
			sort.Slice(notes, func(i, j int) bool {
				return notes[i].Line < notes[j].Line
			})

			for _, note := range notes {
				sb.WriteString(fmt.Sprintf("### Line %d\n", note.Line))
				if note.LineContent != "" {
					sb.WriteString("```\n")
					sb.WriteString(note.LineContent)
					sb.WriteString("\n```\n")
				}
				sb.WriteString(note.Text)
				sb.WriteString("\n\n")
			}
		}
	}

	return sb.String()
}
