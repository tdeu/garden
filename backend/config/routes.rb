Rails.application.routes.draw do
  # Health check
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Single property mode - simplified routes
      resource :property, only: [:show, :update] do
        resources :garden_plans do
          member do
            post :activate
          end
        end
        resources :viewpoint_photos do
          member do
            post :upload_photo
          end
          collection do
            get :by_location  # Find photo matching a location
          end
        end
      end

      # AI endpoints
      namespace :ai do
        post 'transform_viewpoint', to: 'predictions#transform_viewpoint'
        post 'generate_prediction', to: 'predictions#generate_prediction'
      end
    end
  end
end
