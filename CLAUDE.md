# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Guidelines
- Do not modify files that are not relevant to your task
- Do not make "while we're here" edits
- Please observe and adhere to existing formatting and code style
- Each of the services can be tested by modifying test.ts and running `bun ./src/test.ts`

## Development Commands

- **Start development server**: `bun run dev` (with hot reload)
- **Start production server**: `bun run start`
- **Lint and format**: `bun run lint` (uses Biome and runs typecheck)
- **Type checking**: `bun run typecheck`
- **Install dependencies**: `bun install`

## Environment Setup

Copy `.env-example` to `.env` and configure required environment variables before starting development.

## Architecture Overview

This is **Ethereum Follow Protocol (EFP) Services** - a service-based application that processes and caches data for the EFP ecosystem.

### Core Architecture

- **Service Manager Pattern**: The application uses a centralized `ServiceManager` class in `src/index.ts` that orchestrates multiple background services running at configurable intervals
- **Database Layer**: PostgreSQL with Kysely query builder and automatic reconnection handling
- **Path Aliases**: Uses `#/` prefix for imports (configured in tsconfig.json)

### Key Services

The application runs these background services:

1. **recentFollows** (`src/services/recentFollows/`) - Tracks recent follow activity
2. **leaderboard** (`src/services/leaderboard/`) - Generates user ranking data
3. **recommended** (`src/services/recommended/`) - Manages recommendation algorithms
4. **ensMetadata** (`src/services/ensMetadata/`) - Fetches ENS metadata
5. **heartbeat** (`src/services/heartbeat/`) - Health monitoring
6. **efpCache** (`src/services/efpCache/`) - Builds address cache for performance
7. **mutuals** (`src/services/mutuals/`) - Processes mutual connections

### Database Integration

- **Connection**: Robust PostgreSQL connection with automatic reconnection logic in `src/database/index.ts`
- **Schema**: Generated types in `src/database/generated/index.ts` (likely auto-generated from database schema)
- **Error Handling**: Database operations wrapped with connection failure recovery

### Key Patterns

- **Chunked Processing**: Services use `arrayToChunks` utility for batch processing
- **SQL Integration**: Direct SQL queries using Kysely's `sql` template function
- **Logging**: Structured logging with `consola` library
- **Environment Management**: Centralized environment variable handling in `src/env.ts`

### Development Notes

- Uses **Bun** runtime and package manager
- **TypeScript** with strict mode enabled
- **Biome** for linting and formatting

## Service Intervals (Configurable via Environment)

- Recent Follows: 2850s
- Leaderboard: 960s
- Recommended: 4260s
- ENS Metadata: 21600s
- Heartbeat: 290s
- EFP Cache: 3600s
- Mutuals: 973s