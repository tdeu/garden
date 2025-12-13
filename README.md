# Terra Memoria - AI-Powered Garden Planner

A garden planning tool that combines historical aerial imagery, interactive garden design, and AI-powered future visualization. Plan your garden on a map, place plants, and see how your garden will look years into the future using Google Gemini AI.

---

## Overview

**Core Workflow:**

### Today Tab (Present)
1. View your property through time using historical aerial imagery (1777 to present)
2. Place garden elements (trees, shrubs, flowers) on your garden map
3. Create and manage multiple garden plans
4. Track plant growth and carbon sequestration

### Future Tab (AI Vision)
1. Select a garden plan to visualize
2. Upload a viewpoint photo of your current garden
3. Set camera position and direction on the map
4. Choose projection year (1-5 years) and season
5. Generate AI visualization showing your garden with mature plants

---

## Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router) + React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Mapping:** Leaflet + React-Leaflet + Custom Canvas
- **State Management:** Zustand with localStorage persistence
- **Monorepo:** Turborepo with npm workspaces

### Backend
- **Framework:** Ruby on Rails 7.2 (API mode)
- **Database:** PostgreSQL
- **File Storage:** Active Storage (local disk)
- **AI Integration:** Google Gemini API (text + image editing)

### AI Services
- **Google Gemini 2.0 Flash** - Text descriptions and image analysis
- **Google Gemini 2.0 Flash Exp** - Image editing (adding plants to photos)

### External Services
- **Walloon Geoportal WMS** - Historical aerial imagery (1777-2023)
- **Esri World Imagery** - Base satellite layer

---

## Features

### Timeline View - Historical Imagery
Travel through time with your property:
- **1777** - Ferraris Map (first detailed map of Austrian Netherlands)
- **1850** - Vandermaelen topographic atlas
- **1868** - Military depot maps
- **2006-2023** - Walloon Region aerial orthophotos

### Interactive Garden Planner
- Custom garden image as base layer
- Plant placement with drag-and-drop
- Multiple garden plans support
- Plant growth calculations based on species and age

### Extensive Plant Library
Organized by category with growth data:

**Trees:** Oak, Beech, Birch, Wild Cherry, Ash, Rowan, Maple
**Fruit Trees:** Apple, Cherry, Pear, Plum
**Shrubs:** Dogwood, Guelder Rose, Elder, Hydrangea
**Perennials:** Lavender, Echinacea, Rudbeckia, Hosta
**Hedges:** Hornbeam, Yew, Box, Privet

### AI Future Vision
- Upload ground-level photos of your garden
- Set camera position on the map (click to place)
- Set viewing direction (degree input or compass buttons)
- AI calculates plant positions relative to camera
- Generates edited photo with future plants added
- Text descriptions of the transformed garden

---

## Project Structure

```
garden/
├── apps/
│   └── web/                              # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx              # Landing page
│       │   │   └── planner/              # Main garden planner
│       │   ├── components/
│       │   │   └── GardenPlanner/
│       │   │       ├── GardenCanvas.tsx  # Map/canvas view
│       │   │       ├── CanvasGarden.tsx  # Custom canvas renderer
│       │   │       ├── FuturePlanner.tsx # AI future vision UI
│       │   │       ├── PlantLibrary.tsx  # Plant selection
│       │   │       ├── Timeline.tsx      # Historical imagery
│       │   │       └── ViewpointPositionOverlay.tsx # Camera placement
│       │   ├── lib/
│       │   │   └── api/client.ts         # Backend API client
│       │   └── stores/
│       │       └── garden-store.ts       # Zustand state
│       └── public/
│           └── garden-*.png              # Garden base images
├── backend/                              # Rails API
│   ├── app/
│   │   ├── controllers/api/v1/
│   │   │   ├── garden_plans_controller.rb
│   │   │   ├── plants_controller.rb
│   │   │   ├── viewpoint_photos_controller.rb
│   │   │   └── ai/predictions_controller.rb
│   │   ├── models/
│   │   │   ├── garden_plan.rb
│   │   │   ├── plant.rb
│   │   │   └── viewpoint_photo.rb
│   │   └── services/
│   │       ├── gemini_service.rb         # Google Gemini AI integration
│   │       └── growth_calculator_service.rb
│   └── db/
│       └── schema.rb
├── turbo.json                            # Turborepo config
└── package.json                          # Workspace root
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Ruby 3.4+
- Rails 7.2+
- PostgreSQL

### Installation

```bash
# Clone the repository
git clone https://github.com/tdeu/garden.git
cd garden

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
bundle install

# Set up database
rails db:create db:migrate db:seed
cd ..
```

### Environment Variables

Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Create `backend/.env`:
```env
# Database
DB_HOST=localhost
DB_USERNAME=postgres
DB_PASSWORD=postgres

# Google Gemini API (required for AI features)
GEMINI_API_KEY=your_gemini_api_key

# Get your key at: https://aistudio.google.com/apikey
```

### Development

```bash
# Terminal 1: Start Rails backend (port 3000)
cd backend
rails server

# Terminal 2: Start Next.js frontend (port 3001)
npm run dev
```

Open http://localhost:3001/planner in your browser.

---

## API Endpoints

### Garden Plans
- `GET /api/v1/garden_plans` - List all plans
- `POST /api/v1/garden_plans` - Create plan
- `GET /api/v1/garden_plans/:id` - Get plan
- `PUT /api/v1/garden_plans/:id` - Update plan
- `DELETE /api/v1/garden_plans/:id` - Delete plan

### Plants
- `GET /api/v1/garden_plans/:id/plants` - List plants in plan
- `POST /api/v1/garden_plans/:id/plants` - Add plant
- `PUT /api/v1/garden_plans/:id/plants/:id` - Update plant
- `DELETE /api/v1/garden_plans/:id/plants/:id` - Delete plant

### Viewpoint Photos
- `GET /api/v1/viewpoint_photos` - List photos
- `POST /api/v1/viewpoint_photos` - Upload photo
- `PUT /api/v1/viewpoint_photos/:id` - Update photo
- `DELETE /api/v1/viewpoint_photos/:id` - Delete photo

### AI Generation
- `POST /api/v1/ai/transform_viewpoint` - Generate future garden visualization

---

## AI Future Vision - How It Works

1. **Input Data:**
   - Source viewpoint photo (your actual garden)
   - Plants from garden plan (species, location, planted date)
   - Camera position and direction on the map
   - Target year and season

2. **Processing:**
   - Growth calculator estimates plant sizes based on species and age
   - Position calculator determines where each plant appears in the frame
   - Gemini generates text description of future garden
   - Gemini edits the source photo to add plants at correct positions

3. **Output:**
   - Edited photo with future plants added
   - Text description of the transformed scene
   - Download option for the generated image

---

## Walloon Historical Imagery

The timeline feature uses official WMS services from the Walloon Region of Belgium:

| Year | Service | Type |
|------|---------|------|
| 1777 | Ferraris Map | Historical cartography |
| 1850 | Vandermaelen | Topographic atlas |
| 1868 | Depot de la Guerre | Military maps |
| 2006-2023 | SPW Orthophotos | Aerial photography |

These are free, publicly accessible services provided by the Walloon Geoportal (geoservices.wallonie.be).

---

## License

MIT

---

## Acknowledgments

- Walloon Government for open geoportal data
- Google for Gemini AI capabilities
- Leaflet.js community for mapping tools
