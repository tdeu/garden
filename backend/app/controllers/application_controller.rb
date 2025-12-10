class ApplicationController < ActionController::API
  before_action :set_default_format

  private

  def set_default_format
    request.format = :json
  end

  def authenticate_user!
    token = request.headers['Authorization']&.split(' ')&.last

    if token.present?
      begin
        decoded = JWT.decode(token, jwt_secret, true, algorithm: 'HS256')
        @current_user = User.find(decoded[0]['user_id'])
      rescue JWT::DecodeError, ActiveRecord::RecordNotFound
        render json: { error: 'Unauthorized' }, status: :unauthorized
      end
    else
      render json: { error: 'Unauthorized - No token provided' }, status: :unauthorized
    end
  end

  def current_user
    @current_user
  end

  def jwt_secret
    ENV.fetch('JWT_SECRET') { Rails.application.credentials.secret_key_base }
  end
end
