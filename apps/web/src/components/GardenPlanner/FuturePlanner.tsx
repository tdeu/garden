'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGardenStore } from '@/stores/garden-store';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Loader2,
  Calendar,
  Leaf,
  AlertCircle,
  Image as ImageIcon,
  RefreshCw,
  Sun,
  Snowflake,
  Flower2,
  Camera,
  ChevronDown,
  Check,
  Download,
  Upload,
  MapPin,
  FolderOpen,
} from 'lucide-react';
import {
  getViewpointPhotos,
  getGardenPlans,
  getPlants,
  transformViewpoint,
  type ViewpointPhoto,
  type GardenPlan,
} from '@/lib/api';

const currentYear = new Date().getFullYear();

const yearOptions = [
  { year: currentYear + 1, label: `${currentYear + 1}` },
  { year: currentYear + 2, label: `${currentYear + 2}` },
  { year: currentYear + 3, label: `${currentYear + 3}` },
  { year: currentYear + 4, label: `${currentYear + 4}` },
  { year: currentYear + 5, label: `${currentYear + 5}` },
];

const seasonOptions = [
  { value: 'spring', label: 'Printemps', icon: Flower2, color: 'text-pink-400' },
  { value: 'summer', label: 'Été', icon: Sun, color: 'text-yellow-400' },
  { value: 'autumn', label: 'Automne', icon: Leaf, color: 'text-orange-400' },
  { value: 'winter', label: 'Hiver', icon: Snowflake, color: 'text-blue-400' },
] as const;

interface TransformResult {
  success: boolean;
  generatedImageBase64?: string;
  sceneDescription: string;
  error?: string;
}

interface FuturePlannerProps {
  className?: string;
  onShowUploadModal?: () => void;
}

export function FuturePlanner({ className, onShowUploadModal }: FuturePlannerProps) {
  const {
    gardenPlanId,
    futureSelectedPlanId,
    futureSelectedPhotoId,
    futureCameraPosition,
    futureCameraDirection,
    futurePlanPlants,
    setFutureSelectedPlanId,
    setFutureSelectedPhotoId,
    setFuturePlanData,
  } = useGardenStore();

  // Selection state
  const [selectedYear, setSelectedYear] = useState(currentYear + 1);
  const [selectedSeason, setSelectedSeason] = useState<'spring' | 'summer' | 'autumn' | 'winter'>('summer');

  // Garden plans state
  const [gardenPlans, setGardenPlans] = useState<GardenPlan[]>([]);
  const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Viewpoint photos state
  const [viewpointPhotos, setViewpointPhotos] = useState<ViewpointPhoto[]>([]);
  const [isViewpointDropdownOpen, setIsViewpointDropdownOpen] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  // Generation state
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use store state for selections
  const selectedPlanId = futureSelectedPlanId;
  const selectedPhotoId = futureSelectedPhotoId;

  // Load garden plans
  useEffect(() => {
    loadGardenPlans();
  }, []);

  // Load viewpoint photos
  useEffect(() => {
    loadViewpointPhotos();
  }, []);

  // Update selected plan when gardenPlanId changes (from Today tab)
  useEffect(() => {
    if (gardenPlanId && !futureSelectedPlanId) {
      setFutureSelectedPlanId(gardenPlanId);
    }
  }, [gardenPlanId, futureSelectedPlanId, setFutureSelectedPlanId]);

  // Load the selected plan's data when a plan is selected
  useEffect(() => {
    const loadPlanData = async () => {
      if (!futureSelectedPlanId || gardenPlans.length === 0) return;

      const plan = gardenPlans.find(p => p.id === futureSelectedPlanId);
      if (!plan) return;

      try {
        // Fetch plants from dedicated plants table
        const plantRecords = await getPlants(futureSelectedPlanId);

        const planPlants = plantRecords.map((p) => ({
          id: String(p.id),
          species: p.species,
          common_name: p.common_name,
          category: p.category as 'tree' | 'shrub' | 'perennial' | 'hedge' | 'annual',
          location: p.location,
          planted_date: p.planted_date || new Date().toISOString().split('T')[0],
        }));

        // Convert zones/structures from plan format to store format
        const toArray = <T,>(data: T[] | Record<string, T>): T[] => {
          if (Array.isArray(data)) return data;
          return Object.values(data);
        };

        const planZones = toArray(plan.zones || []);
        const planStructures = toArray(plan.structures || []);

        setFuturePlanData(planPlants, planZones, planStructures);
        console.log(`Loaded ${planPlants.length} plants for plan ${plan.name}`);
      } catch (err) {
        console.error('Error loading plan data:', err);
        // Fallback: try to use plants from plan object if API fails
        const toArray = <T,>(data: T[] | Record<string, T>): T[] => {
          if (Array.isArray(data)) return data;
          return Object.values(data);
        };

        const planPlants = toArray(plan.plants || []).map((p: Record<string, unknown>) => ({
          id: String(p.id || `plant-${Date.now()}-${Math.random()}`),
          species: String(p.species || ''),
          common_name: String(p.common_name || ''),
          category: (p.category || 'tree') as 'tree' | 'shrub' | 'perennial' | 'hedge' | 'annual',
          location: (p.location || { lat: 0, lng: 0 }) as { lat: number; lng: number },
          planted_date: String(p.planted_date || new Date().toISOString().split('T')[0]),
        }));

        setFuturePlanData(planPlants, toArray(plan.zones || []), toArray(plan.structures || []));
      }
    };

    loadPlanData();
  }, [futureSelectedPlanId, gardenPlans, setFuturePlanData]);

  const loadGardenPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const plans = await getGardenPlans();
      setGardenPlans(plans);
      // Auto-select active plan if none selected
      if (!futureSelectedPlanId) {
        const activePlan = plans.find(p => p.status === 'active');
        if (activePlan) {
          setFutureSelectedPlanId(activePlan.id);
        } else if (plans.length > 0) {
          setFutureSelectedPlanId(plans[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading garden plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  }, [futureSelectedPlanId, setFutureSelectedPlanId]);

  const loadViewpointPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const photos = await getViewpointPhotos();
      setViewpointPhotos(photos);
      // Auto-select first photo with camera position if available
      const photoWithCamera = photos.find(p => p.camera_position?.x !== undefined);
      if (photoWithCamera && !futureSelectedPhotoId) {
        setFutureSelectedPhotoId(photoWithCamera.id);
      } else if (photos.length > 0 && !futureSelectedPhotoId) {
        setFutureSelectedPhotoId(photos[0].id);
      }
    } catch (err) {
      console.error('Error loading viewpoint photos:', err);
    } finally {
      setLoadingPhotos(false);
    }
  }, [futureSelectedPhotoId, setFutureSelectedPhotoId]);

  const selectedPlan = gardenPlans.find(p => p.id === selectedPlanId);
  const selectedPhoto = viewpointPhotos.find(p => p.id === selectedPhotoId);
  const photosWithCamera = viewpointPhotos.filter(p => p.camera_position?.x !== undefined);

  const handleGenerate = async () => {
    if (!selectedPhoto || !selectedPlanId) {
      setError('Veuillez sélectionner un plan et un point de vue');
      return;
    }

    if (!futureCameraPosition) {
      setError('Veuillez définir la position de la caméra sur la carte');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const yearsFromNow = selectedYear - currentYear;
      const data = await transformViewpoint({
        viewpoint_photo_id: selectedPhoto.id,
        garden_plan_id: selectedPlanId,
        target_year: yearsFromNow,
        season: selectedSeason,
        plants: futurePlanPlants,
        camera_position: futureCameraPosition,
        camera_direction: futureCameraDirection,
      });

      setTransformResult({
        success: true,
        generatedImageBase64: data.generated_image_base64 ?? undefined,
        sceneDescription: data.description,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Échec de la génération';
      setError(message);
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = useCallback(() => {
    if (!transformResult?.generatedImageBase64) return;

    const link = document.createElement('a');
    link.href = `data:image/png;base64,${transformResult.generatedImageBase64}`;
    link.download = `jardin-vision-${selectedYear}-${selectedSeason}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [transformResult, selectedYear, selectedSeason]);

  const canGenerate = selectedPlanId && selectedPhotoId && futureCameraPosition && !isGenerating;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Vision Future</h2>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Visualisez votre jardin dans le futur avec l'IA
        </p>
      </div>

      {/* Selectors */}
      <div className="p-4 space-y-4 border-b border-neutral-800">
        {/* Garden Plan Selector */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 mb-2">
            <FolderOpen className="w-3.5 h-3.5" />
            Plan de jardin
          </label>

          {loadingPlans ? (
            <div className="flex items-center gap-2 p-3 bg-neutral-800 rounded-md">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
              <span className="text-xs text-neutral-500">Chargement...</span>
            </div>
          ) : gardenPlans.length === 0 ? (
            <div className="p-3 bg-amber-900/20 rounded-md border border-amber-800/50">
              <p className="text-xs text-amber-400">
                Aucun plan de jardin. Créez-en un dans l'onglet Aujourd'hui.
              </p>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white hover:border-neutral-600 transition-colors"
              >
                <span className={selectedPlan ? 'text-white' : 'text-neutral-500'}>
                  {selectedPlan ? selectedPlan.name : 'Sélectionner un plan...'}
                </span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', isPlanDropdownOpen && 'rotate-180')} />
              </button>

              {isPlanDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {gardenPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => {
                        setFutureSelectedPlanId(plan.id);
                        setIsPlanDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-700 transition-colors',
                        selectedPlanId === plan.id && 'bg-neutral-700'
                      )}
                    >
                      <div className="text-left">
                        <p className="text-sm text-white">{plan.name}</p>
                        <p className="text-xs text-neutral-500">{plan.total_plants} plantes</p>
                      </div>
                      {selectedPlanId === plan.id && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Viewpoint Photo Selector */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 mb-2">
            <Camera className="w-3.5 h-3.5" />
            Point de vue
          </label>

          {loadingPhotos ? (
            <div className="flex items-center gap-2 p-3 bg-neutral-800 rounded-md">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
              <span className="text-xs text-neutral-500">Chargement...</span>
            </div>
          ) : viewpointPhotos.length === 0 ? (
            <button
              onClick={onShowUploadModal}
              className="w-full p-3 bg-neutral-800 rounded-md border-2 border-dashed border-neutral-700 hover:border-purple-600 transition-colors"
            >
              <div className="flex items-center justify-center gap-2 text-neutral-400">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Ajouter une photo</span>
              </div>
              <p className="text-xs text-neutral-600 mt-1 text-center">
                Uploadez des photos depuis différents points de vue
              </p>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setIsViewpointDropdownOpen(!isViewpointDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white hover:border-neutral-600 transition-colors"
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
                    <span className="text-neutral-500">Sélectionner un point de vue...</span>
                  )}
                </div>
                <ChevronDown className={cn('w-4 h-4 transition-transform', isViewpointDropdownOpen && 'rotate-180')} />
              </button>

              {isViewpointDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {viewpointPhotos.map((photo) => {
                    const hasCamera = photo.camera_position?.x !== undefined;
                    return (
                      <button
                        key={photo.id}
                        onClick={() => {
                          setFutureSelectedPhotoId(photo.id);
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
                            'text-xs flex items-center gap-1',
                            hasCamera ? 'text-green-500' : 'text-yellow-500'
                          )}>
                            <MapPin className="w-3 h-3" />
                            {hasCamera ? 'Position définie' : 'Position non définie'}
                          </p>
                        </div>
                        {selectedPhotoId === photo.id && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </button>
                    );
                  })}

                  {/* Add new photo button */}
                  <button
                    onClick={() => {
                      setIsViewpointDropdownOpen(false);
                      onShowUploadModal?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-purple-400 hover:bg-neutral-700 border-t border-neutral-700"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">Ajouter une photo...</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedPhotoId && !futureCameraPosition && (
            <p className="text-xs text-yellow-500 mt-1">
              Cliquez sur la carte pour définir la position de la caméra
            </p>
          )}
          {selectedPhotoId && futureCameraPosition && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-green-500 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Position caméra définie
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-400">Direction:</label>
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={Math.round(futureCameraDirection)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value)) {
                      // Normalize to 0-360
                      const normalized = ((value % 360) + 360) % 360;
                      useGardenStore.getState().setFutureCameraDirection(normalized);
                    }
                  }}
                  className="w-16 px-2 py-1 bg-neutral-800 border border-neutral-600 rounded text-sm text-white text-center focus:border-purple-500 focus:outline-none"
                />
                <span className="text-xs text-neutral-500">°</span>
              </div>
              {/* Quick direction presets */}
              <div className="flex items-center gap-1">
                {[
                  { label: 'N', value: 0 },
                  { label: 'NE', value: 45 },
                  { label: 'E', value: 90 },
                  { label: 'SE', value: 135 },
                  { label: 'S', value: 180 },
                  { label: 'SO', value: 225 },
                  { label: 'O', value: 270 },
                  { label: 'NO', value: 315 },
                ].map((dir) => (
                  <button
                    key={dir.label}
                    onClick={() => useGardenStore.getState().setFutureCameraDirection(dir.value)}
                    className={cn(
                      'px-1.5 py-0.5 text-[10px] rounded transition-colors',
                      Math.abs(futureCameraDirection - dir.value) < 22.5 || Math.abs(futureCameraDirection - dir.value) > 337.5
                        ? 'bg-purple-600 text-white'
                        : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
                    )}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>
            </div>
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
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 mb-2">
            <Calendar className="w-3.5 h-3.5" />
            Année de projection
          </label>
          <div className="grid grid-cols-5 gap-1">
            {yearOptions.map((option) => (
              <button
                key={option.year}
                onClick={() => setSelectedYear(option.year)}
                className={cn(
                  'px-2 py-2 rounded text-xs font-medium transition-colors',
                  selectedYear === option.year
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

        {/* Summary before generation */}
        {canGenerate && (
          <div className="p-3 bg-purple-900/20 rounded-md border border-purple-800/50">
            <p className="text-xs text-purple-300">
              Prêt à générer: <strong>{futurePlanPlants.length} plante{futurePlanPlants.length !== 1 ? 's' : ''}</strong> projetée{futurePlanPlants.length !== 1 ? 's' : ''} en <strong>{selectedYear}</strong> ({selectedYear - currentYear} an{selectedYear - currentYear !== 1 ? 's' : ''})
            </p>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors',
            canGenerate
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Génération en cours...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Générer Vision {selectedYear}</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-neutral-600 text-center">
          Propulsé par Google Gemini & Imagen 3
        </p>
      </div>

      {/* Results area - Shows prominently when we have a result */}
      <div className="flex-1 p-4 overflow-y-auto min-h-[200px]">
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 rounded-md text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Generated result - PROMINENT DISPLAY */}
        {transformResult && !isGenerating && (
          <div className="space-y-4">
            {/* Success header */}
            <div className="flex items-center gap-2 text-green-400">
              <Check className="w-5 h-5" />
              <span className="font-medium">Vision générée avec succès!</span>
            </div>

            {transformResult.generatedImageBase64 ? (
              <>
                {/* Generated Image - Full width */}
                <div className="relative rounded-lg overflow-hidden border-2 border-purple-500 shadow-lg shadow-purple-500/20">
                  <img
                    src={`data:image/png;base64,${transformResult.generatedImageBase64}`}
                    alt={`Vision jardin ${selectedYear}`}
                    className="w-full h-auto"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="p-2 bg-purple-600 rounded-md hover:bg-purple-700 transition-colors shadow-lg"
                      title="Télécharger l'image"
                    >
                      <Download className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={handleGenerate}
                      className="p-2 bg-neutral-800 rounded-md hover:bg-neutral-700 transition-colors shadow-lg"
                      title="Régénérer"
                    >
                      <RefreshCw className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white font-medium">
                      Votre jardin en {selectedYear} - {seasonOptions.find(s => s.value === selectedSeason)?.label}
                    </p>
                  </div>
                </div>

                {/* Description below image */}
                {transformResult.sceneDescription && (
                  <div className="p-4 bg-neutral-800/80 rounded-lg border border-neutral-700">
                    <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Description de la scène
                    </h4>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      {transformResult.sceneDescription}
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* Text-only result (no image generated) */
              <div className="p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
                <h4 className="text-sm font-medium text-purple-400 mb-2">Description de votre jardin en {selectedYear}</h4>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  {transformResult.sceneDescription}
                </p>
              </div>
            )}

          </div>
        )}

        {/* Loading state */}
        {isGenerating && (
          <div className="aspect-[4/3] bg-neutral-800 rounded-lg flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            <span className="text-sm text-neutral-300">Génération de votre vision jardin...</span>
            <span className="text-xs text-neutral-500">Cela peut prendre 1-2 minutes</span>
            <div className="w-32 h-1 bg-neutral-700 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!transformResult && !isGenerating && (
          <div className="aspect-[4/3] bg-neutral-800/50 rounded-lg border-2 border-dashed border-neutral-700 flex flex-col items-center justify-center gap-2 p-4">
            <ImageIcon className="w-8 h-8 text-neutral-600" />
            <span className="text-sm text-neutral-500 text-center">Aucune vision générée</span>
            <span className="text-xs text-neutral-600 text-center">
              {!selectedPlanId
                ? 'Sélectionnez un plan de jardin'
                : !selectedPhotoId
                  ? 'Sélectionnez un point de vue'
                  : !futureCameraPosition
                    ? 'Cliquez sur la carte pour placer la caméra'
                    : 'Cliquez sur Générer pour voir votre jardin dans le futur'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default FuturePlanner;
