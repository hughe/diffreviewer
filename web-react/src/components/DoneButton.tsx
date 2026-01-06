import { Button } from 'react-bootstrap';

interface DoneButtonProps {
  onClick: () => void;
}

export function DoneButton({ onClick }: DoneButtonProps) {
  return (
    <Button
      variant="primary"
      size="lg"
      onClick={onClick}
      className="px-4 py-2"
    >
      Done
    </Button>
  );
}
