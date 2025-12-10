import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { saveGardenPlan, loadGardenPlan, getProperty } from '@/lib/api';

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
  category: 'tree' | 'fruit_tree' | 'shrub' | 'perennial' | 'hedge' | 'annual' | 'vegetable' | 'herb' | 'berry';
  location: GeoPoint;
  planted_date: string;
  // For coverage area matching
  x?: number;
  y?: number;
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
  type: 'wall' | 'dry_stone_wall' | 'stone_path' | 'fence' | 'path' | 'shed' | 'greenhouse' | 'pond' | 'terrace' | 'stone_terrace' | 'chicken_coop' | 'beehive' | 'duck_pond' | 'other';
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

// Store state
interface GardenState {
  // Property
  property: Property | null;
  setProperty: (property: Property) => void;

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
  plants: [],
  zones: [],
  structures: [],
  selectedTool: 'select' as const,
  selectedPlantType: null,
  selectedItemId: null,
  history: [],
  historyIndex: -1,
  cloudSyncStatus: 'idle' as CloudSyncStatus,
  lastSyncedAt: null,
};

export const useGardenStore = create<GardenState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Property
      setProperty: (property) => set({ property }),

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

      // Cloud sync - simplified for single-property mode
      syncToCloud: async () => {
        const { plants, zones, structures } = get();

        set({ cloudSyncStatus: 'syncing' });

        try {
          const result = await saveGardenPlan(plants, zones, structures);

          if (result) {
            set({
              cloudSyncStatus: 'synced',
              lastSyncedAt: new Date().toISOString(),
            });
            return true;
          } else {
            set({ cloudSyncStatus: 'error' });
            return false;
          }
        } catch (error) {
          console.error('Cloud sync error:', error);
          set({ cloudSyncStatus: 'error' });
          return false;
        }
      },

      loadFromCloud: async () => {
        set({ cloudSyncStatus: 'syncing' });

        try {
          const data = await loadGardenPlan();

          if (data) {
            set({
              plants: data.plants,
              zones: data.zones,
              structures: data.structures,
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
        plants: state.plants,
        zones: state.zones,
        structures: state.structures,
      }),
    }
  )
);
