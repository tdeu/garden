'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useGardenStore, Plant, Zone, Structure } from '@/stores/garden-store';

// Property bounds in lat/lng (for converting to/from pixel coordinates)
const PROPERTY_BOUNDS = {
  north: 49.6409,
  south: 49.6365,
  east: 5.5584,
  west: 5.5460,
};

// Plant category colors
const PLANT_COLORS: Record<string, string> = {
  tree: '#166534',
  fruit_tree: '#15803d',
  shrub: '#22c55e',
  perennial: '#a855f7',
  hedge: '#84cc16',
  annual: '#f59e0b',
  vegetable: '#10b981',
  herb: '#14b8a6',
  berry: '#ec4899',
  wall_plant: '#94a3b8', // Stone gray for wall plants
  bulb: '#fbbf24', // Yellow for spring bulbs
};

// Zone styling for clean overlay
const ZONE_STYLES: Record<string, { fill: string; stroke: string; label: string }> = {
  woodland: { fill: 'rgba(180, 200, 160, 0.7)', stroke: '#6b7c5a', label: 'The Woods' },
  lawn: { fill: 'rgba(200, 220, 180, 0.6)', stroke: '#8a9a70', label: 'Lawn' },
  flower_bed: { fill: 'rgba(220, 180, 200, 0.5)', stroke: '#a07090', label: 'Flower Bed' },
  vegetable_garden: { fill: 'rgba(180, 200, 160, 0.5)', stroke: '#708060', label: 'Vegetable Garden' },
  orchard: { fill: 'rgba(200, 210, 170, 0.5)', stroke: '#909a70', label: 'Orchard' },
  herb_garden: { fill: 'rgba(170, 200, 180, 0.5)', stroke: '#609070', label: 'Herb Garden' },
  animal_area: { fill: 'rgba(200, 190, 160, 0.5)', stroke: '#a09060', label: 'Animal Area' },
  patio: { fill: 'rgba(180, 175, 170, 0.6)', stroke: '#706560', label: 'Patio' },
  water_feature: { fill: 'rgba(160, 190, 210, 0.6)', stroke: '#5080a0', label: 'Water' },
  other: { fill: 'rgba(190, 190, 190, 0.5)', stroke: '#808080', label: '' },
};

// Structure styling for clean overlay
const STRUCTURE_STYLES: Record<string, { fill: string; stroke: string; strokeWidth: number }> = {
  house: { fill: 'rgba(180, 180, 185, 0.85)', stroke: '#2a2a2a', strokeWidth: 3 },
  shed: { fill: 'rgba(160, 150, 140, 0.8)', stroke: '#3a3530', strokeWidth: 2 },
  greenhouse: { fill: 'rgba(200, 220, 210, 0.6)', stroke: '#406050', strokeWidth: 2 },
  terrace: { fill: 'rgba(190, 180, 170, 0.7)', stroke: '#504540', strokeWidth: 2 },
  stone_terrace: { fill: 'rgba(180, 175, 170, 0.7)', stroke: '#605550', strokeWidth: 2 },
  path: { fill: 'rgba(170, 165, 155, 0.7)', stroke: '#605550', strokeWidth: 1 },
  driveway: { fill: 'rgba(140, 140, 145, 0.8)', stroke: '#404045', strokeWidth: 2 },
  stone_path: { fill: 'rgba(175, 170, 165, 0.7)', stroke: '#656055', strokeWidth: 1 },
  fence: { fill: 'transparent', stroke: '#4a4035', strokeWidth: 2 },
  wall: { fill: 'transparent', stroke: '#505050', strokeWidth: 3 },
  dry_stone_wall: { fill: 'transparent', stroke: '#707065', strokeWidth: 3 },
  pond: { fill: 'rgba(140, 180, 200, 0.7)', stroke: '#406080', strokeWidth: 2 },
  other: { fill: 'rgba(180, 180, 180, 0.5)', stroke: '#606060', strokeWidth: 1 },
};

interface CanvasGardenProps {
  imageUrl: string;
  center: [number, number];
  plants?: Plant[];
  zones?: unknown[];
  structures?: unknown[];
  readOnly?: boolean; // If true, don't allow adding plants (for Future mode)
}

export function CanvasGarden({ imageUrl, center, plants: propPlants, readOnly = false }: CanvasGardenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [hoveredPlant, setHoveredPlant] = useState<Plant | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mouseLatLng, setMouseLatLng] = useState({ lat: 0, lng: 0 });

  const { plants: storePlants, zones, structures, selectedTool, selectedPlantType, addPlant, selectedItemId, setSelectedItemId, setSelectedPlantType, setSelectedTool, syncToCloud } = useGardenStore();

  // Use provided plants (for Future mode) or store plants (for Today mode)
  const plants = propPlants || storePlants;

  // Convert lat/lng to canvas pixel coordinates
  const latLngToPixel = useCallback((lat: number, lng: number) => {
    if (!imageRef.current) return { x: 0, y: 0 };

    const imgWidth = imageRef.current.naturalWidth;
    const imgHeight = imageRef.current.naturalHeight;

    const x = ((lng - PROPERTY_BOUNDS.west) / (PROPERTY_BOUNDS.east - PROPERTY_BOUNDS.west)) * imgWidth;
    const y = ((PROPERTY_BOUNDS.north - lat) / (PROPERTY_BOUNDS.north - PROPERTY_BOUNDS.south)) * imgHeight;

    return { x, y };
  }, []);

  // Convert canvas pixel to lat/lng
  const pixelToLatLng = useCallback((px: number, py: number) => {
    if (!imageRef.current) return { lat: 0, lng: 0 };

    const imgWidth = imageRef.current.naturalWidth;
    const imgHeight = imageRef.current.naturalHeight;

    const lng = PROPERTY_BOUNDS.west + (px / imgWidth) * (PROPERTY_BOUNDS.east - PROPERTY_BOUNDS.west);
    const lat = PROPERTY_BOUNDS.north - (py / imgHeight) * (PROPERTY_BOUNDS.north - PROPERTY_BOUNDS.south);

    return { lat, lng };
  }, []);

  // Convert screen coordinates to image coordinates
  const screenToImage = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (screenX - rect.left - offset.x) / scale;
    const y = (screenY - rect.top - offset.y) / scale;

    return { x, y };
  }, [offset, scale]);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
  }, [imageUrl]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Center on property when image loads
  useEffect(() => {
    if (!imageLoaded || !imageRef.current || canvasSize.width === 0) return;

    const img = imageRef.current;

    // Calculate scale to fit image in canvas
    const scaleX = canvasSize.width / img.naturalWidth;
    const scaleY = canvasSize.height / img.naturalHeight;
    const fitScale = Math.min(scaleX, scaleY) * 0.9;

    setScale(fitScale);

    // Center the image
    const scaledWidth = img.naturalWidth * fitScale;
    const scaledHeight = img.naturalHeight * fitScale;
    setOffset({
      x: (canvasSize.width - scaledWidth) / 2,
      y: (canvasSize.height - scaledHeight) / 2,
    });
  }, [imageLoaded, canvasSize]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageLoaded || !imageRef.current) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context and apply transformations
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw satellite image
    ctx.drawImage(imageRef.current, 0, 0);

    // Draw muted overlay to soften satellite imagery
    const img = imageRef.current;
    ctx.fillStyle = 'rgba(215, 220, 200, 0.45)'; // Soft beige-green tint
    ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);

    // Hardcoded woods overlay - everything left of the boundary line
    const woodsBoundary: [number, number][] = [
      [49.636578, 5.551068],
      [49.639441, 5.550839],
      [49.639588, 5.551106],
      [49.640191, 5.551335],
      [49.640449, 5.552436],
      [49.640800, 5.553070],
    ];
    // Create polygon: boundary + extend to left edge of image
    const woodsPolygon: [number, number][] = [
      ...woodsBoundary,
      [PROPERTY_BOUNDS.north, 5.553070], // extend to top
      [PROPERTY_BOUNDS.north, PROPERTY_BOUNDS.west], // top-left corner
      [PROPERTY_BOUNDS.south, PROPERTY_BOUNDS.west], // bottom-left corner
      [PROPERTY_BOUNDS.south, 5.551068], // bottom at boundary lng
    ];
    const woodsPixels = woodsPolygon.map(([lat, lng]) => latLngToPixel(lat, lng));

    // Draw woods with green overlay
    ctx.beginPath();
    ctx.moveTo(woodsPixels[0].x, woodsPixels[0].y);
    for (let i = 1; i < woodsPixels.length; i++) {
      ctx.lineTo(woodsPixels[i].x, woodsPixels[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(34, 85, 51, 0.35)'; // Forest green overlay
    ctx.fill();

    // "La Forêt" label
    const forestLabelPos = latLngToPixel(49.639003, 5.548248);
    const forestFontSize = Math.max(14, Math.min(40, 30 / Math.sqrt(scale)));
    ctx.font = `italic ${forestFontSize}px Georgia, serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('La Forêt', forestLabelPos.x, forestLabelPos.y);

    // "Le Pâturage" label
    const pastureLabelPos = latLngToPixel(49.639731, 5.553314);
    ctx.fillText('Le Pâturage', pastureLabelPos.x, pastureLabelPos.y);

    // Hardcoded house - perfect rectangle from bounding box
    const houseCorners: [number, number][] = [
      [49.638753, 5.551657], // NW
      [49.638753, 5.551928], // NE
      [49.638599, 5.551928], // SE
      [49.638599, 5.551657], // SW
    ];
    const housePixels = houseCorners.map(([lat, lng]) => latLngToPixel(lat, lng));

    // Draw house filled with white
    ctx.beginPath();
    ctx.moveTo(housePixels[0].x, housePixels[0].y);
    for (let i = 1; i < housePixels.length; i++) {
      ctx.lineTo(housePixels[i].x, housePixels[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Calculate house center for label
    const houseCenterX = (housePixels[0].x + housePixels[2].x) / 2;
    const houseCenterY = (housePixels[0].y + housePixels[2].y) / 2;
    const houseWidth = Math.abs(housePixels[1].x - housePixels[0].x);

    // Draw "La Maison" label in black
    const maxFontSize = houseWidth * 0.12;
    const houseFontSize = Math.max(4, Math.min(maxFontSize, 8 / Math.sqrt(scale)));
    ctx.font = `${houseFontSize}px Georgia, serif`;
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('La Maison', houseCenterX, houseCenterY);

    // Helper to convert lat/lng coordinates array to pixel path
    const coordsToPath = (coords: [number, number][]) => {
      return coords.map(([lat, lng]) => latLngToPixel(lat, lng));
    };

    // Helper to get center of polygon for label placement
    const getPolygonCenter = (coords: [number, number][]) => {
      const pixels = coordsToPath(coords);
      const sumX = pixels.reduce((sum, p) => sum + p.x, 0);
      const sumY = pixels.reduce((sum, p) => sum + p.y, 0);
      return { x: sumX / pixels.length, y: sumY / pixels.length };
    };

    // Draw zones with fills and labels
    zones.forEach((zone) => {
      if (zone.coordinates.length < 3) return;

      const style = ZONE_STYLES[zone.type] || ZONE_STYLES.other;
      const pixels = coordsToPath(zone.coordinates);

      // Draw filled zone
      ctx.beginPath();
      ctx.moveTo(pixels[0].x, pixels[0].y);
      for (let i = 1; i < pixels.length; i++) {
        ctx.lineTo(pixels[i].x, pixels[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = style.fill;
      ctx.fill();
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 2 / scale;
      ctx.stroke();

      // Draw zone label
      const labelText = zone.name || style.label;
      if (labelText) {
        const center = getPolygonCenter(zone.coordinates);
        const fontSize = Math.max(12, Math.min(24, 18 / Math.sqrt(scale)));
        ctx.font = `italic ${fontSize}px Georgia, serif`;
        ctx.fillStyle = 'rgba(60, 60, 50, 0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, center.x, center.y);
      }
    });

    // Draw structures with clean outlines
    structures.forEach((structure) => {
      if (structure.coordinates.length < 2) return;

      const style = STRUCTURE_STYLES[structure.type] || STRUCTURE_STYLES.other;
      const pixels = coordsToPath(structure.coordinates);

      // Draw structure (polygon or line)
      ctx.beginPath();
      ctx.moveTo(pixels[0].x, pixels[0].y);
      for (let i = 1; i < pixels.length; i++) {
        ctx.lineTo(pixels[i].x, pixels[i].y);
      }

      // Close polygon for filled structures (house, shed, etc.)
      const isPolygon = ['house', 'shed', 'greenhouse', 'terrace', 'stone_terrace', 'pond'].includes(structure.type);
      if (isPolygon && structure.coordinates.length > 2) {
        ctx.closePath();
        ctx.fillStyle = style.fill;
        ctx.fill();
      }

      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth / Math.sqrt(scale);
      ctx.stroke();

      // Draw structure label
      if (structure.name && isPolygon) {
        const center = getPolygonCenter(structure.coordinates);
        const fontSize = Math.max(14, Math.min(28, 22 / Math.sqrt(scale)));
        ctx.font = `${fontSize}px Georgia, serif`;
        ctx.fillStyle = 'rgba(40, 40, 35, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(structure.name, center.x, center.y);
      }
    });

    // Draw plants
    // Scale marker size inversely with zoom - smaller when zoomed in for clearer view
    const baseRadius = 8;
    const scaledRadius = Math.max(3, Math.min(12, baseRadius / Math.sqrt(scale)));

    plants.forEach((plant) => {
      const pos = latLngToPixel(plant.location.lat, plant.location.lng);
      const color = PLANT_COLORS[plant.category] || '#22c55e';
      const isSelected = selectedItemId === plant.id;
      const isPlanned = !plant.lifecycle_status || plant.lifecycle_status === 'planned';

      // Draw plant marker with zoom-adjusted size
      const radius = isSelected ? scaledRadius * 1.5 : scaledRadius;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

      // Planned plants: lighter/transparent fill with dashed border
      // Planted plants: solid fill
      if (isPlanned) {
        ctx.fillStyle = color + '60'; // 60 = 37.5% opacity
        ctx.fill();
        ctx.setLineDash([2 / scale, 2 / scale]); // Dashed border for planned
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, 2 / Math.sqrt(scale));
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
      } else {
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
        ctx.lineWidth = Math.max(0.5, (isSelected ? 2 : 1) / Math.sqrt(scale));
        ctx.stroke();
      }

      // Draw selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 3 / scale, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, 2 / Math.sqrt(scale));
        ctx.stroke();
      }

      // Draw label for selected plant (also scaled with zoom)
      if (isSelected) {
        const fontSize = Math.max(8, Math.min(14, 12 / Math.sqrt(scale)));
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1, 3 / Math.sqrt(scale));
        const label = plant.common_name || plant.species;
        const statusSuffix = isPlanned ? ' (planned)' : '';
        const labelOffset = radius + 5;
        ctx.strokeText(label + statusSuffix, pos.x + labelOffset, pos.y + fontSize / 3);
        ctx.fillText(label + statusSuffix, pos.x + labelOffset, pos.y + fontSize / 3);
      }
    });

    ctx.restore();
  }, [imageLoaded, offset, scale, plants, zones, structures, selectedItemId, latLngToPixel]);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, scale * zoomFactor));

    // Zoom towards mouse position
    const scaleChange = newScale / scale;
    setOffset({
      x: mouseX - (mouseX - offset.x) * scaleChange,
      y: mouseY - (mouseY - offset.y) * scaleChange,
    });
    setScale(newScale);
  }, [scale, offset]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && selectedTool === 'plant' && selectedPlantType) {
      // Left click to place plant
      const imgCoords = screenToImage(e.clientX, e.clientY);
      const latLng = pixelToLatLng(imgCoords.x, imgCoords.y);

      // Check if click is within image bounds
      if (imageRef.current) {
        const img = imageRef.current;
        if (imgCoords.x >= 0 && imgCoords.x <= img.naturalWidth &&
            imgCoords.y >= 0 && imgCoords.y <= img.naturalHeight) {
          const newPlant: Plant = {
            id: `plant-${Date.now()}`,
            species: selectedPlantType,
            common_name: selectedPlantType.replace(/_/g, ' '),
            category: 'tree',
            location: { lat: latLng.lat, lng: latLng.lng },
            planted_date: new Date().toISOString().split('T')[0],
          };
          addPlant(newPlant);

          // Auto-deselect plant type and switch to select tool
          setSelectedPlantType(null);
          setSelectedTool('select');

          // Auto-save to cloud
          syncToCloud();
        }
      }
    } else if (e.button === 0 && selectedTool === 'select') {
      // Left click - check if clicking on a plant first
      const imgCoords = screenToImage(e.clientX, e.clientY);
      const clickThreshold = 15 / scale;

      // Log coordinates to console for easy copying (Shift+click)
      if (e.shiftKey) {
        const latLng = pixelToLatLng(imgCoords.x, imgCoords.y);
        console.log(`[${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}],`);
        return;
      }

      let clickedPlant: Plant | null = null;
      for (const plant of plants) {
        const pos = latLngToPixel(plant.location.lat, plant.location.lng);
        const dist = Math.sqrt((pos.x - imgCoords.x) ** 2 + (pos.y - imgCoords.y) ** 2);
        if (dist < clickThreshold) {
          clickedPlant = plant;
          break;
        }
      }

      if (clickedPlant) {
        setSelectedItemId(clickedPlant.id);
      } else {
        // No plant clicked - start panning
        setSelectedItemId(null);
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      }
    } else if (e.button === 0) {
      // Default: left click starts panning
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    } else if (e.button === 1) {
      // Middle click also pans
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }, [selectedTool, selectedPlantType, offset, screenToImage, pixelToLatLng, addPlant, plants, latLngToPixel, scale, setSelectedItemId, setSelectedPlantType, setSelectedTool, syncToCloud]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setMousePos({ x: e.clientX, y: e.clientY });

    // Update mouse lat/lng coordinates
    const imgCoords = screenToImage(e.clientX, e.clientY);
    const latLng = pixelToLatLng(imgCoords.x, imgCoords.y);
    setMouseLatLng(latLng);

    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else {
      // Check if hovering over a plant
      const hoverThreshold = 20 / scale;

      let foundPlant: Plant | null = null;
      for (const plant of plants) {
        const pos = latLngToPixel(plant.location.lat, plant.location.lng);
        const dist = Math.sqrt((pos.x - imgCoords.x) ** 2 + (pos.y - imgCoords.y) ** 2);
        if (dist < hoverThreshold) {
          foundPlant = plant;
          break;
        }
      }
      setHoveredPlant(foundPlant);
    }
  }, [isDragging, dragStart, screenToImage, pixelToLatLng, plants, latLngToPixel, scale]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle double click to zoom in
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1.5; // Zoom in by 50%
    const newScale = Math.min(10, scale * zoomFactor);

    // Zoom towards mouse position
    const scaleChange = newScale / scale;
    setOffset({
      x: mouseX - (mouseX - offset.x) * scaleChange,
      y: mouseY - (mouseY - offset.y) * scaleChange,
    });
    setScale(newScale);
  }, [scale, offset]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-slate-900"
      style={{ cursor: isDragging ? 'grabbing' : (selectedTool === 'plant' ? 'crosshair' : 'grab') }}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={() => setScale(s => Math.min(10, s * 1.2))}
          className="w-8 h-8 bg-white rounded shadow flex items-center justify-center hover:bg-gray-100"
        >
          +
        </button>
        <button
          onClick={() => setScale(s => Math.max(0.1, s / 1.2))}
          className="w-8 h-8 bg-white rounded shadow flex items-center justify-center hover:bg-gray-100"
        >
          −
        </button>
      </div>

      {/* Coordinates display */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-sm font-mono z-10">
        {mouseLatLng.lat.toFixed(5)}, {mouseLatLng.lng.toFixed(5)}
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded text-xs z-10">
        <div>Scroll to zoom • Drag to pan</div>
        <div>Shift+click to log coordinates to console</div>
      </div>

      {/* Hover tooltip for plants */}
      {hoveredPlant && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y - 40,
          }}
        >
          <div className="bg-black/80 text-white px-3 py-2 rounded-lg shadow-lg">
            <div className="font-medium text-sm">{hoveredPlant.common_name}</div>
            <div className="text-xs text-gray-300 italic">{hoveredPlant.species}</div>
          </div>
        </div>
      )}

      {/* Selected plant panel */}
      {selectedItemId && (() => {
        const selectedPlant = plants.find(p => p.id === selectedItemId);
        if (!selectedPlant) return null;
        const imageUrl = `/plants/${selectedPlant.species}.jpg`;
        return (
          <div className="absolute bottom-4 right-4 w-64 bg-white rounded-lg shadow-xl overflow-hidden z-20">
            <div className="relative h-40 bg-gray-200">
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm z-0">
                <span className="bg-gray-200 px-2 py-1 rounded">No image</span>
              </div>
              <img
                src={imageUrl}
                alt={selectedPlant.common_name}
                className="absolute inset-0 w-full h-full object-cover z-10"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="p-3">
              <div className="font-semibold text-gray-900">{selectedPlant.common_name}</div>
              <div className="text-sm text-gray-500 italic">{selectedPlant.species.replace(/_/g, ' ')}</div>
              <div className="mt-2 text-xs text-gray-400">
                Planted: {selectedPlant.planted_date}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default CanvasGarden;
