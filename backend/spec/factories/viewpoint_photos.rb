FactoryBot.define do
  factory :viewpoint_photo do
    property { nil }
    viewpoint { "MyString" }
    description { "MyText" }
    capture_date { "2025-12-09" }
    metadata { "" }
  end
end
