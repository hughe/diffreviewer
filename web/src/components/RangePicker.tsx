import { useState, useEffect } from 'react';
import { Dropdown } from 'react-bootstrap';
import { fetchCommitHistory, fetchBaseCommit } from '../services/api';
import type { GitLogEntry } from '../types';

export interface DiffRange {
  type: 'range';
  from: string;
  to: string;
}

interface RangePickerProps {
  onRangeChange: (range: DiffRange) => void;
}

export function RangePicker({ onRangeChange }: RangePickerProps) {
  const [commits, setCommits] = useState<GitLogEntry[]>([]);
  const [fromCommit, setFromCommit] = useState('');
  const [toCommit, setToCommit] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCommits();
  }, []);

  const loadCommits = async () => {
    setLoading(true);
    setError(null);

    try {
      const baseCommitRef = await fetchBaseCommit();
      const commitList = await fetchCommitHistory(baseCommitRef);
      setCommits(commitList);

      if (commitList.length > 0) {
        const from = commitList.length >= 2 ? commitList[1].hash : commitList[0].hash;
        const to = commitList[0].hash;
        setFromCommit(from);
        setToCommit(to);
        onRangeChange({ type: 'range', from, to });
      }
    } catch (err) {
      console.error('Error loading commits:', err);
      setError(err instanceof Error ? err.message : 'Failed to load commits');
    } finally {
      setLoading(false);
    }
  };

  const handleFromSelect = (hash: string) => {
    setFromCommit(hash);
    onRangeChange({ type: 'range', from: hash, to: toCommit });
  };

  const handleToSelect = (hash: string) => {
    setToCommit(hash);
    onRangeChange({ type: 'range', from: fromCommit, to: hash });
  };

  const getShortHash = (hash: string): string => {
    return hash.substring(0, 8);
  };

  const getShortRefName = (ref: string): string => {
    if (ref.startsWith('refs/heads/')) return ref.substring(11);
    if (ref.startsWith('refs/remotes/origin/')) return ref.substring(20);
    if (ref.startsWith('refs/tags/')) return ref.substring(10);
    if (ref.startsWith('HEAD -> ')) return ref.substring(8);
    return ref;
  };

  const isTag = (ref: string): boolean => {
    return ref.includes('tag:') || ref.startsWith('refs/tags/');
  };

  if (loading) {
    return <div className="text-muted fst-italic">Loading commits...</div>;
  }

  if (error) {
    return <div className="text-danger fst-italic">{error}</div>;
  }

  const selectedFromCommit = commits.find((c) => c.hash === fromCommit);
  const selectedToCommit = toCommit === 'CURRENT' ? null : commits.find((c) => c.hash === toCommit);

  return (
    <div className="d-flex align-items-center gap-2">
      <label className="fw-medium" style={{ fontSize: '0.875rem' }}>From</label>
      <Dropdown onSelect={(hash) => hash && handleFromSelect(hash)}>
        <Dropdown.Toggle variant="outline-secondary" size="sm" className="flex-grow-1" style={{ minWidth: '300px', textAlign: 'left' }}>
          {selectedFromCommit ? (
            <>
              <span className="font-monospace text-muted" style={{ fontSize: '0.75rem' }}>
                {getShortHash(selectedFromCommit.hash)}
              </span>
              {' '}
              <span style={{ fontSize: '0.75rem' }}>{selectedFromCommit.subject}</span>
            </>
          ) : (
            'Select commit...'
          )}
        </Dropdown.Toggle>

        <Dropdown.Menu style={{ maxHeight: '300px', overflowY: 'auto', minWidth: '300px' }}>
          {commits.map((commit) => (
            <Dropdown.Item
              key={commit.hash}
              eventKey={commit.hash}
              active={commit.hash === fromCommit}
            >
              <div className="d-flex align-items-start gap-2">
                <span className="font-monospace text-muted" style={{ fontSize: '0.75rem' }}>
                  {getShortHash(commit.hash)}
                </span>
                <span className="flex-grow-1" style={{ fontSize: '0.75rem' }}>
                  {commit.subject}
                </span>
                {commit.refs && commit.refs.length > 0 && (
                  <div className="d-flex gap-1 flex-wrap">
                    {commit.refs.map((ref) => (
                      <span
                        key={ref}
                        className={`badge ${isTag(ref) ? 'bg-warning text-dark' : 'bg-success'}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {getShortRefName(ref)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>

      <label className="fw-medium" style={{ fontSize: '0.875rem' }}>To</label>
      <Dropdown onSelect={(hash) => hash && handleToSelect(hash)}>
        <Dropdown.Toggle variant="outline-secondary" size="sm" className="flex-grow-1" style={{ minWidth: '300px', textAlign: 'left' }}>
          {toCommit === 'CURRENT' ? (
            <span style={{ fontSize: '0.75rem' }}>CURRENT (working directory)</span>
          ) : selectedToCommit ? (
            <>
              <span className="font-monospace text-muted" style={{ fontSize: '0.75rem' }}>
                {getShortHash(selectedToCommit.hash)}
              </span>
              {' '}
              <span style={{ fontSize: '0.75rem' }}>{selectedToCommit.subject}</span>
            </>
          ) : (
            'Select commit...'
          )}
        </Dropdown.Toggle>

        <Dropdown.Menu style={{ maxHeight: '300px', overflowY: 'auto', minWidth: '300px' }}>
          <Dropdown.Item
            eventKey="CURRENT"
            active={toCommit === 'CURRENT'}
          >
            <span style={{ fontSize: '0.75rem' }}>CURRENT (working directory)</span>
          </Dropdown.Item>
          {commits.map((commit) => (
            <Dropdown.Item
              key={commit.hash}
              eventKey={commit.hash}
              active={commit.hash === toCommit}
            >
              <div className="d-flex align-items-start gap-2">
                <span className="font-monospace text-muted" style={{ fontSize: '0.75rem' }}>
                  {getShortHash(commit.hash)}
                </span>
                <span className="flex-grow-1" style={{ fontSize: '0.75rem' }}>
                  {commit.subject}
                </span>
                {commit.refs && commit.refs.length > 0 && (
                  <div className="d-flex gap-1 flex-wrap">
                    {commit.refs.map((ref) => (
                      <span
                        key={ref}
                        className={`badge ${isTag(ref) ? 'bg-warning text-dark' : 'bg-success'}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {getShortRefName(ref)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
