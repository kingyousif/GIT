export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { handleProxy } from '@/lib/proxy-helper';

async function target(params: Promise<{ id: string }>) {
  const { id } = await params;
  return `/api/sessions/${id}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleProxy(request, await target(params));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleProxy(request, await target(params));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleProxy(request, await target(params));
}
