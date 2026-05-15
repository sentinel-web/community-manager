# Community Manager

[![CI](https://github.com/sentinel-web/community-manager/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sentinel-web/community-manager/actions/workflows/ci.yml)

A web application for managing ArmA III communities. Built with Meteor.js, React, and MongoDB.

**Key Features:**
- Event management with calendar and attendance tracking
- Member management with ranks, squads, and specializations
- Task management with Kanban board
- Organization chart (ORBAT) visualization
- Role-based access control (RBAC)
- Multi-language support (English, German, French)

## Requirements

- [Node.js and npm](https://nodejs.org/en)
- [Meteor.js](https://docs.meteor.com/about/install.html)
- [MongoDB Compass](https://www.mongodb.com/try/download/compass) (optional, for database inspection)
- Text editor ([VS Code](https://code.visualstudio.com/download) recommended)

## Quick Start

### Automated Setup (Recommended)

**Linux / macOS:**
```bash
git clone https://github.com/sentinel-web/community-manager.git
cd community-manager
./setup.sh
```

**Windows (PowerShell as Administrator):**
```powershell
git clone https://github.com/sentinel-web/community-manager.git
cd community-manager
.\setup.ps1
```

The setup script will install Node.js, Meteor.js, and project dependencies automatically.

### Manual Setup

```bash
git clone https://github.com/sentinel-web/community-manager.git
cd community-manager
meteor npm install
npm start
```

Access the application at [localhost:3000](http://localhost:3000)

**Development Login:** `admin` / `admin` (auto-created in development mode only)

## Development Commands

```bash
# Dev server
npm start              # Start Meteor dev server at http://localhost:3000

# Tests
npm test               # Mocha unit tests, run once
npm run test-app       # Mocha tests in watch mode (full-app driver)
npm run e2e            # Playwright end-to-end suite (chromium)
npm run e2e:ui         # Playwright UI mode for debugging specs
npm run e2e:headed     # Playwright with a visible browser window
npm run e2e:debug      # Playwright in step-through debugger

# Quality checks
npm run typecheck      # TypeScript --noEmit across the project
npm run doctor         # react-doctor static analysis (no-dead-code)
npm run doctor:full    # react-doctor full report

# Maintenance
npm run update         # Update Meteor + npm packages and audit fix
npm run visualize      # Production bundle size analysis
npm run integrity-scan # Scan MongoDB for orphaned references
```

`npm test` and `npm run e2e` are the two checks gated by CI on every PR and every push to `main`.

## Docker Deployment

```bash
# Required environment variables
ROOT_URL=https://yourdomain.com
DOMAIN=yourdomain.com

# Build and run
docker compose up -d
```

Requires external Traefik network for reverse proxy. See `docker-compose.yml` for configuration.

## Tech Stack

- **Backend:** Meteor.js 3.4+, MongoDB
- **Frontend:** React 18, Ant Design
- **Calendar:** react-big-calendar with rrule
- **Kanban:** react-beautiful-dnd
- **ORBAT:** react-organizational-chart

## Optional VS Code Extensions

<details>
<summary>Recommended extensions</summary>

- Auto Rename Tag
- ES7+ React/Redux/React-Native snippets
- ESLint
- GitLens
- Path Intellisense
- Prettier - Code Formatter
- vscode-icons

</details>

## Contributing

See `CLAUDE.md` for coding guidelines and project patterns.
