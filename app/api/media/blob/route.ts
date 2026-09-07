import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

// GET /api/media/blob — proxy blob download with streaming and Range support
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/media/blob${params ? `?${params}` : ''}`;
  try {
    const forwardHeaders: Record<string, string> = {};
    const range = request.headers.get('range');
    if (range) {
      forwardHeaders['range'] = range;
    }

    const res = await fetch(url, { headers: forwardHeaders });
    if (!res.ok && res.status !== 206) {
      return new NextResponse('Not found', { status: res.status });
    }

    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('Backend proxy error (GET /api/media/blob):', err);
    return new NextResponse('Backend unavailable', { status: 502 });
  }
}

// POST /api/media/blob — proxy multipart file upload to backend
export async function POST(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/media/blob${params ? `?${params}` : ''}`;
    const contentType = request.headers.get('content-type') || '';
    const body = await request.arrayBuffer();

    const res = await fetch(url, {
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
