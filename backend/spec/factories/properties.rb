FactoryBot.define do
  factory :property do
    user { nil }
    name { "MyString" }
    location { "" }
    bbox { "" }
    area_sqm { "9.99" }
  end
end
