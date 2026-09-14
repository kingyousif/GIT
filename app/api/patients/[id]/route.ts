export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { handleProxy } from '@/lib/proxy-helper';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleProxy(request, `/api/patients/${id}`);
}
