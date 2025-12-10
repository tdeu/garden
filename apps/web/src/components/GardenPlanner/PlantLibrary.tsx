'use client';

import { useGardenStore, Plant } from '@/stores/garden-store';
import { PLANT_LIBRARY, PlantCategory, GrowthModel } from '@/lib/plant-library';
import { cn } from '@/lib/utils';
import { TreeDeciduous, Flower2, Leaf, Fence, Sun, Apple, Carrot, Salad, Cherry } from 'lucide-react';

const categoryIcons: Record<PlantCategory, typeof TreeDeciduous> = {
  tree: TreeDeciduous,
  fruit_tree: Apple,
  shrub: Flower2,
  perennial: Leaf,
  hedge: Fence,
  annual: Sun,
  vegetable: Carrot,
  herb: Salad,
  berry: Cherry,
};

const categoryLabels: Record<PlantCategory, string> = {
  tree: 'Trees',
  fruit_tree: 'Fruit Trees',
  shrub: 'Shrubs',
  perennial: 'Perennials',
  hedge: 'Hedges',
  annual: 'Annuals',
  vegetable: 'Vegetables',
  herb: 'Herbs',
  berry: 'Berries',
};

interface PlantLibraryProps {
  onPlantSelect?: (plant: GrowthModel, category: PlantCategory) => void;
}

export function PlantLibrary({ onPlantSelect }: PlantLibraryProps) {
  const { selectedTool, selectedPlantType, setSelectedPlantType } = useGardenStore();

  // Only show when plant tool is selected
  if (selectedTool !== 'plant') {
    return null;
  }

  const handlePlantClick = (plant: GrowthModel, category: PlantCategory) => {
    setSelectedPlantType(plant.species);
    onPlantSelect?.(plant, category);
  };

  return (
    <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800">
        <h3 className="text-sm font-semibold text-white">Plant Library</h3>
        <p className="text-xs text-neutral-500 mt-1">
          Select a plant, then click on the map to place it
        </p>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {(Object.keys(PLANT_LIBRARY) as PlantCategory[]).map((category) => {
          const Icon = categoryIcons[category];
          const plants = PLANT_LIBRARY[category];

          return (
            <div key={category} className="border-b border-neutral-800 last:border-b-0">
              <div className="flex items-center gap-2 px-4 py-2 bg-neutral-800/50">
                <Icon className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-neutral-300 uppercase tracking-wider">
                  {categoryLabels[category]}
                </span>
              </div>

              <div className="p-2 space-y-1">
                {plants.map((plant) => {
                  const isSelected = selectedPlantType === plant.species;

                  return (
                    <button
                      key={plant.species}
                      onClick={() => handlePlantClick(plant, category)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors',
                        'text-left text-sm',
                        isSelected
                          ? 'bg-green-600/20 text-green-400 ring-1 ring-green-600'
                          : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                      )}
                    >
                      <div>
                        <div className="font-medium">{plant.common_name}</div>
                        <div className="text-xs text-neutral-500 italic">
                          {plant.species.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div className="text-right text-xs text-neutral-500">
                        <div>{plant.mature_height_cm / 100}m</div>
                        <div>{plant.carbon_per_year_kg}kg CO₂/yr</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedPlantType && (
        <div className="px-4 py-3 bg-green-900/20 border-t border-green-800/50">
          <p className="text-xs text-green-400">
            Click on the map to place your plant
          </p>
        </div>
      )}
    </div>
  );
}

export default PlantLibrary;
