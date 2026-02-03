import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string; season: string }> }
) {
  const { userId, season } = await params
  
  try {
    const response = await fetch(
      `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`,
      { 
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 60 }
      }
    )
    
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch leagues" },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching leagues:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
