import { useState, useEffect, useRef } from 'react';
import { Form } from 'react-bootstrap';

interface GeneralNotesInputProps {
  value: string;
  onChange: (text: string) => void;
}

export function GeneralNotesInput({ value, onChange }: GeneralNotesInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Debounce the change event
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      onChange(newValue);
    }, 500);
  };

  return (
    <Form.Control
      as="textarea"
      value={localValue}
      onChange={handleInput}
      placeholder="Add general review notes here..."
      style={{ minHeight: '100px', resize: 'vertical', fontSize: '0.875rem' }}
    />
  );
}
