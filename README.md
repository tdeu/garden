# Terra Memoria - AI-Witnessed Land Chronicle

A garden planning tool that combines historical aerial imagery, interactive garden design, and AI-powered future visualization. Plan your garden on a map, upload photos from different viewpoints, and see how your garden will look years into the future.

---

## Overview

**Core Workflow:**
1. View your property through time using historical aerial imagery from 1777 to present
2. Place garden elements (trees, shrubs, flowers, vegetables) on a satellite map
3. Draw zones (flower beds, vegetable gardens, orchards) and structures (paths, walls)
4. Upload ground-level photos from different viewpoints around your garden
5. Generate AI-powered visualizations showing how your garden will look in 1, 5, or 10 years

---

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Mapping:** Leaflet + React-Leaflet
- **State Management:** Zustand with localStorage persistence
- **Monorepo:** Turborepo with npm workspaces

### Backend
- **Framework:** Ruby on Rails 8 (API mode)
- **Database:** SQLite (development) / PostgreSQL (production)
- **File Storage:** Active Storage (local disk / S3-compatible)
- **AI Integration:** OpenAI API for future garden visualization

### External Services
- **Walloon Geoportal WMS** - Historical aerial imagery (1777 Ferraris maps to 2023 orthophotos)
- **Esri World Imagery** - Base satellite layer
- **OpenAI** - Image analysis and garden visualization generation

---

## Features

### Timeline View - Historical Imagery
Travel through time with your property:
- **1777** - Ferraris Map (first detailed map of Austrian Netherlands)
- **1850** - Vandermaelen topographic atlas
- **1868** - Military depot maps
- **2006-2023** - Walloon Region aerial orthophotos
- **2025** - Custom high-resolution imagery

### Interactive Garden Planner
- Satellite map base layer centered on your property
- Plant placement with species-specific icons
- Zone drawing for flower beds, vegetable gardens, orchards
- Structure tools for paths, walls, terraces

### Extensive Plant Library
Organized by category with growth data and CO2 sequestration estimates:

**Trees:** English Oak, European Beech, Silver Birch, Field Maple
**Fruit Trees:** Apple, Cherry, Pear, Plum
**Shrubs:** Dogwood, Guelder Rose, Elder, Hydrangea
**Perennials:** Lavender, Echinacea, Rudbeckia, Hosta
**Hedges:** Hornbeam, Yew, Box, Privet
**Vegetables:** Tomato, Cucumber, Cabbage, Carrot
**Herbs:** Rosemary, Thyme, Mint, Basil
**Berries:** Raspberry, Blackcurrant, Blueberry, Strawberry

### Viewpoint Photo System
Upload photos from standardized viewpoints around your garden:
- Front Garden, Back Terrace, Side Paths
- From House Door, From Street
- Tag photos with location and viewing angle

### AI Future Vision
- Select a viewpoint photo
- Choose time projection: 1, 2, 3, 5, or 10 years
- Pick a season: Spring, Summer, Fall, Winter
- Generate AI visualization of your mature garden

---

## Project Structure

```
garden/
├── apps/
│   └── web/                          # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx          # Landing page
│       │   │   └── planner/          # Main garden planner
│       │   ├── components/
│       │   │   └── GardenPlanner/
│       │   │       ├── GardenCanvas.tsx    # Map with Leaflet
│       │   │       ├── PlantLibrary.tsx    # Plant selection
│       │   │       ├── Timeline.tsx        # Historical imagery
│       │   │       └── ViewpointPhotos.tsx # Photo management
│       │   ├── lib/
│       │   │   ├── api.ts            # Backend API client
│       │   │   └── plant-library.ts  # Plant database
│       │   └── stores/
│       │       └── garden-store.ts   # Zustand state
│       └── public/
│           └── garden-*.png          # Custom aerial imagery
├── backend/                          # Rails API
│   ├── app/
│   │   ├── controllers/
│   │   │   └── api/v1/
│   │   │       ├── properties_controller.rb
│   │   │       ├── garden_plans_controller.rb
│   │   │       └── viewpoint_photos_controller.rb
│   │   └── models/
│   │       ├── property.rb
│   │       ├── garden_plan.rb
│   │       └── viewpoint_photo.rb
│   └── db/
│       ├── schema.rb
│       └── seeds.rb
├── turbo.json                        # Turborepo config
└── package.json                      # Workspace root
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Ruby 3.2+
- Rails 8

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
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Create `backend/.env`:
```env
OPENAI_API_KEY=your_openai_api_key  # Optional, for AI features
```

### Development

```bash
# Start Rails backend (port 3000)
cd backend && rails server

# In another terminal, start Next.js frontend (port 3001)
npm run dev
```

Open http://localhost:3001/planner in your browser.

---

## API Endpoints

### Properties
- `GET /api/v1/property` - Get current property
- `PUT /api/v1/property` - Update property

### Garden Plans
- `GET /api/v1/garden_plans/current` - Get current garden plan
- `PUT /api/v1/garden_plans/current` - Save garden plan

### Viewpoint Photos
- `GET /api/v1/property/viewpoint_photos` - List photos
- `POST /api/v1/property/viewpoint_photos` - Upload photo
- `PUT /api/v1/property/viewpoint_photos/:id` - Update photo
- `DELETE /api/v1/property/viewpoint_photos/:id` - Delete photo

### AI Generation
- `POST /api/v1/generate_future_view` - Generate AI visualization

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
- Leaflet.js community for mapping tools
- OpenAI for AI capabilities
