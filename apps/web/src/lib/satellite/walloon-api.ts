/**
 * Walloon Geoportal API Integration
 *
 * Fetches historical orthophotos from the Walloon government's geoportal.
 * Available years: 1971, 1994, 2006, 2009, 2012, 2013, 2015-2023
 *
 * Note: Uses Lambert 2008 Belgian projection (EPSG:3812)
 */

const ORTHO_SERVICE = 'https://geoservices.wallonie.be/arcgis/rest/services/IMAGERIE';

export interface BBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface OrthophotoOptions {
  year: number;
  bbox: BBox;
  width?: number;
  height?: number;
  format?: 'png' | 'jpg';
}

// Convert WGS84 (lat/lng) to Belgian Lambert 2008 (EPSG:3812)
// Simplified conversion - for production, use proj4js
export function wgs84ToLambert2008(lat: number, lng: number): { x: number; y: number } {
  // Approximate conversion for Belgium region
  // For accurate results, use proj4: proj4('EPSG:4326', 'EPSG:3812', [lng, lat])
  const x = 649328 + (lng - 4.3674) * 73000;
  const y = 671384 + (lat - 50.5039) * 111000;
  return { x, y };
}

// Create a bounding box from center point and size in meters
export function createBBoxFromCenter(
  centerLat: number,
  centerLng: number,
  sizeMeters: number = 200
): BBox {
  const center = wgs84ToLambert2008(centerLat, centerLng);
  const halfSize = sizeMeters / 2;

  return {
    xmin: center.x - halfSize,
    ymin: center.y - halfSize,
    xmax: center.x + halfSize,
    ymax: center.y + halfSize,
  };
}

// Available orthophoto years from Walloon Geoportal
export const AVAILABLE_YEARS = [
  1971, 1994, 2006, 2009, 2012, 2013,
  2015, 2016, 2018, 2019, 2020, 2021, 2023
] as const;

// Key milestone years for the timeline
export const MILESTONE_YEARS = [1971, 1994, 2015, 2018, 2021, 2023] as const;

// Get the service URL for a specific year
function getOrthoServiceUrl(year: number): string {
  return `${ORTHO_SERVICE}/ORTHO_${year}/MapServer/export`;
}

// Check if a year is available
export function isYearAvailable(year: number): boolean {
  return AVAILABLE_YEARS.includes(year as typeof AVAILABLE_YEARS[number]);
}

// Fetch orthophoto image URL
export async function fetchOrthophotoUrl(options: OrthophotoOptions): Promise<string> {
  const { year, bbox, width = 1024, height = 1024, format = 'png' } = options;

  if (!isYearAvailable(year)) {
    throw new Error(`Year ${year} is not available. Available years: ${AVAILABLE_YEARS.join(', ')}`);
  }

  const params = new URLSearchParams({
    bbox: `${bbox.xmin},${bbox.ymin},${bbox.xmax},${bbox.ymax}`,
    bboxSR: '3812', // Lambert 2008
    imageSR: '3812',
    size: `${width},${height}`,
    format: format,
    transparent: 'false',
    f: 'image',
  });

  return `${getOrthoServiceUrl(year)}?${params.toString()}`;
}

// Fetch orthophoto as blob (for caching)
export async function fetchOrthophotoBlob(options: OrthophotoOptions): Promise<Blob> {
  const url = await fetchOrthophotoUrl(options);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch orthophoto: ${response.statusText}`);
  }

  return response.blob();
}

// Fetch all milestone orthophotos for a location
export async function fetchMilestoneOrthophotos(
  centerLat: number,
  centerLng: number,
  sizeMeters: number = 200
): Promise<Map<number, string>> {
  const bbox = createBBoxFromCenter(centerLat, centerLng, sizeMeters);
  const results = new Map<number, string>();

  for (const year of MILESTONE_YEARS) {
    try {
      const url = await fetchOrthophotoUrl({ year, bbox });
      results.set(year, url);
    } catch (error) {
      console.warn(`Failed to fetch orthophoto for year ${year}:`, error);
    }
  }

  return results;
}

// Get metadata about a specific orthophoto layer
export async function getLayerMetadata(year: number): Promise<object | null> {
  if (!isYearAvailable(year)) {
    return null;
  }

  try {
    const url = `${ORTHO_SERVICE}/ORTHO_${year}/MapServer?f=json`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}
