// API service for DiffReviewer
import type {
  DiffFile,
  GitLogEntry,
  SaveFileRequest,
  SaveFileResponse,
  ShutdownRequest,
  ShutdownResponse,
} from '../types';

/**
 * Fetches diff between two commits
 * @param from Starting commit hash
 * @param to Ending commit hash
 */
export async function fetchDiff(from?: string, to?: string): Promise<DiffFile[]> {
  try {
    let url = './api/diff';
    const params = new URLSearchParams();

    if (from) {
      params.append('from', from);
    }
    if (to) {
      params.append('to', to);
    }

    if (params.toString()) {
      url += '?' + params.toString();
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch diff: ${response.statusText}`);
    }

    const result = await response.json();
    // Ensure we always return an array, even if the backend returns null
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error fetching diff:', error);
    throw error;
  }
}

/**
 * Fetches file content by git hash
 * @param hash Git object hash (or all zeros for working directory)
 * @param path File path (required when hash is all zeros for working directory)
 */
export async function fetchFileContent(hash: string, path?: string): Promise<string> {
  try {
    if (!hash) {
      console.warn('Invalid file hash, returning empty string');
      return '';
    }

    // Build URL with hash and optional path
    const params = new URLSearchParams();
    params.append('hash', hash);

    // If hash is all zeros (working directory), path is required
    if (hash === '0000000000000000000000000000000000000000' && path) {
      params.append('path', path);
    }

    const url = `./api/file-content?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch file content: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error('Error fetching file content:', error);
    throw error;
  }
}

/**
 * Saves edited file content back to working directory
 */
export async function saveFileContent(
  path: string,
  content: string
): Promise<SaveFileResponse> {
  try {
    const request: SaveFileRequest = { path, content };
    const response = await fetch('./api/save-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to save file: ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving file content:', error);
    throw error;
  }
}

/**
 * Fetches commit history from initialCommit to HEAD
 * @param initialCommit Starting commit hash (optional)
 */
export async function fetchCommitHistory(
  initialCommit?: string
): Promise<GitLogEntry[]> {
  try {
    let url = './api/commits';
    if (initialCommit) {
      url += `?initialCommit=${encodeURIComponent(initialCommit)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch commit history: ${response.statusText}`);
    }

    const result = await response.json();
    // Ensure we always return an array, even if the backend returns null
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error fetching commit history:', error);
    throw error;
  }
}

/**
 * Fetches the base commit reference
 */
export async function fetchBaseCommit(): Promise<string> {
  try {
    const response = await fetch('./api/base-commit');

    if (!response.ok) {
      throw new Error(`Failed to fetch base commit: ${response.statusText}`);
    }

    const data = await response.json();
    return data.base_commit;
  } catch (error) {
    console.error('Error fetching base commit:', error);
    throw error;
  }
}

/**
 * Triggers graceful shutdown with final general notes
 */
export async function shutdown(
  generalNotes: string
): Promise<ShutdownResponse> {
  try {
    const request: ShutdownRequest = { generalNotes };
    const response = await fetch('./api/shutdown', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to shutdown: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error during shutdown:', error);
    throw error;
  }
}
