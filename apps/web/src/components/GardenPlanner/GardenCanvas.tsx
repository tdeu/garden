'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, ImageOverlay, Marker, Polygon, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useGardenStore, Plant, Zone, Structure, CameraPosition } from '@/stores/garden-store';
import type { TimelineMode } from './Timeline';
import { CanvasGarden } from './CanvasGarden';
import { ViewpointPositionOverlay } from './ViewpointPositionOverlay';

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
// Service names verified from: https://geoservices.wallonie.be/arcgis/rest/services/IMAGERIE?f=json
const WALLOON_ORTHO_SERVICES: Record<number, { url: string; layers: string; type: 'ortho' | 'map' }> = {
  // Modern orthophotos (using correct service names from Walloon geoportal)
  // Note: 2024 removed - no coverage for this property location
  2023: { url: 'https://geoservices.wallonie.be/arcgis/services/IMAGERIE/ORTHO_2023_ETE/MapServer/WMSServer', layers: '0', type: 'ortho' },
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
  // Future mode props for viewpoint position overlay
  showViewpointOverlay?: boolean;
  viewpointCameraPosition?: CameraPosition | null;
  viewpointCameraDirection?: number;
  onViewpointPositionChange?: (pos: CameraPosition) => void;
  onViewpointDirectionChange?: (degrees: number) => void;
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

// Component to display WMS layer for historical imagery
function WmsLayer({ url, layers, attribution, center }: { url: string; layers: string; attribution: string; center: [number, number] }) {
  const map = useMap();
  const wmsLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const [isReady, setIsReady] = useState(false);

  // First effect: Reset map state when component mounts
  useEffect(() => {
    console.log('WmsLayer: Resetting map state for', url.split('/').slice(-3).join('/'));

    // CRITICAL: Remove any bounds restrictions that corrupt Leaflet's projection
    map.setMaxBounds(null as unknown as L.LatLngBoundsExpression);
    map.setMinZoom(12);
    map.options.maxBoundsViscosity = 0;

    // Force reset the map's view to the correct center
    // Use reset: true to force a complete view reset
    const targetZoom = Math.min(map.getZoom(), 18);

    // Set view with no animation to prevent race conditions
    map.setView(center, targetZoom, { animate: false, noMoveStart: true });

    // Force invalidate to recalculate all internal state
    map.invalidateSize({ animate: false, pan: false });

    // Mark as ready after the map has had time to settle
    const readyTimer = setTimeout(() => {
      // Double-check and force the center again right before creating WMS layer
      map.setView(center, map.getZoom(), { animate: false, noMoveStart: true });
      setIsReady(true);
    }, 150);

    return () => {
      clearTimeout(readyTimer);
      setIsReady(false);
    };
  }, [map, center, url]);

  // Second effect: Create WMS layer only after map is ready
  useEffect(() => {
    if (!isReady) return;

    console.log('WmsLayer: Creating layer at center:', map.getCenter().lat.toFixed(5), map.getCenter().lng.toFixed(5));

    // Remove any existing layer
    if (wmsLayerRef.current) {
      map.removeLayer(wmsLayerRef.current);
      wmsLayerRef.current = null;
    }

    // Create the WMS layer
    const wmsLayer = L.tileLayer.wms(url, {
      layers: layers,
      format: 'image/jpeg',
      transparent: false,
      version: '1.1.1',
      attribution: attribution,
    });

    wmsLayerRef.current = wmsLayer;
    wmsLayer.addTo(map);
    wmsLayer.bringToFront();

    return () => {
      if (wmsLayerRef.current) {
        console.log('WmsLayer: Cleanup');
        map.removeLayer(wmsLayerRef.current);
        wmsLayerRef.current = null;
      }
    };
  }, [isReady, map, url, layers, attribution]);

  return null;
}

// Component to show zoom-appropriate CLEANED imagery for "Today/Present" mode
// Uses clean versions (rocks/labels removed) for garden planning
function CleanZoomImageOverlay({ center }: { center: [number, number] }) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());

  useEffect(() => {
    // Ensure we're at a valid zoom level for the custom imagery
    const initialZoom = map.getZoom();
    const validZoom = Math.max(15, Math.min(22, initialZoom));

    // Set minimum zoom only (no maxBounds to avoid view corruption)
    map.setMinZoom(15);

    // Center the map on the property center
    map.setView(center, validZoom, { animate: false });

    const handleZoom = () => {
      setCurrentZoom(Math.round(map.getZoom()));
    };

    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
      map.setMinZoom(12);
    };
  }, [map, center]);

  // Get the image config for current zoom (clamp to available range 15-22)
  const zoomLevel = Math.max(15, Math.min(22, currentZoom));

  // Use cleanup images for Today mode
  const imageConfig = ZOOM_IMAGES_CLEAN[zoomLevel];

  if (!imageConfig) return null;

  return (
    <ImageOverlay
      key={`today-zoom-img-${zoomLevel}`}
      url={imageConfig.url}
      bounds={imageConfig.bounds}
      opacity={1}
      zIndex={100}
    />
  );
}

// Component to manage map center when switching timeline modes
function TimelineModeManager({ center, timelineMode }: { center: [number, number]; timelineMode: TimelineMode }) {
  const map = useMap();
  const previousMode = useRef<TimelineMode>(timelineMode);

  useEffect(() => {
    // When switching FROM present/future TO past, reset the map view
    // This is needed because the CleanZoomImageOverlay sets maxBounds which can corrupt coordinates
    if (previousMode.current !== 'past' && timelineMode === 'past') {
      console.log('Switching to Past mode, resetting map view to:', center);
      // Remove any bounds restrictions first
      map.setMaxBounds(null as unknown as L.LatLngBoundsExpression);
      map.setMinZoom(12);
      // Force set the view to correct center
      map.setView(center, Math.min(map.getZoom(), 18), { animate: false });
      // Invalidate size to force redraw
      setTimeout(() => map.invalidateSize(), 50);
    }
    previousMode.current = timelineMode;
  }, [map, center, timelineMode]);

  return null;
}

export function GardenCanvas({
  center,
  zoom = 18,
  onMapClick,
  timelineMode = 'present',
  timelineYear,
  showViewpointOverlay = false,
  viewpointCameraPosition,
  viewpointCameraDirection = 0,
  onViewpointPositionChange,
  onViewpointDirectionChange,
}: GardenCanvasProps) {
  const mapRef = useRef<L.Map | null>(null);
  const {
    plants: storePlants,
    zones: storeZones,
    structures: storeStructures,
    futurePlanPlants,
    futurePlanZones,
    futurePlanStructures,
    selectedItemId,
    setSelectedItemId,
    property
  } = useGardenStore();

  // In Future mode, use the future plan data; otherwise use the current store data
  const plants = timelineMode === 'future' ? futurePlanPlants : storePlants;
  const zones = timelineMode === 'future' ? futurePlanZones : storeZones;
  const structures = timelineMode === 'future' ? futurePlanStructures : storeStructures;

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

  // For "present" and "future" modes, use Canvas-based view (inspired by simonsarris)
  // This shows the clean property imagery with plants overlaid
  if (timelineMode === 'present' || timelineMode === 'future') {
    return (
      <div className="w-full h-full relative">
        <CanvasGarden
          imageUrl="/garden-_cleanup.png"
          center={center}
          plants={plants}
          zones={zones}
          structures={structures}
          readOnly={timelineMode === 'future'}
        />
        {/* Viewpoint position overlay for Future mode */}
        {timelineMode === 'future' && showViewpointOverlay && (
          <ViewpointPositionOverlay
            cameraPosition={viewpointCameraPosition ?? null}
            cameraDirection={viewpointCameraDirection}
            onPositionChange={onViewpointPositionChange || (() => {})}
            onDirectionChange={onViewpointDirectionChange || (() => {})}
            enabled={true}
          />
        )}
        {/* Coordinates and timeline display */}
        <div className="absolute bottom-4 left-4 flex gap-2 z-[1001]">
          <div className="bg-black/70 text-white px-3 py-1 rounded text-sm font-mono">
            {center[0].toFixed(5)}, {center[1].toFixed(5)}
          </div>
          {timelineMode === 'future' && (
            <div className="px-3 py-1 rounded text-sm font-medium bg-purple-600/90 text-white">
              ✨ {timelineYear}
            </div>
          )}
        </div>
        {/* Help text for Future mode */}
        {timelineMode === 'future' && (
          <div className="absolute bottom-4 right-4 z-[1001] text-xs text-neutral-400 bg-black/50 px-2 py-1 rounded">
            Scroll to zoom • Click to place camera
          </div>
        )}
      </div>
    );
  }

  // For past/future modes, use Leaflet map
  return (
    <div className="w-full h-full relative">
      <MapContainer
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
        {/* Manager to handle map center when switching timeline modes */}
        <TimelineModeManager center={center} timelineMode={timelineMode} />

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
            {/* Walloon historical imagery/map overlay - WMS using native Leaflet */}
            {/* Note: WMS layer is the ONLY layer - it provides full coverage for Walloon region */}
            {/* Key forces full remount when year changes to ensure clean state */}
            <WmsLayer
              key={`wms-${timelineYear}`}
              url={historicalWmsConfig.url}
              layers={historicalWmsConfig.layers}
              attribution={`&copy; SPW - ${historicalWmsConfig.type === 'map' ? 'Carte' : 'Orthophoto'} ${timelineYear}`}
              center={center}
            />
          </>
        ) : (
          <>
            {/* Future mode - base satellite layer + custom property imagery */}
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={22}
            />
            {/* Overlay custom high-res property imagery on top */}
            <CleanZoomImageOverlay center={center} />
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

      {/* Viewpoint position overlay for Future mode */}
      {showViewpointOverlay && timelineMode === 'future' && (
        <ViewpointPositionOverlay
          cameraPosition={viewpointCameraPosition ?? null}
          cameraDirection={viewpointCameraDirection}
          onPositionChange={onViewpointPositionChange || (() => {})}
          onDirectionChange={onViewpointDirectionChange || (() => {})}
          enabled={true}
        />
      )}

      {/* Coordinates and timeline display */}
      <div className="absolute bottom-4 left-4 flex gap-2 z-[1000]">
        <div className="bg-black/70 text-white px-3 py-1 rounded text-sm font-mono">
          {center[0].toFixed(5)}, {center[1].toFixed(5)}
        </div>
        <div className={`px-3 py-1 rounded text-sm font-medium ${
          timelineMode === 'past'
            ? 'bg-amber-600/90 text-white'
            : 'bg-purple-600/90 text-white'
        }`}>
          {timelineMode === 'past' ? `📜 ${timelineYear}` : `✨ ${timelineYear}`}
        </div>
      </div>
    </div>
  );
}

export default GardenCanvas;
