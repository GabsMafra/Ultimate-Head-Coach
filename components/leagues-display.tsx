"use client"

import { useEffect, useState } from "react"
import { useSleeper } from "@/lib/sleeper-context"
import { Users, Trophy, ChevronRight, Loader2 } from "lucide-react"
import { LeagueContextDashboard } from "./league-context-dashboard"
import { SleeperAvatar } from "./sleeper-avatar"
import { RosterDisplay } from "./roster-display" // Import RosterDisplay

export function LeaguesDisplay() {
  const { leagues, isLoadingLeagues, fetchLeagues, fetchPlayers } = useSleeper()
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null)

  useEffect(() => {
    fetchLeagues()
    fetchPlayers()
  }, [fetchLeagues, fetchPlayers])

  if (isLoadingLeagues) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading your leagues...</p>
      </div>
    )
  }

  if (leagues.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2 font-[family-name:var(--font-display)]">No leagues found</h3>
        <p className="text-muted-foreground">
          You don&apos;t have any NFL leagues for the current season yet.
        </p>
      </div>
    )
  }

  const getLeagueTypeLabel = (type: number) => {
    switch (type) {
      case 0: return "Redraft"
      case 1: return "Keeper"
      case 2: return "Dynasty"
      default: return "Standard"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground font-[family-name:var(--font-display)]">
          Your Leagues ({leagues.length})
        </h3>
      </div>

      <div className="grid gap-3">
        {leagues.map((league) => (
          <button
            key={league.league_id}
            onClick={() => setSelectedLeagueId(
              selectedLeagueId === league.league_id ? null : league.league_id
            )}
            className="w-full text-left"
          >
            <div
              className={`p-4 rounded-xl border transition-all duration-200 hover-lift ${
                selectedLeagueId === league.league_id
                  ? "bg-primary/10 border-primary/50"
                  : "bg-secondary/30 border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* League Avatar */}
                <SleeperAvatar 
                  avatar={league.avatar} 
                  displayName={league.name} 
                  size={48}
                  className="rounded-lg"
                />

                {/* League Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground truncate font-[family-name:var(--font-display)]">{league.name}</h4>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {league.total_rosters} teams
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-xs">
                      {getLeagueTypeLabel(league.settings?.type ?? 0)}
                    </span>
                    <span className="text-xs">{league.season}</span>
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight
                  className={`w-5 h-5 text-muted-foreground transition-transform ${
                    selectedLeagueId === league.league_id ? "rotate-90" : ""
                  }`}
                />
              </div>

              {/* Expanded League Context Dashboard */}
              {selectedLeagueId === league.league_id && (
                <div className="mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                  <LeagueContextDashboard league={league} />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
