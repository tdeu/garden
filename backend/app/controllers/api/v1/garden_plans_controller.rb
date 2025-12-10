module Api
  module V1
    class GardenPlansController < BaseController
      before_action :set_garden_plan, only: [:show, :update, :destroy, :activate]

      def index
        plans = default_property.garden_plans.order(created_at: :desc)
        render json: plans.map { |p| plan_json(p) }
      end

      def show
        render json: plan_json(@garden_plan)
      end

      def create
        plan = default_property.garden_plans.build(garden_plan_params)

        if plan.save
          render json: plan_json(plan), status: :created
        else
          render_error('Failed to create garden plan', details: plan.errors)
        end
      end

      def update
        if @garden_plan.update(garden_plan_params)
          render json: plan_json(@garden_plan)
        else
          render_error('Failed to update garden plan', details: @garden_plan.errors)
        end
      end

      def destroy
        @garden_plan.destroy
        head :no_content
      end

      def activate
        @garden_plan.activate!
        render json: plan_json(@garden_plan)
      end

      private

      def default_property
        @property ||= Property.default_property
      end

      def set_garden_plan
        @garden_plan = default_property.garden_plans.find(params[:id])
      end

      def garden_plan_params
        params.require(:garden_plan).permit(:name, :status, plants: {}, zones: {}, structures: {})
      end

      def plan_json(plan)
        {
          id: plan.id,
          name: plan.name,
          status: plan.status,
          plants: plan.plants,
          zones: plan.zones,
          structures: plan.structures,
          total_plants: plan.total_plants,
          total_zones: plan.total_zones,
          created_at: plan.created_at,
          updated_at: plan.updated_at
        }
      end
    end
  end
end
