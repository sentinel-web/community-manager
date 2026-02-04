# Community Manager

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
npm start              # Start dev server (http://localhost:3000)
npm test               # Run tests once
npm run test-app       # Run tests in watch mode
npm run update         # Update all packages
npm run visualize      # Analyze bundle size
```

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
