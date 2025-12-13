'use client';

import { useState, useEffect } from 'react';
import { getGardenPlans, createGardenPlan, activateGardenPlan, deleteGardenPlan, GardenPlan, bulkSavePlants } from '@/lib/api/client';
import { useGardenStore } from '@/stores/garden-store';
import { getDefaultPlantsWithIds } from '@/config/default-plants';

export function PlanSelector() {
  const [plans, setPlans] = useState<GardenPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [showNewPlanInput, setShowNewPlanInput] = useState(false);

  const { gardenPlanId, loadFromCloud } = useGardenStore();

  // Load plans on mount
  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const fetchedPlans = await getGardenPlans();
      setPlans(fetchedPlans);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) return;

    try {
      setCreating(true);
      const newPlan = await createGardenPlan({ name: newPlanName.trim() });

      // Add default plants (existing trees on the property)
      const defaultPlants = getDefaultPlantsWithIds();
      if (defaultPlants.length > 0) {
        await bulkSavePlants(newPlan.id, defaultPlants.map(p => ({
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

      // Activate the new plan
      await activateGardenPlan(newPlan.id);
      // Reload plans
      await loadPlans();
      // Load the new plan into the store
      await loadFromCloud();
      // Reset UI
      setNewPlanName('');
      setShowNewPlanInput(false);
    } catch (error) {
      console.error('Error creating plan:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectPlan = async (planId: number) => {
    if (planId === gardenPlanId) return;

    try {
      setLoading(true);
      await activateGardenPlan(planId);
      await loadPlans();
      await loadFromCloud();
    } catch (error) {
      console.error('Error switching plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (planId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    if (plans.length <= 1) {
      alert('Cannot delete the only plan');
      return;
    }

    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      setLoading(true);
      await deleteGardenPlan(planId);
      await loadPlans();
      // If we deleted the active plan, load the first available one
      if (planId === gardenPlanId) {
        await loadFromCloud();
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="font-semibold text-gray-900">My Garden Plans</h3>
        </div>
        <button
          onClick={() => setShowNewPlanInput(true)}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          + New
        </button>
      </div>

      {/* New plan input */}
      {showNewPlanInput && (
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            placeholder="Plan name..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreatePlan();
              if (e.key === 'Escape') {
                setShowNewPlanInput(false);
                setNewPlanName('');
              }
            }}
          />
          <button
            onClick={handleCreatePlan}
            disabled={creating || !newPlanName.trim()}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? '...' : 'Create'}
          </button>
          <button
            onClick={() => {
              setShowNewPlanInput(false);
              setNewPlanName('');
            }}
            className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Plans list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {loading && plans.length === 0 ? (
          <div className="text-sm text-gray-500 py-2">Loading...</div>
        ) : plans.length === 0 ? (
          <div className="text-sm text-gray-500 py-2">No plans yet. Create one!</div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => handleSelectPlan(plan.id)}
              className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                plan.id === gardenPlanId
                  ? 'bg-green-50 border border-green-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {plan.id === gardenPlanId && (
                  <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                )}
                <span className={`text-sm truncate ${plan.id === gardenPlanId ? 'font-medium text-green-700' : 'text-gray-700'}`}>
                  {plan.name}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">
                  {plan.total_plants} plants
                </span>
                {plans.length > 1 && (
                  <button
                    onClick={(e) => handleDeletePlan(plan.id, e)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Delete plan"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default PlanSelector;
