# Fantasy Head Coach - Project Documentation

> **Project Overview**: Fantasy Head Coach is a fantasy football assistant app that integrates with Sleeper API to help users make better decisions in their fantasy leagues. The app provides team analysis, trade recommendations, and various tools for in-season, draft, and offseason management.

> **Tagline**: "Your best hire to bring you championships"

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Sleeper API Integration](#sleeper-api-integration)
4. [Core Features (Completed)](#core-features-completed)
5. [Development Roadmap](#development-roadmap)
6. [Key Implementation Patterns](#key-implementation-patterns)
7. [Known Issues & Solutions](#known-issues--solutions)
8. [User Stories Reference](#user-stories-reference)

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **State Management**: React Context (SleeperContext)
- **Data Fetching**: SWR pattern with custom hooks
- **External API**: Sleeper API (https://api.sleeper.app)

---

## Architecture Overview

### Directory Structure

```
/app
  /api/sleeper/          # Sleeper API proxy routes
    /league-history/[leagueId]/route.ts
    /league-users/[leagueId]/route.ts
    /leagues/[userId]/route.ts
    /matchups/[leagueId]/[week]/route.ts
    /nfl-state/route.ts
    /players/route.ts
    /rosters/[leagueId]/route.ts
    /user/[username]/route.ts
  /page.tsx              # Main app page with feature navigation
  /layout.tsx            # Root layout with metadata
  /globals.css           # Global styles and design tokens

/components
  /ui/                   # shadcn/ui components
  /feature-card.tsx      # Feature card component
  /feature-modal.tsx     # Modal wrapper for features
  /leagues-display.tsx   # My Leagues feature
  /team-analysis.tsx     # Team Analysis feature
  /trade-hub.tsx         # Trade Hub feature
  /sleeper-avatar.tsx    # Sleeper user avatar component

/lib
  /sleeper-context.tsx   # Global Sleeper state management
  /utils.ts              # Utility functions
```

### State Management (SleeperContext)

The `SleeperContext` manages all Sleeper-related state:

```typescript
interface SleeperContextType {
  user: SleeperUser | null
  leagues: SleeperLeague[]
  rosters: Record<string, SleeperRoster[]>
  players: Record<string, SleeperPlayer>
  isLoadingUser: boolean
  isLoadingLeagues: boolean
  isLoadingPlayers: boolean
  setUser: (user: SleeperUser | null) => void
  fetchLeagues: (userId: string) => Promise<void>
  fetchRosters: (leagueId: string) => Promise<void>
  fetchPlayers: () => Promise<Record<string, SleeperPlayer>>
  logout: () => void
}
```

**Key Pattern**: `fetchPlayers()` returns the players data directly (not just updating state) so callers can use the data immediately without waiting for a React re-render.

---

## Sleeper API Integration

### API Routes (All with retry logic for rate limiting)

| Route | Purpose | Sleeper Endpoint |
|-------|---------|------------------|
| `/api/sleeper/user/[username]` | Lookup user by username | `GET /user/{username}` |
| `/api/sleeper/leagues/[userId]` | Get user's leagues | `GET /user/{user_id}/leagues/nfl/{season}` |
| `/api/sleeper/rosters/[leagueId]` | Get league rosters | `GET /league/{league_id}/rosters` |
| `/api/sleeper/matchups/[leagueId]/[week]` | Get week's matchups | `GET /league/{league_id}/matchups/{week}` |
| `/api/sleeper/players` | Get all NFL players | `GET /players/nfl` |
| `/api/sleeper/league-users/[leagueId]` | Get league members | `GET /league/{league_id}/users` |
| `/api/sleeper/league-history/[leagueId]` | Get league history chain | Recursive previous_league_id lookup |
| `/api/sleeper/nfl-state` | Get current NFL state | `GET /state/nfl` |

### Rate Limiting Handling

All API routes implement retry logic with exponential backoff:

```typescript
async function fetchWithRetry(url: string, retries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url)
    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt + 1) * 1000
      await delay(waitTime)
      continue
    }
    return response
  }
  return null
}
```

---

## Core Features (Completed)

### 1. My Leagues

**Location**: `/components/leagues-display.tsx`

**Functionality**:
- Displays all leagues for the logged-in user
- Shows league name, season, team count, and roster/scoring settings
- Click to view league rosters and matchups
- Supports viewing historical matchups by week

### 2. Team Analysis

**Location**: `/components/team-analysis.tsx`

**Functionality**:
- Analyzes user's roster by position (QB, RB, WR, TE)
- Calculates total points per position based on season performance
- Ranks user's team against all teams in the league
- Identifies strengths (top 1/3) and weaknesses (bottom 1/3)
- Provides improvement recommendations
- Shows position-by-position breakdown with player details

**Key Logic**:
```typescript
// Determine strengths and weaknesses based on league percentile
const isStrength = rank <= Math.ceil(totalTeams / 3)
const isWeakness = rank > Math.ceil(totalTeams * 2 / 3)
```

### 3. Trade Hub

**Location**: `/components/trade-hub.tsx`

**Functionality**:
- Analyzes ALL teams in the league (not just user's team)
- Identifies compatible trade partners based on complementary needs
- Generates specific win-win trade suggestions
- Shows player values and trade impact calculations

**Core Concept**: Find trades where BOTH teams improve - not "who can I fleece" but "where can we help each other."

**Trade Partner Matching Algorithm**:
```typescript
// Find complementary matches
// youCanHelp = your strengths that match their weaknesses
// theyCanHelp = their strengths that match your weaknesses
const youCanHelp = userTeam.strengths.filter(pos => team.weaknesses.includes(pos))
const theyCanHelp = team.strengths.filter(pos => userTeam.weaknesses.includes(pos))
```

**Trade Suggestion Logic**:
- Tries multiple player combinations (not just best-for-best)
- Filters out trades with >50% point difference
- Calculates impact on both teams
- Verdicts: "win-win" (both improve), "fair" (minimal change), "unfair" (one-sided)

---

## Development Roadmap

### Phase 1: Foundation (Sleeper Integration) - COMPLETED

| Feature | Status | Description |
|---------|--------|-------------|
| Username lookup + validation | Done | Enter Sleeper username to login |
| Display user's leagues | Done | Shows all leagues user is part of |
| Display league rosters | Done | Fetches and displays rosters |
| Display player names | Done | Maps player IDs to names |
| Display weekly matchups | Done | Shows matchups for each week |
| Previous season data fallback | Done | Falls back to previous season when current has no data |

### Phase 2: In-Season Tools - IN PROGRESS

| Feature | Status | Description |
|---------|--------|-------------|
| Team Analysis | Done | Roster strengths/weaknesses by position |
| Historical season comparison | Done | Compare performance across seasons |
| Trade Hub | Done | Win-win trade finder with suggestions |
| League Context Dashboard | Planned | Scoring settings & roster rules in one place |
| Projected Team Strength Rankings | Planned | Evaluate competition |
| Injury tracker | Planned | Track injuries and fantasy impact |
| Weekly start/sit suggestions | Planned | AI-powered lineup recommendations |
| Free Agents by Roster Needs | Planned | Personalized FA rankings |
| Trust Index | Planned | Projections vs production comparison |

### Phase 3: Draft Tools - PLANNED

#### 3A: Pre-Draft Preparation
| Feature | Status | Description |
|---------|--------|-------------|
| Leagues by Draft Status | Planned | Sort leagues by draft status |
| Fantasy rankings aggregator | Planned | Aggregate from multiple sources |
| Draft cheat sheet | Planned | Best available by consensus |
| Historical Draft Tendencies | Planned | League's drafting patterns |
| Mock draft simulation | Planned | Practice with AI opponents |

#### 3B: Live Draft Monitoring
| Feature | Status | Description |
|---------|--------|-------------|
| Real-Time Draft Updates | Planned | Live picks without refresh |
| On-the-Clock Indicator | Planned | Current drafter visibility |
| Pick Countdown Timer | Planned | Time remaining display |
| Picks Until My Turn | Planned | Plan ahead indicator |
| Sleep Risk Indicator | Planned | Alertness warning |
| Browser Notifications | Planned | Don't miss your pick |
| Draft Predictions | Planned | Likely available players |

#### 3C: Draft Board & Visualization
| Feature | Status | Description |
|---------|--------|-------------|
| Full Draft Board View | Planned | All picks by round/team |
| Position Color Coding | Planned | Quick visual scanning |
| My Team Highlight | Planned | Focus on your roster |
| Team Needs Display | Planned | Anticipate other picks |

#### 3D: Draft Decision Support
| Feature | Status | Description |
|---------|--------|-------------|
| Best Available Rankings | Planned | Consensus rankings with ADP |
| Positional Scarcity Warnings | Planned | Position drying up alerts |
| Side-by-Side Player Comparison | Planned | Quick decision tool |
| Dynamic Projection Updates | Planned | Updates as drafted |
| AI Draft Assistant | Planned | Real-time recommendations |

### Phase 4: Multi-League Management - PLANNED

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-Draft Dashboard | Planned | Monitor all active drafts |
| League Prioritization | Planned | Focus on important leagues |

### Phase 5: Offseason Tools - PLANNED

| Feature | Status | Description |
|---------|--------|-------------|
| News aggregator with Fantasy impact | Planned | NFL news with fantasy scoring |
| NFL roster tracking | Planned | Free agency and draft impact |
| AI Trade Analyzer (Advanced) | Planned | Deep trade analysis |

### Phase 6: AI Features (Cross-cutting) - PLANNED

| Feature | Status | Description |
|---------|--------|-------------|
| AI Assistant | Planned | Conversational decision help |
| Trade opportunity finder | Planned | Proactive suggestions |
| Projection engine | Planned | Custom projections |

### Phase 7: User Preferences & Settings - PLANNED

| Feature | Status | Description |
|---------|--------|-------------|
| Alert Preference Controls | Planned | Choose which alerts |
| Notification Settings | Planned | Browser/mobile notifications |

---

## Key Implementation Patterns

### 1. Previous Season Data Fallback

**Problem**: Current season (e.g., 2026) may have no matchup data yet.

**Solution**: Fetch previous season (2025) player points as baseline values.

**Critical Insight**: Use CURRENT rosters + PREVIOUS season points.

```typescript
// CORRECT APPROACH:
// - Current rosters (2026): Who owns each player NOW
// - Previous season points (2025): How valuable each player is

// If Davante Adams scored 190 pts in 2025 on Team A,
// but was traded to Team C for 2026,
// those 190 pts count for Team C (current owner)

if (!hasCurrentSeasonData) {
  const previousData = await fetchPreviousSeasonData(league)
  if (previousData) {
    // Only use previous season POINTS, NOT rosters
    playerPoints = calculatePlayerPoints(previousData.matchups)
    // Keep current rosters - they show who owns players NOW
  }
}
```

### 2. Async State Update Pattern

**Problem**: `fetchPlayers()` updates context state, but the caller's reference to `players` won't update until next render.

**Solution**: Return data directly from fetch functions.

```typescript
// In SleeperContext
const fetchPlayers = useCallback(async (): Promise<Record<string, SleeperPlayer>> => {
  if (Object.keys(players).length > 0) return players
  
  const response = await fetch("/api/sleeper/players")
  const data = await response.json()
  setPlayers(data || {})
  return data || {}  // Return immediately for caller
}, [players])

// In component
const playersData = await fetchPlayers()
// Use playersData directly, don't rely on context state
```

### 3. Position Color Coding

```typescript
const POSITION_COLORS: Record<string, string> = {
  QB: "bg-red-500/20 text-red-400 border-red-500/30",
  RB: "bg-green-500/20 text-green-400 border-green-500/30",
  WR: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  TE: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  K: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DEF: "bg-orange-500/20 text-orange-400 border-orange-500/30",
}
```

### 4. Team Analysis Calculation

```typescript
// For each position, calculate:
// 1. Total points from all players at that position
// 2. Rank among all teams in the league
// 3. Determine if strength (top 1/3) or weakness (bottom 1/3)

const positionRanks = Object.entries(positionPointsByTeam)
  .map(([rosterId, points]) => ({ rosterId, points: points[position] || 0 }))
  .sort((a, b) => b.points - a.points)

const rank = positionRanks.findIndex(t => t.rosterId === userRosterId) + 1
const totalTeams = positionRanks.length
const isStrength = rank <= Math.ceil(totalTeams / 3)
const isWeakness = rank > Math.ceil(totalTeams * 2 / 3)
```

---

## Known Issues & Solutions

### 1. Sleeper API Rate Limiting

**Issue**: "Too Many Requests" errors when fetching multiple resources.

**Solution**: 
- Implemented retry logic with exponential backoff
- Added delays between consecutive requests
- Cache player data (rarely changes)

### 2. League History API Rate Limiting

**Issue**: Fetching league history chain causes rate limits.

**Solution**: Instead of calling league-history API, use `league.previous_league_id` directly to fetch previous season matchups.

```typescript
// AVOID: Calling history API
const history = await fetch(`/api/sleeper/league-history/${league.league_id}`)

// BETTER: Use previous_league_id directly
const matchups = await fetchAllMatchups(league.previous_league_id)
const previousSeason = String(Number(league.season) - 1)
```

### 3. First Load Data Issue

**Issue**: Trade Hub/Team Analysis showed 0 values on first load.

**Root Cause**: `fetchPlayers()` updated context state, but component's `players` reference was still empty (React state updates are async).

**Solution**: Have `fetchPlayers()` return data directly so callers can use it immediately.

### 4. Roster vs Points Mismatch

**Issue**: Using previous season rosters with previous season points resulted in 0 values.

**Root Cause**: Players get traded between seasons. If we use old rosters, we're looking at the wrong teams.

**Solution**: Always use CURRENT rosters with PREVIOUS season points. Player value follows the player to their new team.

---

## User Stories Reference

These user stories were provided to guide feature development:

### SAGA 2: Live Draft Monitoring
- US 2.1.1: Real-time draft updates without refresh
- US 2.1.2: On-the-clock indicator
- US 2.1.3: Pick countdown timer
- US 2.2.1: Browser notifications when approaching turn
- US 2.2.2: Sleep risk indicator
- US 2.2.3: Custom notification preferences
- US 2.3.1: Draft predictions
- US 2.3.2: Picks until my turn

### SAGA 3: Draft Board Visualization
- US 3.1.1: Full draft board view
- US 3.1.2: Position color coding
- US 3.2.1: My team highlight
- US 3.2.2: Team needs display

### SAGA 4: Draft Decision Support
- US 4.1.1: Best available rankings
- US 4.1.2: Positional scarcity warnings
- US 4.2.1: Side-by-side player comparison
- US 4.2.2: Dynamic projection updates

### SAGA 5: Multi-League Management
- US 5.1.1: View all leagues
- US 5.1.2: Leagues by draft status
- US 5.2.1: Multi-draft dashboard
- US 5.2.2: League prioritization

### SAGA 6: League Context
- US 6.1.1: Historical draft tendencies
- US 6.1.2: League context dashboard
- US 6.2.1: Free agents by roster needs
- US 6.2.2: Personalized FA rankings
- US 6.2.3: Projected team strength rankings

### SAGA 7: User Preferences
- US 7.1.1: Alert preference controls

---

## Feature Statistics

| Category | Total | Completed | Planned |
|----------|-------|-----------|---------|
| Phase 1: Foundation | 6 | 6 | 0 |
| Phase 2: In-Season | 10 | 3 | 7 |
| Phase 3: Draft Tools | 17 | 0 | 17 |
| Phase 4: Multi-League | 2 | 0 | 2 |
| Phase 5: Offseason | 3 | 0 | 3 |
| Phase 6: AI Features | 3 | 0 | 3 |
| Phase 7: Settings | 2 | 0 | 2 |
| **Total** | **43** | **9** | **34** |

---

## Getting Started (For New Development)

1. User logs in with Sleeper username
2. SleeperContext auto-fetches leagues on login
3. Features use `useSleeper()` hook to access state
4. Each feature fetches additional data as needed (rosters, matchups, etc.)
5. Previous season fallback is automatic when current season has no data

---

*Last Updated: February 2026*
*Project: Fantasy Head Coach*
*Platform: Sleeper Integration*
