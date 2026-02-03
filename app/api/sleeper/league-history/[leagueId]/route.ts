import { NextResponse } from "next/server"

interface SleeperLeague {
  league_id: string
  name: string
  season: string
  previous_league_id: string | null
  total_rosters: number
  avatar: string | null
  status: string
  settings: Record<string, unknown>
  scoring_settings: Record<string, unknown>
  roster_positions: string[]
}

// Simple delay function to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Fetch a single league with retry logic
async function fetchLeagueWithRetry(leagueId: string, retries = 3): Promise<SleeperLeague | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        `https://api.sleeper.app/v1/league/${leagueId}`,
        { 
          next: { revalidate: 3600 },
          headers: { 'Accept': 'application/json' }
        }
      )

      // Check if rate limited before trying to parse
      if (response.status === 429) {
        // Rate limited - wait longer before retry
        const waitTime = Math.pow(2, attempt + 1) * 1000 // Exponential backoff: 2s, 4s, 8s
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}`)
        await delay(waitTime)
        continue
      }

      if (!response.ok) {
        console.log(`League ${leagueId} returned status ${response.status}`)
        return null
      }

      // Only parse JSON if response is ok
      const data = await response.json()
      return data
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed for league ${leagueId}:`, error)
      if (attempt < retries - 1) {
        await delay(1000 * (attempt + 1)) // Longer delays between retries
      }
    }
  }
  return null
}

// Check if a league ID is valid (not null, undefined, empty, or "0")
function isValidLeagueId(leagueId: string | null | undefined): leagueId is string {
  return !!leagueId && leagueId !== "0" && leagueId !== ""
}

// Recursively fetch all previous seasons of a league
async function fetchLeagueChain(leagueId: string): Promise<SleeperLeague[]> {
  const leagues: SleeperLeague[] = []
  let currentLeagueId: string | null = leagueId
  const maxIterations = 10 // Safety limit - most leagues won't have more than 10 years
  let iterations = 0

  while (isValidLeagueId(currentLeagueId) && iterations < maxIterations) {
    const league = await fetchLeagueWithRetry(currentLeagueId)
    
    if (!league) {
      break
    }

    leagues.push(league)
    
    // Check if the previous league ID is valid before continuing
    currentLeagueId = isValidLeagueId(league.previous_league_id) ? league.previous_league_id : null
    iterations++

    // Add a longer delay between requests to avoid rate limiting
    if (isValidLeagueId(currentLeagueId)) {
      await delay(500)
    }
  }

  return leagues
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params

    if (!leagueId) {
      return NextResponse.json(
        { error: "League ID is required" },
        { status: 400 }
      )
    }

    const leagueHistory = await fetchLeagueChain(leagueId)

    return NextResponse.json(leagueHistory)
  } catch (error) {
    console.error("Error fetching league history:", error)
    return NextResponse.json(
      { error: "Failed to fetch league history" },
      { status: 500 }
    )
  }
}
