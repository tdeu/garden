'use client';

import { useEffect } from 'react';
import { useGardenStore } from '@/stores/garden-store';
import { MousePointer2, Trees, Shapes, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

const tools = [
  { id: 'select' as const, icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'plant' as const, icon: Trees, label: 'Plant', shortcut: 'P' },
  { id: 'zone' as const, icon: Shapes, label: 'Zone', shortcut: 'Z' },
  { id: 'structure' as const, icon: Route, label: 'Structure', shortcut: 'S' },
];

export function ToolPalette() {
  const { selectedTool, setSelectedTool } = useGardenStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toUpperCase();
      const tool = tools.find((t) => t.shortcut === key);
      if (tool) {
        setSelectedTool(tool.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedTool]);

  return (
    <div className="flex flex-col gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800">
      <div className="text-xs text-neutral-500 uppercase tracking-wider px-2 py-1">
        Tools
      </div>
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = selectedTool === tool.id;

        return (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
              'text-sm font-medium',
              isActive
                ? 'bg-green-600 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            )}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <Icon className="w-5 h-5" />
            <span className="flex-1 text-left">{tool.label}</span>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              isActive ? 'bg-green-700' : 'bg-neutral-800'
            )}>
              {tool.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ToolPalette;
