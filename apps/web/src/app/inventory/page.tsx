'use client';

import { useEffect, useState } from 'react';
import { useGardenStore } from '@/stores/garden-store';
import {
  getPlants,
  getPlantStats,
  updatePlant,
  observePlant,
  identifyPlant,
  PlantRecord,
  PlantStats,
  PlantFilters,
  PlantIdentificationResult,
  HealthStatus,
  IdentificationConfidence,
} from '@/lib/api/client';
import {
  Leaf,
  TreeDeciduous,
  Flower2,
  AlertTriangle,
  HelpCircle,
  Eye,
  EyeOff,
  Home,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Camera,
  Calendar,
  MapPin,
  Heart,
  Loader2,
  Sparkles,
  Upload,
  X,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Health status colors and labels
const HEALTH_CONFIG: Record<HealthStatus, { color: string; bgColor: string; label: string }> = {
  thriving: { color: 'text-green-400', bgColor: 'bg-green-400/20', label: 'Thriving' },
  healthy: { color: 'text-green-300', bgColor: 'bg-green-300/20', label: 'Healthy' },
  fair: { color: 'text-yellow-400', bgColor: 'bg-yellow-400/20', label: 'Fair' },
  struggling: { color: 'text-orange-400', bgColor: 'bg-orange-400/20', label: 'Struggling' },
  declining: { color: 'text-red-400', bgColor: 'bg-red-400/20', label: 'Declining' },
  dead: { color: 'text-neutral-500', bgColor: 'bg-neutral-500/20', label: 'Dead' },
  unknown: { color: 'text-neutral-400', bgColor: 'bg-neutral-400/20', label: 'Unknown' },
};

const CONFIDENCE_CONFIG: Record<IdentificationConfidence, { color: string; label: string }> = {
  confirmed: { color: 'text-green-400', label: 'Confirmed' },
  likely: { color: 'text-blue-400', label: 'Likely' },
  uncertain: { color: 'text-yellow-400', label: 'Uncertain' },
  unknown: { color: 'text-neutral-400', label: 'Unknown' },
};

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  tree: <TreeDeciduous className="w-4 h-4" />,
  fruit_tree: <TreeDeciduous className="w-4 h-4" />,
  shrub: <Leaf className="w-4 h-4" />,
  perennial: <Flower2 className="w-4 h-4" />,
  hedge: <Leaf className="w-4 h-4" />,
  annual: <Flower2 className="w-4 h-4" />,
  vegetable: <Leaf className="w-4 h-4" />,
  herb: <Leaf className="w-4 h-4" />,
  berry: <Leaf className="w-4 h-4" />,
  wall_plant: <Leaf className="w-4 h-4" />,
  bulb: <Flower2 className="w-4 h-4" />,
};

export default function InventoryPage() {
  const { initializeFromCloud, property } = useGardenStore();
  const [plants, setPlants] = useState<PlantRecord[]>([]);
  const [stats, setStats] = useState<PlantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlant, setSelectedPlant] = useState<PlantRecord | null>(null);
  const [filters, setFilters] = useState<PlantFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);

  // Initialize and load data
  useEffect(() => {
    const init = async () => {
      await initializeFromCloud();
    };
    init();
  }, [initializeFromCloud]);

  // Get active plan ID from property
  useEffect(() => {
    if (property?.active_plan?.id) {
      setActivePlanId(property.active_plan.id);
    }
  }, [property]);

  // Load plants when plan is available
  useEffect(() => {
    if (activePlanId) {
      loadPlants();
      loadStats();
    }
  }, [activePlanId, filters]);

  const loadPlants = async () => {
    if (!activePlanId) return;
    setLoading(true);
    try {
      const data = await getPlants(activePlanId, filters);
      setPlants(data);
    } catch (error) {
      console.error('Failed to load plants:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!activePlanId) return;
    try {
      const data = await getPlantStats(activePlanId);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleUpdatePlant = async (plantId: number, updates: Partial<PlantRecord>) => {
    if (!activePlanId) return;
    try {
      const updated = await updatePlant(activePlanId, plantId, updates);
      setPlants(plants.map(p => p.id === plantId ? updated : p));
      if (selectedPlant?.id === plantId) {
        setSelectedPlant(updated);
      }
      loadStats();
    } catch (error) {
      console.error('Failed to update plant:', error);
    }
  };

  const handleObserve = async (plantId: number, notes?: string, health_status?: HealthStatus) => {
    if (!activePlanId) return;
    try {
      const updated = await observePlant(activePlanId, plantId, { notes, health_status });
      setPlants(plants.map(p => p.id === plantId ? updated : p));
      if (selectedPlant?.id === plantId) {
        setSelectedPlant(updated);
      }
      loadStats();
    } catch (error) {
      console.error('Failed to record observation:', error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const daysSinceObserved = (dateString: string | null) => {
    if (!dateString) return null;
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              title="Home"
            >
              <Home className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Garden Inventory</h1>
              <p className="text-sm text-neutral-400">
                {stats?.total ?? 0} plants catalogued
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIdentifyModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Identify Plant
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                showFilters ? 'bg-emerald-600' : 'bg-neutral-800 hover:bg-neutral-700'
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              onClick={loadPlants}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="flex gap-4 mt-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Health:</span>
              {Object.entries(stats.by_health_status).map(([status, count]) => (
                <span
                  key={status}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs',
                    HEALTH_CONFIG[status as HealthStatus]?.bgColor,
                    HEALTH_CONFIG[status as HealthStatus]?.color
                  )}
                >
                  {count} {status}
                </span>
              ))}
            </div>
            {stats.needs_attention > 0 && (
              <div className="flex items-center gap-1 text-orange-400">
                <AlertTriangle className="w-4 h-4" />
                {stats.needs_attention} need attention
              </div>
            )}
            {stats.not_observed_recently > 0 && (
              <div className="flex items-center gap-1 text-yellow-400">
                <EyeOff className="w-4 h-4" />
                {stats.not_observed_recently} not observed recently
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-neutral-800">
            <select
              value={filters.health_status || ''}
              onChange={(e) => setFilters({ ...filters, health_status: e.target.value as HealthStatus || undefined })}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">All Health Statuses</option>
              {Object.entries(HEALTH_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={filters.needs_attention || false}
                onChange={(e) => setFilters({ ...filters, needs_attention: e.target.checked || undefined })}
                className="rounded"
              />
              <span className="text-sm">Needs Attention</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={filters.unidentified || false}
                onChange={(e) => setFilters({ ...filters, unidentified: e.target.checked || undefined })}
                className="rounded"
              />
              <span className="text-sm">Unidentified</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={filters.not_observed || false}
                onChange={(e) => setFilters({ ...filters, not_observed: e.target.checked || undefined })}
                className="rounded"
              />
              <span className="text-sm">Not Observed Recently</span>
            </label>
            <button
              onClick={() => setFilters({})}
              className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white"
            >
              Clear Filters
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Plant List */}
        <div className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : plants.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <Leaf className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No plants in your inventory yet.</p>
              <p className="text-sm mt-2">
                Add plants from the{' '}
                <Link href="/planner" className="text-emerald-400 hover:underline">
                  Garden Planner
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {plants.map((plant) => {
                const days = daysSinceObserved(plant.last_observed_at);
                const needsObservation = days === null || days > 30;

                return (
                  <div
                    key={plant.id}
                    onClick={() => setSelectedPlant(plant)}
                    className={cn(
                      'bg-neutral-900 border rounded-lg p-4 cursor-pointer transition-colors',
                      selectedPlant?.id === plant.id
                        ? 'border-emerald-500'
                        : 'border-neutral-800 hover:border-neutral-700'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-neutral-800 rounded-lg">
                          {CATEGORY_ICONS[plant.category] || <Leaf className="w-4 h-4" />}
                        </div>
                        <div>
                          <h3 className="font-medium">
                            {plant.common_name || plant.species}
                          </h3>
                          {plant.common_name && (
                            <p className="text-sm text-neutral-400 italic">{plant.species}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-xs',
                                HEALTH_CONFIG[plant.health_status]?.bgColor,
                                HEALTH_CONFIG[plant.health_status]?.color
                              )}
                            >
                              {HEALTH_CONFIG[plant.health_status]?.label}
                            </span>
                            <span
                              className={cn(
                                'text-xs',
                                CONFIDENCE_CONFIG[plant.identification_confidence]?.color
                              )}
                            >
                              <HelpCircle className="w-3 h-3 inline mr-1" />
                              {CONFIDENCE_CONFIG[plant.identification_confidence]?.label}
                            </span>
                            {plant.age_years && (
                              <span className="text-xs text-neutral-400">
                                ~{plant.age_years} years old
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className={cn(
                          'flex items-center gap-1',
                          needsObservation ? 'text-yellow-400' : 'text-neutral-400'
                        )}>
                          {needsObservation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {days !== null ? `${days}d ago` : 'Never observed'}
                        </div>
                        {plant.photos_count > 0 && (
                          <div className="flex items-center gap-1 text-neutral-400 mt-1">
                            <Camera className="w-4 h-4" />
                            {plant.photos_count} photos
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedPlant && (
          <div className="w-96 bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto">
            <PlantDetailPanel
              plant={selectedPlant}
              onUpdate={(updates) => handleUpdatePlant(selectedPlant.id, updates)}
              onObserve={(notes, health) => handleObserve(selectedPlant.id, notes, health)}
              onClose={() => setSelectedPlant(null)}
            />
          </div>
        )}
      </div>

      {/* Identify Plant Modal */}
      {showIdentifyModal && (
        <PlantIdentifyModal onClose={() => setShowIdentifyModal(false)} />
      )}
    </div>
  );
}

// Plant Detail Panel Component
interface PlantDetailPanelProps {
  plant: PlantRecord;
  onUpdate: (updates: Partial<PlantRecord>) => void;
  onObserve: (notes?: string, health_status?: HealthStatus) => void;
  onClose: () => void;
}

function PlantDetailPanel({ plant, onUpdate, onObserve, onClose }: PlantDetailPanelProps) {
  const [observationNotes, setObservationNotes] = useState('');
  const [observationHealth, setObservationHealth] = useState<HealthStatus | ''>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(plant.notes || '');

  const handleSubmitObservation = () => {
    onObserve(
      observationNotes || undefined,
      observationHealth || undefined
    );
    setObservationNotes('');
    setObservationHealth('');
  };

  const handleSaveNotes = () => {
    onUpdate({ notes: editedNotes });
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{plant.common_name || plant.species}</h2>
          {plant.common_name && (
            <p className="text-neutral-400 italic">{plant.species}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-800 rounded"
        >
          &times;
        </button>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-neutral-400 mb-1">Health</div>
          <select
            value={plant.health_status}
            onChange={(e) => onUpdate({ health_status: e.target.value as HealthStatus })}
            className={cn(
              'w-full bg-transparent font-medium',
              HEALTH_CONFIG[plant.health_status]?.color
            )}
          >
            {Object.entries(HEALTH_CONFIG).map(([key, config]) => (
              <option key={key} value={key} className="bg-neutral-800 text-white">
                {config.label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3">
          <div className="text-neutral-400 mb-1">Identification</div>
          <select
            value={plant.identification_confidence}
            onChange={(e) => onUpdate({ identification_confidence: e.target.value as IdentificationConfidence })}
            className={cn(
              'w-full bg-transparent font-medium',
              CONFIDENCE_CONFIG[plant.identification_confidence]?.color
            )}
          >
            {Object.entries(CONFIDENCE_CONFIG).map(([key, config]) => (
              <option key={key} value={key} className="bg-neutral-800 text-white">
                {config.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-neutral-400">
          <Calendar className="w-4 h-4" />
          {plant.planted_date ? (
            <span>Planted: {new Date(plant.planted_date).toLocaleDateString()}</span>
          ) : plant.estimated_age_years ? (
            <span>Estimated age: ~{plant.estimated_age_years} years</span>
          ) : (
            <span>Age unknown</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-neutral-400">
          <MapPin className="w-4 h-4" />
          <span>
            {plant.location.lat.toFixed(5)}, {plant.location.lng.toFixed(5)}
          </span>
        </div>
        {plant.acquired_from && (
          <div className="flex items-center gap-2 text-neutral-400">
            <span>Source: {plant.acquired_from}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-neutral-400">
          <Eye className="w-4 h-4" />
          <span>
            Last observed:{' '}
            {plant.last_observed_at
              ? new Date(plant.last_observed_at).toLocaleDateString()
              : 'Never'}
          </span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Notes</h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-sm text-emerald-400 hover:underline"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              className="w-full h-32 bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-sm resize-none"
              placeholder="Add notes about this plant..."
            />
            <button
              onClick={handleSaveNotes}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm"
            >
              Save Notes
            </button>
          </div>
        ) : (
          <div className="bg-neutral-800 rounded-lg p-3 text-sm whitespace-pre-wrap min-h-[60px]">
            {plant.notes || <span className="text-neutral-500">No notes yet</span>}
          </div>
        )}
      </div>

      {/* Quick Observation */}
      <div className="border-t border-neutral-800 pt-4 space-y-3">
        <h3 className="font-medium flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Record Observation
        </h3>
        <select
          value={observationHealth}
          onChange={(e) => setObservationHealth(e.target.value as HealthStatus)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Update health status (optional)</option>
          {Object.entries(HEALTH_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <textarea
          value={observationNotes}
          onChange={(e) => setObservationNotes(e.target.value)}
          placeholder="What did you observe? (optional)"
          className="w-full h-20 bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-sm resize-none"
        />
        <button
          onClick={handleSubmitObservation}
          className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium"
        >
          Record Observation
        </button>
      </div>

      {/* Photos */}
      {plant.photos_count > 0 && (
        <div className="border-t border-neutral-800 pt-4">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Photos ({plant.photos_count})
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {plant.photo_urls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${plant.common_name || plant.species} photo ${i + 1}`}
                className="w-full aspect-square object-cover rounded-lg"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Plant Identification Modal Component
interface PlantIdentifyModalProps {
  onClose: () => void;
}

function PlantIdentifyModal({ onClose }: PlantIdentifyModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlantIdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleIdentify = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    try {
      const identification = await identifyPlant(selectedFile, context || undefined);
      setResult(identification);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to identify plant');
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (confidence: string | undefined, pct: number) => {
    if (pct >= 80 || confidence === 'high') return 'text-green-400';
    if (pct >= 50 || confidence === 'medium') return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Plant Identification
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Upload Area */}
          {!result && (
            <>
              <div className="border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center">
                {previewUrl ? (
                  <div className="space-y-4">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-lg"
                    />
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="text-sm text-neutral-400 hover:text-white"
                    >
                      Choose different photo
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-500" />
                    <p className="text-neutral-300 mb-2">
                      Drop a photo here or click to upload
                    </p>
                    <p className="text-sm text-neutral-500">
                      Take a clear photo of the plant you want to identify
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Optional Context */}
              <div>
                <label className="block text-sm text-neutral-400 mb-2">
                  Additional context (optional)
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., 'Found in my backyard', 'Might be an oak tree'"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Identify Button */}
              <button
                onClick={handleIdentify}
                disabled={!selectedFile || loading}
                className={cn(
                  'w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2',
                  selectedFile && !loading
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Identify Plant
                  </>
                )}
              </button>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300">
              {error}
            </div>
          )}

          {/* Results */}
          {result && result.success && (
            <div className="space-y-4">
              {/* Primary Suggestion */}
              <div className="bg-neutral-800 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {result.primary_suggestion.common_name}
                    </h3>
                    <p className="text-neutral-400 italic text-sm">
                      {result.primary_suggestion.species?.replace(/_/g, ' ')}
                    </p>
                    {result.primary_suggestion.common_name_fr && (
                      <p className="text-neutral-500 text-sm">
                        FR: {result.primary_suggestion.common_name_fr}
                      </p>
                    )}
                  </div>
                  <div className={cn(
                    'text-right',
                    confidenceColor(result.primary_suggestion.confidence, result.primary_suggestion.confidence_percentage)
                  )}>
                    <div className="text-2xl font-bold">
                      {result.primary_suggestion.confidence_percentage}%
                    </div>
                    <div className="text-sm capitalize">
                      {result.primary_suggestion.confidence} confidence
                    </div>
                  </div>
                </div>
                {result.primary_suggestion.reasoning && (
                  <p className="text-sm text-neutral-300">
                    {result.primary_suggestion.reasoning}
                  </p>
                )}
              </div>

              {/* Category & Health */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-800 rounded-lg p-3">
                  <div className="text-neutral-400 text-sm mb-1">Category</div>
                  <div className="capitalize">{result.category?.replace(/_/g, ' ')}</div>
                </div>
                <div className="bg-neutral-800 rounded-lg p-3">
                  <div className="text-neutral-400 text-sm mb-1">Health Assessment</div>
                  <div className={cn(
                    'capitalize',
                    HEALTH_CONFIG[result.health_assessment?.status]?.color || 'text-neutral-300'
                  )}>
                    {result.health_assessment?.status || 'Unknown'}
                  </div>
                </div>
              </div>

              {/* Characteristics */}
              {result.characteristics_observed && result.characteristics_observed.length > 0 && (
                <div>
                  <h4 className="text-sm text-neutral-400 mb-2">Observed Characteristics</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.characteristics_observed.map((char, i) => (
                      <span key={i} className="px-2 py-1 bg-neutral-800 rounded-full text-sm">
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternative Suggestions */}
              {result.alternative_suggestions && result.alternative_suggestions.length > 0 && (
                <div>
                  <h4 className="text-sm text-neutral-400 mb-2">Alternative Possibilities</h4>
                  <div className="space-y-2">
                    {result.alternative_suggestions.map((alt, i) => (
                      <div key={i} className="bg-neutral-800 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium">{alt.common_name}</span>
                          <span className="text-neutral-400 text-sm ml-2">
                            {alt.species?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className={cn('text-sm', confidenceColor(undefined, alt.confidence_percentage))}>
                          {alt.confidence_percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Care Tips */}
              {result.care_tips && (
                <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">Care Tips</h4>
                  <p className="text-sm text-neutral-300">{result.care_tips}</p>
                </div>
              )}

              {/* Notes */}
              {result.identification_notes && (
                <div className="text-sm text-neutral-400 italic">
                  Note: {result.identification_notes}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setResult(null);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg"
                >
                  Identify Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
