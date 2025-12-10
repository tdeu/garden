'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Upload, Trash2, Check, Loader2, ImageIcon, MapPin, Edit3, X, Save } from 'lucide-react';
import {
  getViewpointPhotos,
  createAndUploadViewpointPhoto,
  updateViewpointPhoto,
  deleteViewpointPhoto,
  type ViewpointPhoto,
  type CoverageArea,
  type CameraPosition,
} from '@/lib/api';
import { cn } from '@/lib/utils';

interface ViewpointCardProps {
  photo: ViewpointPhoto;
  onEdit: () => void;
  onDelete: () => void;
  isSelected: boolean;
  onSelect: () => void;
}

function ViewpointCard({ photo, onEdit, onDelete, isSelected, onSelect }: ViewpointCardProps) {
  const hasCoverage = photo.coverage_area &&
    photo.coverage_area.xmin !== undefined &&
    photo.coverage_area.xmax !== undefined;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative rounded-lg border p-3 transition-all cursor-pointer',
        isSelected
          ? 'border-green-500 bg-green-900/20 ring-2 ring-green-500/50'
          : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
      )}
    >
      {/* Photo preview */}
      <div className="relative aspect-video mb-2 rounded overflow-hidden bg-neutral-900">
        {photo.photo_url ? (
          <img
            src={photo.photo_url}
            alt={photo.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-neutral-700" />
          </div>
        )}

        {/* Coverage status badge */}
        <div className={cn(
          'absolute top-1 right-1 rounded-full p-0.5',
          hasCoverage ? 'bg-green-600' : 'bg-yellow-600'
        )}>
          {hasCoverage ? (
            <Check className="w-3 h-3 text-white" />
          ) : (
            <MapPin className="w-3 h-3 text-white" />
          )}
        </div>
      </div>

      {/* Label */}
      <div className="mb-2">
        <p className="text-xs font-medium text-white truncate">{photo.name}</p>
        {photo.description && (
          <p className="text-[10px] text-neutral-500 truncate">{photo.description}</p>
        )}
        {!hasCoverage && (
          <p className="text-[10px] text-yellow-500">Coverage area not set</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-neutral-700 text-neutral-300 hover:bg-neutral-600 transition-colors"
        >
          <Edit3 className="w-3 h-3" />
          <span>Edit</span>
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
          title="Delete photo"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

interface CoverageEditorProps {
  photo: ViewpointPhoto;
  onSave: (coverage: CoverageArea, cameraPos: CameraPosition, direction: number) => Promise<void>;
  onCancel: () => void;
  propertyBbox?: { xmin: number; ymin: number; xmax: number; ymax: number };
}

function CoverageEditor({ photo, onSave, onCancel, propertyBbox }: CoverageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [coverage, setCoverage] = useState<CoverageArea | null>(photo.coverage_area || null);
  const [cameraPos, setCameraPos] = useState<CameraPosition>(photo.camera_position || { x: 0, y: 0 });
  const [direction, setDirection] = useState(photo.camera_direction || 0);
  const [saving, setSaving] = useState(false);

  // Canvas coordinate system: 0-100 normalized
  const CANVAS_SIZE = 300;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const pos = (i / 10) * CANVAS_SIZE;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(CANVAS_SIZE, pos);
      ctx.stroke();
    }

    // Draw coverage area
    if (coverage) {
      const x = (coverage.xmin / 100) * CANVAS_SIZE;
      const y = (coverage.ymin / 100) * CANVAS_SIZE;
      const w = ((coverage.xmax - coverage.xmin) / 100) * CANVAS_SIZE;
      const h = ((coverage.ymax - coverage.ymin) / 100) * CANVAS_SIZE;

      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }

    // Draw camera position
    const camX = (cameraPos.x / 100) * CANVAS_SIZE;
    const camY = (cameraPos.y / 100) * CANVAS_SIZE;

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(camX, camY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw direction arrow
    const arrowLen = 20;
    const rad = (direction * Math.PI) / 180;
    const arrowX = camX + Math.cos(rad) * arrowLen;
    const arrowY = camY + Math.sin(rad) * arrowLen;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(camX, camY);
    ctx.lineTo(arrowX, arrowY);
    ctx.stroke();
  }, [coverage, cameraPos, direction]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (e.shiftKey) {
      // Shift+click sets camera position
      setCameraPos({ x, y });
    } else {
      // Regular click starts drawing coverage
      setIsDrawing(true);
      setStartPoint({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setCoverage({
      xmin: Math.min(startPoint.x, x),
      xmax: Math.max(startPoint.x, x),
      ymin: Math.min(startPoint.y, y),
      ymax: Math.max(startPoint.y, y),
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setStartPoint(null);
  };

  const handleSave = async () => {
    if (!coverage) return;
    setSaving(true);
    try {
      await onSave(coverage, cameraPos, direction);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Set Coverage Area</h3>
          <button onClick={onCancel} className="text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo preview */}
        {photo.photo_url && (
          <div className="mb-4 rounded overflow-hidden">
            <img src={photo.photo_url} alt={photo.name} className="w-full h-32 object-cover" />
          </div>
        )}

        {/* Canvas for drawing */}
        <div className="mb-4">
          <p className="text-xs text-neutral-400 mb-2">
            Draw the area visible in this photo. Shift+click to set camera position.
          </p>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="w-full border border-neutral-700 rounded cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {/* Direction slider */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-400 mb-1">
            Camera Direction: {direction}°
          </label>
          <input
            type="range"
            min="0"
            max="360"
            value={direction}
            onChange={(e) => setDirection(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded bg-neutral-700 text-white hover:bg-neutral-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!coverage || saving}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded text-white',
              coverage && !saving
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-neutral-600 cursor-not-allowed'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddPhotoModalProps {
  onAdd: (file: File, name: string, description?: string) => Promise<void>;
  onCancel: () => void;
}

function AddPhotoModal({ onAdd, onCancel }: AddPhotoModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);

      // Auto-generate name from filename
      if (!name) {
        setName(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  const handleSubmit = async () => {
    if (!file || !name) return;
    setSaving(true);
    try {
      await onAdd(file, name, description || undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Add Viewpoint Photo</h3>
          <button onClick={onCancel} className="text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File input */}
        <div className="mb-4">
          <label className="block w-full">
            <div className={cn(
              'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
              preview ? 'border-green-600' : 'border-neutral-600 hover:border-neutral-500'
            )}>
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-40 mx-auto rounded" />
              ) : (
                <div className="py-4">
                  <Upload className="w-8 h-8 mx-auto text-neutral-500 mb-2" />
                  <p className="text-sm text-neutral-400">Click to select a photo</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Name input */}
        <div className="mb-3">
          <label className="block text-xs text-neutral-400 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Back garden view"
            className="w-full px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-white text-sm focus:outline-none focus:border-green-600"
          />
        </div>

        {/* Description input */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-400 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this photo shows..."
            rows={2}
            className="w-full px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-white text-sm focus:outline-none focus:border-green-600 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded bg-neutral-700 text-white hover:bg-neutral-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || !name || saving}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded text-white',
              file && name && !saving
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-neutral-600 cursor-not-allowed'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Add Photo
          </button>
        </div>
      </div>
    </div>
  );
}

interface ViewpointManagerProps {
  className?: string;
  onPhotoSelect?: (photo: ViewpointPhoto) => void;
  selectedPhotoId?: number | null;
}

export function ViewpointManager({
  className,
  onPhotoSelect,
  selectedPhotoId,
}: ViewpointManagerProps) {
  const [photos, setPhotos] = useState<ViewpointPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<ViewpointPhoto | null>(null);

  // Load photos on mount
  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const data = await getViewpointPhotos();
      setPhotos(data);
    } catch (error) {
      console.error('Error loading viewpoint photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async (file: File, name: string, description?: string) => {
    try {
      await createAndUploadViewpointPhoto(file, { name, description });
      await loadPhotos();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding photo:', error);
    }
  };

  const handleUpdateCoverage = async (
    photoId: number,
    coverage: CoverageArea,
    cameraPos: CameraPosition,
    direction: number
  ) => {
    try {
      await updateViewpointPhoto(photoId, {
        coverage_area: coverage,
        camera_position: cameraPos,
        camera_direction: direction,
      });
      await loadPhotos();
      setEditingPhoto(null);
    } catch (error) {
      console.error('Error updating coverage:', error);
    }
  };

  const handleDelete = async (photoId: number) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await deleteViewpointPhoto(photoId);
      await loadPhotos();
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  const photosWithCoverage = photos.filter(p => p.coverage_area?.xmin !== undefined).length;

  return (
    <div className={cn('bg-neutral-900 rounded-lg border border-neutral-800', className)}>
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-semibold text-white">Viewpoint Photos</h3>
          </div>
          <span className="text-xs text-neutral-500">
            {photosWithCoverage}/{photos.length} configured
          </span>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Upload photos and mark their coverage areas for AI visualization
        </p>
      </div>

      {loading ? (
        <div className="p-4 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />
        </div>
      ) : (
        <div className="p-3">
          {/* Add button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-green-600 hover:text-green-500 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm">Add Photo</span>
          </button>

          {/* Photo grid */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo) => (
                <ViewpointCard
                  key={photo.id}
                  photo={photo}
                  isSelected={selectedPhotoId === photo.id}
                  onSelect={() => onPhotoSelect?.(photo)}
                  onEdit={() => setEditingPhoto(photo)}
                  onDelete={() => handleDelete(photo.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-neutral-500">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No photos yet</p>
              <p className="text-xs">Add photos from different viewpoints around your garden</p>
            </div>
          )}

          {photos.length > 0 && photosWithCoverage < photos.length && (
            <div className="mt-3 p-2 bg-yellow-900/20 rounded border border-yellow-800/50">
              <p className="text-xs text-yellow-400">
                {photos.length - photosWithCoverage} photo{photos.length - photosWithCoverage > 1 ? 's' : ''} need coverage areas set for AI visualization.
              </p>
            </div>
          )}

          {photosWithCoverage === photos.length && photos.length > 0 && (
            <div className="mt-3 p-2 bg-green-900/20 rounded border border-green-800/50">
              <p className="text-xs text-green-400">
                All photos configured! Ready for AI visualization.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddPhotoModal
          onAdd={handleAddPhoto}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {editingPhoto && (
        <CoverageEditor
          photo={editingPhoto}
          onSave={(coverage, cameraPos, direction) =>
            handleUpdateCoverage(editingPhoto.id, coverage, cameraPos, direction)
          }
          onCancel={() => setEditingPhoto(null)}
        />
      )}
    </div>
  );
}

export default ViewpointManager;
