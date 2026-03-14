import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "HeyGen API key not configured" },
      { status: 500 }
    );
  }

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

    if (!res.ok) {
      const errorText = await res.text();
      console.error("HeyGen token error:", errorText);
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
