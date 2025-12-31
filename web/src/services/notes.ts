// Notes service for DiffReviewer
import type {
  Note,
  NotesResponse,
  GeneralNotesRequest,
  GeneralNotesResponse,
} from '../types';

/**
 * Local cache for notes
 */
let notesCache: NotesResponse | null = null;

/**
 * Fetches all notes (line notes and general notes)
 */
export async function fetchNotes(): Promise<NotesResponse> {
  try {
    const response = await fetch('./api/notes');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch notes: ${response.statusText}`);
    }
    
    const data: NotesResponse = await response.json();
    notesCache = data;
    return data;
  } catch (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }
}

/**
 * Adds a new line-specific note
 */
export async function addNote(
  file: string,
  line: number,
  lineContent: string,
  text: string
): Promise<void> {
  try {
    const note: Note = { file, line, lineContent, text };
    const response = await fetch('./api/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(note),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add note: ${response.statusText}`);
    }
    
    // Update local cache
    if (notesCache) {
      const existingIndex = notesCache.lineNotes.findIndex(
        (n) => n.file === file && n.line === line
      );
      if (existingIndex >= 0) {
        notesCache.lineNotes[existingIndex] = note;
      } else {
        notesCache.lineNotes.push(note);
      }
    }
  } catch (error) {
    console.error('Error adding note:', error);
    throw error;
  }
}

/**
 * Updates an existing line-specific note
 */
export async function updateNote(
  file: string,
  line: number,
  lineContent: string,
  text: string
): Promise<void> {
  // For now, addNote handles both add and update
  return addNote(file, line, lineContent, text);
}

/**
 * Deletes a line-specific note
 */
export async function deleteNote(file: string, line: number): Promise<void> {
  try {
    const response = await fetch('./api/notes', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file, line }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete note: ${response.statusText}`);
    }
    
    // Update local cache
    if (notesCache) {
      notesCache.lineNotes = notesCache.lineNotes.filter(
        (n) => !(n.file === file && n.line === line)
      );
    }
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
}

/**
 * Updates the general notes text
 */
export async function updateGeneralNotes(text: string): Promise<void> {
  try {
    const request: GeneralNotesRequest = { text };
    const response = await fetch('./api/general-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update general notes: ${response.statusText}`);
    }
    
    // Update local cache
    if (notesCache) {
      notesCache.generalNotes = text;
    }
  } catch (error) {
    console.error('Error updating general notes:', error);
    throw error;
  }
}

/**
 * Fetches just the general notes text
 */
export async function fetchGeneralNotes(): Promise<string> {
  try {
    const response = await fetch('./api/general-notes');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch general notes: ${response.statusText}`);
    }
    
    const data: GeneralNotesResponse = await response.json();
    return data.text;
  } catch (error) {
    console.error('Error fetching general notes:', error);
    throw error;
  }
}

/**
 * Gets notes from cache if available
 */
export function getCachedNotes(): NotesResponse | null {
  return notesCache;
}

/**
 * Clears the notes cache
 */
export function clearNotesCache(): void {
  notesCache = null;
}
