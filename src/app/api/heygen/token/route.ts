import { NextResponse } from "next/server";

// Simple in-memory rate limit tracker for the token endpoint
let lastTokenRequest = 0;
const MIN_TOKEN_INTERVAL_MS = 3000; // Minimum 3s between token requests

export async function POST() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "HeyGen API key not configured" },
      { status: 500 }
    );
  }

  // Throttle: prevent rapid-fire token requests (React dev double-mount, retries, etc.)
  const now = Date.now();
  if (now - lastTokenRequest < MIN_TOKEN_INTERVAL_MS) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment.", retryAfter: MIN_TOKEN_INTERVAL_MS / 1000 },
      { status: 429 }
    );
  }
  lastTokenRequest = now;

  try {
    const res = await fetch(
      "https://api.heygen.com/v1/streaming.create_token",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after") || "60";
      console.warn(`HeyGen rate limited. Retry after ${retryAfter}s`);
      return NextResponse.json(
        { error: "HeyGen rate limit reached. Please wait and try again.", retryAfter: parseInt(retryAfter) || 60 },
        { status: 429 }
      );
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error("HeyGen token error:", res.status, errorText);
      return NextResponse.json(
        { error: "Failed to create HeyGen token", details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ token: data.data?.token || data.token });
  } catch (error) {
    console.error("HeyGen token error:", error);
    return NextResponse.json(
      { error: "HeyGen service unavailable" },
      { status: 503 }
    );
  }
}
