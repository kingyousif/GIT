export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { handleProxy } from '@/lib/proxy-helper';

export async function GET(request: NextRequest) {
  return handleProxy(request, '/api/media');
}

export async function POST(request: NextRequest) {
  return handleProxy(request, '/api/media');
}

export async function PATCH(request: NextRequest) {
  return handleProxy(request, '/api/media');
}

export async function DELETE(request: NextRequest) {
  return handleProxy(request, '/api/media');
}
