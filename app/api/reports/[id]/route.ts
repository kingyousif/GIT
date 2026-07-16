export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { handleProxy } from '@/lib/proxy-helper';

async function reportPath(params: Promise<{ id: string }>) {
  const { id } = await params;
  return `/api/reports/${encodeURIComponent(id)}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleProxy(request, await reportPath(params));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleProxy(request, await reportPath(params));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleProxy(request, await reportPath(params));
}
