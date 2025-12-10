-- Terra Memoria Database Schema
-- Run this in your Supabase SQL Editor

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- Properties table
-- =====================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address VARCHAR(42) NOT NULL, -- Ethereum address
  name VARCHAR(255) NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  bbox GEOGRAPHY(POLYGON, 4326),
  area_sqm DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_address);

-- =====================================================
-- Garden plans table
-- =====================================================
CREATE TABLE IF NOT EXISTS garden_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  version INT DEFAULT 1,
  plan_data JSONB NOT NULL DEFAULT '{}', -- Full garden layout
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Index for property lookups
CREATE INDEX IF NOT EXISTS idx_garden_plans_property ON garden_plans(property_id);
CREATE INDEX IF NOT EXISTS idx_garden_plans_active ON garden_plans(property_id, is_active);

-- =====================================================
-- Plants table
-- =====================================================
CREATE TABLE IF NOT EXISTS plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_plan_id UUID REFERENCES garden_plans(id) ON DELETE CASCADE,
  species VARCHAR(255) NOT NULL,
  common_name VARCHAR(255),
  category VARCHAR(50) CHECK (category IN ('tree', 'shrub', 'perennial', 'hedge', 'annual')),
  planted_date DATE,
  location GEOGRAPHY(POINT, 4326),
  nft_token_id VARCHAR(255),
  blockchain_tx VARCHAR(66),
  ipfs_hash VARCHAR(255),
  growth_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plants_garden_plan ON plants(garden_plan_id);
CREATE INDEX IF NOT EXISTS idx_plants_nft ON plants(nft_token_id);
CREATE INDEX IF NOT EXISTS idx_plants_category ON plants(category);

-- =====================================================
-- Historical images table
-- =====================================================
CREATE TABLE IF NOT EXISTS historical_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  year INT NOT NULL,
  source VARCHAR(50) CHECK (source IN ('walloon_gov', 'user_upload', 'ai_generated')),
  image_url TEXT,
  ipfs_hash VARCHAR(255),
  blockchain_tx VARCHAR(66),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_historical_images_property ON historical_images(property_id);
CREATE INDEX IF NOT EXISTS idx_historical_images_year ON historical_images(year);
CREATE INDEX IF NOT EXISTS idx_historical_images_source ON historical_images(source);

-- =====================================================
-- Predictions table
-- =====================================================
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE NOT NULL,
  target_year INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM target_date)::INT) STORED,
  predicted_data JSONB NOT NULL DEFAULT '{}', -- height, canopy, carbon, etc.
  ai_model VARCHAR(255),
  image_url TEXT,
  image_ipfs VARCHAR(255),
  blockchain_tx VARCHAR(66),
  prediction_id_onchain VARCHAR(66),
  verified_date DATE,
  actual_data JSONB,
  accuracy_score DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_predictions_plant ON predictions(plant_id);
CREATE INDEX IF NOT EXISTS idx_predictions_property ON predictions(property_id);
CREATE INDEX IF NOT EXISTS idx_predictions_target_date ON predictions(target_date);
CREATE INDEX IF NOT EXISTS idx_predictions_target_year ON predictions(target_year);

-- =====================================================
-- Improvements table
-- =====================================================
CREATE TABLE IF NOT EXISTS improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category VARCHAR(100) CHECK (category IN ('planting', 'structure', 'landscaping', 'maintenance')),
  description TEXT,
  cost_eur DECIMAL(10,2),
  labor_hours DECIMAL(5,1),
  estimated_value_added_eur DECIMAL(10,2),
  evidence_ipfs TEXT[],
  blockchain_tx VARCHAR(66),
  improvement_id_onchain VARCHAR(66),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_improvements_property ON improvements(property_id);
CREATE INDEX IF NOT EXISTS idx_improvements_category ON improvements(category);
CREATE INDEX IF NOT EXISTS idx_improvements_date ON improvements(date);

-- =====================================================
-- User photos table
-- =====================================================
CREATE TABLE IF NOT EXISTS user_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  angle_id VARCHAR(100), -- Fixed photo angle identifier
  capture_date DATE NOT NULL DEFAULT CURRENT_DATE,
  gps_location GEOGRAPHY(POINT, 4326),
  bearing INT, -- Compass direction 0-360
  file_path TEXT,
  ipfs_hash VARCHAR(255),
  blockchain_tx VARCHAR(66),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_photos_property ON user_photos(property_id);
CREATE INDEX IF NOT EXISTS idx_user_photos_angle ON user_photos(angle_id, capture_date);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_photos ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's wallet address from JWT
-- (Assumes you're passing wallet address as a custom claim)
CREATE OR REPLACE FUNCTION auth.wallet_address()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'wallet_address',
    ''
  )
$$ LANGUAGE SQL STABLE;

-- Properties policies
CREATE POLICY "Users can view their own properties"
  ON properties FOR SELECT
  USING (owner_address = auth.wallet_address());

CREATE POLICY "Users can insert their own properties"
  ON properties FOR INSERT
  WITH CHECK (owner_address = auth.wallet_address());

CREATE POLICY "Users can update their own properties"
  ON properties FOR UPDATE
  USING (owner_address = auth.wallet_address());

-- Garden plans policies (inherit from property)
CREATE POLICY "Users can view garden plans for their properties"
  ON garden_plans FOR SELECT
  USING (property_id IN (
    SELECT id FROM properties WHERE owner_address = auth.wallet_address()
  ));

CREATE POLICY "Users can insert garden plans for their properties"
  ON garden_plans FOR INSERT
  WITH CHECK (property_id IN (
    SELECT id FROM properties WHERE owner_address = auth.wallet_address()
  ));

CREATE POLICY "Users can update garden plans for their properties"
  ON garden_plans FOR UPDATE
  USING (property_id IN (
    SELECT id FROM properties WHERE owner_address = auth.wallet_address()
  ));

-- Similar policies for other tables...
-- Plants
CREATE POLICY "Users can manage plants in their garden plans"
  ON plants FOR ALL
  USING (garden_plan_id IN (
    SELECT gp.id FROM garden_plans gp
    JOIN properties p ON gp.property_id = p.id
    WHERE p.owner_address = auth.wallet_address()
  ));

-- Historical images
CREATE POLICY "Users can manage historical images for their properties"
  ON historical_images FOR ALL
  USING (property_id IN (
    SELECT id FROM properties WHERE owner_address = auth.wallet_address()
  ));

-- Predictions
CREATE POLICY "Users can manage predictions for their properties"
  ON predictions FOR ALL
  USING (property_id IN (
    SELECT id FROM properties WHERE owner_address = auth.wallet_address()
  ));

-- Improvements
CREATE POLICY "Users can manage improvements for their properties"
  ON improvements FOR ALL
  USING (property_id IN (
    SELECT id FROM properties WHERE owner_address = auth.wallet_address()
  ));

-- User photos
CREATE POLICY "Users can manage photos for their properties"
  ON user_photos FOR ALL
  USING (property_id IN (
    SELECT id FROM properties WHERE owner_address = auth.wallet_address()
  ));

-- =====================================================
-- Updated at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- Storage bucket for user uploads
-- =====================================================
-- Run this in the Supabase Dashboard > Storage section
-- Or use the Supabase CLI

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('garden-photos', 'garden-photos', true);

-- Policy for garden-photos bucket
-- CREATE POLICY "Users can upload to their own folder"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'garden-photos' AND (storage.foldername(name))[1] = auth.wallet_address());
