// Server-side proxy route: /api/proxy/[...path]
// Forwards requests to the Azure Function App, injecting the host key
// from a server-only environment variable (FUNCTION_KEY, no NEXT_PUBLIC_ prefix).
// The key is never sent to the browser.

import { NextRequest, NextResponse } from "next/server";

const FUNCTION_APP_URL = process.env.FUNCTION_APP_URL ?? "";
const FUNCTION_KEY = process.env.FUNCTION_KEY ?? "";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, "POST");
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
): Promise<NextResponse> {
  if (!FUNCTION_APP_URL) {
    return NextResponse.json(
      { error: "FUNCTION_APP_URL is not configured." },
      { status: 503 }
    );
  }

  const upstreamPath = pathSegments.join("/");
  const upstreamUrl = `${FUNCTION_APP_URL}/${upstreamPath}${request.nextUrl.search}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(FUNCTION_KEY ? { "x-functions-key": FUNCTION_KEY } : {}),
  };

  const body = method === "POST" ? await request.text() : undefined;

  try {
    const upstreamResponse = await fetch(upstreamUrl, { method, headers, body });
    const data = await upstreamResponse.json();
    return NextResponse.json(data, { status: upstreamResponse.status });
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: "Upstream request failed." }, { status: 502 });
  }
}
