"use client"

import { useState } from "react"

interface SleeperAvatarProps {
  avatar: string | null
  displayName: string
  size?: number
  className?: string
}

export function SleeperAvatar({ avatar, displayName, size = 48, className = "" }: SleeperAvatarProps) {
  const [imageError, setImageError] = useState(false)
  
  const sizeClasses = {
    32: "w-8 h-8 text-sm",
    40: "w-10 h-10 text-base",
    48: "w-12 h-12 text-lg",
    56: "w-14 h-14 text-xl",
    64: "w-16 h-16 text-2xl",
  }
  
  const sizeClass = sizeClasses[size as keyof typeof sizeClasses] || "w-12 h-12 text-lg"
  
  // Show fallback if no avatar or if image failed to load
  if (!avatar || imageError) {
    return (
      <div 
        className={`${sizeClass} rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 ${className}`}
      >
        <span className="font-semibold text-primary">
          {displayName ? displayName.charAt(0).toUpperCase() : "?"}
        </span>
      </div>
    )
  }

  return (
    <img
      src={`https://sleepercdn.com/avatars/thumbs/${avatar}`}
      alt={displayName}
      width={size}
      height={size}
      className={`${sizeClass} rounded-full bg-muted object-cover flex-shrink-0 ${className}`}
      onError={() => setImageError(true)}
      crossOrigin="anonymous"
    />
  )
}
