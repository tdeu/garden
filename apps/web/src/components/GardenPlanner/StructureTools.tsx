'use client';

import { useEffect, useRef, useState } from 'react';
import { useGardenStore, Structure } from '@/stores/garden-store';
import { cn } from '@/lib/utils';

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

const structureTypes = [
  { id: 'house', label: 'Maison', color: '#64748b', dashed: false, isPolygon: true },
  { id: 'shed', label: 'Shed', color: '#92400e', dashed: false, isPolygon: true },
  { id: 'greenhouse', label: 'Greenhouse', color: '#65a30d', dashed: false, isPolygon: true },
  { id: 'terrace', label: 'Terrace', color: '#a1a1aa', dashed: false, isPolygon: true },
  { id: 'stone_terrace', label: 'Terrasse en Pierre', color: '#d6d3d1', dashed: false, isPolygon: true },
  { id: 'pond', label: 'Pond', color: '#3b82f6', dashed: false, isPolygon: true },
  { id: 'driveway', label: 'Allée', color: '#6b7280', dashed: false, isPolygon: true },
  { id: 'dry_stone_wall', label: 'Mur en Pierre Sèche', color: '#78716c', dashed: false, isPolygon: false },
  { id: 'stone_path', label: 'Chemin en Pierre', color: '#a8a29e', dashed: true, isPolygon: false },
  { id: 'wall', label: 'Wall', color: '#57534e', dashed: false, isPolygon: false },
  { id: 'fence', label: 'Fence', color: '#a16207', dashed: false, isPolygon: false },
  { id: 'path', label: 'Path', color: '#78716c', dashed: true, isPolygon: false },
  { id: 'chicken_coop', label: 'Poulailler', color: '#f59e0b', dashed: false, isPolygon: true },
  { id: 'beehive', label: 'Ruche', color: '#fbbf24', dashed: false, isPolygon: true },
  { id: 'duck_pond', label: 'Mare aux Canards', color: '#0ea5e9', dashed: false, isPolygon: true },
  { id: 'other', label: 'Other', color: '#8b5cf6', dashed: true, isPolygon: false },
] as const;

type StructureTypeId = typeof structureTypes[number]['id'];

interface StructureDrawControlProps {
  selectedStructureType: StructureTypeId;
  onStructureCreated: (coordinates: [number, number][]) => void;
  isActive: boolean;
}

// Leaflet draw control for structures (polylines)
function StructureDrawControl({ selectedStructureType, onStructureCreated, isActive }: StructureDrawControlProps) {
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

    const structureConfig = structureTypes.find((s) => s.id === selectedStructureType);
    const color = structureConfig?.color || '#8b5cf6';
    const isPolygon = structureConfig?.isPolygon ?? false;

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: isPolygon ? false : {
          shapeOptions: {
            color: color,
            weight: 4,
            dashArray: structureConfig?.dashed ? '10, 10' : undefined,
          },
        },
        polygon: isPolygon ? {
          shapeOptions: {
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
            weight: 3,
          },
        } : false,
        rectangle: isPolygon ? {
          shapeOptions: {
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
            weight: 3,
          },
        } : false,
        circle: false,
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

      if (layer instanceof L.Polygon) {
        // Polygon returns nested array, get first ring
        const latlngs = layer.getLatLngs()[0] as any[];
        const coordinates: [number, number][] = latlngs.map((ll: any) => [ll.lat, ll.lng]);
        onStructureCreated(coordinates);
      } else if (layer instanceof L.Polyline) {
        const latlngs = layer.getLatLngs() as any[];
        const coordinates: [number, number][] = latlngs.map((ll: any) => [ll.lat, ll.lng]);
        onStructureCreated(coordinates);
      }
    };

    map.on(L.Draw.Event.CREATED, handleDrawCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
    };
  }, [map, isActive, selectedStructureType, onStructureCreated]);

  return null;
}

interface StructureToolsProps {
  className?: string;
}

export function StructureTools({ className }: StructureToolsProps) {
  const { selectedTool, addStructure } = useGardenStore();
  const [selectedStructureType, setSelectedStructureType] = useState<StructureTypeId>('path');
  const [structureName, setStructureName] = useState('');

  const isActive = selectedTool === 'structure';

  const handleStructureCreated = (coordinates: [number, number][]) => {
    const structureConfig = structureTypes.find((s) => s.id === selectedStructureType);

    const newStructure: Structure = {
      id: `structure-${Date.now()}`,
      type: selectedStructureType,
      coordinates,
      name: structureName || `${structureConfig?.label || 'Structure'} ${Date.now()}`,
    };

    addStructure(newStructure);
    setStructureName('');
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className={cn('bg-neutral-900 rounded-lg border border-neutral-800', className)}>
      <div className="px-4 py-3 border-b border-neutral-800">
        <h3 className="text-sm font-semibold text-white">Draw Structure</h3>
        <p className="text-xs text-neutral-500 mt-1">
          Select a type and draw paths or boundaries
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Structure name input */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">
            Structure Name (optional)
          </label>
          <input
            type="text"
            value={structureName}
            onChange={(e) => setStructureName(e.target.value)}
            placeholder="e.g., Garden Path"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Structure type selector */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            Structure Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {structureTypes.map((structureType) => (
              <button
                key={structureType.id}
                onClick={() => setSelectedStructureType(structureType.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  selectedStructureType === structureType.id
                    ? 'bg-neutral-700 ring-2 ring-green-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                )}
              >
                <div
                  className="w-6 h-1 rounded"
                  style={{
                    backgroundColor: structureType.color,
                    borderStyle: structureType.dashed ? 'dashed' : 'solid',
                  }}
                />
                <span className="text-xs">{structureType.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="p-3 bg-green-900/20 rounded-md border border-green-800/50">
          <p className="text-xs text-green-400">
            Use the line drawing tool in the top-right corner to draw your structure
          </p>
        </div>
      </div>
    </div>
  );
}

export { StructureDrawControl };
export default StructureTools;
