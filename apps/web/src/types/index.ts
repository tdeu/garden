/**
 * Shared Types for Terra Memoria Garden Planner
 * Single source of truth for all domain types
 */

// ============================================
// Core Domain Types
// ============================================

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface CameraPosition {
  x: number;
  y: number;
}

export interface CoverageArea {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export interface BoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

// ============================================
// Plant Types
// ============================================

export type PlantCategory =
  | 'tree'
  | 'fruit_tree'
  | 'shrub'
  | 'perennial'
  | 'hedge'
  | 'annual'
  | 'vegetable'
  | 'herb'
  | 'berry'
  | 'wall_plant'
  | 'bulb';

export type HealthStatus =
  | 'thriving'
  | 'healthy'
  | 'fair'
  | 'struggling'
  | 'declining'
  | 'dead'
  | 'unknown';

export type IdentificationConfidence =
  | 'confirmed'
  | 'likely'
  | 'uncertain'
  | 'unknown';

export type LifecycleStatus =
  | 'planned'
  | 'planted'
  | 'established'
  | 'removed';

export interface Plant {
  id: string;
  species: string;
  common_name: string;
  category: PlantCategory;
  location: GeoPoint;
  planted_date: string;
  // Lifecycle
  lifecycle_status?: LifecycleStatus;
  planted_at?: string;
  planted_photo_url?: string;
  // For coverage area matching
  x?: number;
  y?: number;
  // Plant images
  images?: string[];
  // Whether this is a default/existing plant
  isDefault?: boolean;
}

export interface PlantRecord {
  id: number;
  species: string;
  common_name: string;
  category: string;
  location: GeoPoint;
  planted_date: string | null;
  // Lifecycle
  lifecycle_status: LifecycleStatus;
  planted_at: string | null;
  planted_photo_id: number | null;
  planted_photo_url: string | null;
  // Inventory fields
  health_status: HealthStatus;
  identification_confidence: IdentificationConfidence;
  estimated_age_years: number | null;
  age_years: number | null;
  acquired_from: string | null;
  notes: string | null;
  last_observed_at: string | null;
  // Photos
  photo_urls: string[];
  photos_count: number;
  // Metadata
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================
// Zone & Structure Types
// ============================================

export type ZoneType =
  | 'flower_bed'
  | 'vegetable_garden'
  | 'lawn'
  | 'woodland'
  | 'orchard'
  | 'herb_garden'
  | 'animal_area'
  | 'patio'
  | 'water_feature'
  | 'other';

export type StructureType =
  | 'house'
  | 'wall'
  | 'dry_stone_wall'
  | 'dry_stone_planter'
  | 'herb_spiral'
  | 'stone_path'
  | 'fence'
  | 'path'
  | 'driveway'
  | 'shed'
  | 'greenhouse'
  | 'pond'
  | 'terrace'
  | 'stone_terrace'
  | 'chicken_coop'
  | 'beehive'
  | 'duck_pond'
  | 'other';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  coordinates: [number, number][];
  color?: string;
}

export interface Structure {
  id: string;
  type: StructureType;
  coordinates: [number, number][];
  name?: string;
}

// ============================================
// Property & Garden Plan Types
// ============================================

export interface Property {
  id: number;
  name: string;
  location: GeoPoint;
  bbox?: BoundingBox;
  area_sqm?: number;
  garden_plans_count?: number;
  viewpoint_photos_count?: number;
  active_plan?: { id: number; name: string; status: string } | null;
}

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

// ============================================
// Viewpoint & Photo Types
// ============================================

export interface ViewpointPhoto {
  id: number;
  name: string;
  description?: string;
  capture_date?: string;
  camera_position?: CameraPosition;
  camera_direction?: number;
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

// ============================================
// Dropbox Photo Types (for photo inbox)
// ============================================

export type DropboxPhotoStatus = 'pending' | 'assigned' | 'archived';

export interface DropboxPhoto {
  id: number;
  photo_url: string;
  status: DropboxPhotoStatus;
  latitude?: number;
  longitude?: number;
  taken_at?: string;
  camera_model?: string;
  assignable_type?: 'Plant' | 'ViewpointPhoto';
  assignable_id?: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// AI Types
// ============================================

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface PlantSuggestion {
  species: string;
  common_name: string;
  common_name_fr?: string;
  confidence?: 'high' | 'medium' | 'low';
  confidence_percentage: number;
  reasoning?: string;
}

export interface PlantIdentificationResult {
  success: boolean;
  error?: string;
  primary_suggestion: PlantSuggestion;
  alternative_suggestions: PlantSuggestion[];
  category: string;
  characteristics_observed: string[];
  health_assessment: {
    status: HealthStatus;
    observations?: string;
  };
  care_tips?: string;
  identification_notes?: string;
}

// ============================================
// UI State Types
// ============================================

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export type ToolType = 'select' | 'plant' | 'zone' | 'structure';

export type TimelineMode = 'past' | 'present' | 'future';
