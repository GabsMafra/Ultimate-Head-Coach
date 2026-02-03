"use client"

import { useState, useEffect, useCallback } from "react"
import { useSleeper, type SleeperLeague, type SleeperRoster } from "@/lib/sleeper-context"
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Users,
  Target,
  History,
  Calendar,
  Info,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SleeperAvatar } from "./sleeper-avatar"

interface PositionAnalysis {
  position: string
  playerCount: number
  totalPoints: number
  avgPoints: number
  leagueAvgPoints: number
  leagueMaxPoints: number
  percentile: number
  rank: number
  totalTeams: number
  status: "strong" | "average" | "weak"
  players: {
    name: string
    points: number
    rank: number
    totalAtPosition: number
  }[]
}

type DataSource = "current_season" | "previous_season" | "projected"

interface TeamAnalysisData {
  league: SleeperLeague
  roster: SleeperRoster
  totalPoints: number
  leagueRank: number
  totalTeams: number
  positionAnalysis: PositionAnalysis[]
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  dataSource: DataSource
  dataSourceSeason: string
}

interface MatchupPlayer {
  player_id: string
  points: number
}

interface Matchup {
  roster_id: number
  players: string[]
  starters: string[]
  players_points: Record<string, number>
}

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  RB: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  WR: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  TE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  K: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
  DEF: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  FLEX: "bg-blue-500/20 text-blue-400 border-blue-500/30",
}

const MAIN_POSITIONS = ["QB", "RB", "WR", "TE"]

export function TeamAnalysis() {
  const { user, leagues, rosters, players, fetchRosters, fetchPlayers, isLoadingPlayers } = useSleeper()
  const [selectedLeague, setSelectedLeague] = useState<SleeperLeague | null>(null)
  const [analysisData, setAnalysisData] = useState<TeamAnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set())
  const [allMatchups, setAllMatchups] = useState<Record<string, Matchup[]>>({})
  const [nflState, setNflState] = useState<{ week: number; season: string; season_type: string } | null>(null)
  
  const currentYear = new Date().getFullYear()
  const [activeLeagueHistory, setActiveLeagueHistory] = useState<SleeperLeague[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Fetch NFL state to determine if season has started
  useEffect(() => {
    const fetchNflState = async () => {
      try {
        const response = await fetch("/api/sleeper/nfl-state")
        if (response.ok) {
          const data = await response.json()
          setNflState(data)
        }
      } catch (error) {
        console.error("Error fetching NFL state:", error)
      }
    }
    fetchNflState()
  }, [])

  // Fetch league history chain (all previous seasons)
  const fetchLeagueHistory = useCallback(async (leagueId: string): Promise<SleeperLeague[]> => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch(`/api/sleeper/league-history/${leagueId}`)
      if (response.ok) {
        const data = await response.json()
        return data || []
      }
    } catch (error) {
      console.error("Error fetching league history:", error)
    } finally {
      setIsLoadingHistory(false)
    }
    return []
  }, [])

  // Fetch all matchups for a league (all weeks)
  const fetchAllMatchups = useCallback(async (leagueId: string) => {
    const matchupsByWeek: Record<string, Matchup[]> = {}
    
    // Fetch weeks 1-18 (regular season + playoffs)
    const weekPromises = Array.from({ length: 18 }, async (_, i) => {
      const week = i + 1
      try {
        const response = await fetch(`/api/sleeper/matchups/${leagueId}/${week}`)
        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            matchupsByWeek[week] = data
          }
        }
      } catch (error) {
        // Silently fail for weeks that don't exist yet
      }
    })

    await Promise.all(weekPromises)
    return matchupsByWeek
  }, [])

  // Calculate player points from matchups
  const calculatePlayerPoints = useCallback((matchups: Record<string, Matchup[]>) => {
    const playerPoints: Record<string, number> = {}
    
    Object.values(matchups).forEach(weekMatchups => {
      weekMatchups.forEach(matchup => {
        if (matchup.players_points) {
          Object.entries(matchup.players_points).forEach(([playerId, points]) => {
            if (typeof points === "number" && !isNaN(points)) {
              playerPoints[playerId] = (playerPoints[playerId] || 0) + points
            }
          })
        }
      })
    })

    return playerPoints
  }, [])

  // Fetch previous season league and matchups for fallback data
  const fetchPreviousSeasonData = useCallback(async (league: SleeperLeague): Promise<{
    matchups: Record<string, Matchup[]>
    rosters: SleeperRoster[]
    leagueId: string
    season: string
  } | null> => {
    // Check if we have a previous league ID
    if (!league.previous_league_id) return null

    try {
      // Directly fetch matchups for previous league - no need to call history API
      // This avoids rate limiting issues with the Sleeper API
      const matchups = await fetchAllMatchups(league.previous_league_id)
      
      // Also fetch rosters from previous season - critical for mapping players to points
      let previousRosters: SleeperRoster[] = []
      const rostersResponse = await fetch(`/api/sleeper/rosters/${league.previous_league_id}`)
      if (rostersResponse.ok) {
        previousRosters = await rostersResponse.json()
      }
      
      // Calculate the previous season year
      const previousSeason = String(Number(league.season) - 1)
      
      return {
        matchups,
        rosters: previousRosters,
        leagueId: league.previous_league_id,
        season: previousSeason
      }
    } catch (error) {
      console.error("Error fetching previous season data:", error)
      return null
    }
  }, [fetchAllMatchups])

  // Analyze team when league is selected
  const analyzeTeam = useCallback(async (league: SleeperLeague, skipHistoryFetch = false) => {
    if (!user) return

    setIsLoading(true)
    setAnalysisData(null)

    try {
      // Fetch league history if not already loaded and this is the initial selection
      if (!skipHistoryFetch && activeLeagueHistory.length === 0) {
        const history = await fetchLeagueHistory(league.league_id)
        setActiveLeagueHistory(history)
      }

      // Fetch players and get the data directly (don't rely on state update)
      const playersData = await fetchPlayers()

      // Fetch rosters directly for this league (don't rely on context state)
      let leagueRosters: SleeperRoster[] = rosters[league.league_id] || []
      
      if (leagueRosters.length === 0) {
        try {
          const rostersResponse = await fetch(`/api/sleeper/rosters/${league.league_id}`)
          if (rostersResponse.ok) {
            leagueRosters = await rostersResponse.json()
          }
        } catch (error) {
          console.error("Error fetching rosters:", error)
        }
      }

      // Fetch all matchups for this league
      const matchups = await fetchAllMatchups(league.league_id)
      setAllMatchups(matchups)

      // Calculate player points from current season matchups
      let playerPoints = calculatePlayerPoints(matchups)
      
      // Determine data source - check if we have meaningful data
      const hasCurrentSeasonData = Object.keys(playerPoints).length > 0 && 
        Object.values(playerPoints).some(pts => pts > 0)
      
      let dataSource: DataSource = "current_season"
      let dataSourceSeason = league.season

      // If current season has no data, try to get previous season PLAYER POINTS
      // IMPORTANT: We keep CURRENT rosters but use PREVIOUS season points to value players
      // This way, if a player was traded, their value follows them to the new team
      if (!hasCurrentSeasonData) {
        const previousData = await fetchPreviousSeasonData(league)
        
        if (previousData && Object.keys(previousData.matchups).length > 0) {
          // Use previous season data as projections basis
          const previousPlayerPoints = calculatePlayerPoints(previousData.matchups)
          
          if (Object.values(previousPlayerPoints).some(pts => pts > 0)) {
            // Only use previous season POINTS, NOT rosters
            // Current rosters show who owns players NOW
            // Previous points show how valuable those players are
            playerPoints = previousPlayerPoints
            dataSource = "previous_season"
            dataSourceSeason = previousData.season
          }
        }
      }

      const userRoster = leagueRosters.find(r => r.owner_id === user.user_id)

      if (!userRoster || !leagueRosters.length) {
        setIsLoading(false)
        return
      }

      // Calculate position-based analysis for all teams
      const positionPointsByTeam: Record<number, Record<string, number>> = {}
      const positionPlayersByTeam: Record<number, Record<string, { playerId: string; points: number }[]>> = {}

      leagueRosters.forEach(roster => {
        positionPointsByTeam[roster.roster_id] = {}
        positionPlayersByTeam[roster.roster_id] = {}

        const rosterPlayers = roster.players || []
        rosterPlayers.forEach(playerId => {
          const player = playersData[playerId]
          if (!player) return

          const position = player.position
          if (!MAIN_POSITIONS.includes(position)) return

          const points = playerPoints[playerId] || 0

          if (!positionPointsByTeam[roster.roster_id][position]) {
            positionPointsByTeam[roster.roster_id][position] = 0
            positionPlayersByTeam[roster.roster_id][position] = []
          }

          positionPointsByTeam[roster.roster_id][position] += points
          positionPlayersByTeam[roster.roster_id][position].push({ playerId, points })
        })
      })

      // Calculate league-wide position stats
      const leaguePositionStats: Record<string, { 
        total: number
        teams: number[]
        allPlayers: { playerId: string; points: number; rosterId: number }[]
      }> = {}

      MAIN_POSITIONS.forEach(pos => {
        leaguePositionStats[pos] = { total: 0, teams: [], allPlayers: [] }
      })

      Object.entries(positionPointsByTeam).forEach(([rosterId, positions]) => {
        Object.entries(positions).forEach(([pos, points]) => {
          leaguePositionStats[pos].total += points
          leaguePositionStats[pos].teams.push(points)
        })
      })

      Object.entries(positionPlayersByTeam).forEach(([rosterId, positions]) => {
        Object.entries(positions).forEach(([pos, playerList]) => {
          playerList.forEach(p => {
            leaguePositionStats[pos].allPlayers.push({ 
              ...p, 
              rosterId: parseInt(rosterId) 
            })
          })
        })
      })

      // Sort players by points for rankings
      Object.values(leaguePositionStats).forEach(stats => {
        stats.allPlayers.sort((a, b) => b.points - a.points)
        stats.teams.sort((a, b) => b - a)
      })

      // Build position analysis for user's team
      const positionAnalysis: PositionAnalysis[] = MAIN_POSITIONS.map(pos => {
        const userPoints = positionPointsByTeam[userRoster.roster_id]?.[pos] || 0
        const userPlayers = positionPlayersByTeam[userRoster.roster_id]?.[pos] || []
        const stats = leaguePositionStats[pos]
        
        const leagueAvg = stats.teams.length > 0 
          ? stats.total / stats.teams.length 
          : 0
        const leagueMax = stats.teams.length > 0 
          ? Math.max(...stats.teams) 
          : 0

        // Calculate rank among teams
        const rank = stats.teams.filter(t => t > userPoints).length + 1
        const percentile = stats.teams.length > 0 
          ? ((stats.teams.length - rank + 1) / stats.teams.length) * 100 
          : 0

        // Determine status based on percentile
        let status: "strong" | "average" | "weak" = "average"
        if (percentile >= 66) status = "strong"
        else if (percentile <= 33) status = "weak"

        // Get player rankings
        const playerDetails = userPlayers
          .map(p => {
            const player = players[p.playerId]
            const allPlayersAtPos = stats.allPlayers
            const playerRank = allPlayersAtPos.findIndex(ap => ap.playerId === p.playerId) + 1

            return {
              name: player?.full_name || "Unknown",
              points: p.points,
              rank: playerRank,
              totalAtPosition: allPlayersAtPos.length
            }
          })
          .sort((a, b) => b.points - a.points)

        return {
          position: pos,
          playerCount: userPlayers.length,
          totalPoints: userPoints,
          avgPoints: userPlayers.length > 0 ? userPoints / userPlayers.length : 0,
          leagueAvgPoints: leagueAvg,
          leagueMaxPoints: leagueMax,
          percentile,
          rank,
          totalTeams: leagueRosters.length,
          status,
          players: playerDetails
        }
      })

      // Calculate overall team ranking
      const teamTotalPoints = Object.values(playerPoints)
        .filter((_, idx) => userRoster.players?.includes(Object.keys(playerPoints)[idx]))
        .reduce((sum, pts) => sum + (pts || 0), 0)

      const userTotalPoints = userRoster.players?.reduce((sum, playerId) => {
        return sum + (playerPoints[playerId] || 0)
      }, 0) || 0

      const allTeamTotals = leagueRosters.map(roster => {
        return roster.players?.reduce((sum, playerId) => {
          return sum + (playerPoints[playerId] || 0)
        }, 0) || 0
      }).sort((a, b) => b - a)

      const leagueRank = allTeamTotals.findIndex(t => t === userTotalPoints) + 1

      // Generate insights
      const strengths = positionAnalysis
        .filter(p => p.status === "strong")
        .map(p => `${p.position}: Ranked #${p.rank} in league (${p.percentile.toFixed(0)}th percentile)`)

      const weaknesses = positionAnalysis
        .filter(p => p.status === "weak")
        .map(p => `${p.position}: Ranked #${p.rank} in league (${p.percentile.toFixed(0)}th percentile)`)

      const recommendations: string[] = []
      
      positionAnalysis.forEach(pa => {
        if (pa.status === "weak") {
          const topPlayer = pa.players[0]
          if (topPlayer && topPlayer.rank > Math.ceil(pa.totalAtPosition * 0.5)) {
            recommendations.push(
              `Consider upgrading at ${pa.position} - your best player ranks #${topPlayer.rank} out of ${topPlayer.totalAtPosition} in the league`
            )
          }
        }
      })

      const strongPositions = positionAnalysis.filter(p => p.status === "strong")
      const weakPositions = positionAnalysis.filter(p => p.status === "weak")

      if (strongPositions.length > 0 && weakPositions.length > 0) {
        recommendations.push(
          `You have depth at ${strongPositions.map(p => p.position).join(", ")} - consider trading for ${weakPositions.map(p => p.position).join(", ")} help`
        )
      }

      setAnalysisData({
        league,
        roster: userRoster,
        totalPoints: userTotalPoints,
        leagueRank,
        totalTeams: leagueRosters.length,
        positionAnalysis,
        strengths,
        weaknesses,
        recommendations,
        dataSource,
        dataSourceSeason
      })
    } catch (error) {
      console.error("Error analyzing team:", error)
    } finally {
      setIsLoading(false)
    }
  }, [user, rosters, players, fetchRosters, fetchPlayers, fetchAllMatchups, calculatePlayerPoints, fetchPreviousSeasonData, activeLeagueHistory.length, fetchLeagueHistory])

  const togglePosition = (position: string) => {
    setExpandedPositions(prev => {
      const next = new Set(prev)
      if (next.has(position)) {
        next.delete(position)
      } else {
        next.add(position)
      }
      return next
    })
  }

  const getStatusIcon = (status: "strong" | "average" | "weak") => {
    switch (status) {
      case "strong":
        return <TrendingUp className="w-4 h-4 text-emerald-400" />
      case "weak":
        return <TrendingDown className="w-4 h-4 text-rose-400" />
      default:
        return <Minus className="w-4 h-4 text-amber-400" />
    }
  }

  const getStatusColor = (status: "strong" | "average" | "weak") => {
    switch (status) {
      case "strong":
        return "border-emerald-500/30 bg-emerald-500/10"
      case "weak":
        return "border-rose-500/30 bg-rose-500/10"
      default:
        return "border-amber-500/30 bg-amber-500/10"
    }
  }

  if (isLoadingPlayers) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading player data...</span>
      </div>
    )
  }

  // League selection view
  if (!selectedLeague) {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b border-border">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground font-[family-name:var(--font-display)]">
            Team Analysis
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select a league to analyze your roster strengths and weaknesses
          </p>
        </div>

        {/* No leagues message */}
        {leagues.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No leagues found for {currentYear}
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {leagues.map(league => (
            <button
              key={league.league_id}
              onClick={() => {
                setActiveLeagueHistory([])
                setSelectedLeague(league)
                analyzeTeam(league)
              }}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all text-left"
            >
              <SleeperAvatar 
                avatar={league.avatar} 
                displayName={league.name} 
                size={40}
                className="rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground truncate font-[family-name:var(--font-display)]">
                  {league.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {league.total_rosters} teams | {league.season}
                  {league.previous_league_id && (
                    <span className="ml-2 text-accent">
                      <History className="w-3 h-3 inline mr-1" />
                      Multi-year
                    </span>
                  )}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Analyzing your team...</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Fetching matchup data from all weeks
        </p>
      </div>
    )
  }

  // No data state
  if (!analysisData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Unable to Analyze</h3>
        <p className="text-muted-foreground mb-4">
          Could not retrieve enough data to analyze your team.
        </p>
        <button
          onClick={() => setSelectedLeague(null)}
          className="text-primary hover:underline"
        >
          Choose another league
        </button>
      </div>
    )
  }

  // Analysis results
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4 pb-4 border-b border-border">
        <button
          onClick={() => {
            setSelectedLeague(null)
            setAnalysisData(null)
            setActiveLeagueHistory([])
          }}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground rotate-180" />
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground font-[family-name:var(--font-display)]">
            {analysisData.league.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            Team Analysis | {analysisData.league.season}
          </p>
        </div>
        {Number(analysisData.league.season) < currentYear && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-accent/20 text-accent border border-accent/30">
            <History className="w-3 h-3 inline mr-1" />
            Historical
          </span>
        )}
      </div>

      {/* Season Tabs */}
      {activeLeagueHistory.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide mr-2">
            Season:
          </span>
          {activeLeagueHistory.map((historyLeague) => {
            const isActive = historyLeague.league_id === analysisData.league.league_id
            return (
              <Button
                key={historyLeague.league_id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!isActive) {
                    setSelectedLeague(historyLeague)
                    analyzeTeam(historyLeague, true)
                  }
                }}
                className={`${
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "border-border hover:border-primary/50 hover:bg-primary/10"
                }`}
              >
                {historyLeague.season}
              </Button>
            )
          })}
          {isLoadingHistory && (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin ml-2" />
          )}
        </div>
      )}

      {/* Data Source Indicator */}
      <div className={`p-3 rounded-xl border flex items-start gap-3 ${
        analysisData.dataSource === "previous_season" 
          ? "bg-amber-500/10 border-amber-500/30" 
          : "bg-primary/10 border-primary/30"
      }`}>
        <Info className={`w-5 h-5 shrink-0 mt-0.5 ${
          analysisData.dataSource === "previous_season" ? "text-amber-400" : "text-primary"
        }`} />
        <div className="flex-1 min-w-0">
          {analysisData.dataSource === "current_season" ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Using {analysisData.dataSourceSeason} Season Data
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Analysis based on actual points scored this season
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                Using {analysisData.dataSourceSeason} Season Data as Projections
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current season has no scoring data yet. Analysis based on last season{"'"}s performance. 
                Data will auto-update when new season begins.
              </p>
            </>
          )}
        </div>
        {analysisData.dataSource === "previous_season" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => analyzeTeam(analysisData.league)}
            className="shrink-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        )}
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Total Points</span>
          </div>
          <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-display)]">
            {analysisData.totalPoints.toFixed(1)}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">League Rank</span>
          </div>
          <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-display)]">
            #{analysisData.leagueRank}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              of {analysisData.totalTeams}
            </span>
          </p>
        </div>
      </div>

      {/* Position Analysis */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Position Breakdown
        </h4>
        
        {analysisData.positionAnalysis.map(pa => (
          <div
            key={pa.position}
            className={`rounded-xl border ${getStatusColor(pa.status)} overflow-hidden`}
          >
            <button
              onClick={() => togglePosition(pa.position)}
              className="w-full flex items-center gap-4 p-4 text-left"
            >
              <span className={`px-2 py-1 text-xs font-semibold rounded border ${POSITION_COLORS[pa.position] || "bg-gray-500/20 text-gray-400"}`}>
                {pa.position}
              </span>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {getStatusIcon(pa.status)}
                  <span className="font-semibold text-foreground">
                    {pa.totalPoints.toFixed(1)} pts
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({pa.playerCount} players)
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Rank #{pa.rank} of {pa.totalTeams} | League avg: {pa.leagueAvgPoints.toFixed(1)}
                </div>
              </div>

              {/* Percentile bar */}
              <div className="w-24 hidden sm:block">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      pa.status === "strong" ? "bg-emerald-500" :
                      pa.status === "weak" ? "bg-rose-500" : "bg-amber-500"
                    }`}
                    style={{ width: `${pa.percentile}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right mt-1">
                  {pa.percentile.toFixed(0)}%
                </p>
              </div>

              {expandedPositions.has(pa.position) 
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
              }
            </button>

            {/* Expanded player list */}
            {expandedPositions.has(pa.position) && (
              <div className="px-4 pb-4 border-t border-border/50 pt-3">
                <div className="space-y-2">
                  {pa.players.map((player, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-foreground">{player.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          {player.points.toFixed(1)} pts
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          player.rank <= Math.ceil(player.totalAtPosition * 0.2) 
                            ? "bg-emerald-500/20 text-emerald-400"
                            : player.rank <= Math.ceil(player.totalAtPosition * 0.5)
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-rose-500/20 text-rose-400"
                        }`}>
                          #{player.rank}/{player.totalAtPosition}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Insights */}
      {(analysisData.strengths.length > 0 || analysisData.weaknesses.length > 0) && (
        <div className="space-y-4">
          {analysisData.strengths.length > 0 && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h4 className="font-semibold text-emerald-400 font-[family-name:var(--font-display)]">
                  Strengths
                </h4>
              </div>
              <ul className="space-y-1">
                {analysisData.strengths.map((s, idx) => (
                  <li key={idx} className="text-sm text-foreground/80">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysisData.weaknesses.length > 0 && (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h4 className="font-semibold text-rose-400 font-[family-name:var(--font-display)]">
                  Areas to Improve
                </h4>
              </div>
              <ul className="space-y-1">
                {analysisData.weaknesses.map((w, idx) => (
                  <li key={idx} className="text-sm text-foreground/80">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {analysisData.recommendations.length > 0 && (
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/10">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-primary font-[family-name:var(--font-display)]">
              Recommendations
            </h4>
          </div>
          <ul className="space-y-2">
            {analysisData.recommendations.map((r, idx) => (
              <li key={idx} className="text-sm text-foreground/80">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
