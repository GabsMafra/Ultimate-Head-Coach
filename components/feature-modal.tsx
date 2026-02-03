"use client"

import React from "react"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

interface FeatureModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function FeatureModal({ isOpen, onClose, title, children }: FeatureModalProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      setIsClosing(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setShouldRender(false)
      onClose()
    }, 200)
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen])

  if (!shouldRender) return null

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        isClosing ? "animate-bubble-out" : "animate-bubble-in"
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative w-full max-w-4xl max-h-[90vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden ${
          isClosing ? "animate-bubble-out" : "animate-bubble-in"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-semibold text-foreground font-[family-name:var(--font-display)]">{title}</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  )
}
