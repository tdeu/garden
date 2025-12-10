'use client';

import { useState, useEffect } from 'react';
import { useGardenStore } from '@/stores/garden-store';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Loader2,
  Calendar,
  Leaf,
  TreeDeciduous,
  AlertCircle,
  Image as ImageIcon,
  RefreshCw,
  Sun,
  Snowflake,
  Flower2,
  Camera,
  ChevronDown,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  getViewpointPhotos,
  transformViewpoint,
  generatePrediction,
  type ViewpointPhoto,
} from '@/lib/api';

interface Prediction {
  description: string;
  plantPredictions: Array<{
    plantId: string;
    plantName: string;
    predictedHeightCm: number;
    predictedCanopyCm: number;
    predictedCarbonKg: number;
    growthStage: string;
    visualDescription: string;
  }>;
  atmosphereNotes: string;
  totalCarbonKg: number;
}

interface TransformResult {
  success: boolean;
  transformedImageUrl?: string;
  transformPrompt: string;
  sceneDescription: string;
  error?: string;
}

const yearOptions = [
  { years: 1, label: '1 Year' },
  { years: 2, label: '2 Years' },
  { years: 3, label: '3 Years' },
  { years: 5, label: '5 Years' },
  { years: 10, label: '10 Years' },
];

const seasonOptions = [
  { value: 'spring', label: 'Printemps', icon: Flower2, color: 'text-pink-400' },
  { value: 'summer', label: 'Été', icon: Sun, color: 'text-yellow-400' },
  { value: 'fall', label: 'Automne', icon: Leaf, color: 'text-orange-400' },
  { value: 'winter', label: 'Hiver', icon: Snowflake, color: 'text-blue-400' },
] as const;

interface FutureViewProps {
  className?: string;
}

export function FutureView({ className }: FutureViewProps) {
  const { plants, zones, structures, property } = useGardenStore();
  const [selectedYears, setSelectedYears] = useState(5);
  const [selectedSeason, setSelectedSeason] = useState<'spring' | 'summer' | 'fall' | 'winter'>('summer');
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [isLoadingTransform, setIsLoadingTransform] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('image');

  // Viewpoint selection state
  const [viewpointPhotos, setViewpointPhotos] = useState<ViewpointPhoto[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [isViewpointDropdownOpen, setIsViewpointDropdownOpen] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  // Load viewpoint photos
  useEffect(() => {
    loadViewpointPhotos();
  }, []);

  const loadViewpointPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const photos = await getViewpointPhotos();
      setViewpointPhotos(photos);
      // Auto-select first photo with coverage area if available
      const photoWithCoverage = photos.find(p => p.coverage_area?.xmin !== undefined);
      if (photoWithCoverage && !selectedPhotoId) {
        setSelectedPhotoId(photoWithCoverage.id);
      } else if (photos.length > 0 && !selectedPhotoId) {
        setSelectedPhotoId(photos[0].id);
      }
    } catch (err) {
      console.error('Error loading viewpoint photos:', err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const selectedPhoto = viewpointPhotos.find((p) => p.id === selectedPhotoId);

  const handleGeneratePrediction = async () => {
    setIsLoadingPrediction(true);
    setError(null);

    try {
      const data = await generatePrediction({
        garden_plan_id: 0, // Will use plants directly
        target_year: selectedYears,
        season: selectedSeason as 'spring' | 'summer' | 'autumn' | 'winter',
      });

      setPrediction({
        description: data.description,
        plantPredictions: data.plant_predictions.map(p => ({
          plantId: p.plant_id,
          plantName: p.name,
          predictedHeightCm: p.predicted_height_cm,
          predictedCanopyCm: p.predicted_canopy_cm,
          predictedCarbonKg: 0,
          growthStage: '',
          visualDescription: p.visual_description,
        })),
        atmosphereNotes: data.atmosphere_notes,
        totalCarbonKg: 0,
      });
    } catch (err) {
      setError('Failed to generate prediction. Please try again.');
      console.error(err);
    } finally {
      setIsLoadingPrediction(false);
    }
  };

  const handleGenerateTransform = async () => {
    if (!selectedPhoto) {
      setError('Please select a viewpoint photo first');
      return;
    }

    setIsLoadingTransform(true);
    setError(null);

    try {
      const data = await transformViewpoint({
        viewpoint_photo_id: selectedPhoto.id,
        target_year: selectedYears,
        season: selectedSeason as 'spring' | 'summer' | 'autumn' | 'winter',
        plants: plants,
      });

      setTransformResult({
        success: true,
        transformedImageUrl: data.transformed_image_url ?? undefined,
        sceneDescription: data.description,
        transformPrompt: '',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate transformation';
      setError(message);
      console.error(err);
    } finally {
      setIsLoadingTransform(false);
    }
  };

  const targetYear = new Date().getFullYear() + selectedYears;

  const hasViewpointPhotos = viewpointPhotos.length > 0;
  const photosWithCoverage = viewpointPhotos.filter(p => p.coverage_area?.xmin !== undefined);

  return (
    <div className={cn('bg-neutral-900 rounded-lg border border-neutral-800', className)}>
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Future Vision</h3>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Transform your garden photos to see the future
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Viewpoint Photo Selector */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            <Camera className="w-3 h-3 inline mr-1" />
            Source Photo
          </label>

          {loadingPhotos ? (
            <div className="flex items-center gap-2 p-3 bg-neutral-800 rounded-md">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
              <span className="text-xs text-neutral-500">Loading photos...</span>
            </div>
          ) : !hasViewpointPhotos ? (
            <div className="p-3 bg-amber-900/20 rounded-md border border-amber-800/50">
              <p className="text-xs text-amber-400">
                No viewpoint photos uploaded yet. Use the Viewpoint Photos panel to upload photos from different viewpoints.
              </p>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setIsViewpointDropdownOpen(!isViewpointDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white hover:border-neutral-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {selectedPhoto ? (
                    <>
                      {selectedPhoto.photo_url && (
                        <img
                          src={selectedPhoto.photo_url}
                          alt=""
                          className="w-8 h-6 object-cover rounded"
                        />
                      )}
                      <span>{selectedPhoto.name}</span>
                    </>
                  ) : (
                    <span className="text-neutral-500">Select a viewpoint...</span>
                  )}
                </div>
                <ChevronDown className={cn('w-4 h-4 transition-transform', isViewpointDropdownOpen && 'rotate-180')} />
              </button>

              {isViewpointDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {viewpointPhotos.map((photo) => {
                    const hasCoverage = photo.coverage_area?.xmin !== undefined;
                    return (
                      <button
                        key={photo.id}
                        onClick={() => {
                          setSelectedPhotoId(photo.id);
                          setIsViewpointDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-700 transition-colors',
                          selectedPhotoId === photo.id && 'bg-neutral-700'
                        )}
                      >
                        {photo.photo_url && (
                          <img
                            src={photo.photo_url}
                            alt=""
                            className="w-12 h-8 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 text-left">
                          <p className="text-sm text-white">{photo.name}</p>
                          <p className={cn(
                            'text-xs',
                            hasCoverage ? 'text-green-500' : 'text-yellow-500'
                          )}>
                            {hasCoverage ? 'Coverage area set' : 'No coverage area'}
                          </p>
                        </div>
                        {selectedPhotoId === photo.id && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {photosWithCoverage.length === 0 && hasViewpointPhotos && (
            <p className="text-xs text-yellow-500 mt-1">
              Set coverage areas on your photos for accurate plant placement
            </p>
          )}
        </div>

        {/* Preview selected photo */}
        {selectedPhoto && selectedPhoto.photo_url && (
          <div className="relative rounded-lg overflow-hidden border border-neutral-700">
            <img
              src={selectedPhoto.photo_url}
              alt="Source viewpoint"
              className="w-full h-32 object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-xs text-white">{selectedPhoto.name}</p>
            </div>
          </div>
        )}

        {/* Year selector */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            <Calendar className="w-3 h-3 inline mr-1" />
            Projection temporelle
          </label>
          <div className="grid grid-cols-5 gap-1">
            {yearOptions.map((option) => (
              <button
                key={option.years}
                onClick={() => setSelectedYears(option.years)}
                className={cn(
                  'px-2 py-1.5 rounded text-xs font-medium transition-colors',
                  selectedYears === option.years
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Season selector */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-2">
            Saison
          </label>
          <div className="grid grid-cols-4 gap-2">
            {seasonOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedSeason(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors',
                    selectedSeason === option.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                  )}
                >
                  <Icon className={cn('w-4 h-4', selectedSeason === option.value ? 'text-white' : option.color)} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 bg-neutral-800 rounded-lg">
          <button
            onClick={() => setActiveTab('image')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
              activeTab === 'image'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
            )}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Image IA
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
              activeTab === 'text'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
            )}
          >
            <TreeDeciduous className="w-3.5 h-3.5" />
            Détails
          </button>
        </div>

        {/* Generate button */}
        <button
          onClick={activeTab === 'image' ? handleGenerateTransform : handleGeneratePrediction}
          disabled={isLoadingTransform || isLoadingPrediction || (activeTab === 'image' && !selectedPhoto)}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-medium transition-colors',
            isLoadingTransform || isLoadingPrediction || (activeTab === 'image' && !selectedPhoto)
              ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          )}
        >
          {isLoadingTransform || isLoadingPrediction ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Génération en cours...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Générer {targetYear} {activeTab === 'image' ? 'Image' : 'Prédiction'}</span>
            </>
          )}
        </button>

        {/* Info about generation */}
        <p className="text-[10px] text-neutral-600 text-center">
          Propulsé par Google Gemini
        </p>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 rounded-md text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Image Tab Content */}
        {activeTab === 'image' && (
          <div className="space-y-3">
            {/* Transform result */}
            {transformResult && !isLoadingTransform && (
              <div className="space-y-3">
                {transformResult.transformedImageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-neutral-700">
                    <img
                      src={transformResult.transformedImageUrl}
                      alt={`Garden vision for ${targetYear}`}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <a
                        href={transformResult.transformedImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-black/50 rounded-md hover:bg-black/70 transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-4 h-4 text-white" />
                      </a>
                      <button
                        onClick={handleGenerateTransform}
                        className="p-1.5 bg-black/50 rounded-md hover:bg-black/70 transition-colors"
                        title="Regenerate"
                      >
                        <RefreshCw className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                      {targetYear} • {seasonOptions.find((s) => s.value === selectedSeason)?.label}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
                    <p className="text-sm text-neutral-300 mb-3">
                      {transformResult.sceneDescription}
                    </p>
                  </div>
                )}

                {/* Scene description */}
                <div className="p-3 bg-neutral-800/50 rounded-md">
                  <h4 className="text-xs font-medium text-neutral-400 mb-1">Description de la scène</h4>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {transformResult.sceneDescription}
                  </p>
                </div>
              </div>
            )}

            {/* Loading placeholder */}
            {isLoadingTransform && (
              <div className="aspect-[4/3] bg-neutral-800 rounded-lg flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <span className="text-sm text-neutral-400">Analyse de votre jardin...</span>
                <span className="text-xs text-neutral-600">Génération de la vision future</span>
              </div>
            )}

            {/* Empty state */}
            {!transformResult && !isLoadingTransform && (
              <div className="aspect-[4/3] bg-neutral-800/50 rounded-lg border-2 border-dashed border-neutral-700 flex flex-col items-center justify-center gap-2 p-4">
                <ImageIcon className="w-8 h-8 text-neutral-600" />
                <span className="text-sm text-neutral-500 text-center">Aucune vision générée</span>
                <span className="text-xs text-neutral-600 text-center">
                  {!hasViewpointPhotos
                    ? 'Uploadez des photos depuis les points de vue de votre jardin'
                    : 'Sélectionnez un point de vue et cliquez sur Générer'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Text Tab Content */}
        {activeTab === 'text' && (
          <div className="space-y-4">
            {plants.length === 0 && zones.length === 0 && structures.length === 0 && (
              <p className="text-xs text-neutral-500 text-center">
                Ajoutez des éléments à votre jardin pour voir les prédictions de croissance détaillées
              </p>
            )}

            {/* Prediction results */}
            {prediction && !isLoadingPrediction && (
              <div className="space-y-4">
                {/* Description */}
                <div className="p-3 bg-neutral-800/50 rounded-md">
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {prediction.description}
                  </p>
                </div>

                {/* Carbon stats */}
                {prediction.totalCarbonKg > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-green-900/20 rounded-md border border-green-800/50">
                    <Leaf className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="text-sm font-medium text-green-400">
                        {prediction.totalCarbonKg.toFixed(1)}kg CO₂
                      </div>
                      <div className="text-xs text-green-500/70">
                        Séquestration de carbone estimée d&apos;ici {targetYear}
                      </div>
                    </div>
                  </div>
                )}

                {/* Plant predictions */}
                {prediction.plantPredictions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1">
                      <TreeDeciduous className="w-3 h-3" />
                      Croissance des plantes
                    </h4>
                    <div className="space-y-2">
                      {prediction.plantPredictions.map((plant) => (
                        <div
                          key={plant.plantId}
                          className="p-2 bg-neutral-800/30 rounded text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-neutral-300">
                              {plant.plantName}
                            </span>
                            <span className="text-neutral-500">{plant.growthStage}</span>
                          </div>
                          <div className="flex gap-4 mt-1 text-neutral-500">
                            <span>{(plant.predictedHeightCm / 100).toFixed(1)}m hauteur</span>
                            <span>{(plant.predictedCanopyCm / 100).toFixed(1)}m canopée</span>
                            <span className="text-green-500">{plant.predictedCarbonKg.toFixed(1)}kg CO₂</span>
                          </div>
                          {plant.visualDescription && (
                            <p className="mt-1 text-neutral-400 italic">
                              {plant.visualDescription}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Atmosphere notes */}
                {prediction.atmosphereNotes && (
                  <div className="p-3 bg-purple-900/20 rounded-md border border-purple-800/50">
                    <p className="text-xs text-purple-300/80 italic">
                      {prediction.atmosphereNotes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Loading state for prediction */}
            {isLoadingPrediction && (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <span className="text-sm text-neutral-400">Analyse de la croissance du jardin...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FutureView;
