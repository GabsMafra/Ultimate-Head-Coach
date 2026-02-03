import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params

  try {
    const response = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/users`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch league users" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching league users:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
