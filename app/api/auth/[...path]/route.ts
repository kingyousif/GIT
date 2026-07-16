import { NextRequest } from 'next/server';
import { handleProxy } from '@/lib/proxy-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const pathParts = (await params).path;
  return handleProxy(request, `/api/auth/${pathParts.join('/')}`);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const pathParts = (await params).path;
  return handleProxy(request, `/api/auth/${pathParts.join('/')}`);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const pathParts = (await params).path;
  return handleProxy(request, `/api/auth/${pathParts.join('/')}`);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const pathParts = (await params).path;
  return handleProxy(request, `/api/auth/${pathParts.join('/')}`);
}
