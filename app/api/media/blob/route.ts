import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

// GET /api/media/blob — proxy blob download from backend
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/media/blob${params ? `?${params}` : ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return new NextResponse('Not found', { status: res.status });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('Backend proxy error (GET /api/media/blob):', err);
    return new NextResponse('Backend unavailable', { status: 502 });
  }
}

// POST /api/media/blob — proxy multipart file upload to backend
export async function POST(request: NextRequest) {
  try {
    // Read the raw body and forward it with the original content-type (includes boundary)
    const contentType = request.headers.get('content-type') || '';
    const body = await request.arrayBuffer();

    const res = await fetch(`${BACKEND_URL}/api/media/blob`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: Buffer.from(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Backend proxy error (POST /api/media/blob):', err);
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}
