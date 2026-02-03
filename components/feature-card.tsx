"use client"

import type { LucideIcon } from "lucide-react"

interface FeatureCardProps {
  title: string
  description: string
  icon: LucideIcon
  status?: "available" | "coming-soon" | "beta"
  onClick: () => void
}

export function FeatureCard({ title, description, icon: Icon, status = "available", onClick }: FeatureCardProps) {
  const statusStyles = {
    available: "bg-primary/10 text-primary border-primary/20",
    "coming-soon": "bg-accent/10 text-accent border-accent/20",
    beta: "bg-chart-3/10 text-chart-3 border-chart-3/20"
  }

  const statusLabels = {
    available: "Available",
    "coming-soon": "Coming Soon",
    beta: "Beta"
  }

  const isDisabled = status === "coming-soon"

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`group relative w-full text-left p-6 rounded-xl border border-border bg-card hover-lift transition-all duration-200 ${
        isDisabled 
          ? "opacity-60 cursor-not-allowed hover:border-accent/30" 
          : "hover:border-primary/50 hover:bg-card/80 cursor-pointer"
      }`}
    >
      {/* Status Badge */}
      <div className={`absolute top-4 right-4 px-2 py-1 text-xs font-medium rounded-full border ${statusStyles[status]}`}>
        {statusLabels[status]}
      </div>

      {/* Icon */}
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4 ${
        !isDisabled && "group-hover:animate-float"
      }`}>
        <Icon className="w-6 h-6 text-primary" />
      </div>

      {/* Content */}
      <h3 className="text-lg font-semibold text-foreground mb-2 font-[family-name:var(--font-display)]">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </button>
  )
}
