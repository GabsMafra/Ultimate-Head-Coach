"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { SleeperUser } from "@/components/username-input"

export interface SleeperLeague {
  league_id: string
  name: string
  season: string
  status: string
  sport: string
  total_rosters: number
  roster_positions: string[]
  settings: {
    type: number
    best_ball: number
    [key: string]: number | string | boolean
  }
  scoring_settings: Record<string, number>
  avatar: string | null
  previous_league_id: string | null
}

export interface SleeperRoster {
  roster_id: number
  owner_id: string
  league_id: string
  players: string[]
  starters: string[]
  reserve: string[]
  settings: {
    wins: number
    losses: number
    ties: number
    fpts: number
    fpts_decimal: number
  }
}

export interface SleeperPlayer {
  player_id: string
  full_name: string
  first_name: string
  last_name: string
  position: string
  team: string
  age: number
  status: string
}

interface SleeperContextType {
  user: SleeperUser | null
  leagues: SleeperLeague[]
  rosters: Record<string, SleeperRoster[]>
  players: Record<string, SleeperPlayer>
  isLoadingLeagues: boolean
  isLoadingRosters: boolean
  isLoadingPlayers: boolean
  setUser: (user: SleeperUser | null) => void
  fetchLeagues: () => Promise<void>
  fetchRosters: (leagueId: string) => Promise<void>
  fetchPlayers: () => Promise<void>
  getUserRoster: (leagueId: string) => SleeperRoster | undefined
  clearUser: () => void
}

const SleeperContext = createContext<SleeperContextType | undefined>(undefined)

export function SleeperProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SleeperUser | null>(null)
  const [leagues, setLeagues] = useState<SleeperLeague[]>([])
  const [rosters, setRosters] = useState<Record<string, SleeperRoster[]>>({})
  const [players, setPlayers] = useState<Record<string, SleeperPlayer>>({})
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false)
  const [isLoadingRosters, setIsLoadingRosters] = useState(false)
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false)

  const fetchLeagues = useCallback(async (userId?: string) => {
    const targetUserId = userId || user?.user_id
    if (!targetUserId) return

    setIsLoadingLeagues(true)
    try {
      const response = await fetch(`/api/sleeper/leagues/${targetUserId}`)
      
      if (response.ok) {
        const data = await response.json()
        setLeagues(data || [])
      } else {
        console.error("Failed to fetch leagues:", response.statusText)
      }
    } catch (error) {
      console.error("Failed to fetch leagues:", error)
    } finally {
      setIsLoadingLeagues(false)
    }
  }, [user?.user_id])

  // Automatically fetch leagues when user is set
  useEffect(() => {
    if (user?.user_id && leagues.length === 0) {
      fetchLeagues(user.user_id)
    }
  }, [user?.user_id, leagues.length, fetchLeagues])

  const fetchRosters = useCallback(async (leagueId: string) => {
    if (rosters[leagueId]) return

    setIsLoadingRosters(true)
    try {
      const response = await fetch(`/api/sleeper/rosters/${leagueId}`)
      
      if (response.ok) {
        const data = await response.json()
        setRosters(prev => ({ ...prev, [leagueId]: data || [] }))
      } else {
        console.error("Failed to fetch rosters:", response.statusText)
      }
    } catch (error) {
      console.error("Failed to fetch rosters:", error)
    } finally {
      setIsLoadingRosters(false)
    }
  }, [rosters])

  const fetchPlayers = useCallback(async (): Promise<Record<string, SleeperPlayer>> => {
    // If players already loaded, return them immediately
    if (Object.keys(players).length > 0) return players

    setIsLoadingPlayers(true)
    try {
      const response = await fetch("/api/sleeper/players")
      
      if (response.ok) {
        const data = await response.json()
        setPlayers(data || {})
        return data || {}
      } else {
        console.error("Failed to fetch players:", response.statusText)
      }
    } catch (error) {
      console.error("Failed to fetch players:", error)
    } finally {
      setIsLoadingPlayers(false)
    }
    return {}
  }, [players])

  const getUserRoster = useCallback((leagueId: string): SleeperRoster | undefined => {
    if (!user || !rosters[leagueId]) return undefined
    return rosters[leagueId].find(roster => roster.owner_id === user.user_id)
  }, [user, rosters])

  const clearUser = useCallback(() => {
    setUser(null)
    setLeagues([])
    setRosters({})
  }, [])

  return (
    <SleeperContext.Provider
      value={{
        user,
        leagues,
        rosters,
        players,
        isLoadingLeagues,
        isLoadingRosters,
        isLoadingPlayers,
        setUser,
        fetchLeagues,
        fetchRosters,
        fetchPlayers,
        getUserRoster,
        clearUser
      }}
    >
      {children}
    </SleeperContext.Provider>
  )
}

export function useSleeper() {
  const context = useContext(SleeperContext)
  if (context === undefined) {
    throw new Error("useSleeper must be used within a SleeperProvider")
  }
  return context
}
