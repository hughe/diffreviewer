import { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { MonacoView } from './MonacoView';
import { DiffFile } from '../types';
import { fetchDiff, fetchFileContent, saveFileContent } from '../services/api';
import type { DiffRange } from './RangePicker';

interface DiffViewerProps {
  range: DiffRange | null;
  onNoteAdded?: (note: {
    file: string;
    line: number;
    lineContent: string;
    noteText: string;
    formattedNote: string;
  }) => void;
}

export function DiffViewer({ range, onNoteAdded }: DiffViewerProps) {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, { original: string; modified: string }>>(new Map());

  useEffect(() => {
    if (range) {
      loadDiff(range);
    }
  }, [range]);

  const loadDiff = async (diffRange: DiffRange) => {
    try {
      setLoading(true);
      setError(null);
      setFileContents(new Map());

      const diffFiles = await fetchDiff(diffRange.from, diffRange.to);
      setFiles(diffFiles);

      if (diffFiles.length > 0) {
        setSelectedFile(diffFiles[0].path);
        await loadFileContents(diffFiles[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diff');
      console.error('Error loading diff:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFileContents = async (file: DiffFile) => {
    try {
      const cacheKey = file.path;
      if (fileContents.has(cacheKey)) {
        return;
      }

      const [original, modified] = await Promise.all([
        file.old_hash
          ? fetchFileContent(file.old_hash, file.old_path || file.path)
          : Promise.resolve(''),
        file.new_hash
          ? fetchFileContent(file.new_hash, file.path)
          : Promise.resolve(''),
      ]);

      setFileContents((prev) => new Map(prev).set(cacheKey, { original, modified }));
    } catch (err) {
      console.error('Error loading file contents:', err);
      setError('Failed to load file contents');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPath = e.target.value;
    setSelectedFile(newPath);

    const file = files.find((f) => f.path === newPath);
    if (file) {
      await loadFileContents(file);
    }
  };

  const handleSave = async (path: string, content: string) => {
    try {
      const response = await saveFileContent(path, content);
      if (response.success) {
        console.log(`File saved: ${path}`);

        // Update the cached modified content
        const file = files.find((f) => f.path === path);
        if (file) {
          const cached = fileContents.get(file.path);
          if (cached) {
            setFileContents((prev) => new Map(prev).set(file.path, { ...cached, modified: content }));
          }
        }
      } else {
        alert(`Failed to save: ${response.error || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to save changes to ${path}:\n\n${errorMsg}`);
    }
  };

  const getTotalStats = () => {
    return files.reduce(
      (acc, file) => ({
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
      }),
      { additions: 0, deletions: 0 }
    );
  };

  if (loading) {
    return <div className="d-flex align-items-center justify-content-center h-100 text-muted">Loading diff...</div>;
  }

  if (error) {
    return <div className="d-flex align-items-center justify-content-center h-100 text-danger">{error}</div>;
  }

  if (files.length === 0) {
    return <div className="d-flex align-items-center justify-content-center h-100 text-muted">No files changed</div>;
  }

  const currentFile = files.find((f) => f.path === selectedFile);
  const contents = currentFile ? fileContents.get(currentFile.path) : null;
  const totalStats = getTotalStats();

  return (
    <div className="d-flex flex-column h-100">
      <div className="d-flex align-items-center gap-3 p-3 border-bottom bg-white">
        <Form.Select
          value={selectedFile}
          onChange={handleFileChange}
          className="flex-grow-1"
          style={{ fontSize: '0.875rem' }}
        >
          {files.map((file) => (
            <option key={file.path} value={file.path}>
              {file.path} (+{file.additions} -{file.deletions})
            </option>
          ))}
        </Form.Select>
        <div className="d-flex gap-3 text-muted" style={{ fontSize: '0.875rem' }}>
          <span>{files.length} files</span>
          <span className="text-success">+{totalStats.additions}</span>
          <span className="text-danger">-{totalStats.deletions}</span>
        </div>
      </div>
      <div className="flex-grow-1 overflow-hidden">
        {contents ? (
          <MonacoView
            originalCode={contents.original}
            modifiedCode={contents.modified}
            originalFilename={currentFile?.old_path || ''}
            modifiedFilename={currentFile?.path || ''}
            editableRight={true}
            onSave={handleSave}
            onNoteAdded={onNoteAdded}
          />
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-muted">Loading file...</div>
        )}
      </div>
    </div>
  );
}
