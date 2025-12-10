'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TimelineSlider, type TimelinePoint } from '@/components/Timeline/TimelineSlider';
import { ImageViewer } from '@/components/Timeline/ImageViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchOrthophotoUrl, createBBoxFromCenter, MILESTONE_YEARS } from '@/lib/satellite/walloon-api';
import { ArrowLeft, Map, Sparkles, Settings } from 'lucide-react';

// Default test coordinates (Wallonia, Belgium)
const DEFAULT_LAT = parseFloat(process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_LAT || '50.5');
const DEFAULT_LNG = parseFloat(process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_LNG || '4.5');

// Build timeline points
const TIMELINE_POINTS: TimelinePoint[] = [
  ...MILESTONE_YEARS.map((year) => ({
    year,
    type: 'past' as const,
    label: year === 1971 ? 'Earliest Archive' : 'Historical',
  })),
  { year: 2024, type: 'present' as const, label: 'Current' },
  { year: 2025, type: 'future' as const, label: '+1 Year Prediction' },
  { year: 2026, type: 'future' as const, label: '+2 Years Prediction' },
  { year: 2029, type: 'future' as const, label: '+5 Years Prediction' },
  { year: 2034, type: 'future' as const, label: '+10 Years Prediction' },
].sort((a, b) => a.year - b.year);

export default function TimelinePage() {
  const [mounted, setMounted] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2024);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [propertyLocation, setPropertyLocation] = useState({
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
  });

  const selectedPoint = TIMELINE_POINTS.find((p) => p.year === selectedYear);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch orthophoto when year changes
  useEffect(() => {
    if (!mounted) return;

    const fetchImage = async () => {
      const point = TIMELINE_POINTS.find((p) => p.year === selectedYear);

      if (!point) return;

      // Only fetch for historical/present years
      if (point.type === 'future') {
        setImageUrl(undefined);
        setError('AI predictions will be generated based on your garden plan');
        return;
      }

      // For present year, use 2023 (latest available)
      const fetchYear = point.type === 'present' ? 2023 : selectedYear;

      // Check if year is available
      if (!MILESTONE_YEARS.includes(fetchYear as typeof MILESTONE_YEARS[number])) {
        setImageUrl(undefined);
        setError(`No orthophoto available for ${selectedYear}`);
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        const bbox = createBBoxFromCenter(propertyLocation.lat, propertyLocation.lng, 200);
        const url = await fetchOrthophotoUrl({ year: fetchYear, bbox });
        setImageUrl(url);
      } catch (err) {
        console.error('Failed to fetch orthophoto:', err);
        setError('Failed to load orthophoto. Please check your coordinates.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchImage();
  }, [selectedYear, propertyLocation, mounted]);

  // Auto-play through years
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSelectedYear((prev) => {
        const currentIndex = TIMELINE_POINTS.findIndex((p) => p.year === prev);
        const nextIndex = (currentIndex + 1) % TIMELINE_POINTS.length;
        return TIMELINE_POINTS[nextIndex].year;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handlePlayToggle = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-neutral-950">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-800">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/planner">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Property Timeline</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/planner">
              <Button variant="outline" size="sm" className="gap-2">
                <Map className="h-4 w-4" />
                Garden Planner
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          {/* Main content */}
          <div className="space-y-6">
            {/* Image viewer */}
            <ImageViewer
              imageUrl={imageUrl}
              year={selectedYear}
              type={selectedPoint?.type || 'present'}
              isLoading={isLoading}
              error={error}
              className="border border-neutral-800"
            />

            {/* Timeline slider */}
            <Card>
              <CardContent className="py-6">
                <TimelineSlider
                  points={TIMELINE_POINTS}
                  selectedYear={selectedYear}
                  onYearChange={setSelectedYear}
                  isPlaying={isPlaying}
                  onPlayToggle={handlePlayToggle}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Year info card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {selectedPoint?.type === 'future' && (
                    <Sparkles className="h-5 w-5 text-purple-500" />
                  )}
                  {selectedYear}
                </CardTitle>
                <CardDescription>{selectedPoint?.label}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPoint?.type === 'past' && (
                  <div className="space-y-2 text-sm">
                    <p className="text-neutral-400">
                      Official orthophoto from the Walloon Government geoportal.
                    </p>
                    <p className="text-neutral-500">
                      Resolution: 25cm per pixel
                    </p>
                    <p className="text-neutral-500">
                      Source: geoservices.wallonie.be
                    </p>
                  </div>
                )}

                {selectedPoint?.type === 'present' && (
                  <div className="space-y-2 text-sm">
                    <p className="text-neutral-400">
                      Current view using the most recent available orthophoto (2023).
                    </p>
                    <Link href="/planner">
                      <Button className="mt-4 w-full gap-2">
                        <Map className="h-4 w-4" />
                        Open Garden Planner
                      </Button>
                    </Link>
                  </div>
                )}

                {selectedPoint?.type === 'future' && (
                  <div className="space-y-4 text-sm">
                    <p className="text-neutral-400">
                      AI-generated prediction showing your garden&apos;s evolution.
                    </p>
                    <div className="rounded-lg bg-purple-500/10 p-3">
                      <p className="text-purple-300">
                        Create a garden plan to generate AI predictions for this year.
                      </p>
                    </div>
                    <Link href="/planner">
                      <Button variant="outline" className="w-full gap-2">
                        <Sparkles className="h-4 w-4" />
                        Create Garden Plan
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Property Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={propertyLocation.lat}
                      onChange={(e) =>
                        setPropertyLocation((prev) => ({
                          ...prev,
                          lat: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={propertyLocation.lng}
                      onChange={(e) =>
                        setPropertyLocation((prev) => ({
                          ...prev,
                          lng: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-neutral-500">
                  Enter your property coordinates to view historical orthophotos.
                  Coordinates should be in the Wallonia region (Belgium).
                </p>
              </CardContent>
            </Card>

            {/* Analysis card (placeholder) */}
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis</CardTitle>
                <CardDescription>Historical changes detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-neutral-400">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Vegetation coverage: Analyzing...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span>Structure detection: Analyzing...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Land use changes: Analyzing...</span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-neutral-500">
                  AI analysis will be available after setting up your property.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
