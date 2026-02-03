"use client"

import { useState, useCallback } from "react"
import { useSleeper, type SleeperLeague, type SleeperRoster } from "@/lib/sleeper-context"
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight,
  ArrowLeftRight,
  Users,
  CheckCircle2,
  AlertCircle,
  Handshake,
  Filter,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SleeperAvatar } from "./sleeper-avatar"

interface TeamPositionData {
  position: string
  totalPoints: number
  rank: number
  playerCount: number
  players: { playerId: string; name: string; points: number }[]
}

interface TeamAnalysis {
  rosterId: number
  ownerId: string
  ownerName: string
  avatar: string | null
  totalPoints: number
  rank: number
  positionData: Record<string, TeamPositionData>
  strengths: string[]
  weaknesses: string[]
}

interface TradePartner {
  team: TeamAnalysis
  compatibilityScore: number
  yourNeeds: string[]
  theirNeeds: string[]
  suggestedTrades: TradeSuggestion[]
}

interface TradeSuggestion {
  youSend: { playerId: string; name: string; position: string; points: number }[]
  youReceive: { playerId: string; name: string; position: string; points: number }[]
  yourTeamBefore: number
  yourTeamAfter: number
  theirTeamBefore: number
  theirTeamAfter: number
  yourImprovement: number
  theirImprovement: number
  verdict: "win-win" | "fair" | "unfair"
}

interface LeagueUser {
  user_id: string
  display_name: string
  avatar: string | null
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
}

const MAIN_POSITIONS = ["QB", "RB", "WR", "TE"]

export function TradeHub() {
  const { user, leagues, rosters, players, fetchRosters, fetchPlayers, isLoadingPlayers, isLoadingLeagues } = useSleeper()
  const [selectedLeague, setSelectedLeague] = useState<SleeperLeague | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [allTeamAnalysis, setAllTeamAnalysis] = useState<TeamAnalysis[]>([])
  const [userTeamAnalysis, setUserTeamAnalysis] = useState<TeamAnalysis | null>(null)
  const [tradePartners, setTradePartners] = useState<TradePartner[]>([])
  const [leagueUsers, setLeagueUsers] = useState<LeagueUser[]>([])
  const [selectedPartner, setSelectedPartner] = useState<TradePartner | null>(null)
  const [filterPosition, setFilterPosition] = useState<string | null>(null)
  const [analysisDataSource, setAnalysisDataSource] = useState<{ source: string; season: string } | null>(null)

  // Fetch all matchups for a league
  const fetchAllMatchups = useCallback(async (leagueId: string) => {
    const matchupsByWeek: Record<string, Matchup[]> = {}
    
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
        // Silently fail for weeks that don't exist
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

  // Fetch league users
  const fetchLeagueUsers = useCallback(async (leagueId: string) => {
    try {
      const response = await fetch(`/api/sleeper/league-users/${leagueId}`)
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error("Error fetching league users:", error)
    }
    return []
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

  // Analyze all teams in the league
  const analyzeAllTeams = useCallback(async (league: SleeperLeague) => {
    if (!user) return

    setIsLoading(true)
    setAllTeamAnalysis([])
    setUserTeamAnalysis(null)
    setTradePartners([])
    setSelectedPartner(null)
    setAnalysisDataSource(null)

    try {
      // Fetch players and get the data directly (don't rely on state update)
      const playersData = await fetchPlayers()

      // Fetch rosters
      let leagueRosters: SleeperRoster[] = rosters[league.league_id] || []
      
      if (leagueRosters.length === 0) {
        const rostersResponse = await fetch(`/api/sleeper/rosters/${league.league_id}`)
        if (rostersResponse.ok) {
          leagueRosters = await rostersResponse.json()
        }
      }

      // Fetch league users
      const users = await fetchLeagueUsers(league.league_id)
      setLeagueUsers(users)

      // Fetch matchups
      const matchups = await fetchAllMatchups(league.league_id)
      let playerPoints = calculatePlayerPoints(matchups)
      
      // Determine data source - check if we have meaningful data
      const hasCurrentSeasonData = Object.keys(playerPoints).length > 0 &&
        Object.values(playerPoints).some(pts => pts > 0)
      
      let dataSource = "current_season"
      let dataSourceSeason = league.season
      
      // If current season has no data, try to get previous season PLAYER POINTS
      // IMPORTANT: We keep CURRENT rosters but use PREVIOUS season points to value players
      // This way, if a player was traded, their value follows them to the new team
      if (!hasCurrentSeasonData) {
        const previousData = await fetchPreviousSeasonData(league)
        
        if (previousData && Object.keys(previousData.matchups).length > 0) {
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
      
      setAnalysisDataSource({ source: dataSource, season: dataSourceSeason })

      // Build team analysis for each roster
      const teamAnalyses: TeamAnalysis[] = []

      for (const roster of leagueRosters) {
        const owner = users.find((u: LeagueUser) => u.user_id === roster.owner_id)
        const positionData: Record<string, TeamPositionData> = {}
        let totalPoints = 0

        const rosterPlayers = roster.players || []
        
        for (const position of MAIN_POSITIONS) {
          const posPlayers = rosterPlayers
            .map(playerId => {
              const player = playersData[playerId]
              if (!player || player.position !== position) return null
              const points = playerPoints[playerId] || 0
              return { playerId, name: `${player.first_name} ${player.last_name}`, points }
            })
            .filter((p): p is { playerId: string; name: string; points: number } => p !== null)
            .sort((a, b) => b.points - a.points)

          const posTotal = posPlayers.reduce((sum, p) => sum + p.points, 0)
          totalPoints += posTotal

          positionData[position] = {
            position,
            totalPoints: posTotal,
            rank: 0,
            playerCount: posPlayers.length,
            players: posPlayers
          }
        }

        teamAnalyses.push({
          rosterId: roster.roster_id,
          ownerId: roster.owner_id || "",
          ownerName: owner?.display_name || `Team ${roster.roster_id}`,
          avatar: owner?.avatar || null,
          totalPoints,
          rank: 0,
          positionData,
          strengths: [],
          weaknesses: []
        })
      }

      // Calculate ranks for each position
      for (const position of MAIN_POSITIONS) {
        const sorted = [...teamAnalyses].sort(
          (a, b) => (b.positionData[position]?.totalPoints || 0) - (a.positionData[position]?.totalPoints || 0)
        )
        sorted.forEach((team, index) => {
          if (team.positionData[position]) {
            team.positionData[position].rank = index + 1
          }
        })
      }

      // Calculate overall ranks
      const sortedByTotal = [...teamAnalyses].sort((a, b) => b.totalPoints - a.totalPoints)
      sortedByTotal.forEach((team, index) => {
        team.rank = index + 1
      })

      // Identify strengths and weaknesses
      const totalTeams = teamAnalyses.length
      const topThreshold = Math.ceil(totalTeams / 3)
      const bottomThreshold = Math.floor(totalTeams * 2 / 3)

      teamAnalyses.forEach(team => {
        for (const position of MAIN_POSITIONS) {
          const posData = team.positionData[position]
          if (!posData) continue

          if (posData.rank <= topThreshold) {
            team.strengths.push(position)
          } else if (posData.rank > bottomThreshold) {
            team.weaknesses.push(position)
          }
        }
      })

      setAllTeamAnalysis(teamAnalyses)

      // Find user's team
      const userTeam = teamAnalyses.find(t => t.ownerId === user.user_id)
      if (userTeam) {
        setUserTeamAnalysis(userTeam)
        
// Find compatible trade partners
      const partners = findTradePartners(userTeam, teamAnalyses, playersData, playerPoints)
        setTradePartners(partners)
      }

    } catch (error) {
      console.error("Error analyzing teams:", error)
    } finally {
      setIsLoading(false)
    }
  }, [user, rosters, players, fetchPlayers, fetchLeagueUsers, fetchAllMatchups, calculatePlayerPoints, fetchPreviousSeasonData])

  // Find compatible trade partners
  const findTradePartners = (
    userTeam: TeamAnalysis,
    allTeams: TeamAnalysis[],
    playersData: Record<string, any>,
    playerPoints: Record<string, number>
  ): TradePartner[] => {
    const partners: TradePartner[] = []

    for (const team of allTeams) {
      if (team.ownerId === userTeam.ownerId) continue

      // Find complementary matches
      // youCanHelp = your strengths that match their weaknesses
      // theyCanHelp = their strengths that match your weaknesses
      const youCanHelp = userTeam.strengths.filter(pos => team.weaknesses.includes(pos))
      const theyCanHelp = team.strengths.filter(pos => userTeam.weaknesses.includes(pos))

      // Skip if no complementary matches at all
      if (youCanHelp.length === 0 && theyCanHelp.length === 0) continue

      // Calculate compatibility score based on how well positions match
      // Maximum score is 100% when all weaknesses can be addressed
      const maxPossibleMatches = Math.max(userTeam.weaknesses.length + team.weaknesses.length, 1)
      const actualMatches = youCanHelp.length + theyCanHelp.length
      const compatibilityScore = Math.min(100, Math.round((actualMatches / maxPossibleMatches) * 100) + (actualMatches * 15))

      // Generate trade suggestions
      const suggestedTrades = generateTradeSuggestions(
        userTeam,
        team,
        youCanHelp,
        theyCanHelp,
        playersData,
        playerPoints
      )

      partners.push({
        team,
        compatibilityScore,
        // yourNeeds = positions you're weak at that they're strong at (what you want from them)
        yourNeeds: userTeam.weaknesses.filter(pos => team.strengths.includes(pos)),
        // theirNeeds = positions they're weak at that you're strong at (what they want from you)
        theirNeeds: team.weaknesses.filter(pos => userTeam.strengths.includes(pos)),
        suggestedTrades
      })
    }

    // Sort by compatibility score, then by number of win-win trades
    return partners.sort((a, b) => {
      const aWinWins = a.suggestedTrades.filter(t => t.verdict === "win-win").length
      const bWinWins = b.suggestedTrades.filter(t => t.verdict === "win-win").length
      if (aWinWins !== bWinWins) return bWinWins - aWinWins
      return b.compatibilityScore - a.compatibilityScore
    })
  }

  // Generate specific trade suggestions
  const generateTradeSuggestions = (
    userTeam: TeamAnalysis,
    partnerTeam: TeamAnalysis,
    youCanHelp: string[],
    theyCanHelp: string[],
    playersData: Record<string, any>,
    playerPoints: Record<string, number>
  ): TradeSuggestion[] => {
    const suggestions: TradeSuggestion[] = []
    const seenTrades = new Set<string>()

    // Generate 1-for-1 trades
    for (const sendPos of youCanHelp) {
      for (const receivePos of theyCanHelp) {
        const yourPlayers = userTeam.positionData[sendPos]?.players || []
        const theirPlayers = partnerTeam.positionData[receivePos]?.players || []

        if (yourPlayers.length === 0 || theirPlayers.length === 0) continue

        // Try multiple combinations - your 1st, 2nd, 3rd best for their 1st, 2nd best
        const yourIndicesToTry = [0, 1, 2].filter(i => i < yourPlayers.length)
        const theirIndicesToTry = [0, 1].filter(i => i < theirPlayers.length)

        for (const youSendIndex of yourIndicesToTry) {
          for (const theyReceiveIndex of theirIndicesToTry) {
            const youSend = yourPlayers[youSendIndex]
            const youReceive = theirPlayers[theyReceiveIndex]

            if (!youSend || !youReceive) continue
            
            // Skip if points difference is too large (more than 50%)
            const pointsDiff = Math.abs(youSend.points - youReceive.points)
            const avgPoints = (youSend.points + youReceive.points) / 2
            if (avgPoints > 0 && pointsDiff / avgPoints > 0.5) continue

            const tradeKey = `${youSend.playerId}-${youReceive.playerId}`
            if (seenTrades.has(tradeKey)) continue
            seenTrades.add(tradeKey)

            const player1Data = playersData[youSend.playerId]
            const player2Data = playersData[youReceive.playerId]

            if (!player1Data || !player2Data) continue

            // Calculate impact
            const yourTeamBefore = userTeam.totalPoints
            const theirTeamBefore = partnerTeam.totalPoints

            const yourTeamAfter = yourTeamBefore - youSend.points + youReceive.points
            const theirTeamAfter = theirTeamBefore - youReceive.points + youSend.points

            const yourImprovement = yourTeamBefore > 0 ? ((yourTeamAfter - yourTeamBefore) / yourTeamBefore) * 100 : 0
            const theirImprovement = theirTeamBefore > 0 ? ((theirTeamAfter - theirTeamBefore) / theirTeamBefore) * 100 : 0

            // Determine verdict based on positional improvement, not just total points
            // A trade is win-win if:
            // 1. You improve at a position you're weak at
            // 2. They improve at a position they're weak at
            // Even if total points go down slightly, positional improvement matters
            
            const yourPosImproves = userTeam.weaknesses.includes(receivePos)
            const theirPosImproves = partnerTeam.weaknesses.includes(sendPos)
            
            let verdict: "win-win" | "fair" | "unfair"
            if (yourPosImproves && theirPosImproves) {
              verdict = "win-win"
            } else if (yourImprovement >= -2 && theirImprovement >= -2) {
              verdict = "fair"
            } else {
              verdict = "unfair"
            }

            suggestions.push({
              youSend: [{
                playerId: youSend.playerId,
                name: youSend.name,
                position: sendPos,
                points: youSend.points
              }],
              youReceive: [{
                playerId: youReceive.playerId,
                name: youReceive.name,
                position: receivePos,
                points: youReceive.points
              }],
              yourTeamBefore,
              yourTeamAfter,
              theirTeamBefore,
              theirTeamAfter,
              yourImprovement,
              theirImprovement,
              verdict
            })
          }
        }
      }
    }

    // Sort by verdict (win-win first), then by combined improvement
    return suggestions.sort((a, b) => {
      const verdictOrder = { "win-win": 0, "fair": 1, "unfair": 2 }
      if (verdictOrder[a.verdict] !== verdictOrder[b.verdict]) {
        return verdictOrder[a.verdict] - verdictOrder[b.verdict]
      }
      return (b.yourImprovement + b.theirImprovement) - (a.yourImprovement + a.theirImprovement)
    })
  }

  if (isLoadingPlayers) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin mr-2" />
        <span className="text-muted-foreground">Loading player data...</span>
      </div>
    )
  }

  // League selection view
  if (!selectedLeague) {
    return (
      <div className="space-y-6">
        <div className="text-center pb-4 border-b border-border">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
            <Handshake className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground font-[family-name:var(--font-display)]">
            Trade Hub
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Find win-win trade opportunities in your leagues
          </p>
        </div>

        {isLoadingLeagues && (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
            <p className="text-muted-foreground">Loading your leagues...</p>
          </div>
        )}
        
        {!isLoadingLeagues && leagues.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No leagues found</p>
          </div>
        )}

        <div className="grid gap-3">
          {leagues.map(league => (
            <button
              key={league.league_id}
              onClick={() => {
                setSelectedLeague(league)
                analyzeAllTeams(league)
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
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <button
            onClick={() => {
              setSelectedLeague(null)
              setAllTeamAnalysis([])
              setUserTeamAnalysis(null)
              setTradePartners([])
            }}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground rotate-180" />
          </button>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground font-[family-name:var(--font-display)]">
              {selectedLeague.name}
            </h3>
            <p className="text-sm text-muted-foreground">Analyzing all teams...</p>
          </div>
        </div>

        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin mr-2" />
          <span className="text-muted-foreground">Analyzing {selectedLeague.total_rosters} teams for trade opportunities...</span>
        </div>
      </div>
    )
  }

  // No data available
  if (!userTeamAnalysis) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <button
            onClick={() => {
              setSelectedLeague(null)
              setAllTeamAnalysis([])
            }}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground rotate-180" />
          </button>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground font-[family-name:var(--font-display)]">
              {selectedLeague.name}
            </h3>
          </div>
        </div>

        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Unable to Analyze</h3>
          <p className="text-muted-foreground mb-2">Could not find your team in this league or no player data available.</p>
          {analysisDataSource ? (
            <p className="text-xs text-muted-foreground">
              Attempted to use {analysisDataSource.source === "previous_season" ? `${analysisDataSource.season} season` : "current season"} data.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No matchup data found for current or previous seasons.
            </p>
          )}
        </div>
      </div>
    )
  }

  // Trade partner detail view
  if (selectedPartner) {
    // Get positions where you can help them and they can help you
    const youCanOffer = userTeamAnalysis?.strengths.filter(pos => selectedPartner.team.weaknesses.includes(pos)) || []
    const theyCanOffer = selectedPartner.team.strengths.filter(pos => userTeamAnalysis?.weaknesses.includes(pos)) || []
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <button
            onClick={() => setSelectedPartner(null)}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground rotate-180" />
          </button>
          <SleeperAvatar 
            avatar={selectedPartner.team.avatar} 
            displayName={selectedPartner.team.ownerName} 
            size={40}
            className="rounded-lg"
          />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground font-[family-name:var(--font-display)]">
              Trade with {selectedPartner.team.ownerName}
            </h3>
            <p className="text-sm text-muted-foreground">
              Rank #{selectedPartner.team.rank} | {selectedPartner.team.totalPoints.toFixed(0)} pts
            </p>
          </div>
          <div className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
            {selectedPartner.compatibilityScore}% match
          </div>
        </div>

        {/* Trade Match Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* What You Can Offer */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Players You Can Offer</p>
              <span className="text-xs text-muted-foreground">Your strengths they need</span>
            </div>
            {youCanOffer.length > 0 ? youCanOffer.map(pos => {
              const posData = userTeamAnalysis?.positionData[pos]
              if (!posData) return null
              return (
                <div key={pos} className="space-y-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${POSITION_COLORS[pos]}`}>
                    {pos}
                  </span>
                  <div className="space-y-1">
                    {posData.players.slice(0, 3).map((player, idx) => (
                      <div key={player.playerId} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">#{idx + 1}</span>
                          <span className="text-sm text-foreground">{player.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{player.points.toFixed(1)} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No direct position matches</p>
            )}
          </div>

          {/* What They Can Offer */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Players They Can Offer</p>
              <span className="text-xs text-muted-foreground">Their strengths you need</span>
            </div>
            {theyCanOffer.length > 0 ? theyCanOffer.map(pos => {
              const posData = selectedPartner.team.positionData[pos]
              if (!posData) return null
              return (
                <div key={pos} className="space-y-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${POSITION_COLORS[pos]}`}>
                    {pos}
                  </span>
                  <div className="space-y-1">
                    {posData.players.slice(0, 3).map((player, idx) => (
                      <div key={player.playerId} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">#{idx + 1}</span>
                          <span className="text-sm text-foreground">{player.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{player.points.toFixed(1)} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No direct position matches</p>
            )}
          </div>
        </div>

        {/* Trade Suggestions */}
        <div className="space-y-4">
          <h4 className="font-semibold text-foreground font-[family-name:var(--font-display)]">
            Suggested Trades
          </h4>

          {selectedPartner.suggestedTrades.length === 0 ? (
            <div className="text-center py-8 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground">No specific trade suggestions available</p>
            </div>
          ) : (
            selectedPartner.suggestedTrades.map((trade, index) => (
              <div key={index} className="p-4 rounded-xl bg-card border border-border space-y-4">
                {/* Trade Details */}
                <div className="flex items-center gap-4">
                  {/* You Send */}
                  <div className="flex-1 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs text-destructive uppercase tracking-wide mb-2">You Send</p>
                    {trade.youSend.map(player => (
                      <div key={player.playerId} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{player.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${POSITION_COLORS[player.position]}`}>
                            {player.position}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{player.points.toFixed(1)} pts</p>
                      </div>
                    ))}
                  </div>

                  <ArrowLeftRight className="w-6 h-6 text-muted-foreground shrink-0" />

                  {/* You Receive */}
                  <div className="flex-1 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-primary uppercase tracking-wide mb-2">You Receive</p>
                    {trade.youReceive.map(player => (
                      <div key={player.playerId} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{player.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${POSITION_COLORS[player.position]}`}>
                            {player.position}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{player.points.toFixed(1)} pts</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Impact */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Your Team</p>
                      <div className="flex items-center gap-1">
                        {trade.yourImprovement > 0 ? (
                          <TrendingUp className="w-4 h-4 text-primary" />
                        ) : trade.yourImprovement < 0 ? (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        ) : null}
                        <span className={`font-medium ${trade.yourImprovement > 0 ? "text-primary" : trade.yourImprovement < 0 ? "text-destructive" : "text-foreground"}`}>
                          {trade.yourImprovement > 0 ? "+" : ""}{trade.yourImprovement.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Their Team</p>
                      <div className="flex items-center gap-1">
                        {trade.theirImprovement > 0 ? (
                          <TrendingUp className="w-4 h-4 text-primary" />
                        ) : trade.theirImprovement < 0 ? (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        ) : null}
                        <span className={`font-medium ${trade.theirImprovement > 0 ? "text-primary" : trade.theirImprovement < 0 ? "text-destructive" : "text-foreground"}`}>
                          {trade.theirImprovement > 0 ? "+" : ""}{trade.theirImprovement.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    trade.verdict === "win-win" 
                      ? "bg-primary/20 text-primary" 
                      : trade.verdict === "fair" 
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-destructive/20 text-destructive"
                  }`}>
                    {trade.verdict === "win-win" ? "Win-Win" : trade.verdict === "fair" ? "Fair Trade" : "Unbalanced"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Main trade hub view - list of trade partners
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border">
        <button
          onClick={() => {
            setSelectedLeague(null)
            setAllTeamAnalysis([])
            setUserTeamAnalysis(null)
            setTradePartners([])
          }}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground rotate-180" />
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground font-[family-name:var(--font-display)]">
            {selectedLeague.name}
          </h3>
          <p className="text-sm text-muted-foreground">Trade Hub | {selectedLeague.season}</p>
        </div>
        {analysisDataSource && (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            analysisDataSource.source === "previous_season" 
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
              : "bg-primary/20 text-primary border border-primary/30"
          }`}>
            {analysisDataSource.source === "previous_season" 
              ? `Based on ${analysisDataSource.season} data` 
              : `${analysisDataSource.season} Season`}
          </span>
        )}
      </div>

      {/* Your Team Summary */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-foreground font-[family-name:var(--font-display)]">
            Your Team Analysis
          </h4>
          <span className="text-sm text-muted-foreground">
            Rank #{userTeamAnalysis.rank} of {allTeamAnalysis.length} | {userTeamAnalysis.totalPoints.toFixed(1)} pts
          </span>
        </div>

        {/* Position Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MAIN_POSITIONS.map(pos => {
            const posData = userTeamAnalysis.positionData[pos]
            if (!posData) return null
            const isStrength = userTeamAnalysis.strengths.includes(pos)
            const isWeakness = userTeamAnalysis.weaknesses.includes(pos)
            return (
              <div 
                key={pos} 
                className={`p-3 rounded-lg border ${
                  isStrength 
                    ? "bg-primary/10 border-primary/30" 
                    : isWeakness 
                      ? "bg-destructive/10 border-destructive/30"
                      : "bg-secondary/30 border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${POSITION_COLORS[pos]}`}>
                    {pos}
                  </span>
                  <span className={`text-xs font-medium ${
                    isStrength ? "text-primary" : isWeakness ? "text-destructive" : "text-muted-foreground"
                  }`}>
                    #{posData.rank}
                  </span>
                </div>
                <p className="text-lg font-semibold text-foreground">{posData.totalPoints.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{posData.playerCount} players</p>
                {isStrength && (
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span className="text-xs text-primary font-medium">Strength</span>
                  </div>
                )}
                {isWeakness && (
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingDown className="w-3 h-3 text-destructive" />
                    <span className="text-xs text-destructive font-medium">Weakness</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 pt-3 border-t border-border">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Trade Away (Strengths)</p>
            <div className="flex flex-wrap gap-2">
              {userTeamAnalysis.strengths.length > 0 ? userTeamAnalysis.strengths.map(pos => (
                <span key={pos} className={`px-2 py-1 rounded-md text-xs font-medium border ${POSITION_COLORS[pos]}`}>
                  {pos}
                </span>
              )) : (
                <span className="text-sm text-muted-foreground">No clear strengths</span>
              )}
            </div>
          </div>
          <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Target (Weaknesses)</p>
            <div className="flex flex-wrap gap-2">
              {userTeamAnalysis.weaknesses.length > 0 ? userTeamAnalysis.weaknesses.map(pos => (
                <span key={pos} className={`px-2 py-1 rounded-md text-xs font-medium border ${POSITION_COLORS[pos]}`}>
                  {pos}
                </span>
              )) : (
                <span className="text-sm text-muted-foreground">No clear weaknesses</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter by position */}
      {userTeamAnalysis.weaknesses.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter by need:</span>
          <Button
            variant={filterPosition === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterPosition(null)}
          >
            All
          </Button>
          {userTeamAnalysis.weaknesses.map(pos => (
            <Button
              key={pos}
              variant={filterPosition === pos ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterPosition(pos)}
            >
              {pos}
            </Button>
          ))}
        </div>
      )}

      {/* Trade Partners */}
      <div className="space-y-3">
        <h4 className="font-semibold text-foreground font-[family-name:var(--font-display)]">
          Compatible Trade Partners ({tradePartners.length})
        </h4>

        {tradePartners.length === 0 ? (
          <div className="text-center py-8 bg-card rounded-xl border border-border">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Trade Partners Found</h3>
            <p className="text-muted-foreground">
              No teams with complementary strengths and weaknesses were found.
            </p>
          </div>
        ) : (
          tradePartners
            .filter(partner => {
              if (!filterPosition) return true
              return partner.yourNeeds.includes(filterPosition)
            })
            .map(partner => (
              <button
                key={partner.team.rosterId}
                onClick={() => setSelectedPartner(partner)}
                className="w-full p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <SleeperAvatar 
                    avatar={partner.team.avatar} 
                    displayName={partner.team.ownerName} 
                    size={40}
                    className="rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground truncate font-[family-name:var(--font-display)]">
                        {partner.team.ownerName}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        #{partner.team.rank} | {partner.team.totalPoints.toFixed(0)} pts
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
                      {partner.compatibilityScore}%
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
                
                {/* Trade Match Preview */}
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">You can offer ({userTeamAnalysis?.strengths.filter(pos => partner.team.weaknesses.includes(pos)).length || 0} match)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {userTeamAnalysis?.strengths.filter(pos => partner.team.weaknesses.includes(pos)).map(pos => (
                        <span key={pos} className={`px-2 py-0.5 rounded text-xs font-medium border ${POSITION_COLORS[pos]}`}>
                          {pos}
                        </span>
                      ))}
                      {userTeamAnalysis?.strengths.filter(pos => partner.team.weaknesses.includes(pos)).length === 0 && (
                        <span className="text-xs text-muted-foreground italic">No direct matches</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">You can get ({partner.team.strengths.filter(pos => userTeamAnalysis?.weaknesses.includes(pos)).length || 0} match)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {partner.team.strengths.filter(pos => userTeamAnalysis?.weaknesses.includes(pos)).map(pos => (
                        <span key={pos} className={`px-2 py-0.5 rounded text-xs font-medium border ${POSITION_COLORS[pos]}`}>
                          {pos}
                        </span>
                      ))}
                      {partner.team.strengths.filter(pos => userTeamAnalysis?.weaknesses.includes(pos)).length === 0 && (
                        <span className="text-xs text-muted-foreground italic">No direct matches</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {partner.suggestedTrades.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-primary font-medium">
                      {partner.suggestedTrades.filter(t => t.verdict === "win-win").length} win-win trades available
                    </span>
                  </div>
                )}
              </button>
            ))
        )}
      </div>
    </div>
  )
}
