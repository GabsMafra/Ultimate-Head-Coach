"use client"

import { useEffect, useState, useCallback } from "react"
import { useSleeper, type SleeperLeague, type SleeperRoster } from "@/lib/sleeper-context"
import { 
  Loader2, 
  Users, 
  Trophy, 
  Settings2, 
  ChevronDown, 
  ChevronRight,
  Crown,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  AlertCircle
} from "lucide-react"
import { SleeperAvatar } from "./sleeper-avatar"

interface LeagueContextDashboardProps {
  league: SleeperLeague
}

interface LeagueUser {
  user_id: string
  display_name: string
  avatar: string | null
}

interface TeamRanking {
  rosterId: number
  ownerId: string
  ownerName: string
  avatar: string | null
  totalPoints: number
  rank: number
  wins: number
  losses: number
  ties: number
}

interface ScoringHighlight {
  key: string
  label: string
  value: number
  isCustom: boolean
  note?: string
}

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  RB: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  WR: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  TE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  K: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
  DEF: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  FLEX: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SUPER_FLEX: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  BN: "bg-gray-500/20 text-gray-400 border-gray-500/30",
}

// Standard scoring values for comparison
const STANDARD_PPR_SCORING: Record<string, number> = {
  rec: 1,
  pass_yd: 0.04,
  pass_td: 4,
  rush_yd: 0.1,
  rush_td: 6,
  rec_yd: 0.1,
  rec_td: 6,
  pass_int: -2,
  fum_lost: -2,
}

const STANDARD_HALF_PPR_SCORING: Record<string, number> = {
  ...STANDARD_PPR_SCORING,
  rec: 0.5,
}

const SCORING_LABELS: Record<string, string> = {
  rec: "Points Per Reception",
  rec_yd: "Receiving Yards",
  rec_td: "Receiving TD",
  rush_yd: "Rushing Yards",
  rush_td: "Rushing TD",
  pass_yd: "Passing Yards",
  pass_td: "Passing TD",
  pass_int: "Interception",
  fum_lost: "Fumble Lost",
  bonus_rec_te: "TE Premium",
  bonus_rush_yd_100: "100+ Rush Yards Bonus",
  bonus_rec_yd_100: "100+ Rec Yards Bonus",
  bonus_pass_yd_300: "300+ Pass Yards Bonus",
  rec_fd: "First Down Reception",
  rush_fd: "First Down Rush",
  pass_fd: "First Down Pass",
}

export function LeagueContextDashboard({ league }: LeagueContextDashboardProps) {
  const { user, players, fetchPlayers, fetchRosters, rosters } = useSleeper()
  const [isLoading, setIsLoading] = useState(true)
  const [leagueUsers, setLeagueUsers] = useState<LeagueUser[]>([])
  const [teamRankings, setTeamRankings] = useState<TeamRanking[]>([])
  const [selectedTeamRoster, setSelectedTeamRoster] = useState<SleeperRoster | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["scoring", "teams"]))

  // Fetch league users
  const fetchLeagueUsers = useCallback(async () => {
    try {
      const response = await fetch(`/api/sleeper/league-users/${league.league_id}`)
      if (response.ok) {
        const data = await response.json()
        return data || []
      }
    } catch (error) {
      console.error("Error fetching league users:", error)
    }
    return []
  }, [league.league_id])

  // Fetch all matchups for player points
  const fetchAllMatchups = useCallback(async (leagueId: string) => {
    const matchupsByWeek: Record<string, any[]> = {}
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
  const calculatePlayerPoints = useCallback((matchups: Record<string, any[]>) => {
    const playerPoints: Record<string, number> = {}
    Object.values(matchups).forEach(weekMatchups => {
      weekMatchups.forEach(matchup => {
        if (matchup.players_points) {
          Object.entries(matchup.players_points).forEach(([playerId, points]) => {
            playerPoints[playerId] = (playerPoints[playerId] || 0) + (points as number)
          })
        }
      })
    })
    return playerPoints
  }, [])

  // Calculate team rankings
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const [users, playersData] = await Promise.all([
          fetchLeagueUsers(),
          fetchPlayers()
        ])
        setLeagueUsers(users)
        
        await fetchRosters(league.league_id)
        const leagueRosters = rosters[league.league_id] || []
        
        // Fetch matchups for player points
        let matchups = await fetchAllMatchups(league.league_id)
        let playerPoints = calculatePlayerPoints(matchups)
        
        // If no current season data, try previous season
        if (Object.keys(playerPoints).length === 0 && league.previous_league_id) {
          matchups = await fetchAllMatchups(league.previous_league_id)
          playerPoints = calculatePlayerPoints(matchups)
        }
        
        // Build rankings
        const rankings: TeamRanking[] = leagueRosters.map(roster => {
          const owner = users.find((u: LeagueUser) => u.user_id === roster.owner_id)
          const rosterPlayers = roster.players || []
          
          const totalPoints = rosterPlayers.reduce((sum, playerId) => {
            return sum + (playerPoints[playerId] || 0)
          }, 0)
          
          return {
            rosterId: roster.roster_id,
            ownerId: roster.owner_id,
            ownerName: owner?.display_name || `Team ${roster.roster_id}`,
            avatar: owner?.avatar || null,
            totalPoints,
            rank: 0,
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            ties: roster.settings?.ties || 0,
          }
        })
        
        // Sort by total points and assign ranks
        rankings.sort((a, b) => b.totalPoints - a.totalPoints)
        rankings.forEach((team, index) => {
          team.rank = index + 1
        })
        
        setTeamRankings(rankings)
      } catch (error) {
        console.error("Error loading league context:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [league.league_id, league.previous_league_id, fetchLeagueUsers, fetchPlayers, fetchRosters, rosters, fetchAllMatchups, calculatePlayerPoints])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  // Determine league type
  const getLeagueType = () => {
    const types: string[] = []
    
    // Dynasty/Keeper/Redraft
    if (league.settings?.type === 2) types.push("Dynasty")
    else if (league.settings?.type === 1) types.push("Keeper")
    else types.push("Redraft")
    
    // Scoring format
    const ppr = league.scoring_settings?.rec || 0
    if (ppr === 1) types.push("PPR")
    else if (ppr === 0.5) types.push("Half PPR")
    else if (ppr === 0) types.push("Standard")
    
    // Superflex
    if (league.roster_positions?.includes("SUPER_FLEX")) {
      types.push("Superflex")
    }
    
    // Best Ball
    if (league.settings?.best_ball === 1) {
      types.push("Best Ball")
    }
    
    return types
  }

  // Get roster configuration summary
  const getRosterConfig = () => {
    const positions = league.roster_positions || []
    const config: Record<string, number> = {}
    
    positions.forEach(pos => {
      config[pos] = (config[pos] || 0) + 1
    })
    
    return config
  }

  // Get scoring highlights (custom/notable settings)
  const getScoringHighlights = (): ScoringHighlight[] => {
    const highlights: ScoringHighlight[] = []
    const scoring = league.scoring_settings || {}
    const ppr = scoring.rec || 0
    
    // Determine baseline for comparison
    const baseline = ppr >= 0.75 ? STANDARD_PPR_SCORING : STANDARD_HALF_PPR_SCORING
    
    // Key scoring settings to highlight
    const keySettings = [
      'rec', 'rec_td', 'rush_td', 'pass_td', 'pass_yd', 'rush_yd', 'rec_yd',
      'bonus_rec_te', 'rec_fd', 'rush_fd', 'pass_fd', 
      'bonus_rush_yd_100', 'bonus_rec_yd_100', 'bonus_pass_yd_300'
    ]
    
    keySettings.forEach(key => {
      const value = scoring[key]
      if (value === undefined) return
      
      const standardValue = baseline[key] || 0
      const isCustom = value !== standardValue
      const label = SCORING_LABELS[key] || key
      
      // Always show PPR
      if (key === 'rec') {
        highlights.push({
          key,
          label,
          value,
          isCustom: false,
          note: value === 1 ? "Full PPR" : value === 0.5 ? "Half PPR" : value === 0 ? "Standard" : `${value} PPR`
        })
        return
      }
      
      // Only show if custom or it's a bonus setting
      if (isCustom || key.startsWith('bonus_') || key.endsWith('_fd')) {
        let note: string | undefined
        if (isCustom && standardValue !== 0) {
          note = value > standardValue ? `+${((value - standardValue) / standardValue * 100).toFixed(0)}% vs standard` : `${((value - standardValue) / standardValue * 100).toFixed(0)}% vs standard`
        } else if (key.startsWith('bonus_') && value > 0) {
          note = "Bonus"
        } else if (key.endsWith('_fd') && value > 0) {
          note = "First Down Bonus"
        }
        
        highlights.push({
          key,
          label,
          value,
          isCustom,
          note
        })
      }
    })
    
    return highlights
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading league details...</span>
      </div>
    )
  }

  const leagueTypes = getLeagueType()
  const rosterConfig = getRosterConfig()
  const scoringHighlights = getScoringHighlights()
  const leagueRosters = rosters[league.league_id] || []

  // If a team roster is selected, show their roster
  if (selectedTeamRoster) {
    const selectedTeam = teamRankings.find(t => t.rosterId === selectedTeamRoster.roster_id)
    return (
      <div className="space-y-4">
        {/* Back button */}
        <button
          onClick={() => setSelectedTeamRoster(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to League Overview
        </button>
        
        {/* Team Header */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
          <SleeperAvatar 
            avatar={selectedTeam?.avatar || null}
            displayName={selectedTeam?.ownerName || "Team"}
            size={40}
            className="rounded-lg"
          />
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">{selectedTeam?.ownerName}</h4>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Rank #{selectedTeam?.rank}
              </span>
              <span>{selectedTeam?.wins}-{selectedTeam?.losses}{(selectedTeam?.ties || 0) > 0 && `-${selectedTeam?.ties}`}</span>
              <span>{selectedTeam?.totalPoints.toFixed(1)} pts</span>
            </div>
          </div>
        </div>
        
        {/* Team Roster */}
        <TeamRosterView roster={selectedTeamRoster} players={players} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* League Type Tags */}
      <div className="flex flex-wrap gap-2">
        {leagueTypes.map((type, i) => (
          <span 
            key={i}
            className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary border border-primary/30"
          >
            {type}
          </span>
        ))}
        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-secondary text-muted-foreground">
          {league.total_rosters} Teams
        </span>
      </div>

      {/* Roster Configuration */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(rosterConfig).map(([pos, count]) => (
          <span 
            key={pos}
            className={`px-2 py-0.5 text-xs font-medium rounded border ${POSITION_COLORS[pos] || POSITION_COLORS.BN}`}
          >
            {count} {pos}
          </span>
        ))}
      </div>

      {/* Scoring Highlights Section */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("scoring")}
          className="w-full flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm text-foreground">Scoring Settings</span>
            {scoringHighlights.filter(s => s.isCustom).length > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {scoringHighlights.filter(s => s.isCustom).length} Custom
              </span>
            )}
          </div>
          {expandedSections.has("scoring") ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {expandedSections.has("scoring") && (
          <div className="p-3 space-y-2">
            {scoringHighlights.map(highlight => (
              <div 
                key={highlight.key}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  highlight.isCustom ? "bg-amber-500/10 border border-amber-500/20" : "bg-secondary/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  {highlight.isCustom && <Zap className="w-3 h-3 text-amber-400" />}
                  <span className="text-sm text-foreground">{highlight.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{highlight.value}</span>
                  {highlight.note && (
                    <span className="text-xs text-muted-foreground">{highlight.note}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Power Rankings Section */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("teams")}
          className="w-full flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm text-foreground">Power Rankings</span>
          </div>
          {expandedSections.has("teams") ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {expandedSections.has("teams") && (
          <div className="p-2 space-y-1">
            {teamRankings.map((team) => {
              const isUserTeam = team.ownerId === user?.user_id
              const roster = leagueRosters.find(r => r.roster_id === team.rosterId)
              
              return (
                <button
                  key={team.rosterId}
                  onClick={() => roster && setSelectedTeamRoster(roster)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${
                    isUserTeam 
                      ? "bg-primary/10 border border-primary/30 hover:bg-primary/20" 
                      : "bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    team.rank === 1 ? "bg-amber-500/20 text-amber-400" :
                    team.rank === 2 ? "bg-gray-400/20 text-gray-300" :
                    team.rank === 3 ? "bg-orange-600/20 text-orange-400" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {team.rank}
                  </div>
                  
                  {/* Avatar */}
                  <SleeperAvatar 
                    avatar={team.avatar}
                    displayName={team.ownerName}
                    size={32}
                    className="rounded-md"
                  />
                  
                  {/* Name & Record */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm truncate ${isUserTeam ? "text-primary" : "text-foreground"}`}>
                        {team.ownerName}
                      </span>
                      {isUserTeam && (
                        <span className="text-xs text-primary">(You)</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {team.wins}-{team.losses}{team.ties > 0 && `-${team.ties}`}
                    </span>
                  </div>
                  
                  {/* Points */}
                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground">{team.totalPoints.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground ml-1">pts</span>
                  </div>
                  
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Team Roster View Component
function TeamRosterView({ roster, players }: { roster: SleeperRoster; players: Record<string, any> }) {
  const starters = roster.starters?.filter(id => id) || []
  const bench = roster.players?.filter(id => !starters.includes(id)) || []

  const getPositionStyle = (position: string) => {
    return POSITION_COLORS[position] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }

  return (
    <div className="space-y-4">
      {/* Starters */}
      <div>
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Starters</h5>
        <div className="grid gap-1.5">
          {starters.map((playerId, index) => {
            const player = players[playerId]
            if (!player) {
              return (
                <div key={`starter-${index}`} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
                  <span className="text-xs text-muted-foreground">Empty Slot</span>
                </div>
              )
            }
            return (
              <div key={playerId} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
                <span className={`px-1.5 py-0.5 text-xs font-semibold rounded border ${getPositionStyle(player.position)}`}>
                  {player.position}
                </span>
                <span className="text-sm text-foreground flex-1 truncate">{player.full_name}</span>
                <span className="text-xs text-muted-foreground">{player.team || "FA"}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bench ({bench.length})</h5>
          <div className="grid gap-1">
            {bench.map((playerId, index) => {
              const player = players[playerId]
              if (!player) {
                return (
                  <div key={`bench-${index}`} className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary/20">
                    <span className="text-xs text-muted-foreground">Unknown</span>
                  </div>
                )
              }
              return (
                <div key={playerId} className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary/20">
                  <span className={`px-1 py-0.5 text-xs font-semibold rounded border ${getPositionStyle(player.position)}`}>
                    {player.position}
                  </span>
                  <span className="text-xs text-foreground flex-1 truncate">{player.full_name}</span>
                  <span className="text-xs text-muted-foreground">{player.team || "FA"}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
