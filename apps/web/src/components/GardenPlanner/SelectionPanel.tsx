'use client';

import { useState, useEffect } from 'react';
import { useGardenStore, Plant, Zone, Structure } from '@/stores/garden-store';
import { PLANT_LIBRARY, PlantCategory } from '@/lib/plant-library';
import { cn } from '@/lib/utils';
import { Trash2, X, Calendar, MapPin, TreeDeciduous, Shapes, Route } from 'lucide-react';

interface SelectionPanelProps {
  className?: string;
}

export function SelectionPanel({ className }: SelectionPanelProps) {
  const {
    selectedItemId,
    setSelectedItemId,
    plants,
    zones,
    structures,
    updatePlant,
    updateZone,
    updateStructure,
    deletePlant,
    deleteZone,
    deleteStructure,
  } = useGardenStore();

  // Find the selected item
  const selectedPlant = plants.find((p) => p.id === selectedItemId);
  const selectedZone = zones.find((z) => z.id === selectedItemId);
  const selectedStructure = structures.find((s) => s.id === selectedItemId);

  const selectedItem = selectedPlant || selectedZone || selectedStructure;
  const itemType = selectedPlant ? 'plant' : selectedZone ? 'zone' : selectedStructure ? 'structure' : null;

  // Local state for editing
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');

  // Update local state when selection changes
  useEffect(() => {
    if (selectedPlant) {
      setEditName(selectedPlant.common_name);
      setEditDate(selectedPlant.planted_date);
    } else if (selectedZone) {
      setEditName(selectedZone.name);
    } else if (selectedStructure) {
      setEditName(selectedStructure.name || '');
    }
  }, [selectedItemId, selectedPlant, selectedZone, selectedStructure]);

  if (!selectedItem || !itemType) {
    return null;
  }

  const handleClose = () => {
    setSelectedItemId(null);
  };

  const handleDelete = () => {
    if (itemType === 'plant') {
      deletePlant(selectedItemId!);
    } else if (itemType === 'zone') {
      deleteZone(selectedItemId!);
    } else if (itemType === 'structure') {
      deleteStructure(selectedItemId!);
    }
    setSelectedItemId(null);
  };

  const handleNameChange = (value: string) => {
    setEditName(value);
    if (itemType === 'plant') {
      updatePlant(selectedItemId!, { common_name: value });
    } else if (itemType === 'zone') {
      updateZone(selectedItemId!, { name: value });
    } else if (itemType === 'structure') {
      updateStructure(selectedItemId!, { name: value });
    }
  };

  const handleDateChange = (value: string) => {
    setEditDate(value);
    if (itemType === 'plant') {
      updatePlant(selectedItemId!, { planted_date: value });
    }
  };

  // Get growth info for plants
  const getPlantGrowthInfo = () => {
    if (!selectedPlant) return null;

    for (const category of Object.keys(PLANT_LIBRARY) as PlantCategory[]) {
      const plant = PLANT_LIBRARY[category].find((p) => p.species === selectedPlant.species);
      if (plant) {
        return plant;
      }
    }
    return null;
  };

  const growthInfo = getPlantGrowthInfo();

  return (
    <div className={cn('bg-neutral-900 rounded-lg border border-neutral-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          {itemType === 'plant' && <TreeDeciduous className="w-4 h-4 text-green-500" />}
          {itemType === 'zone' && <Shapes className="w-4 h-4 text-pink-500" />}
          {itemType === 'structure' && <Route className="w-4 h-4 text-amber-500" />}
          <h3 className="text-sm font-semibold text-white capitalize">{itemType} Details</h3>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">
            Name
          </label>
          <input
            type="text"
            value={editName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Plant-specific fields */}
        {itemType === 'plant' && selectedPlant && (
          <>
            {/* Species */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Species
              </label>
              <div className="px-3 py-2 bg-neutral-800/50 rounded-md text-sm text-neutral-300 italic">
                {selectedPlant.species.replace(/_/g, ' ')}
              </div>
            </div>

            {/* Planted Date */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-neutral-400 mb-1">
                <Calendar className="w-3 h-3" />
                Planted Date
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {/* Location */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-neutral-400 mb-1">
                <MapPin className="w-3 h-3" />
                Location
              </label>
              <div className="px-3 py-2 bg-neutral-800/50 rounded-md text-xs text-neutral-400 font-mono">
                {selectedPlant.location.lat.toFixed(6)}, {selectedPlant.location.lng.toFixed(6)}
              </div>
            </div>

            {/* Growth Info */}
            {growthInfo && (
              <div className="p-3 bg-neutral-800/50 rounded-md space-y-2">
                <div className="text-xs font-medium text-neutral-400">Growth Info</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-neutral-500">Mature Height:</span>
                    <span className="text-white ml-1">{growthInfo.mature_height_cm / 100}m</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Growth Rate:</span>
                    <span className="text-white ml-1">{growthInfo.yearly_height_growth_cm}cm/yr</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">CO₂ Capture:</span>
                    <span className="text-green-400 ml-1">{growthInfo.carbon_per_year_kg}kg/yr</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Maturity:</span>
                    <span className="text-white ml-1">{growthInfo.maturity_years} years</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Zone-specific fields */}
        {itemType === 'zone' && selectedZone && (
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Zone Type
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 rounded-md">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedZone.color }}
              />
              <span className="text-sm text-neutral-300 capitalize">
                {selectedZone.type.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        )}

        {/* Structure-specific fields */}
        {itemType === 'structure' && selectedStructure && (
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Structure Type
            </label>
            <div className="px-3 py-2 bg-neutral-800/50 rounded-md text-sm text-neutral-300 capitalize">
              {selectedStructure.type.replace(/_/g, ' ')}
            </div>
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete {itemType}</span>
        </button>
      </div>
    </div>
  );
}

export default SelectionPanel;
