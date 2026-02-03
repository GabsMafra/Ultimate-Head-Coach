"use client"

import React from "react"

import { useState } from "react"
import { Search, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SleeperAvatar } from "@/components/sleeper-avatar"

interface UsernameInputProps {
  onUserFound: (user: SleeperUser) => void
}

export interface SleeperUser {
  user_id: string
  username: string
  display_name: string
  avatar: string | null
}

export function UsernameInput({ onUserFound }: UsernameInputProps) {
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [foundUser, setFoundUser] = useState<SleeperUser | null>(null)

  const handleSearch = async () => {
    if (!username.trim()) return

    setIsLoading(true)
    setError(null)
    setFoundUser(null)

    try {
      const response = await fetch(`/api/sleeper/user/${username.trim()}`)
      
      if (!response.ok) {
        throw new Error("User not found")
      }

      const data = await response.json()
      
      if (!data || !data.user_id) {
        throw new Error("User not found")
      }

      const user: SleeperUser = {
        user_id: data.user_id,
        username: data.username,
        display_name: data.display_name || data.username,
        avatar: data.avatar
      }

      setFoundUser(user)
    } catch {
      setError("User not found. Please check the username and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = () => {
    if (foundUser) {
      onUserFound(foundUser)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSearch()
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter your Sleeper username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setError(null)
                setFoundUser(null)
              }}
              onKeyDown={handleKeyDown}
              className="pl-10 h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isLoading || !username.trim()}
            className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mt-3 flex items-center gap-2 text-destructive text-sm">
            <XCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Found User */}
        {foundUser && (
          <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-primary/30 animate-bubble-in">
            <div className="flex items-center gap-4">
              <SleeperAvatar 
                avatar={foundUser.avatar} 
                displayName={foundUser.display_name} 
                size={48}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">User found</span>
                </div>
                <p className="font-semibold text-foreground font-[family-name:var(--font-display)]">{foundUser.display_name}</p>
                <p className="text-sm text-muted-foreground">@{foundUser.username}</p>
              </div>
              <Button
                onClick={handleConfirm}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
