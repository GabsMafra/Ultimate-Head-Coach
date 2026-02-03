"use client"

import { useEffect } from "react"
import { useSleeper } from "@/lib/sleeper-context"
import { Loader2, User } from "lucide-react"

interface RosterDisplayProps {
  leagueId: string
}

const POSITION_COLORS: Record<string, string> = {
  QB: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  RB: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  WR: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  TE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  K: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
  DEF: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  DL: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  LB: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  DB: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
}

export function RosterDisplay({ leagueId }: RosterDisplayProps) {
  const { 
    fetchRosters, 
    getUserRoster, 
    players, 
    isLoadingRosters,
    isLoadingPlayers 
  } = useSleeper()

  useEffect(() => {
    fetchRosters(leagueId)
  }, [leagueId, fetchRosters])

  const roster = getUserRoster(leagueId)

  if (isLoadingRosters || isLoadingPlayers) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Loading roster...</span>
      </div>
    )
  }

  if (!roster) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Could not find your roster in this league.
      </div>
    )
  }

  const getPlayer = (playerId: string) => {
    return players[playerId] || null
  }

  const getPositionStyle = (position: string) => {
    return POSITION_COLORS[position] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }

  const starters = roster.starters?.filter(id => id) || []
  const bench = roster.players?.filter(id => !starters.includes(id)) || []

  return (
    <div className="space-y-6">
      {/* Record */}
      {roster.settings && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Record:</span>
          <span className="font-semibold text-foreground">
            {roster.settings.wins}-{roster.settings.losses}
            {roster.settings.ties > 0 && `-${roster.settings.ties}`}
          </span>
          {roster.settings.fpts > 0 && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">Points:</span>
              <span className="font-semibold text-foreground">
                {roster.settings.fpts.toFixed(1)}
              </span>
            </>
          )}
        </div>
      )}

      {/* Starters */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 font-[family-name:var(--font-display)]">Starters</h4>
        <div className="grid gap-2">
          {starters.map((playerId, index) => {
            const player = getPlayer(playerId)
            if (!player) {
              return (
                <div 
                  key={`starter-${index}`}
                  className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground text-sm">Unknown Player</span>
                </div>
              )
            }

            return (
              <div 
                key={playerId}
                className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <span className={`px-2 py-1 text-xs font-semibold rounded border ${getPositionStyle(player.position)}`}>
                  {player.position}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {player.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {player.team || "FA"}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 font-[family-name:var(--font-display)]">
            Bench ({bench.length})
          </h4>
          <div className="grid gap-2">
            {bench.map((playerId, index) => {
              const player = getPlayer(playerId)
              if (!player) {
                return (
                  <div 
                    key={`bench-${index}`}
                    className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20"
                  >
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <span className="text-muted-foreground text-xs">Unknown</span>
                  </div>
                )
              }

              return (
                <div 
                  key={playerId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
                >
                  <span className={`px-1.5 py-0.5 text-xs font-semibold rounded border ${getPositionStyle(player.position)}`}>
                    {player.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-xs truncate">
                      {player.full_name}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {player.team || "FA"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
