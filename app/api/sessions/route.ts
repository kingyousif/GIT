export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { handleProxy } from '@/lib/proxy-helper';

export async function POST(request: NextRequest) {
  return handleProxy(request, '/api/sessions');
}
