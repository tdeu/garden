/**
 * Rails API Client
 * Single-user mode - no authentication required
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// API error type
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generic fetch wrapper (no auth needed in single-user mode)
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || `HTTP ${response.status}`,
      response.status,
      errorData.details
    );
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ============================================
// Property API (Single Property Mode)
// ============================================

export interface Property {
  id: number;
  name: string;
  location: { lat: number; lng: number };
  bbox?: { xmin: number; ymin: number; xmax: number; ymax: number };
  area_sqm?: number;
  garden_plans_count: number;
  viewpoint_photos_count: number;
  active_plan?: { id: number; name: string; status: string } | null;
}

export async function getProperty(): Promise<Property> {
  return apiFetch<Property>('/property');
}

export async function updateProperty(
  updates: Partial<Pick<Property, 'name' | 'location' | 'bbox' | 'area_sqm'>>
): Promise<Property> {
  return apiFetch<Property>('/property', {
    method: 'PATCH',
    body: JSON.stringify({ property: updates }),
  });
}

// ============================================
// Garden Plan API
// ============================================

import type { Plant, Zone, Structure } from '@/stores/garden-store';

export interface GardenPlan {
  id: number;
  name: string;
  plants: Plant[] | Record<string, Plant>;
  zones: Zone[] | Record<string, Zone>;
  structures: Structure[] | Record<string, Structure>;
  status: 'draft' | 'active' | 'archived';
  total_plants: number;
  total_zones: number;
  created_at: string;
  updated_at: string;
}

export async function getGardenPlans(): Promise<GardenPlan[]> {
  return apiFetch<GardenPlan[]>('/property/garden_plans');
}

export async function getGardenPlan(planId: number): Promise<GardenPlan> {
  return apiFetch<GardenPlan>(`/property/garden_plans/${planId}`);
}

export async function getActiveGardenPlan(): Promise<GardenPlan | null> {
  const plans = await getGardenPlans();
  return plans.find(p => p.status === 'active') || plans[0] || null;
}

export async function createGardenPlan(plan: {
  name?: string;
  plants?: Plant[];
  zones?: Zone[];
  structures?: Structure[];
}): Promise<GardenPlan> {
  return apiFetch<GardenPlan>('/property/garden_plans', {
    method: 'POST',
    body: JSON.stringify({
      garden_plan: {
        name: plan.name || 'New Plan',
        plants: plan.plants || [],
        zones: plan.zones || [],
        structures: plan.structures || [],
      },
    }),
  });
}

export async function updateGardenPlan(
  planId: number,
  updates: Partial<Pick<GardenPlan, 'name' | 'plants' | 'zones' | 'structures'>>
): Promise<GardenPlan> {
  return apiFetch<GardenPlan>(`/property/garden_plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify({ garden_plan: updates }),
  });
}

export async function activateGardenPlan(planId: number): Promise<GardenPlan> {
  return apiFetch<GardenPlan>(`/property/garden_plans/${planId}/activate`, {
    method: 'POST',
  });
}

export async function deleteGardenPlan(planId: number): Promise<void> {
  await apiFetch(`/property/garden_plans/${planId}`, { method: 'DELETE' });
}

// Convenience method for the store
export async function saveGardenPlan(
  plants: Plant[],
  zones: Zone[],
  structures: Structure[]
): Promise<GardenPlan | null> {
  try {
    const existingPlan = await getActiveGardenPlan();

    if (existingPlan) {
      return await updateGardenPlan(existingPlan.id, {
        plants,
        zones,
        structures,
      });
    } else {
      return await createGardenPlan({ plants, zones, structures });
    }
  } catch (error) {
    console.error('Error saving garden plan:', error);
    return null;
  }
}

export async function loadGardenPlan(): Promise<{
  plants: Plant[];
  zones: Zone[];
  structures: Structure[];
} | null> {
  try {
    const plan = await getActiveGardenPlan();
    if (!plan) return null;

    // Handle both array and object formats
    const toArray = <T>(data: T[] | Record<string, T>): T[] => {
      if (Array.isArray(data)) return data;
      return Object.values(data);
    };

    return {
      plants: toArray(plan.plants || []),
      zones: toArray(plan.zones || []),
      structures: toArray(plan.structures || []),
    };
  } catch (error) {
    console.error('Error loading garden plan:', error);
    return null;
  }
}

// ============================================
// Plants API (new dedicated table)
// ============================================

export interface PlantRecord {
  id: number;
  species: string;
  common_name: string;
  category: string;
  location: { lat: number; lng: number };
  planted_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPlants(gardenPlanId: number): Promise<PlantRecord[]> {
  return apiFetch<PlantRecord[]>(`/property/garden_plans/${gardenPlanId}/plants`);
}

export async function createPlant(
  gardenPlanId: number,
  plant: {
    species: string;
    common_name?: string;
    category: string;
    latitude: number;
    longitude: number;
    planted_date?: string;
  }
): Promise<PlantRecord> {
  return apiFetch<PlantRecord>(`/property/garden_plans/${gardenPlanId}/plants`, {
    method: 'POST',
    body: JSON.stringify({ plant }),
  });
}

export async function updatePlant(
  gardenPlanId: number,
  plantId: number,
  updates: Partial<{
    species: string;
    common_name: string;
    category: string;
    latitude: number;
    longitude: number;
    planted_date: string;
  }>
): Promise<PlantRecord> {
  return apiFetch<PlantRecord>(`/property/garden_plans/${gardenPlanId}/plants/${plantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ plant: updates }),
  });
}

export async function deletePlant(gardenPlanId: number, plantId: number): Promise<void> {
  await apiFetch(`/property/garden_plans/${gardenPlanId}/plants/${plantId}`, { method: 'DELETE' });
}

export async function bulkSavePlants(
  gardenPlanId: number,
  plants: Array<{
    species: string;
    common_name?: string;
    category: string;
    location: { lat: number; lng: number };
    planted_date?: string;
    metadata?: Record<string, unknown>;
  }>
): Promise<PlantRecord[]> {
  return apiFetch<PlantRecord[]>(`/property/garden_plans/${gardenPlanId}/plants/bulk`, {
    method: 'POST',
    body: JSON.stringify({ plants }),
  });
}

// ============================================
// Viewpoint Photos API
// ============================================

export interface CoverageArea {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export interface CameraPosition {
  x: number;
  y: number;
}

export interface ViewpointPhoto {
  id: number;
  name: string;
  description?: string;
  capture_date?: string;
  camera_position?: CameraPosition;
  camera_direction?: number; // degrees 0-360
  coverage_area?: CoverageArea;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface LocationMatchResult {
  photo: ViewpointPhoto | null;
  match_quality?: {
    score: number;
    label: 'excellent' | 'good' | 'fair' | 'poor';
  };
  message?: string;
  suggestion?: string;
}

export async function getViewpointPhotos(): Promise<ViewpointPhoto[]> {
  return apiFetch<ViewpointPhoto[]>('/property/viewpoint_photos');
}

export async function getViewpointPhoto(photoId: number): Promise<ViewpointPhoto> {
  return apiFetch<ViewpointPhoto>(`/property/viewpoint_photos/${photoId}`);
}

export async function findPhotoByLocation(x: number, y: number): Promise<LocationMatchResult> {
  return apiFetch<LocationMatchResult>(`/property/viewpoint_photos/by_location?x=${x}&y=${y}`);
}

export async function createViewpointPhoto(data: {
  name: string;
  description?: string;
  capture_date?: string;
  camera_position?: CameraPosition;
  camera_direction?: number;
  coverage_area?: CoverageArea;
}): Promise<ViewpointPhoto> {
  return apiFetch<ViewpointPhoto>('/property/viewpoint_photos', {
    method: 'POST',
    body: JSON.stringify({ viewpoint_photo: data }),
  });
}

export async function uploadViewpointPhoto(
  photoId: number,
  file: File
): Promise<ViewpointPhoto> {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch(
    `${API_BASE_URL}/property/viewpoint_photos/${photoId}/upload_photo`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.error || 'Upload failed', response.status);
  }

  return response.json();
}

export async function createAndUploadViewpointPhoto(
  file: File,
  data: {
    name: string;
    description?: string;
    camera_position?: CameraPosition;
    camera_direction?: number;
    coverage_area?: CoverageArea;
  }
): Promise<ViewpointPhoto> {
  // First create the record
  const photo = await createViewpointPhoto(data);
  // Then upload the file
  return uploadViewpointPhoto(photo.id, file);
}

export async function updateViewpointPhoto(
  photoId: number,
  updates: Partial<Pick<ViewpointPhoto, 'name' | 'description' | 'camera_position' | 'camera_direction' | 'coverage_area'>>
): Promise<ViewpointPhoto> {
  return apiFetch<ViewpointPhoto>(`/property/viewpoint_photos/${photoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ viewpoint_photo: updates }),
  });
}

export async function deleteViewpointPhoto(photoId: number): Promise<void> {
  await apiFetch(`/property/viewpoint_photos/${photoId}`, { method: 'DELETE' });
}

// ============================================
// AI API
// ============================================

export interface TransformViewpointRequest {
  viewpoint_photo_id: number;
  garden_plan_id?: number;
  target_year: number;
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
  plants?: Plant[];
  // Camera position for viewpoint (normalized 0-100)
  camera_position?: { x: number; y: number };
  // Camera direction in degrees (0-360)
  camera_direction?: number;
}

export interface TransformViewpointResponse {
  success: boolean;
  generated_image_base64: string | null;
  generated_image_url: string | null;
  scene_description: string;
  prompt_used: string;
  image_prompt_used?: string;
  plants_shown: Array<{
    name: string;
    visual_appearance: string;
  }>;
  // Mapped field for convenience
  description: string;
}

export async function transformViewpoint(
  request: TransformViewpointRequest
): Promise<TransformViewpointResponse> {
  interface ApiResponse {
    data?: {
      success?: boolean;
      generated_image_base64?: string | null;
      generated_image_url?: string | null;
      scene_description?: string;
      prompt_used?: string;
      image_prompt_used?: string;
      plants_shown?: Array<{ name: string; visual_appearance: string }>;
    };
    success?: boolean;
    generated_image_base64?: string | null;
    generated_image_url?: string | null;
    scene_description?: string;
    prompt_used?: string;
    image_prompt_used?: string;
    plants_shown?: Array<{ name: string; visual_appearance: string }>;
  }

  const response = await apiFetch<ApiResponse>('/ai/transform_viewpoint', {
    method: 'POST',
    body: JSON.stringify({
      viewpoint_photo_id: request.viewpoint_photo_id,
      garden_plan_id: request.garden_plan_id,
      target_years: request.target_year,
      season: request.season,
      plants: request.plants || [],
      camera_position: request.camera_position,
      camera_direction: request.camera_direction,
    }),
  });

  // Handle both wrapped and unwrapped responses
  const data = response.data || response;
  return {
    success: data.success ?? true,
    generated_image_base64: data.generated_image_base64 || null,
    generated_image_url: data.generated_image_url || null,
    scene_description: data.scene_description || '',
    prompt_used: data.prompt_used || '',
    image_prompt_used: data.image_prompt_used,
    plants_shown: data.plants_shown || [],
    description: data.scene_description || '',
  };
}

export interface GeneratePredictionRequest {
  garden_plan_id: number;
  target_year: number;
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
}

export interface PredictionData {
  description: string;
  plant_predictions: Array<{
    plant_id: string;
    name: string;
    predicted_height_cm: number;
    predicted_canopy_cm: number;
    visual_description: string;
  }>;
  atmosphere_notes: string;
}

export async function generatePrediction(
  request: GeneratePredictionRequest
): Promise<PredictionData> {
  return apiFetch<PredictionData>('/ai/generate_prediction', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ============================================
// Export API client
// ============================================

export const apiClient = {
  // Property
  getProperty,
  updateProperty,

  // Garden Plans
  getGardenPlans,
  getGardenPlan,
  getActiveGardenPlan,
  createGardenPlan,
  updateGardenPlan,
  activateGardenPlan,
  deleteGardenPlan,
  saveGardenPlan,
  loadGardenPlan,

  // Plants (dedicated table)
  getPlants,
  createPlant,
  updatePlant,
  deletePlant,
  bulkSavePlants,

  // Viewpoint Photos
  getViewpointPhotos,
  getViewpointPhoto,
  findPhotoByLocation,
  createViewpointPhoto,
  uploadViewpointPhoto,
  createAndUploadViewpointPhoto,
  updateViewpointPhoto,
  deleteViewpointPhoto,

  // AI
  transformViewpoint,
  generatePrediction,
};

export default apiClient;
