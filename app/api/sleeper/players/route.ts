import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch(
      "https://api.sleeper.app/v1/players/nfl",
      { 
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 86400 } // Cache for 24 hours - player data doesn't change often
      }
    )
    
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch players" },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching players:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
