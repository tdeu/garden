# User model kept for potential future use but not required
# Single-user mode: all data belongs to the default property
class User < ApplicationRecord
  has_many :properties, dependent: :destroy
end
