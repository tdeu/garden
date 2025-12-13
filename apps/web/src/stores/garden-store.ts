import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { saveGardenPlan, loadGardenPlan, getProperty, getActiveGardenPlan, bulkSavePlants, getPlants } from '@/lib/api';

// Types
export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Plant {
  id: string;
  species: string;
  common_name: string;
  category: 'tree' | 'fruit_tree' | 'shrub' | 'perennial' | 'hedge' | 'annual' | 'vegetable' | 'herb' | 'berry' | 'wall_plant' | 'bulb';
  location: GeoPoint;
  planted_date: string;
  // For coverage area matching
  x?: number;
  y?: number;
  // Plant images
  images?: string[];
  // Whether this is a default/existing plant (not to be deleted when creating new plans)
  isDefault?: boolean;
}

export interface Zone {
  id: string;
  name: string;
  type: 'flower_bed' | 'vegetable_garden' | 'lawn' | 'woodland' | 'orchard' | 'herb_garden' | 'animal_area' | 'patio' | 'water_feature' | 'other';
  coordinates: [number, number][];
  color?: string;
}

export interface Structure {
  id: string;
  type: 'wall' | 'dry_stone_wall' | 'dry_stone_planter' | 'herb_spiral' | 'stone_path' | 'fence' | 'path' | 'shed' | 'greenhouse' | 'pond' | 'terrace' | 'stone_terrace' | 'chicken_coop' | 'beehive' | 'duck_pond' | 'other';
  coordinates: [number, number][];
  name?: string;
}

export interface Property {
  id: number;
  name: string;
  location: GeoPoint;
  bbox: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  area_sqm?: number;
}

// Camera position type for viewpoint
export interface CameraPosition {
  x: number;
  y: number;
}

// Store state
interface GardenState {
  // Property
  property: Property | null;
  setProperty: (property: Property) => void;

  // Active garden plan ID (needed for plants API)
  gardenPlanId: number | null;
  setGardenPlanId: (id: number | null) => void;

  // Future mode state
  futureSelectedPlanId: number | null;
  futureSelectedPhotoId: number | null;
  futureCameraPosition: CameraPosition | null;
  futureCameraDirection: number;
  futurePlanPlants: Plant[];
  futurePlanZones: Zone[];
  futurePlanStructures: Structure[];
  setFutureSelectedPlanId: (id: number | null) => void;
  setFutureSelectedPhotoId: (id: number | null) => void;
  setFutureCameraPosition: (pos: CameraPosition | null) => void;
  setFutureCameraDirection: (degrees: number) => void;
  setFuturePlanData: (plants: Plant[], zones: Zone[], structures: Structure[]) => void;

  // Garden data
  plants: Plant[];
  zones: Zone[];
  structures: Structure[];

  // Plant actions
  addPlant: (plant: Plant) => void;
  updatePlant: (id: string, updates: Partial<Plant>) => void;
  deletePlant: (id: string) => void;

  // Zone actions
  addZone: (zone: Zone) => void;
  updateZone: (id: string, updates: Partial<Zone>) => void;
  deleteZone: (id: string) => void;

  // Structure actions
  addStructure: (structure: Structure) => void;
  updateStructure: (id: string, updates: Partial<Structure>) => void;
  deleteStructure: (id: string) => void;

  // UI state
  selectedTool: 'select' | 'plant' | 'zone' | 'structure';
  setSelectedTool: (tool: 'select' | 'plant' | 'zone' | 'structure') => void;

  selectedPlantType: string | null;
  setSelectedPlantType: (plantType: string | null) => void;

  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;

  // History for undo/redo
  history: Array<{ plants: Plant[]; zones: Zone[]; structures: Structure[] }>;
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;

  // Cloud sync
  cloudSyncStatus: CloudSyncStatus;
  lastSyncedAt: string | null;
  syncToCloud: () => Promise<boolean>;
  loadFromCloud: () => Promise<boolean>;
  initializeFromCloud: () => Promise<void>;

  // Reset
  reset: () => void;
}

const initialState = {
  property: null,
  gardenPlanId: null as number | null,
  plants: [] as Plant[],
  zones: [] as Zone[],
  structures: [] as Structure[],
  selectedTool: 'select' as const,
  selectedPlantType: null as string | null,
  selectedItemId: null as string | null,
  history: [] as Array<{ plants: Plant[]; zones: Zone[]; structures: Structure[] }>,
  historyIndex: -1,
  cloudSyncStatus: 'idle' as CloudSyncStatus,
  lastSyncedAt: null as string | null,
  // Future mode state
  futureSelectedPlanId: null as number | null,
  futureSelectedPhotoId: null as number | null,
  futureCameraPosition: null as CameraPosition | null,
  futureCameraDirection: 0,
  futurePlanPlants: [] as Plant[],
  futurePlanZones: [] as Zone[],
  futurePlanStructures: [] as Structure[],
};

export const useGardenStore = create<GardenState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Property
      setProperty: (property) => set({ property }),

      // Garden plan ID
      setGardenPlanId: (id) => set({ gardenPlanId: id }),

      // Future mode actions
      setFutureSelectedPlanId: (id) => set({ futureSelectedPlanId: id }),
      setFutureSelectedPhotoId: (id) => set({ futureSelectedPhotoId: id }),
      setFutureCameraPosition: (pos) => set({ futureCameraPosition: pos }),
      setFutureCameraDirection: (degrees) => set({ futureCameraDirection: degrees }),
      setFuturePlanData: (plants, zones, structures) => set({
        futurePlanPlants: plants,
        futurePlanZones: zones,
        futurePlanStructures: structures
      }),

      // Plant actions
      addPlant: (plant) => {
        get().saveToHistory();
        set((state) => ({ plants: [...state.plants, plant] }));
      },
      updatePlant: (id, updates) => {
        get().saveToHistory();
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },
      deletePlant: (id) => {
        get().saveToHistory();
        set((state) => ({
          plants: state.plants.filter((p) => p.id !== id),
        }));
      },

      // Zone actions
      addZone: (zone) => {
        get().saveToHistory();
        set((state) => ({ zones: [...state.zones, zone] }));
      },
      updateZone: (id, updates) => {
        get().saveToHistory();
        set((state) => ({
          zones: state.zones.map((z) =>
            z.id === id ? { ...z, ...updates } : z
          ),
        }));
      },
      deleteZone: (id) => {
        get().saveToHistory();
        set((state) => ({
          zones: state.zones.filter((z) => z.id !== id),
        }));
      },

      // Structure actions
      addStructure: (structure) => {
        get().saveToHistory();
        set((state) => ({ structures: [...state.structures, structure] }));
      },
      updateStructure: (id, updates) => {
        get().saveToHistory();
        set((state) => ({
          structures: state.structures.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },
      deleteStructure: (id) => {
        get().saveToHistory();
        set((state) => ({
          structures: state.structures.filter((s) => s.id !== id),
        }));
      },

      // UI state
      setSelectedTool: (tool) => set({ selectedTool: tool }),
      setSelectedPlantType: (plantType) => set({ selectedPlantType: plantType }),
      setSelectedItemId: (id) => set({ selectedItemId: id }),

      // History
      saveToHistory: () => {
        const { plants, zones, structures, history, historyIndex } = get();
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ plants: [...plants], zones: [...zones], structures: [...structures] });
        // Keep only last 50 history entries
        if (newHistory.length > 50) {
          newHistory.shift();
        }
        set({ history: newHistory, historyIndex: newHistory.length - 1 });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
          const previousState = history[historyIndex - 1];
          set({
            plants: previousState.plants,
            zones: previousState.zones,
            structures: previousState.structures,
            historyIndex: historyIndex - 1,
          });
        }
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const nextState = history[historyIndex + 1];
          set({
            plants: nextState.plants,
            zones: nextState.zones,
            structures: nextState.structures,
            historyIndex: historyIndex + 1,
          });
        }
      },

      // Cloud sync - now uses dedicated plants table
      syncToCloud: async () => {
        const { plants, zones, structures, gardenPlanId } = get();

        set({ cloudSyncStatus: 'syncing' });

        try {
          // First save zones and structures to garden_plans JSONB (unchanged)
          const result = await saveGardenPlan([], zones, structures);

          if (!result) {
            set({ cloudSyncStatus: 'error' });
            return false;
          }

          // Get the garden plan ID if we don't have it
          let planId = gardenPlanId;
          if (!planId) {
            const plan = await getActiveGardenPlan();
            if (plan) {
              planId = plan.id;
              set({ gardenPlanId: planId });
            }
          }

          // Now save plants to dedicated plants table
          if (planId) {
            await bulkSavePlants(planId, plants.map(p => ({
              species: p.species,
              common_name: p.common_name,
              category: p.category,
              location: p.location,
              planted_date: p.planted_date,
              metadata: {
                images: p.images,
                isDefault: p.isDefault,
              },
            })));
          }

          set({
            cloudSyncStatus: 'synced',
            lastSyncedAt: new Date().toISOString(),
          });
          return true;
        } catch (error) {
          console.error('Cloud sync error:', error);
          set({ cloudSyncStatus: 'error' });
          return false;
        }
      },

      loadFromCloud: async () => {
        set({ cloudSyncStatus: 'syncing' });

        try {
          // Get active plan for zones/structures and plan ID
          const plan = await getActiveGardenPlan();

          if (plan) {
            set({ gardenPlanId: plan.id });

            // Load plants from dedicated plants table
            const plantRecords = await getPlants(plan.id);

            // Convert PlantRecord to Plant format
            const plants: Plant[] = plantRecords.map((p) => {
              // Extract images and isDefault from metadata if present
              const metadata = (p as { metadata?: { images?: string[]; isDefault?: boolean } }).metadata;
              return {
                id: String(p.id), // Use DB id as string
                species: p.species,
                common_name: p.common_name,
                category: p.category as Plant['category'],
                location: p.location,
                planted_date: p.planted_date || new Date().toISOString().split('T')[0],
                images: metadata?.images,
                isDefault: metadata?.isDefault,
              };
            });

            // Handle both array and object formats for zones/structures
            const toArray = <T>(data: T[] | Record<string, T>): T[] => {
              if (Array.isArray(data)) return data;
              return Object.values(data);
            };

            set({
              plants,
              zones: toArray(plan.zones || []) as Zone[],
              structures: toArray(plan.structures || []) as Structure[],
              cloudSyncStatus: 'synced',
              lastSyncedAt: new Date().toISOString(),
              history: [],
              historyIndex: -1,
            });
            return true;
          } else {
            set({ cloudSyncStatus: 'idle' });
            return false;
          }
        } catch (error) {
          console.error('Load from cloud error:', error);
          set({ cloudSyncStatus: 'error' });
          return false;
        }
      },

      initializeFromCloud: async () => {
        // Load property and garden plan
        try {
          const property = await getProperty();

          if (property) {
            set({
              property: {
                id: property.id,
                name: property.name,
                location: property.location,
                bbox: property.bbox || { xmin: 0, ymin: 0, xmax: 0, ymax: 0 },
                area_sqm: property.area_sqm,
              },
            });

            // Load garden plan
            await get().loadFromCloud();
          }
        } catch (error) {
          console.error('Initialize from cloud error:', error);
        }
      },

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'garden-planner',
      partialize: (state) => ({
        property: state.property,
        gardenPlanId: state.gardenPlanId,
        plants: state.plants,
        zones: state.zones,
        structures: state.structures,
      }),
    }
  )
);
