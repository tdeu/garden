'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CameraPosition } from '@/stores/garden-store';

interface ViewpointPositionOverlayProps {
  cameraPosition: CameraPosition | null;
  cameraDirection: number;
  onPositionChange: (pos: CameraPosition) => void;
  onDirectionChange: (degrees: number) => void;
  enabled: boolean;
  className?: string;
}

export function ViewpointPositionOverlay({
  cameraPosition,
  cameraDirection,
  onPositionChange,
  onDirectionChange,
  enabled,
  className,
}: ViewpointPositionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingDirection, setIsDraggingDirection] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [showInstructions, setShowInstructions] = useState(true);

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Convert normalized (0-100) coordinates to pixel coordinates
  const normalizedToPixel = useCallback((pos: CameraPosition) => {
    return {
      x: (pos.x / 100) * containerSize.width,
      y: (pos.y / 100) * containerSize.height,
    };
  }, [containerSize]);

  // Convert pixel coordinates to normalized (0-100)
  const pixelToNormalized = useCallback((x: number, y: number): CameraPosition => {
    return {
      x: Math.max(0, Math.min(100, (x / containerSize.width) * 100)),
      y: Math.max(0, Math.min(100, (y / containerSize.height) * 100)),
    };
  }, [containerSize]);

  // Calculate direction from camera position to a point
  const calculateDirection = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    // atan2 gives angle from positive x-axis, but we want 0 = up/north
    let degrees = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (degrees < 0) degrees += 360;
    return degrees;
  }, []);

  // Handle click to place camera
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!enabled || isDraggingDirection) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normalized = pixelToNormalized(x, y);
    onPositionChange(normalized);
    setShowInstructions(false);
  }, [enabled, isDraggingDirection, pixelToNormalized, onPositionChange]);

  // Handle drag start for direction
  const handlePinMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled || !cameraPosition) return;
    e.stopPropagation();
    setIsDraggingDirection(true);
  }, [enabled, cameraPosition]);

  // Handle drag for direction
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingDirection || !cameraPosition || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const pinPos = normalizedToPixel(cameraPosition);
    const direction = calculateDirection(pinPos.x, pinPos.y, mouseX, mouseY);
    onDirectionChange(direction);
  }, [isDraggingDirection, cameraPosition, normalizedToPixel, calculateDirection, onDirectionChange]);

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDraggingDirection(false);
  }, []);

  // Add global mouse up listener
  useEffect(() => {
    if (isDraggingDirection) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDraggingDirection, handleMouseUp]);

  // Calculate arrow endpoint for direction indicator
  const getArrowEndpoint = useCallback(() => {
    if (!cameraPosition) return null;

    const pinPos = normalizedToPixel(cameraPosition);
    const arrowLength = 80; // pixels
    const radians = (cameraDirection - 90) * (Math.PI / 180);

    return {
      x: pinPos.x + Math.cos(radians) * arrowLength,
      y: pinPos.y + Math.sin(radians) * arrowLength,
    };
  }, [cameraPosition, cameraDirection, normalizedToPixel]);

  // Render field of view cone
  const renderFovCone = useCallback(() => {
    if (!cameraPosition) return null;

    const pinPos = normalizedToPixel(cameraPosition);
    const fovAngle = 60; // degrees
    const coneLength = 120; // pixels

    const leftRadians = (cameraDirection - fovAngle / 2 - 90) * (Math.PI / 180);
    const rightRadians = (cameraDirection + fovAngle / 2 - 90) * (Math.PI / 180);

    const leftX = pinPos.x + Math.cos(leftRadians) * coneLength;
    const leftY = pinPos.y + Math.sin(leftRadians) * coneLength;
    const rightX = pinPos.x + Math.cos(rightRadians) * coneLength;
    const rightY = pinPos.y + Math.sin(rightRadians) * coneLength;

    const pathD = `M ${pinPos.x} ${pinPos.y} L ${leftX} ${leftY} A ${coneLength} ${coneLength} 0 0 1 ${rightX} ${rightY} Z`;

    return (
      <path
        d={pathD}
        fill="rgba(147, 51, 234, 0.2)"
        stroke="rgba(147, 51, 234, 0.6)"
        strokeWidth="1"
      />
    );
  }, [cameraPosition, cameraDirection, normalizedToPixel]);

  const pinPos = cameraPosition ? normalizedToPixel(cameraPosition) : null;
  const arrowEnd = getArrowEndpoint();

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute inset-0 z-[1000]',
        className
      )}
      style={{ pointerEvents: 'none' }}
    >
      {/* Click capture layer - allows scroll through but captures clicks */}
      {enabled && (
        <div
          className="absolute inset-0"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          style={{
            pointerEvents: 'auto',
            cursor: 'crosshair'
          }}
        />
      )}

      {/* Instructions */}
      {enabled && showInstructions && !cameraPosition && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 rounded-lg text-white text-sm pointer-events-none">
          Cliquez sur la carte pour placer la position de la camera
        </div>
      )}

      {enabled && cameraPosition && showInstructions && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 rounded-lg text-white text-sm pointer-events-none">
          Faites glisser depuis le marqueur pour definir la direction
        </div>
      )}

      {/* SVG overlay for shapes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Field of view cone */}
        {pinPos && renderFovCone()}

        {/* Direction arrow */}
        {pinPos && arrowEnd && (
          <line
            x1={pinPos.x}
            y1={pinPos.y}
            x2={arrowEnd.x}
            y2={arrowEnd.y}
            stroke="#9333ea"
            strokeWidth="3"
            strokeLinecap="round"
            markerEnd="url(#arrowhead)"
          />
        )}

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#9333ea" />
          </marker>
        </defs>
      </svg>

      {/* Camera pin */}
      {pinPos && (
        <div
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-purple-600 border-2 border-white shadow-lg flex items-center justify-center',
            enabled && 'cursor-grab hover:bg-purple-700',
            isDraggingDirection && 'cursor-grabbing bg-purple-800'
          )}
          style={{ left: pinPos.x, top: pinPos.y }}
          onMouseDown={handlePinMouseDown}
        >
          <Camera className="w-5 h-5 text-white" />
        </div>
      )}

      {/* Direction indicator label */}
      {pinPos && (
        <div
          className="absolute px-2 py-1 bg-black/70 rounded text-white text-xs whitespace-nowrap"
          style={{
            left: pinPos.x + 25,
            top: pinPos.y - 30,
          }}
        >
          {Math.round(cameraDirection)}°
        </div>
      )}
    </div>
  );
}

export default ViewpointPositionOverlay;
