'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGardenStore } from '@/stores/garden-store';
import {
  getDropboxPhotos,
  uploadDropboxPhotos,
  deleteDropboxPhoto,
  assignDropboxPhoto,
  getPlants,
  getViewpointPhotos,
  PlantRecord,
} from '@/lib/api/client';
import {
  DropboxPhoto,
  ViewpointPhoto,
  DropboxPhotoStatus,
} from '@/types';
import {
  Upload,
  Trash2,
  Home,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  MapPin,
  Calendar,
  Camera,
  Check,
  X,
  Leaf,
  Eye,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type AssignTarget = { type: 'plant' | 'viewpoint'; id: number; name: string };

export default function DropboxPage() {
  const { initializeFromCloud, property } = useGardenStore();
  const [photos, setPhotos] = useState<DropboxPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<DropboxPhoto | null>(null);
  const [filter, setFilter] = useState<DropboxPhotoStatus | 'all'>('pending');
  const [plants, setPlants] = useState<PlantRecord[]>([]);
  const [viewpoints, setViewpoints] = useState<ViewpointPhoto[]>([]);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [assignTarget, setAssignTarget] = useState<'plant' | 'viewpoint'>('plant');
  const [isDragOver, setIsDragOver] = useState(false);

  // Initialize
  useEffect(() => {
    const init = async () => {
      await initializeFromCloud();
    };
    init();
  }, [initializeFromCloud]);

  // Load photos
  useEffect(() => {
    loadPhotos();
  }, [filter]);

  // Load assignment targets when property is available
  useEffect(() => {
    if (property?.active_plan?.id) {
      loadAssignmentTargets();
    }
  }, [property]);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await getDropboxPhotos(status);
      setPhotos(data);
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignmentTargets = async () => {
    if (!property?.active_plan?.id) return;
    try {
      const [plantsData, viewpointsData] = await Promise.all([
        getPlants(property.active_plan.id),
        getViewpointPhotos(),
      ]);
      setPlants(plantsData);
      setViewpoints(viewpointsData);
    } catch (error) {
      console.error('Failed to load assignment targets:', error);
    }
  };

  const handleFilesSelected = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await uploadDropboxPhotos(fileArray);
      setPhotos(prev => [...uploaded, ...prev]);
    } catch (error) {
      console.error('Failed to upload photos:', error);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  }, [handleFilesSelected]);

  const handleDelete = async (photo: DropboxPhoto) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await deleteDropboxPhoto(photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto(null);
      }
    } catch (error) {
      console.error('Failed to delete photo:', error);
    }
  };

  const handleAssign = async (photo: DropboxPhoto, target: AssignTarget) => {
    try {
      const updated = await assignDropboxPhoto(photo.id, {
        type: target.type,
        id: target.id,
      });
      setPhotos(prev => prev.map(p => p.id === photo.id ? updated : p));
      setSelectedPhoto(updated);
      setShowAssignMenu(false);
    } catch (error) {
      console.error('Failed to assign photo:', error);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = photos.filter(p => p.status === 'pending').length;

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
              <h1 className="text-lg font-semibold">Photo Dropbox</h1>
              <p className="text-sm text-neutral-400">
                {pendingCount} photos waiting for assignment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as DropboxPhotoStatus | 'all')}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="archived">Archived</option>
              <option value="all">All Photos</option>
            </select>
            <button
              onClick={loadPhotos}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </header>

      {/* Upload Zone */}
      <div className="p-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
            isDragOver
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-neutral-700 hover:border-neutral-600'
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
              <p className="text-neutral-300">Uploading photos...</p>
            </div>
          ) : (
            <label className="cursor-pointer block">
              <Upload className="w-10 h-10 mx-auto mb-3 text-neutral-500" />
              <p className="text-neutral-300 mb-1">
                Drop photos here or click to upload
              </p>
              <p className="text-sm text-neutral-500">
                EXIF data (GPS, date, camera) will be extracted automatically
              </p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Photo Grid */}
        <div className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No photos in your dropbox.</p>
              <p className="text-sm mt-2">
                Upload photos to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className={cn(
                    'relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-colors',
                    selectedPhoto?.id === photo.id
                      ? 'border-emerald-500'
                      : 'border-transparent hover:border-neutral-700'
                  )}
                >
                  <div className="aspect-square bg-neutral-800">
                    <img
                      src={photo.photo_url}
                      alt="Dropbox photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Status Badge */}
                  <div
                    className={cn(
                      'absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium',
                      photo.status === 'pending' && 'bg-yellow-500/80 text-yellow-950',
                      photo.status === 'assigned' && 'bg-green-500/80 text-green-950',
                      photo.status === 'archived' && 'bg-neutral-500/80 text-neutral-950'
                    )}
                  >
                    {photo.status}
                  </div>
                  {/* GPS indicator */}
                  {photo.latitude && photo.longitude && (
                    <div className="absolute top-2 left-2 p-1 bg-blue-500/80 rounded-full">
                      <MapPin className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {/* Hover overlay with delete */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(photo);
                      }}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedPhoto && (
          <div className="w-96 bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold">Photo Details</h2>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-1 hover:bg-neutral-800 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Preview */}
              <div className="rounded-lg overflow-hidden">
                <img
                  src={selectedPhoto.photo_url}
                  alt="Selected photo"
                  className="w-full"
                />
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Status:</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                    selectedPhoto.status === 'pending' && 'bg-yellow-500/20 text-yellow-400',
                    selectedPhoto.status === 'assigned' && 'bg-green-500/20 text-green-400',
                    selectedPhoto.status === 'archived' && 'bg-neutral-500/20 text-neutral-400'
                  )}
                >
                  {selectedPhoto.status}
                </span>
              </div>

              {/* EXIF Info */}
              <div className="space-y-2 text-sm">
                {selectedPhoto.taken_at && (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Calendar className="w-4 h-4" />
                    <span>Taken: {formatDate(selectedPhoto.taken_at)}</span>
                  </div>
                )}
                {selectedPhoto.latitude && selectedPhoto.longitude && (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {selectedPhoto.latitude.toFixed(5)}, {selectedPhoto.longitude.toFixed(5)}
                    </span>
                  </div>
                )}
                {selectedPhoto.camera_model && (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Camera className="w-4 h-4" />
                    <span>{selectedPhoto.camera_model}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-neutral-400">
                  <Upload className="w-4 h-4" />
                  <span>Uploaded: {formatDate(selectedPhoto.created_at)}</span>
                </div>
              </div>

              {/* Assignment Info */}
              {selectedPhoto.assignable_type && selectedPhoto.assignable_id && (
                <div className="bg-neutral-800 rounded-lg p-3">
                  <div className="text-sm text-neutral-400 mb-1">Assigned to</div>
                  <div className="flex items-center gap-2">
                    {selectedPhoto.assignable_type === 'Plant' ? (
                      <Leaf className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-blue-400" />
                    )}
                    <span>
                      {selectedPhoto.assignable_type} #{selectedPhoto.assignable_id}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedPhoto.status === 'pending' && (
                <div className="space-y-3 border-t border-neutral-800 pt-4">
                  <h3 className="font-medium">Assign Photo</h3>

                  {/* Target Type Selector */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAssignTarget('plant')}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2',
                        assignTarget === 'plant'
                          ? 'bg-emerald-600'
                          : 'bg-neutral-800 hover:bg-neutral-700'
                      )}
                    >
                      <Leaf className="w-4 h-4" />
                      Plant
                    </button>
                    <button
                      onClick={() => setAssignTarget('viewpoint')}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2',
                        assignTarget === 'viewpoint'
                          ? 'bg-blue-600'
                          : 'bg-neutral-800 hover:bg-neutral-700'
                      )}
                    >
                      <Eye className="w-4 h-4" />
                      Viewpoint
                    </button>
                  </div>

                  {/* Target List */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {assignTarget === 'plant' ? (
                      plants.length === 0 ? (
                        <p className="text-sm text-neutral-500 text-center py-4">
                          No plants available. Add plants in the Garden Planner.
                        </p>
                      ) : (
                        plants.map((plant) => (
                          <button
                            key={plant.id}
                            onClick={() => handleAssign(selectedPhoto, {
                              type: 'plant',
                              id: plant.id,
                              name: plant.common_name || plant.species,
                            })}
                            className="w-full text-left p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                          >
                            <div className="font-medium text-sm">
                              {plant.common_name || plant.species}
                            </div>
                            {plant.common_name && (
                              <div className="text-xs text-neutral-400 italic">
                                {plant.species}
                              </div>
                            )}
                          </button>
                        ))
                      )
                    ) : viewpoints.length === 0 ? (
                      <p className="text-sm text-neutral-500 text-center py-4">
                        No viewpoints available. Create viewpoints in the Garden Planner.
                      </p>
                    ) : (
                      viewpoints.map((viewpoint) => (
                        <button
                          key={viewpoint.id}
                          onClick={() => handleAssign(selectedPhoto, {
                            type: 'viewpoint',
                            id: viewpoint.id,
                            name: viewpoint.name,
                          })}
                          className="w-full text-left p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                        >
                          <div className="font-medium text-sm">{viewpoint.name}</div>
                          {viewpoint.description && (
                            <div className="text-xs text-neutral-400">
                              {viewpoint.description}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(selectedPhoto)}
                className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Photo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
