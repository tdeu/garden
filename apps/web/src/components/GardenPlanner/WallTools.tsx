'use client';

import { useEffect, useRef, useState } from 'react';
import { useGardenStore, Structure } from '@/stores/garden-store';
import { cn } from '@/lib/utils';
import { Fence, Info } from 'lucide-react';

// Conditional imports for Leaflet (only on client)
let L: typeof import('leaflet') | null = null;
if (typeof window !== 'undefined') {
  L = require('leaflet');
  require('leaflet-draw');
}

// Only import useMap from react-leaflet dynamically
const useMap = typeof window !== 'undefined'
  ? require('react-leaflet').useMap
  : () => null;

interface WallDrawControlProps {
  onWallCreated: (coordinates: [number, number][]) => void;
  isActive: boolean;
}

// Leaflet draw control for stone walls (polylines)
function WallDrawControl({ onWallCreated, isActive }: WallDrawControlProps) {
  const map = useMap();
  const drawControlRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);

  // Initialize drawnItems on client only
  useEffect(() => {
    if (typeof window !== 'undefined' && L && !drawnItemsRef.current) {
      drawnItemsRef.current = new L.FeatureGroup();
    }
  }, []);

  useEffect(() => {
    if (!map || !L || !drawnItemsRef.current) return;

    map.addLayer(drawnItemsRef.current);

    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
      }
      map.removeLayer(drawnItemsRef.current);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !L || !drawnItemsRef.current) return;

    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    if (!isActive) return;

    // Stone wall color - warm stone/yellow tone
    const color = '#b8860b';

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: {
          shapeOptions: {
            color: color,
            weight: 6,
            opacity: 0.9,
          },
        },
        polygon: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItemsRef.current,
        remove: true,
      },
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    const handleDrawCreated = (e: any) => {
      const layer = e.layer;

      if (layer instanceof L.Polyline) {
        const latlngs = layer.getLatLngs() as any[];
        const coordinates: [number, number][] = latlngs.map((ll: any) => [ll.lng, ll.lat]);
        onWallCreated(coordinates);
      }
    };

    map.on(L.Draw.Event.CREATED, handleDrawCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
    };
  }, [map, isActive, onWallCreated]);

  return null;
}

interface WallToolsProps {
  className?: string;
}

export function WallTools({ className }: WallToolsProps) {
  const { selectedTool, addStructure } = useGardenStore();
  const [wallName, setWallName] = useState('');

  const isActive = selectedTool === 'structure';

  const handleWallCreated = (coordinates: [number, number][]) => {
    const newStructure: Structure = {
      id: `wall-${Date.now()}`,
      type: 'dry_stone_wall',
      coordinates,
      name: wallName || `Stone Wall ${new Date().toLocaleDateString()}`,
    };

    addStructure(newStructure);
    setWallName('');
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className={cn('bg-neutral-900 rounded-lg border border-neutral-800', className)}>
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Fence className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-white">Stone Wall Builder</h3>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Build walls from renovation stones
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Wall name input */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">
            Wall Name (optional)
          </label>
          <input
            type="text"
            value={wallName}
            onChange={(e) => setWallName(e.target.value)}
            placeholder="e.g., Garden Border Wall"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
        </div>

        {/* Wall preview */}
        <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-md">
          <div
            className="w-16 h-3 rounded"
            style={{ backgroundColor: '#b8860b' }}
          />
          <span className="text-sm text-neutral-300">Dry Stone Wall</span>
        </div>

        {/* Instructions */}
        <div className="p-3 bg-amber-900/20 rounded-md border border-amber-800/50">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-400 space-y-1">
              <p>Click the polyline tool (top-right) to start drawing your wall.</p>
              <p>Click points to trace the wall path, then finish by clicking the last point again or pressing Enter.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { WallDrawControl };
export default WallTools;
