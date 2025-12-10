'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, RotateCcw, Download, Loader2, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageViewerProps {
  imageUrl?: string;
  year: number;
  type: 'past' | 'present' | 'future';
  isLoading?: boolean;
  error?: string;
  className?: string;
}

export function ImageViewer({
  imageUrl,
  year,
  type,
  isLoading = false,
  error,
  className,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [zoom, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && zoom > 1) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.5, Math.min(4, prev + delta)));
  }, []);

  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `terra-memoria-${year}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [imageUrl, year]);

  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      {/* Controls */}
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleZoomIn}
          disabled={zoom >= 4}
          className="bg-neutral-900/80 backdrop-blur-sm"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="bg-neutral-900/80 backdrop-blur-sm"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleReset}
          disabled={zoom === 1 && position.x === 0 && position.y === 0}
          className="bg-neutral-900/80 backdrop-blur-sm"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleDownload}
          disabled={!imageUrl}
          className="bg-neutral-900/80 backdrop-blur-sm"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Year badge */}
      <div className="absolute left-4 top-4 z-10">
        <div
          className={cn(
            'rounded-lg px-3 py-1 text-sm font-bold backdrop-blur-sm',
            type === 'past' && 'bg-neutral-900/80 text-neutral-300',
            type === 'present' && 'bg-green-900/80 text-green-300',
            type === 'future' && 'bg-purple-900/80 text-purple-300'
          )}
        >
          {year}
        </div>
      </div>

      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-neutral-900/80 px-2 py-1 text-xs backdrop-blur-sm">
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* Image container */}
      <div
        className={cn(
          'flex h-[500px] items-center justify-center bg-neutral-900',
          zoom > 1 && 'cursor-move'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 text-neutral-500"
            >
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Loading orthophoto...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 text-neutral-500"
            >
              <ImageOff className="h-8 w-8" />
              <p>{error}</p>
            </motion.div>
          ) : imageUrl ? (
            <motion.img
              key={imageUrl}
              src={imageUrl}
              alt={`Orthophoto ${year}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full object-contain"
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${
                  position.y / zoom
                }px)`,
                transformOrigin: 'center',
              }}
              draggable={false}
            />
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 text-neutral-500"
            >
              <ImageOff className="h-8 w-8" />
              <p>No image available for {year}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Source attribution */}
      <div className="absolute bottom-4 right-4 z-10 rounded-lg bg-neutral-900/80 px-2 py-1 text-xs text-neutral-400 backdrop-blur-sm">
        {type === 'past'
          ? 'Source: Walloon Geoportal'
          : type === 'present'
          ? 'Current View'
          : 'AI Generated'}
      </div>
    </div>
  );
}
