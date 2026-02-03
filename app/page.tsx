"use client"

import { useState } from "react"
import { SleeperProvider, useSleeper } from "@/lib/sleeper-context"
import { UsernameInput, type SleeperUser } from "@/components/username-input"
import { FeatureCard } from "@/components/feature-card"
import { FeatureModal } from "@/components/feature-modal"
import { LeaguesDisplay } from "@/components/leagues-display"
import { TeamAnalysis } from "@/components/team-analysis"
import { TradeHub } from "@/components/trade-hub"
import { 
  Trophy, 
  Users, 
  Calendar, 
  TrendingUp, 
  Zap,
  Brain,
  FileText,
  ArrowLeftRight,
  Target,
  Newspaper,
  LogOut,
  BarChart3,
  Handshake
} from "lucide-react"
import { Button } from "@/components/ui/button"

type FeatureKey = 
  | "leagues" 
  | "team-analysis"
  | "trade-hub"
  | "matchups" 
  | "start-sit" 
  | "waiver" 
  | "projections" 
  | "rankings" 
  | "draft" 
  | "news"

interface Feature {
  key: FeatureKey
  title: string
  description: string
  icon: typeof Trophy
  status: "available" | "coming-soon" | "beta"
  category: "foundation" | "in-season" | "preseason" | "offseason"
}

const features: Feature[] = [
  {
    key: "leagues",
    title: "My Leagues",
    description: "View all your Sleeper leagues and manage your rosters in one place.",
    icon: Trophy,
    status: "available",
    category: "foundation"
  },
  {
    key: "team-analysis",
    title: "Team Analysis",
    description: "Analyze your roster strengths and weaknesses compared to your league.",
    icon: BarChart3,
    status: "available",
    category: "foundation"
  },
  {
    key: "trade-hub",
    title: "Trade Hub",
    description: "Find win-win trade opportunities with compatible trade partners in your league.",
    icon: Handshake,
    status: "available",
    category: "in-season"
  },
  {
    key: "matchups",
    title: "Weekly Matchups",
    description: "Track your weekly matchups and see how your team is performing.",
    icon: Calendar,
    status: "coming-soon",
    category: "in-season"
  },
  {
    key: "start-sit",
    title: "Start/Sit Advisor",
    description: "Get AI-powered recommendations on who to start and sit each week.",
    icon: Target,
    status: "coming-soon",
    category: "in-season"
  },
  {
    key: "waiver",
    title: "Waiver Wire",
    description: "Discover waiver wire opportunities with a 3-week value projection.",
    icon: TrendingUp,
    status: "coming-soon",
    category: "in-season"
  },
  
  {
    key: "projections",
    title: "Projections Tool",
    description: "Create and customize player projections for the upcoming season.",
    icon: Zap,
    status: "coming-soon",
    category: "preseason"
  },
  {
    key: "rankings",
    title: "Fantasy Rankings",
    description: "Aggregated rankings from top analysts plus our own AI-driven rankings.",
    icon: FileText,
    status: "coming-soon",
    category: "preseason"
  },
  {
    key: "draft",
    title: "Draft Assistant",
    description: "AI-powered draft assistant with value-based pick recommendations.",
    icon: Brain,
    status: "coming-soon",
    category: "preseason"
  },
  {
    key: "news",
    title: "Fantasy News",
    description: "Bite-sized news with fantasy impact analysis for quick decisions.",
    icon: Newspaper,
    status: "coming-soon",
    category: "offseason"
  }
]

function AppContent() {
  const { user, setUser, clearUser } = useSleeper()
  const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null)

  const handleUserFound = (foundUser: SleeperUser) => {
    setUser(foundUser)
  }

  const getFeatureContent = (key: FeatureKey) => {
    switch (key) {
      case "leagues":
        return <LeaguesDisplay />
      case "team-analysis":
        return <TeamAnalysis />
      case "trade-hub":
        return <TradeHub />
      default:
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              We&apos;re working hard to bring you this feature. Stay tuned for updates!
            </p>
          </div>
        )
    }
  }

  const activeFeatureData = features.find(f => f.key === activeFeature)

  // Landing page (not logged in)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Hero Section */}
        <header className="flex-1 flex flex-col items-center justify-center px-4 py-16">
          <div className="text-center max-w-3xl mx-auto">
            {/* Logo/Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-8 animate-float">
              <Trophy className="w-10 h-10 text-primary" />
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight text-balance font-[family-name:var(--font-display)]">
              Fantasy Head Coach
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto text-pretty">
              Your best hire to bring you championships
            </p>

            {/* Username Input */}
            <UsernameInput onUserFound={handleUserFound} />

            {/* Features Preview */}
            <div className="mt-16 pt-16 border-t border-border">
              <p className="text-sm text-muted-foreground mb-8">
                Connect your Sleeper account to access these features
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                {features.slice(0, 5).map((feature) => (
                  <div 
                    key={feature.key}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border"
                  >
                    <feature.icon className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">{feature.title}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border">
                  <span className="text-sm text-muted-foreground">+ more</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Footer */}
        <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border">
          <p>Powered by Sleeper API</p>
        </footer>
      </div>
    )
  }

  // Dashboard (logged in)
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground font-[family-name:var(--font-display)]">Fantasy Head Coach</h1>
              <p className="text-xs text-muted-foreground">Your best hire to bring you championships</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img
                  src={`https://sleepercdn.com/avatars/thumbs/${user.avatar}`}
                  alt={user.display_name}
                  className="w-8 h-8 rounded-full bg-muted"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
              )}
              <span className="text-sm font-medium text-foreground hidden sm:block">
                {user.display_name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearUser}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2 font-[family-name:var(--font-display)]">
            Welcome back, {user.display_name}
          </h2>
          <p className="text-muted-foreground">
            Select a feature to get started with your fantasy analysis.
          </p>
        </div>

        {/* Feature Categories */}
        <div className="space-y-8">
          {/* Foundation */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Foundation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features
                .filter(f => f.category === "foundation")
                .map((feature) => (
                  <FeatureCard
                    key={feature.key}
                    title={feature.title}
                    description={feature.description}
                    icon={feature.icon}
                    status={feature.status}
                    onClick={() => setActiveFeature(feature.key)}
                  />
                ))}
            </div>
          </section>

          {/* In-Season */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              In-Season Tools
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features
                .filter(f => f.category === "in-season")
                .map((feature) => (
                  <FeatureCard
                    key={feature.key}
                    title={feature.title}
                    description={feature.description}
                    icon={feature.icon}
                    status={feature.status}
                    onClick={() => setActiveFeature(feature.key)}
                  />
                ))}
            </div>
          </section>

          {/* Preseason */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Preseason Tools
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features
                .filter(f => f.category === "preseason")
                .map((feature) => (
                  <FeatureCard
                    key={feature.key}
                    title={feature.title}
                    description={feature.description}
                    icon={feature.icon}
                    status={feature.status}
                    onClick={() => setActiveFeature(feature.key)}
                  />
                ))}
            </div>
          </section>

          {/* Offseason */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Offseason Tools
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features
                .filter(f => f.category === "offseason")
                .map((feature) => (
                  <FeatureCard
                    key={feature.key}
                    title={feature.title}
                    description={feature.description}
                    icon={feature.icon}
                    status={feature.status}
                    onClick={() => setActiveFeature(feature.key)}
                  />
                ))}
            </div>
          </section>
        </div>
      </main>

      {/* Feature Modal */}
      {activeFeatureData && (
        <FeatureModal
          isOpen={!!activeFeature}
          onClose={() => setActiveFeature(null)}
          title={activeFeatureData.title}
        >
          {getFeatureContent(activeFeature!)}
        </FeatureModal>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <SleeperProvider>
      <AppContent />
    </SleeperProvider>
  )
}
