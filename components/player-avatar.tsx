"use client"

import { useState } from "react"
import { User } from "lucide-react"

interface PlayerAvatarProps {
  playerId: string
  playerName: string
  size?: number
  className?: string
}

export function PlayerAvatar({ playerId, playerName, size = 32, className = "" }: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false)
  
  // Sleeper CDN URL for player headshots
  const imageUrl = `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
  
  if (imageError) {
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-secondary ${className}`}
        style={{ width: size, height: size }}
      >
        <User className="text-muted-foreground" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    )
  }
  
  return (
    <img
      src={imageUrl || "/placeholder.svg"}
      alt={playerName}
      width={size}
      height={size}
      className={`rounded-full bg-secondary object-cover ${className}`}
      onError={() => setImageError(true)}
    />
  )
}
