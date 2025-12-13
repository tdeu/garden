'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useGardenStore, Plant } from '@/stores/garden-store';

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

  const { plants: storePlants, selectedTool, selectedPlantType, addPlant, selectedItemId, setSelectedItemId, setSelectedPlantType, setSelectedTool, syncToCloud } = useGardenStore();

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

    // Draw plants
    plants.forEach((plant) => {
      const pos = latLngToPixel(plant.location.lat, plant.location.lng);
      const color = PLANT_COLORS[plant.category] || '#22c55e';
      const isSelected = selectedItemId === plant.id;

      // Draw plant marker
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected ? 12 : 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.stroke();

      // Draw label for selected plant
      if (isSelected) {
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        const label = plant.common_name || plant.species;
        ctx.strokeText(label, pos.x + 15, pos.y + 5);
        ctx.fillText(label, pos.x + 15, pos.y + 5);
      }
    });

    ctx.restore();
  }, [imageLoaded, offset, scale, plants, selectedItemId, latLngToPixel]);

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
        <div>Select plant tool and click to place</div>
      </div>

      {/* Hover preview for plants with images */}
      {hoveredPlant && hoveredPlant.images && hoveredPlant.images.length > 0 && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: mousePos.x + 20,
            top: mousePos.y - 100,
          }}
        >
          <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-xs">
            <img
              src={hoveredPlant.images[0]}
              alt={hoveredPlant.common_name}
              className="w-48 h-36 object-cover"
            />
            <div className="p-2 bg-white">
              <div className="font-medium text-gray-900 text-sm">{hoveredPlant.common_name}</div>
              <div className="text-xs text-gray-500 italic">{hoveredPlant.species}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CanvasGarden;
