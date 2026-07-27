# Flowa

Flowa is a design system platform that combines Sketch component library parsing, AI-powered prototype generation, and team collaboration. Built on Express + SQLite/PostgreSQL.

## Quick Start

```bash
# Start the platform server
cd platform-server
cp .env.example .env    # configure your environment
npm install
npm start

# Open in browser
open http://localhost:4173
```

## Features

### Authentication & Account
- Register, login, token refresh, logout
- Profile management (nickname, password, avatar)

### Project Management
- Create, edit, delete, search, sort projects
- Grid/list view toggle
- Product line / tag organization

### Prototype Viewer
- Axure prototype ZIP upload & extraction
- Version management (increment version on upload)
- Full viewer: page tree navigation, iframe preview, zoom, fullscreen
- Share with password protection and expiry control
- Team members: invite, remove, permission management

### Component Library
- Sketch (.sketch) file upload and parsing (up to 200MB)
- Extracts: symbols, component families, icon vector paths, colors, fonts
- Design Tokens (primary color, surface, border radius, spacing, font size)
- Component list with references and categorization
- macOS: optional sketchtool integration for SVG preview export

### AI Generation
- Generates page prototypes based on user prompts
- References selected component library's tokens and components
- Real-time iframe preview with AI-generated HTML
- Fallback to structured JSON layout when AI is unavailable

### Comments & Collaboration
- Page-level comments with timestamps
- Notification system for project activity
- Operation logs and statistics

### Axure Plugin Sync
- Electron-based desktop plugin for Axure (AxurePlugin/)
- Local preview cache → upload to platform server
- Supports macOS (arm64/x64) and Windows

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express |
| Database | SQLite (dev) / PostgreSQL (production) |
| Frontend | Vanilla JS, iframe-based preview |
| Storage | Local filesystem / Vercel Blob |
| AI | OpenRouter API (free-tier models) |
| Auth | JWT (access + refresh tokens) |

## Project Structure

```
├── platform-server/       # Main server application
│   ├── routes/            # API routes (auth, projects, upload, share, ai, framo)
│   ├── db/                # Database connector (SQLite / PostgreSQL)
│   ├── storage/           # File storage abstraction (local / Vercel Blob)
│   ├── middleware/        # Auth, rate limiting
│   ├── public/            # Frontend assets (HTML, JS, CSS)
│   ├── data/              # Component library data, sketch SVG resources
│   └── index.js           # Entry point
├── AxurePlugin/           # Electron-based Axure sync plugin
│   ├── main.js            # Plugin HTTP server + sync logic
│   ├── ui.js              # Plugin UI
│   ├── electron-main.js   # Electron entry
│   └── config.json        # Plugin configuration
└── data/                  # Shared data (sketch assets, libraries)
```

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Register a new account |
| `POST /api/auth/login` | Login, returns JWT tokens |
| `GET /api/projects` | List user's projects |
| `GET /api/projects/:id` | Project detail + page tree |
| `POST /api/upload` | Upload Axure ZIP prototype |
| `GET /api/framo/libraries` | List component libraries |
| `POST /api/framo/sketch/import` | Upload & parse .sketch file |
| `POST /api/framo/ai/generate` | AI generate page prototype |
| `GET /api/share/:token` | Public share view |
| `GET /api/health` | Server health check |

## Deployment

### Render (recommended free preview deployment)

The repository includes [`render.yaml`](./render.yaml). In Render, choose **New + → Blueprint**, connect `Susie-ss/framo`, and set the following values when prompted:

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_APP_URL` | Yes | The Render public URL, for example `https://flowa.onrender.com` |
| `DATABASE_URL` | Recommended | PostgreSQL connection string. Without it, the service falls back to SQLite, which is not persistent on free instances. |
| `OPENROUTER_API_KEY` | Optional | Enables the free OpenRouter model. Without it the structured local generator remains available. |

Render free services sleep after inactivity and their local filesystem is ephemeral. Do not rely on local uploaded Sketch files or generated SVG previews as durable production storage. Use PostgreSQL plus an external object store before treating the service as production.

### Other environments

Set the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | OpenRouter API key for AI generation |
| `DATABASE_URL` | No | PostgreSQL connection string (SQLite fallback) |
| `JWT_SECRET` | No | JWT signing secret (auto-generated fallback) |
| `BLOB_STORE_ID` | No | Vercel Blob store ID for production file storage |

## Plugin Build

```bash
cd AxurePlugin
npm install

# macOS
npm run build:mac

# Windows (requires Windows + NSIS)
npm run build:win
```

## License

MIT
