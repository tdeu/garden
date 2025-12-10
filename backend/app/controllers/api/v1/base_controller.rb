module Api
  module V1
    class BaseController < ApplicationController
      # Single-user mode: no authentication required
      # before_action :authenticate_user!

      rescue_from ActiveRecord::RecordNotFound, with: :not_found
      rescue_from ActiveRecord::RecordInvalid, with: :unprocessable_entity
      rescue_from ActionController::ParameterMissing, with: :bad_request

      private

      def not_found(exception)
        render json: { error: exception.message }, status: :not_found
      end

      def unprocessable_entity(exception)
        render json: { error: exception.message, details: exception.record.errors },
               status: :unprocessable_entity
      end

      def bad_request(exception)
        render json: { error: exception.message }, status: :bad_request
      end

      def render_success(data, status: :ok, meta: {})
        render json: { data: data, meta: meta }, status: status
      end

      def render_error(message, status: :unprocessable_entity, details: {})
        render json: { error: message, details: details }, status: status
      end
    end
  end
end
