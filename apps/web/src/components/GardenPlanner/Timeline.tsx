'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, History, Calendar, Sparkles, Image, Map } from 'lucide-react';

// Available historical years from Walloon services
// Aerial photos: 2006-2023, Historical maps: 1777-1868
// 2025: Custom Google Maps screenshots (current state with rocks)
// Note: 2024 removed - WMS service has no coverage for this property location
const HISTORICAL_YEARS = [
  { year: 1777, type: 'map' as const, label: '1777' },
  { year: 1850, type: 'map' as const, label: '1850' },
  { year: 1868, type: 'map' as const, label: '1868' },
  { year: 2006, type: 'ortho' as const, label: '2006' },
  { year: 2009, type: 'ortho' as const, label: '2009' },
  { year: 2012, type: 'ortho' as const, label: '2012' },
  { year: 2015, type: 'ortho' as const, label: '2015' },
  { year: 2019, type: 'ortho' as const, label: '2019' },
  { year: 2021, type: 'ortho' as const, label: '2021' },
  { year: 2023, type: 'ortho' as const, label: '2023' },
  { year: 2025, type: 'custom' as const, label: '2025' },
];

// Future years (up to 5 years from now)
const currentYear = new Date().getFullYear();
const FUTURE_YEARS = [1, 2, 3, 4, 5].map(y => currentYear + y);

export type TimelineMode = 'past' | 'present' | 'future';

interface TimelineProps {
  className?: string;
  onTimeChange?: (mode: TimelineMode, year: number) => void;
}

export function Timeline({ className, onTimeChange }: TimelineProps) {
  const [mode, setMode] = useState<TimelineMode>('present');
  const [selectedPastIndex, setSelectedPastIndex] = useState(HISTORICAL_YEARS.length - 1);
  const [selectedFutureYear, setSelectedFutureYear] = useState(FUTURE_YEARS[0]);
  const timelineRef = useRef<HTMLDivElement>(null);

  const selectedPastEntry = HISTORICAL_YEARS[selectedPastIndex];

  const handleModeChange = (newMode: TimelineMode) => {
    setMode(newMode);
    if (newMode === 'past') {
      onTimeChange?.(newMode, selectedPastEntry.year);
    } else if (newMode === 'future') {
      onTimeChange?.(newMode, selectedFutureYear);
    } else {
      onTimeChange?.(newMode, currentYear);
    }
  };

  const handlePastYearChange = (index: number) => {
    setSelectedPastIndex(index);
    onTimeChange?.('past', HISTORICAL_YEARS[index].year);
  };

  const handleFutureYearChange = (year: number) => {
    setSelectedFutureYear(year);
    onTimeChange?.('future', year);
  };

  // Calculate position on timeline (regular intervals)
  const getTimelinePosition = (index: number): number => {
    // Evenly distribute all years across the timeline
    const totalYears = HISTORICAL_YEARS.length;
    return ((index + 1) / totalYears) * 100;
  };

  return (
    <div className={cn('bg-neutral-900 rounded-lg border border-neutral-800', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Timeline</h3>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          View your garden through time
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Mode selector */}
        <div className="flex gap-1 p-1 bg-neutral-800 rounded-lg">
          <button
            onClick={() => handleModeChange('past')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
              mode === 'past'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
            )}
          >
            <History className="w-3.5 h-3.5" />
            Past
          </button>
          <button
            onClick={() => handleModeChange('present')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
              mode === 'present'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            Today
          </button>
          <button
            onClick={() => handleModeChange('future')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
              mode === 'future'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Future
          </button>
        </div>

        {/* Past view - Visual Timeline */}
        {mode === 'past' && (
          <div className="space-y-4">
            {/* Selected year display */}
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{selectedPastEntry.label}</div>
              <div className="text-xs text-neutral-500 flex items-center justify-center gap-1 mt-1">
                {selectedPastEntry.type === 'ortho' ? (
                  <><Image className="w-3 h-3" /> Aerial photo</>
                ) : (
                  <><Map className="w-3 h-3" /> Historical map</>
                )}
              </div>
            </div>

            {/* Visual Timeline */}
            <div className="relative pt-6 pb-2" ref={timelineRef}>
              {/* Timeline track */}
              <div className="absolute top-10 left-0 right-0 h-1 bg-neutral-700 rounded-full" />

              {/* Progress fill */}
              <div
                className="absolute top-10 left-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${getTimelinePosition(selectedPastIndex)}%` }}
              />

              {/* Year markers */}
              <div className="relative h-8">
                {HISTORICAL_YEARS.map((entry, index) => {
                  const position = getTimelinePosition(index);
                  const isSelected = selectedPastIndex === index;

                  // Determine marker color based on type
                  const getMarkerColors = () => {
                    if (isSelected) {
                      return 'w-4 h-4 border-amber-400 bg-amber-500 shadow-lg shadow-amber-500/50';
                    }
                    switch (entry.type) {
                      case 'custom':
                        return 'w-2.5 h-2.5 border-blue-500 bg-blue-600 hover:w-3 hover:h-3 hover:border-blue-400';
                      case 'ortho':
                        return 'w-2.5 h-2.5 border-amber-600 bg-amber-700 hover:w-3 hover:h-3 hover:border-amber-500';
                      default: // map
                        return 'w-2.5 h-2.5 border-orange-600 bg-orange-700 hover:w-3 hover:h-3 hover:border-orange-500';
                    }
                  };

                  return (
                    <button
                      key={entry.year}
                      onClick={() => handlePastYearChange(index)}
                      className={cn(
                        'absolute transform -translate-x-1/2 transition-all duration-200 group',
                        'flex flex-col items-center'
                      )}
                      style={{ left: `${position}%` }}
                    >
                      {/* Year label (shows on hover or when selected) */}
                      <span className={cn(
                        'text-[10px] font-medium mb-1 transition-all whitespace-nowrap',
                        isSelected
                          ? 'opacity-100 text-amber-400'
                          : 'opacity-0 group-hover:opacity-100 text-neutral-400'
                      )}>
                        {entry.label}
                      </span>

                      {/* Marker dot */}
                      <div className={cn(
                        'rounded-full transition-all duration-200 border-2',
                        getMarkerColors()
                      )} />
                    </button>
                  );
                })}
              </div>

              {/* Era labels */}
              <div className="flex justify-between mt-2 px-1">
                <span className="text-[9px] text-amber-500/70">{HISTORICAL_YEARS[0].label}</span>
                <span className="text-[9px] text-orange-500/70">{HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1].label}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 text-[10px] text-neutral-500">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-600" />
                <span>Maps</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-600" />
                <span>Aerial</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Custom</span>
              </div>
            </div>

            {/* Info box */}
            <div className={cn(
              'p-3 rounded-md border',
              selectedPastEntry.type === 'custom'
                ? 'bg-blue-900/20 border-blue-800/50'
                : selectedPastEntry.type === 'ortho'
                  ? 'bg-amber-900/20 border-amber-800/50'
                  : 'bg-orange-900/20 border-orange-800/50'
            )}>
              <div className="flex items-start gap-2">
                {selectedPastEntry.type === 'custom' ? (
                  <Image className="w-4 h-4 text-blue-400 mt-0.5" />
                ) : selectedPastEntry.type === 'ortho' ? (
                  <Image className="w-4 h-4 text-amber-400 mt-0.5" />
                ) : (
                  <Map className="w-4 h-4 text-orange-400 mt-0.5" />
                )}
                <div>
                  <div className={cn(
                    'text-xs font-medium',
                    selectedPastEntry.type === 'custom'
                      ? 'text-blue-400'
                      : selectedPastEntry.type === 'ortho'
                        ? 'text-amber-400'
                        : 'text-orange-400'
                  )}>
                    {selectedPastEntry.type === 'custom'
                      ? 'Google Maps Screenshot 2025'
                      : selectedPastEntry.type === 'ortho'
                        ? `Walloon Orthophoto ${selectedPastEntry.year}`
                        : selectedPastEntry.year === 1777
                          ? 'Ferraris Map (1771-1778)'
                          : selectedPastEntry.year === 1850
                            ? 'Vandermaelen Map (1846-1854)'
                            : 'Dépôt de la Guerre (1865-1880)'
                    }
                  </div>
                  <div className={cn(
                    'text-xs mt-0.5',
                    selectedPastEntry.type === 'custom'
                      ? 'text-blue-500/70'
                      : selectedPastEntry.type === 'ortho'
                        ? 'text-amber-500/70'
                        : 'text-orange-500/70'
                  )}>
                    {selectedPastEntry.type === 'custom'
                      ? 'Current state before garden renovation'
                      : selectedPastEntry.type === 'ortho'
                        ? 'Aerial imagery from the Walloon Region'
                        : selectedPastEntry.year === 1777
                          ? 'First detailed map of the Austrian Netherlands'
                          : selectedPastEntry.year === 1850
                            ? 'Topographic atlas by Philippe Vandermaelen'
                            : 'Military topographic survey of Belgium'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Present view */}
        {mode === 'present' && (
          <div className="space-y-3">
            <div className="text-center py-2">
              <div className="text-2xl font-bold text-green-400">{currentYear}</div>
              <div className="text-xs text-neutral-500">Current satellite view</div>
            </div>

            <div className="p-3 bg-green-900/20 rounded-md border border-green-800/50">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-green-400 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-green-400">Garden Planning Mode</div>
                  <div className="text-xs text-green-500/70 mt-0.5">
                    Use the tools on the left to design your garden
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Future view controls */}
        {mode === 'future' && (
          <div className="space-y-4">
            {/* Selected year display */}
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">{selectedFutureYear}</div>
              <div className="text-xs text-neutral-500 mt-1">
                +{selectedFutureYear - currentYear} year{selectedFutureYear - currentYear > 1 ? 's' : ''} from now
              </div>
            </div>

            {/* Future timeline */}
            <div className="relative pt-6 pb-2">
              {/* Timeline track */}
              <div className="absolute top-10 left-0 right-0 h-1 bg-neutral-700 rounded-full" />

              {/* Progress fill */}
              <div
                className="absolute top-10 left-0 h-1 bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-300"
                style={{ width: `${((selectedFutureYear - currentYear) / 5) * 100}%` }}
              />

              {/* Year markers */}
              <div className="relative h-8">
                {FUTURE_YEARS.map((year, index) => {
                  const position = ((index + 1) / 5) * 100;
                  const isSelected = selectedFutureYear === year;

                  return (
                    <button
                      key={year}
                      onClick={() => handleFutureYearChange(year)}
                      className="absolute transform -translate-x-1/2 transition-all duration-200 group flex flex-col items-center"
                      style={{ left: `${position}%` }}
                    >
                      <span className={cn(
                        'text-[10px] font-medium mb-1 transition-all',
                        isSelected
                          ? 'opacity-100 text-purple-400'
                          : 'opacity-0 group-hover:opacity-100 text-neutral-400'
                      )}>
                        {year}
                      </span>

                      <div className={cn(
                        'rounded-full transition-all duration-200 border-2',
                        isSelected
                          ? 'w-4 h-4 border-purple-400 bg-purple-500 shadow-lg shadow-purple-500/50'
                          : 'w-2.5 h-2.5 border-purple-600 bg-purple-700 hover:w-3 hover:h-3 hover:border-purple-500'
                      )} />
                    </button>
                  );
                })}
              </div>

              {/* Era labels */}
              <div className="flex justify-between mt-2 px-1">
                <span className="text-[9px] text-purple-500/70">+1y</span>
                <span className="text-[9px] text-purple-500/70">+5y</span>
              </div>
            </div>

            <div className="p-3 bg-purple-900/20 rounded-md border border-purple-800/50">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-purple-400">AI Vision Preview</div>
                  <div className="text-xs text-purple-500/70 mt-0.5">
                    Coming soon: AI-generated visualization of your garden&apos;s future growth
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Timeline;
