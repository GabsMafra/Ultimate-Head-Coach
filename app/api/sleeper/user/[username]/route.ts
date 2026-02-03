import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  
  try {
    const response = await fetch(
      `https://api.sleeper.app/v1/user/${username}`,
      { 
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 300 } // Cache for 5 minutes
      }
    )
    
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    if (!data) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
