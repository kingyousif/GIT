import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: 'secretary' | 'doctor' | 'admin';
}

function requestPath(request: FastifyRequest) {
  return request.url.split('?')[0];
}

function isPublicRoute(method: string, path: string) {
  if (path === '/api/health') return true;
  if (path === '/api/auth/login') return true;
  if (path === '/api/auth' || path === '/api/auth/me') return true;
  return false;
}

export function getSessionUser(request: FastifyRequest): SessionUser | null {
  const cookie = request.cookies?.endo_session;
  if (!cookie) return null;
  try {
    const parsed = JSON.parse(cookie) as SessionUser;
    if (!parsed?.id || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function registerAuthGuard(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    if (method === 'OPTIONS' || method === 'HEAD') return;

    const path = requestPath(request);
    if (isPublicRoute(method, path)) return;

    const user = getSessionUser(request);
    if (!user) {
      reply.code(401).send({ error: 'Authentication required.' });
      return;
    }

    if (
      (path.startsWith('/api/auth/register') || path.startsWith('/api/auth/users')) &&
      user.role !== 'admin'
    ) {
      reply.code(403).send({ error: 'Admin access required.' });
      return;
    }
  });
}
