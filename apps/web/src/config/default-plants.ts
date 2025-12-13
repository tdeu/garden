import type { Plant } from '@/stores/garden-store';

// Default plants that exist on the property
// These are added to every new garden plan
export const DEFAULT_PLANTS: Omit<Plant, 'id'>[] = [
  {
    species: 'Prunus avium',
    common_name: 'Wild Cherry (Cerisier sauvage)',
    category: 'tree',
    location: { lat: 49.63867, lng: 5.55145 },
    planted_date: '2020-01-01', // Approximate - existing tree
    images: [
      '/plants/cerisier1.JPG',
      '/plants/cerisier2.JPG',
      '/plants/cerisier3.jpg',
    ],
    isDefault: true,
  },
];

// Generate unique IDs for default plants
export function getDefaultPlantsWithIds(): Plant[] {
  return DEFAULT_PLANTS.map((plant, index) => ({
    ...plant,
    id: `default-plant-${index}`,
  }));
}
