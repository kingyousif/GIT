import { NextRequest } from 'next/server';
import { handleProxy } from '@/lib/proxy-helper';

export async function GET(request: NextRequest) {
  return handleProxy(request, '/api/auth');
}

export async function POST(request: NextRequest) {
  return handleProxy(request, '/api/auth');
}

export async function DELETE(request: NextRequest) {
  return handleProxy(request, '/api/auth');
}

