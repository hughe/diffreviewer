import { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { RangePicker, DiffRange } from './components/RangePicker';
import { DiffViewer } from './components/DiffViewer';
import { GeneralNotesInput } from './components/GeneralNotesInput';
import { DoneButton } from './components/DoneButton';
import { fetchNotes, updateGeneralNotes } from './services/notes';
import { shutdown } from './services/api';

export function App() {
  const [generalNotes, setGeneralNotes] = useState('');
  const [currentRange, setCurrentRange] = useState<DiffRange | null>(null);

  useEffect(() => {
    loadGeneralNotes();
  }, []);

  const loadGeneralNotes = async () => {
    try {
      const notesResponse = await fetchNotes();
      setGeneralNotes(notesResponse.generalNotes);
    } catch (err) {
      console.error('Error loading notes:', err);
    }
  };

  const handleNoteAdded = async (note: {
    file: string;
    line: number;
    lineContent: string;
    noteText: string;
    formattedNote: string;
  }) => {
    console.log('Note added:', note.formattedNote);

    // Append to general notes with a newline separator
    const updatedNotes = generalNotes.trim()
      ? `${generalNotes}\n\n${note.formattedNote}`
      : note.formattedNote;

    setGeneralNotes(updatedNotes);

    // Save to backend immediately
    try {
      await updateGeneralNotes(updatedNotes);
    } catch (err) {
      console.error('Error saving note to backend:', err);
    }
  };

  const handleRangeChange = (range: DiffRange) => {
    console.log('Range changed:', range);
    setCurrentRange(range);
  };

  const handleGeneralNotesChange = async (text: string) => {
    setGeneralNotes(text);
    try {
      await updateGeneralNotes(text);
    } catch (err) {
      console.error('Error saving general notes:', err);
    }
  };

  const handleDone = async () => {
    if (!window.confirm('Save notes and exit DiffReviewer?')) {
      return;
    }

    try {
      // Save general notes to server before shutdown
      await updateGeneralNotes(generalNotes);
      await shutdown(generalNotes);

      // Try to close the window immediately
      window.close();

      // If we reach here, window.close() didn't work (window is still open)
      // Show a message instructing the user to close manually
      setTimeout(() => {
        if (!window.closed) {
          document.body.innerHTML =
            '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 1.5rem; color: #6b7280; text-align: center; flex-direction: column; gap: 1rem;">' +
            '<div>✓ Notes saved successfully!</div>' +
            '<div style="font-size: 1.2rem;">Please close this window.</div>' +
            '</div>';
        }
      }, 100);
    } catch (err) {
      alert('Error during shutdown: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="d-flex flex-column vh-100">
      <div className="d-flex align-items-center justify-content-between p-3 border-bottom bg-white">
        <h1 className="h3 mb-0">DiffReviewer</h1>
      </div>
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">
        <Container fluid className="p-3">
          <RangePicker onRangeChange={handleRangeChange} />
        </Container>
        <div className="flex-grow-1 overflow-hidden">
          <DiffViewer range={currentRange} onNoteAdded={handleNoteAdded} />
        </div>
        <div className="border-top bg-white p-4">
          <Container fluid>
            <Row className="align-items-center g-3">
              <Col>
                <GeneralNotesInput
                  value={generalNotes}
                  onChange={handleGeneralNotesChange}
                />
              </Col>
              <Col xs="auto">
                <DoneButton onClick={handleDone} />
              </Col>
            </Row>
          </Container>
        </div>
      </div>
    </div>
  );
}
