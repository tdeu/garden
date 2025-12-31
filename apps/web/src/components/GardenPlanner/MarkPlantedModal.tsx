'use client';

import { useState, useEffect } from 'react';
import { useGardenStore, Plant } from '@/stores/garden-store';
import { getDropboxPhotos } from '@/lib/api/client';
import { DropboxPhoto } from '@/types';
import { X, Calendar, Sprout, Loader2, Image as ImageIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkPlantedModalProps {
  plant: Plant;
  onClose: () => void;
}

export function MarkPlantedModal({ plant, onClose }: MarkPlantedModalProps) {
  const { markPlantAsPlanted } = useGardenStore();
  const [plantedDate, setPlantedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<DropboxPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load pending dropbox photos
  useEffect(() => {
    const loadPhotos = async () => {
      setLoading(true);
      try {
        const data = await getDropboxPhotos('pending');
        setPhotos(data);
      } catch (error) {
        console.error('Failed to load dropbox photos:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPhotos();
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const success = await markPlantAsPlanted(
        plant.id,
        new Date(plantedDate),
        selectedPhotoId || undefined
      );
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to mark plant as planted:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sprout className="w-5 h-5 text-green-400" />
            Mark as Planted
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Plant Info */}
          <div className="bg-neutral-800 rounded-lg p-3">
            <div className="font-medium">{plant.common_name}</div>
            <div className="text-sm text-neutral-400 italic">{plant.species.replace(/_/g, ' ')}</div>
          </div>

          {/* Planted Date */}
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-neutral-400 mb-2">
              <Calendar className="w-4 h-4" />
              Planting Date
            </label>
            <input
              type="date"
              value={plantedDate}
              onChange={(e) => setPlantedDate(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {/* Photo Selection */}
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-neutral-400 mb-2">
              <ImageIcon className="w-4 h-4" />
              Attach Photo (optional)
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
              </div>
            ) : photos.length === 0 ? (
              <div className="text-center py-6 bg-neutral-800/50 rounded-lg text-neutral-500 text-sm">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No photos in dropbox. Upload photos first.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhotoId(
                      selectedPhotoId === photo.id ? null : photo.id
                    )}
                    className={cn(
                      'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                      selectedPhotoId === photo.id
                        ? 'border-green-500'
                        : 'border-transparent hover:border-neutral-600'
                    )}
                  >
                    <img
                      src={photo.photo_url}
                      alt="Dropbox photo"
                      className="w-full h-full object-cover"
                    />
                    {selectedPhotoId === photo.id && (
                      <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={cn(
                'flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors',
                saving
                  ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirm Planted
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarkPlantedModal;
