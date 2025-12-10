'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, ImageOverlay, Marker, Polygon, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useGardenStore, Plant, Zone, Structure } from '@/stores/garden-store';
import type { TimelineMode } from './Timeline';

// Custom 2025 imagery - one image per zoom level (Huombois, Étalle, Belgium)
// Center: 49.6387, 5.5522 - Bounds calculated to match image aspect ratios
// At lat 49.6°: 1° lat ≈ 111km, 1° lng ≈ 73km
// These are the ORIGINAL images with construction rocks visible (used for Past 2025)
const ZOOM_IMAGES: Record<number, { url: string; bounds: [[number, number], [number, number]] }> = {
  15: { url: '/garden-.png', bounds: [[49.6365, 5.5460], [49.6409, 5.5584]] },
  16: { url: '/garden-c.png', bounds: [[49.6368, 5.5474], [49.6406, 5.5570]] },
  17: { url: '/garden-cl.png', bounds: [[49.6374, 5.5488], [49.6400, 5.5556]] },
  18: { url: '/garden-clo.png', bounds: [[49.6376, 5.5498], [49.6398, 5.5546]] },
  19: { url: '/garden-clos.png', bounds: [[49.6380, 5.5505], [49.6394, 5.5539]] },
  20: { url: '/garden-close.png', bounds: [[49.6382, 5.5512], [49.6392, 5.5532]] },
  21: { url: '/garden-closer.png', bounds: [[49.6384, 5.5515], [49.6390, 5.5529]] },
  22: { url: '/garden-closest.png', bounds: [[49.6385, 5.5518], [49.6389, 5.5526]] },
};

// Cleaned 2025 imagery for "Today/Present" mode (rocks removed via cleanup.pictures)
// These show the property without construction debris - used for garden planning
const ZOOM_IMAGES_CLEAN: Record<number, { url: string; bounds: [[number, number], [number, number]] }> = {
  15: { url: '/garden-_cleanup.png', bounds: [[49.6365, 5.5460], [49.6409, 5.5584]] },
  16: { url: '/garden-c_cleanup.png', bounds: [[49.6368, 5.5474], [49.6406, 5.5570]] },
  17: { url: '/garden-cl_cleanup.png', bounds: [[49.6374, 5.5488], [49.6400, 5.5556]] },
  18: { url: '/garden-clo_cleanup.png', bounds: [[49.6376, 5.5498], [49.6398, 5.5546]] },
  19: { url: '/garden-clos_cleanup.png', bounds: [[49.6380, 5.5505], [49.6394, 5.5539]] },
  20: { url: '/garden-close_cleanup.png', bounds: [[49.6382, 5.5512], [49.6392, 5.5532]] },
  21: { url: '/garden-closer_cleanup.png', bounds: [[49.6384, 5.5515], [49.6390, 5.5529]] },
  22: { url: '/garden-closest_cleanup.png', bounds: [[49.6385, 5.5518], [49.6389, 5.5526]] },
};

// Walloon orthophoto WMS services by year (aerial photos)
const WALLOON_ORTHO_SERVICES: Record<number, { url: string; layers: string; type: 'ortho' | 'map' }> = {
  2023: { url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2023/MapServer/WMSServer', layers: '0', type: 'ortho' },
  2021: { url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2021/MapServer/WMSServer', layers: '0', type: 'ortho' },
  2019: { url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2019/MapServer/WMSServer', layers: '0', type: 'ortho' },
  2015: { url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2015/MapServer/WMSServer', layers: '0', type: 'ortho' },
  2012: { url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2012_2013/MapServer/WMSServer', layers: '0', type: 'ortho' },
  2009: { url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2009_2010/MapServer/WMSServer', layers: '0', type: 'ortho' },
  2006: { url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2006_2007/MapServer/WMSServer', layers: '0', type: 'ortho' },
  // Historical maps (cartographic, not aerial)
  1868: { url: 'https://geoservices.wallonie.be/arcgis/services/CARTES_ANCIENNES/DEPOT_GUERRE_1865_1880/MapServer/WMSServer', layers: '0', type: 'map' },
  1850: { url: 'https://geoservices.wallonie.be/arcgis/services/CARTES_ANCIENNES/VDML/MapServer/WMSServer', layers: '0', type: 'map' },
  1777: { url: 'https://geoservices.wallonie.be/arcgis/services/CARTES_ANCIENNES/FERRARIS/MapServer/WMSServer', layers: '0', type: 'map' },
};

// Fix Leaflet default marker icons in Next.js
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Plant category icons
const plantIcons: Record<string, L.Icon> = {
  tree: L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7"/><path d="M9 9V4l3-3 3 3v5"/><path d="M9 9h6l-3 3-3-3z"/><path d="M6 13h12l-6 6-6-6z"/></svg>`),
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  }),
  shrub: L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"/><path d="M12 18v4"/></svg>`),
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  }),
  perennial: L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-6"/><path d="M12 10c-3 0-6 2-6 6"/><path d="M12 10c3 0 6 2 6 6"/><circle cx="12" cy="6" r="4"/></svg>`),
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  }),
  hedge: L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="10" rx="2"/><line x1="12" y1="18" x2="12" y2="22"/></svg>`),
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  }),
  annual: L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M12 12v10"/><path d="M8 14l4-2 4 2"/></svg>`),
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  }),
};

// Zone type colors
const zoneColors: Record<string, string> = {
  flower_bed: '#ec4899',
  vegetable_garden: '#22c55e',
  lawn: '#84cc16',
  woodland: '#166534',
  patio: '#a1a1aa',
  water_feature: '#3b82f6',
  other: '#8b5cf6',
};

interface GardenCanvasProps {
  center: [number, number];
  zoom?: number;
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  timelineMode?: TimelineMode;
  timelineYear?: number;
}

// Component to handle map events
function MapEventHandler({ onMapClick }: { onMapClick?: (latlng: { lat: number; lng: number }) => void }) {
  const { selectedTool, selectedPlantType, addPlant } = useGardenStore();

  useMapEvents({
    click: (e) => {
      if (selectedTool === 'plant' && selectedPlantType) {
        // Add plant at clicked location
        const newPlant: Plant = {
          id: `plant-${Date.now()}`,
          species: selectedPlantType,
          common_name: selectedPlantType.replace(/_/g, ' '),
          category: 'tree', // Will be updated by PlantLibrary
          location: { lat: e.latlng.lat, lng: e.latlng.lng },
          planted_date: new Date().toISOString().split('T')[0],
        };
        addPlant(newPlant);
      }
      onMapClick?.(e.latlng);
    },
  });

  return null;
}

// Component to fit bounds to property
function PropertyBoundsHandler({ bounds }: { bounds?: L.LatLngBoundsExpression }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);

  return null;
}

// Max bounds for custom imagery (widest image bounds - zoom 15)
const CUSTOM_IMAGERY_BOUNDS: [[number, number], [number, number]] = [[49.6365, 5.5460], [49.6409, 5.5584]];

// Component to show zoom-appropriate custom imagery
// restrictBounds: if true, restrict zoom/pan to imagery area (for Today mode)
function ZoomImageOverlay({ restrictBounds = true }: { restrictBounds?: boolean }) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());

  useEffect(() => {
    if (restrictBounds) {
      // Restrict zoom and pan to custom imagery area in present mode
      map.setMinZoom(15);
      map.setMaxBounds(CUSTOM_IMAGERY_BOUNDS);
      map.options.maxBoundsViscosity = 1.0; // Hard boundary
    }

    const handleZoom = () => {
      setCurrentZoom(Math.round(map.getZoom()));
    };

    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
      if (restrictBounds) {
        map.setMinZoom(12);
        map.setMaxBounds(null as unknown as L.LatLngBoundsExpression); // Remove bounds restriction
      }
    };
  }, [map, restrictBounds]);

  // Get the image config for current zoom (clamp to available range 15-22)
  const zoomLevel = Math.max(15, Math.min(22, currentZoom));
  const imageConfig = ZOOM_IMAGES[zoomLevel];

  if (!imageConfig) return null;

  return (
    <ImageOverlay
      key={`zoom-img-${zoomLevel}`}
      url={imageConfig.url}
      bounds={imageConfig.bounds}
      opacity={1}
      zIndex={100}
    />
  );
}

// Component to show zoom-appropriate CLEANED imagery for "Today/Present" mode
// Uses clean versions (rocks/labels removed), falls back to originals if not available
function CleanZoomImageOverlay() {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  const [cleanImagesAvailable, setCleanImagesAvailable] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Restrict zoom and pan to custom imagery area
    map.setMinZoom(15);
    map.setMaxBounds(CUSTOM_IMAGERY_BOUNDS);
    map.options.maxBoundsViscosity = 1.0;

    // Check which clean images are available
    const checkImages = async () => {
      const available: Record<number, boolean> = {};
      for (const zoomLevel of [15, 16, 17, 18, 19, 20, 21, 22]) {
        const config = ZOOM_IMAGES_CLEAN[zoomLevel];
        if (config) {
          try {
            const response = await fetch(config.url, { method: 'HEAD' });
            available[zoomLevel] = response.ok;
          } catch {
            available[zoomLevel] = false;
          }
        }
      }
      setCleanImagesAvailable(available);
    };
    checkImages();

    const handleZoom = () => {
      setCurrentZoom(Math.round(map.getZoom()));
    };

    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
      map.setMinZoom(12);
      map.setMaxBounds(null as unknown as L.LatLngBoundsExpression);
    };
  }, [map]);

  // Get the image config for current zoom (clamp to available range 15-22)
  const zoomLevel = Math.max(15, Math.min(22, currentZoom));

  // Try clean version first, fall back to original
  const useClean = cleanImagesAvailable[zoomLevel];
  const imageConfig = useClean ? ZOOM_IMAGES_CLEAN[zoomLevel] : ZOOM_IMAGES[zoomLevel];

  if (!imageConfig) return null;

  return (
    <ImageOverlay
      key={`clean-zoom-img-${zoomLevel}-${useClean ? 'clean' : 'original'}`}
      url={imageConfig.url}
      bounds={imageConfig.bounds}
      opacity={1}
      zIndex={100}
    />
  );
}

export function GardenCanvas({ center, zoom = 18, onMapClick, timelineMode = 'present', timelineYear }: GardenCanvasProps) {
  const mapRef = useRef<L.Map | null>(null);
  const { plants, zones, structures, selectedItemId, setSelectedItemId, property } = useGardenStore();

  // Get the appropriate WMS config for historical imagery
  const getHistoricalWmsConfig = (year: number): { url: string; layers: string; type: 'ortho' | 'map' } | null => {
    return WALLOON_ORTHO_SERVICES[year] || null;
  };

  const historicalWmsConfig = timelineMode === 'past' && timelineYear ? getHistoricalWmsConfig(timelineYear) : null;

  // Calculate bounds from property or center
  const getBounds = useCallback((): L.LatLngBoundsExpression | undefined => {
    if (property?.bbox) {
      // Convert Lambert to WGS84 (approximate reverse)
      const sw: [number, number] = [
        50.5039 + (property.bbox.ymin - 671384) / 111000,
        4.3674 + (property.bbox.xmin - 649328) / 73000,
      ];
      const ne: [number, number] = [
        50.5039 + (property.bbox.ymax - 671384) / 111000,
        4.3674 + (property.bbox.xmax - 649328) / 73000,
      ];
      return [sw, ne];
    }
    return undefined;
  }, [property]);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        key={`map-${timelineMode}-${timelineYear}`}
        center={center}
        zoom={zoom}
        minZoom={12}
        maxZoom={22}
        className="w-full h-full"
        ref={mapRef}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
      >
        {/* Base layer - switches based on timeline mode */}
        {timelineMode === 'past' && timelineYear === 2025 ? (
          /* Past 2025 - Custom screenshots (current state with rocks) */
          <>
            {/* Base layer for when zoomed out beyond custom imagery */}
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={20}
            />
            {/* Custom 2025 imagery - without strict bounds restriction */}
            <ZoomImageOverlay restrictBounds={false} />
          </>
        ) : timelineMode === 'past' && historicalWmsConfig ? (
          <>
            {/* Fallback base layer */}
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={20}
            />
            {/* Walloon historical imagery/map overlay */}
            <WMSTileLayer
              key={`wms-${timelineYear}`}
              url={historicalWmsConfig.url}
              layers={historicalWmsConfig.layers}
              format="image/png"
              transparent={false}
              version="1.1.1"
              opacity={1}
              attribution={`&copy; SPW - ${historicalWmsConfig.type === 'map' ? 'Carte' : 'Orthophoto'} ${timelineYear}`}
            />
          </>
        ) : timelineMode === 'future' ? (
          <>
            {/* Present satellite with future indicator overlay */}
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a> | Imagery &copy; Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={20}
              className="future-view"
            />
          </>
        ) : (
          /* Present - Clean 2025 imagery (rocks/labels removed) with zoom */
          <>
            {/* Base satellite layer as fallback while custom images load */}
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={22}
            />
            {/* Clean zoom images - falls back to originals if clean versions don't exist */}
            <CleanZoomImageOverlay />
          </>
        )}


        {/* Map event handler */}
        <MapEventHandler onMapClick={onMapClick} />

        {/* Property bounds handler */}
        <PropertyBoundsHandler bounds={getBounds()} />

        {/* Render zones as polygons */}
        {zones.map((zone) => (
          <Polygon
            key={zone.id}
            positions={zone.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: zone.color || zoneColors[zone.type] || zoneColors.other,
              fillColor: zone.color || zoneColors[zone.type] || zoneColors.other,
              fillOpacity: selectedItemId === zone.id ? 0.5 : 0.3,
              weight: selectedItemId === zone.id ? 3 : 2,
            }}
            eventHandlers={{
              click: () => setSelectedItemId(zone.id),
            }}
          />
        ))}

        {/* Render structures as polylines */}
        {structures.map((structure) => (
          <Polyline
            key={structure.id}
            positions={structure.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: selectedItemId === structure.id ? '#f59e0b' : '#71717a',
              weight: selectedItemId === structure.id ? 4 : 3,
              dashArray: structure.type === 'path' ? '10, 10' : undefined,
            }}
            eventHandlers={{
              click: () => setSelectedItemId(structure.id),
            }}
          />
        ))}

        {/* Render plants as markers */}
        {plants.map((plant) => (
          <Marker
            key={plant.id}
            position={[plant.location.lat, plant.location.lng]}
            icon={plantIcons[plant.category] || defaultIcon}
            eventHandlers={{
              click: () => setSelectedItemId(plant.id),
            }}
          />
        ))}
      </MapContainer>

      {/* Coordinates and timeline display */}
      <div className="absolute bottom-4 left-4 flex gap-2 z-[1000]">
        <div className="bg-black/70 text-white px-3 py-1 rounded text-sm font-mono">
          {center[0].toFixed(5)}, {center[1].toFixed(5)}
        </div>
        {timelineMode !== 'present' && (
          <div className={`px-3 py-1 rounded text-sm font-medium ${
            timelineMode === 'past'
              ? 'bg-amber-600/90 text-white'
              : 'bg-purple-600/90 text-white'
          }`}>
            {timelineMode === 'past' ? `📜 ${timelineYear}` : `✨ ${timelineYear}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default GardenCanvas;
