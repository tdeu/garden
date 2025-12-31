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
          resources :plants, except: [:new, :edit] do
            collection do
              post :bulk
              get :stats
            end
            member do
              post :upload_photos
              post :observe
              post :mark_planted
            end
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
        # Photo dropbox for uploading and managing photos
        resources :dropbox, controller: 'dropbox', only: [:index, :show, :create, :destroy] do
          member do
            post :assign
          end
        end
      end

      # AI endpoints
      namespace :ai do
        post 'transform_viewpoint', to: 'predictions#transform_viewpoint'
        post 'generate_prediction', to: 'predictions#generate_prediction'
        post 'identify_plant', to: 'predictions#identify_plant'
      end
    end
  end
end
