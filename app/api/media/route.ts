import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

// Proxy all media requests to the Fastify backend
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/media${params ? `?${params}` : ''}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Backend proxy error (GET /api/media):', err);
    return NextResponse.json([], { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/api/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Backend proxy error (POST /api/media):', err);
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/api/media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Backend proxy error (PATCH /api/media):', err);
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/media${params ? `?${params}` : ''}`;
  try {
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Backend proxy error (DELETE /api/media):', err);
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
