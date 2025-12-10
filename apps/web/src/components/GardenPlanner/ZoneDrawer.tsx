'use client';

import { useEffect, useRef, useState } from 'react';
import { useGardenStore, Zone } from '@/stores/garden-store';
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

const zoneTypes = [
  { id: 'flower_bed', label: 'Parterre de Fleurs', color: '#ec4899' },
  { id: 'vegetable_garden', label: 'Potager', color: '#22c55e' },
  { id: 'orchard', label: 'Verger', color: '#65a30d' },
  { id: 'herb_garden', label: 'Jardin d\'Herbes', color: '#10b981' },
  { id: 'animal_area', label: 'Zone Animaux', color: '#f97316' },
  { id: 'lawn', label: 'Pelouse', color: '#84cc16' },
  { id: 'woodland', label: 'Bois', color: '#166534' },
  { id: 'patio', label: 'Patio', color: '#a1a1aa' },
  { id: 'water_feature', label: 'Point d\'Eau', color: '#3b82f6' },
  { id: 'other', label: 'Autre', color: '#8b5cf6' },
] as const;

type ZoneTypeId = typeof zoneTypes[number]['id'];

interface ZoneDrawerControlProps {
  selectedZoneType: ZoneTypeId;
  onZoneCreated: (coordinates: [number, number][]) => void;
  isActive: boolean;
}

// Leaflet draw control component
function ZoneDrawControl({ selectedZoneType, onZoneCreated, isActive }: ZoneDrawerControlProps) {
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

    // Add the drawn items layer
    map.addLayer(drawnItemsRef.current);

    // Clean up on unmount
    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
      }
      map.removeLayer(drawnItemsRef.current);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !L || !drawnItemsRef.current) return;

    // Remove existing control
    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    if (!isActive) return;

    // Get zone color
    const zoneConfig = zoneTypes.find((z) => z.id === selectedZoneType);
    const color = zoneConfig?.color || '#8b5cf6';

    // Create draw control for polygons only
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
          },
        },
        circle: false,
        rectangle: {
          shapeOptions: {
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
          },
        },
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

    // Handle draw created event
    const handleDrawCreated = (e: any) => {
      const layer = e.layer;

      if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        const latlngs = layer.getLatLngs()[0] as any[];
        const coordinates: [number, number][] = latlngs.map((ll: any) => [ll.lng, ll.lat]);
        onZoneCreated(coordinates);
      }
    };

    map.on(L.Draw.Event.CREATED, handleDrawCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
    };
  }, [map, isActive, selectedZoneType, onZoneCreated]);

  return null;
}

interface ZoneDrawerProps {
  className?: string;
}

export function ZoneDrawer({ className }: ZoneDrawerProps) {
  const { selectedTool, addZone } = useGardenStore();
  const [selectedZoneType, setSelectedZoneType] = useState<ZoneTypeId>('flower_bed');
  const [zoneName, setZoneName] = useState('');

  const isActive = selectedTool === 'zone';

  const handleZoneCreated = (coordinates: [number, number][]) => {
    const zoneConfig = zoneTypes.find((z) => z.id === selectedZoneType);

    const newZone: Zone = {
      id: `zone-${Date.now()}`,
      name: zoneName || `${zoneConfig?.label || 'Zone'} ${Date.now()}`,
      type: selectedZoneType,
      coordinates,
      color: zoneConfig?.color,
    };

    addZone(newZone);
    setZoneName('');
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className={cn('bg-neutral-900 rounded-lg border border-neutral-800', className)}>
      <div className="px-4 py-3 border-b border-neutral-800">
        <h3 className="text-sm font-semibold text-white">Draw Zone</h3>
        <p className="text-xs text-neutral-500 mt-1">
          Select a zone type and draw on the map
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Zone name input */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">
            Zone Name (optional)
          </label>
          <input
            type="text"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            placeholder="e.g., Front Garden"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Zone type selector */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            Zone Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {zoneTypes.map((zoneType) => (
              <button
                key={zoneType.id}
                onClick={() => setSelectedZoneType(zoneType.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  selectedZoneType === zoneType.id
                    ? 'bg-neutral-700 ring-2 ring-green-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                )}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: zoneType.color }}
                />
                <span className="text-xs">{zoneType.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="p-3 bg-green-900/20 rounded-md border border-green-800/50">
          <p className="text-xs text-green-400">
            Use the drawing tools in the top-right corner of the map to draw your zone
          </p>
        </div>
      </div>
    </div>
  );
}

// Export the control for use in GardenCanvas
export { ZoneDrawControl };
export default ZoneDrawer;
