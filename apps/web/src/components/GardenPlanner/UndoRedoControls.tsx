'use client';

import { useEffect } from 'react';
import { useGardenStore } from '@/stores/garden-store';
import { Undo2, Redo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UndoRedoControlsProps {
  className?: string;
}

export function UndoRedoControls({ className }: UndoRedoControlsProps) {
  const { undo, redo, historyIndex, history } = useGardenStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }

      // Ctrl+Y or Ctrl+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={undo}
        disabled={!canUndo}
        className={cn(
          'p-2 rounded-md transition-colors',
          canUndo
            ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            : 'text-neutral-600 cursor-not-allowed'
        )}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-5 h-5" />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className={cn(
          'p-2 rounded-md transition-colors',
          canRedo
            ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            : 'text-neutral-600 cursor-not-allowed'
        )}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-5 h-5" />
      </button>
      {history.length > 0 && (
        <span className="text-xs text-neutral-600 ml-1">
          {historyIndex + 1}/{history.length}
        </span>
      )}
    </div>
  );
}

export default UndoRedoControls;
