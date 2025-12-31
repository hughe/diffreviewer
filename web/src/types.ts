// Type definitions for DiffReviewer

export interface GitLogEntry {
  hash: string;
  refs: string[];
  subject: string;
}

export interface DiffFile {
  path: string;
  old_path: string;
  old_mode: string;
  new_mode: string;
  old_hash: string;
  new_hash: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface Note {
  file: string;
  line: number;
  lineContent: string;
  text: string;
}

export interface NotesResponse {
  lineNotes: Note[];
  generalNotes: string;
}

export interface ApiError {
  error: string;
}

export interface SaveFileRequest {
  path: string;
  content: string;
}

export interface SaveFileResponse {
  success: boolean;
  error?: string;
}

export interface ShutdownRequest {
  generalNotes: string;
}

export interface ShutdownResponse {
  success: boolean;
  message: string;
}

export interface GeneralNotesRequest {
  text: string;
}

export interface GeneralNotesResponse {
  text: string;
}
