import { NextResponse } from "next/server"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchWithRetry(retries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch("https://api.sleeper.app/v1/state/nfl", {
        next: { revalidate: 3600 },
        headers: { 'Accept': 'application/json' }
      })

      // Check for rate limiting before parsing
      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt + 1) * 1000
        await delay(waitTime)
        continue
      }

      return response
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error)
      if (attempt < retries - 1) {
        await delay(1000 * (attempt + 1))
      }
    }
  }
  return null
}

export async function GET() {
  try {
    const response = await fetchWithRetry()

    if (!response) {
      return NextResponse.json(
        { error: "Failed to fetch NFL state after retries" },
        { status: 503 }
      )
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch NFL state" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching NFL state:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
