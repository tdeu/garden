'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { ToolPalette } from '@/components/GardenPlanner/ToolPalette';
import { PlantLibrary } from '@/components/GardenPlanner/PlantLibrary';
import { ZoneDrawer } from '@/components/GardenPlanner/ZoneDrawer';
import { StructureTools } from '@/components/GardenPlanner/StructureTools';
import { SelectionPanel } from '@/components/GardenPlanner/SelectionPanel';
import { UndoRedoControls } from '@/components/GardenPlanner/UndoRedoControls';
import { Timeline, TimelineMode } from '@/components/GardenPlanner/Timeline';
import { ViewpointManager } from '@/components/GardenPlanner/ViewpointManager';
import { useGardenStore } from '@/stores/garden-store';
import { Save, Loader2, Home, Cloud, CloudOff, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Dynamic import for Leaflet (no SSR)
const GardenCanvas = dynamic(
  () => import('@/components/GardenPlanner/GardenCanvas').then((mod) => mod.GardenCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-neutral-900">
        <div className="flex items-center gap-2 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading map...</span>
        </div>
      </div>
    ),
  }
);

// Default center - User's property (Huombois, Étalle, Belgium)
const DEFAULT_CENTER: [number, number] = [49.6387, 5.5522];

export default function PlannerPage() {
  const {
    plants,
    zones,
    structures,
    selectedItemId,
    cloudSyncStatus,
    lastSyncedAt,
    syncToCloud,
    initializeFromCloud,
    property,
  } = useGardenStore();

  // Timeline state
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('present');
  const [timelineYear, setTimelineYear] = useState(new Date().getFullYear());

  const handleTimeChange = (mode: TimelineMode, year: number) => {
    setTimelineMode(mode);
    setTimelineYear(year);
  };

  // Initialize from cloud on mount
  useEffect(() => {
    initializeFromCloud();
  }, [initializeFromCloud]);

  const handleSave = async () => {
    await syncToCloud();
  };

  const totalItems = plants.length + zones.length + structures.length;

  // Sync status indicator
  const SyncStatusIcon = () => {
    switch (cloudSyncStatus) {
      case 'syncing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case 'synced':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return property?.id ? <Cloud className="w-4 h-4 text-neutral-500" /> : <CloudOff className="w-4 h-4 text-neutral-600" />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800"
            title="Home"
          >
            <Home className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold text-white">Garden Planner</h1>
          <span className="text-sm text-neutral-500">
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync status */}
          <div className="flex items-center gap-2 px-2" title={lastSyncedAt ? `Last synced: ${new Date(lastSyncedAt).toLocaleString()}` : 'Not synced'}>
            <SyncStatusIcon />
            {cloudSyncStatus === 'synced' && (
              <span className="text-xs text-neutral-500">Saved</span>
            )}
          </div>

          <div className="w-px h-6 bg-neutral-800 mx-1" />

          {/* Undo/Redo */}
          <UndoRedoControls />

          <div className="w-px h-6 bg-neutral-800 mx-1" />

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={cloudSyncStatus === 'syncing' || !property?.id}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-white transition-colors',
              cloudSyncStatus === 'syncing' || !property?.id
                ? 'bg-neutral-700 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {cloudSyncStatus === 'syncing' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save to Cloud</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-72 flex flex-col gap-4 p-4 bg-neutral-950 border-r border-neutral-800 overflow-y-auto">
          <ToolPalette />
          <PlantLibrary />
          <ZoneDrawer />
          <StructureTools />
        </aside>

        {/* Map canvas */}
        <main className="flex-1 relative">
          <GardenCanvas
            center={DEFAULT_CENTER}
            zoom={18}
            timelineMode={timelineMode}
            timelineYear={timelineYear}
          />
        </main>

        {/* Right sidebar */}
        <aside className="w-80 flex flex-col gap-4 p-4 bg-neutral-950 border-l border-neutral-800 overflow-y-auto">
          <Timeline onTimeChange={handleTimeChange} />
          <ViewpointManager />
          {selectedItemId && <SelectionPanel />}
        </aside>
      </div>
    </div>
  );
}
