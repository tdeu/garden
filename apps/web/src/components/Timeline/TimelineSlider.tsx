'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TimelinePoint {
  year: number;
  type: 'past' | 'present' | 'future';
  imageUrl?: string;
  label?: string;
  isLoaded?: boolean;
}

interface TimelineSliderProps {
  points: TimelinePoint[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  isPlaying?: boolean;
  onPlayToggle?: () => void;
  className?: string;
}

const MILESTONE_YEARS = [1971, 1994, 2015, 2018, 2021, 2023];
const FUTURE_YEARS = [2025, 2026, 2029, 2034];
const CURRENT_YEAR = 2024;

export function TimelineSlider({
  points,
  selectedYear,
  onYearChange,
  isPlaying = false,
  onPlayToggle,
  className,
}: TimelineSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  // Calculate position for a given year
  const getPositionForYear = useCallback(
    (year: number) => {
      const allYears = points.map((p) => p.year).sort((a, b) => a - b);
      const minYear = allYears[0];
      const maxYear = allYears[allYears.length - 1];
      return ((year - minYear) / (maxYear - minYear)) * 100;
    },
    [points]
  );

  // Get year from position (for drag)
  const getYearFromPosition = useCallback(
    (position: number) => {
      const allYears = points.map((p) => p.year).sort((a, b) => a - b);
      const minYear = allYears[0];
      const maxYear = allYears[allYears.length - 1];
      const year = Math.round(minYear + (position / 100) * (maxYear - minYear));

      // Snap to nearest available year
      let closest = allYears[0];
      let minDiff = Math.abs(year - closest);

      for (const y of allYears) {
        const diff = Math.abs(year - y);
        if (diff < minDiff) {
          minDiff = diff;
          closest = y;
        }
      }

      return closest;
    },
    [points]
  );

  const handleSliderClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const position = ((e.clientX - rect.left) / rect.width) * 100;
      const year = getYearFromPosition(position);
      onYearChange(year);
    },
    [getYearFromPosition, onYearChange]
  );

  const currentPointIndex = useMemo(
    () => points.findIndex((p) => p.year === selectedYear),
    [points, selectedYear]
  );

  const goToPrevious = useCallback(() => {
    if (currentPointIndex > 0) {
      onYearChange(points[currentPointIndex - 1].year);
    }
  }, [currentPointIndex, points, onYearChange]);

  const goToNext = useCallback(() => {
    if (currentPointIndex < points.length - 1) {
      onYearChange(points[currentPointIndex + 1].year);
    }
  }, [currentPointIndex, points, onYearChange]);

  const selectedPoint = points.find((p) => p.year === selectedYear);

  return (
    <div className={cn('w-full', className)}>
      {/* Controls */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevious}
          disabled={currentPointIndex <= 0}
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" onClick={onPlayToggle}>
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          disabled={currentPointIndex >= points.length - 1}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Current year display */}
      <div className="mb-4 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedYear}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="text-4xl font-bold"
          >
            <span
              className={cn(
                selectedPoint?.type === 'past' && 'text-neutral-400',
                selectedPoint?.type === 'present' && 'text-green-500',
                selectedPoint?.type === 'future' && 'text-purple-500'
              )}
            >
              {selectedYear}
            </span>
          </motion.div>
        </AnimatePresence>
        <p className="text-sm text-neutral-500">
          {selectedPoint?.label || (
            selectedPoint?.type === 'past'
              ? 'Historical Orthophoto'
              : selectedPoint?.type === 'present'
              ? 'Current View'
              : 'AI Prediction'
          )}
        </p>
      </div>

      {/* Timeline slider */}
      <div
        className="relative h-12 cursor-pointer px-4"
        onClick={handleSliderClick}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const position = ((e.clientX - rect.left) / rect.width) * 100;
          setHoveredYear(getYearFromPosition(position));
        }}
        onMouseLeave={() => setHoveredYear(null)}
      >
        {/* Track background */}
        <div className="absolute left-4 right-4 top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-800">
          {/* Gradient overlay */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-neutral-600 via-green-600 to-purple-600 opacity-30" />

          {/* Progress fill */}
          <motion.div
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-neutral-500 via-green-500 to-purple-500"
            style={{ width: `${getPositionForYear(selectedYear)}%` }}
            layoutId="progress"
          />
        </div>

        {/* Year markers */}
        {points.map((point) => {
          const position = getPositionForYear(point.year);
          const isSelected = point.year === selectedYear;
          const isHovered = point.year === hoveredYear;

          return (
            <div
              key={point.year}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `calc(${position}% + 16px - ${position * 0.32}px)` }}
            >
              {/* Marker dot */}
              <motion.div
                className={cn(
                  'h-4 w-4 rounded-full border-2 transition-all',
                  point.type === 'past' &&
                    'border-neutral-600 bg-neutral-700',
                  point.type === 'present' &&
                    'border-green-500 bg-green-600',
                  point.type === 'future' &&
                    'border-purple-500 bg-purple-600',
                  isSelected && 'h-6 w-6 ring-2 ring-white/30',
                  isHovered && !isSelected && 'h-5 w-5'
                )}
                whileHover={{ scale: 1.2 }}
                animate={isSelected ? { scale: 1.1 } : {}}
              />

              {/* Year label below */}
              <div
                className={cn(
                  'absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-xs font-mono transition-all',
                  isSelected
                    ? 'text-neutral-200'
                    : 'text-neutral-500 opacity-0 group-hover:opacity-100',
                  isHovered && 'opacity-100'
                )}
              >
                {point.year}
              </div>
            </div>
          );
        })}

        {/* Hover preview tooltip */}
        <AnimatePresence>
          {hoveredYear && hoveredYear !== selectedYear && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-neutral-800 px-2 py-1 text-xs"
              style={{
                left: `calc(${getPositionForYear(hoveredYear)}% + 16px - ${
                  getPositionForYear(hoveredYear) * 0.32
                }px)`,
              }}
            >
              {hoveredYear}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="mt-8 flex justify-center gap-6 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-neutral-600" />
          <span>Historical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>Present</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-purple-500" />
          <span>AI Prediction</span>
        </div>
      </div>
    </div>
  );
}
