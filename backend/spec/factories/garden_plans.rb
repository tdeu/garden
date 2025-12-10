FactoryBot.define do
  factory :garden_plan do
    property { nil }
    plants { "" }
    zones { "" }
    structures { "" }
    status { "MyString" }
    version { 1 }
  end
end
