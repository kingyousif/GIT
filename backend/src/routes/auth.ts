import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { User } from '../db/models.js';

export async function authRoutes(app: FastifyInstance) {
  // ===== Frontend session routes =====

  // POST /api/auth — set session cookie
  app.post('/api/auth', async (request, reply) => {
    const { user } = request.body as { user: Record<string, unknown> };
    if (!user) return reply.status(400).send({ error: 'user object required' });
    reply.setCookie('endo_session', JSON.stringify(user), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
    return { success: true };
  });

  // GET /api/auth — get current session
  app.get('/api/auth', async (request) => {
    const cookie = request.cookies.endo_session;
    if (!cookie) return { user: null };
    try { return { user: JSON.parse(cookie) }; } catch { return { user: null }; }
  });

  // DELETE /api/auth — clear session
  app.delete('/api/auth', async (request, reply) => {
    reply.clearCookie('endo_session', { path: '/' });
    return { success: true };
  });

  // ===== User management =====

  // POST /api/auth/login
  app.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };
    if (!username || !password) return reply.status(400).send({ error: 'username and password required' });

    const user = await User.findOne({ username, active: true });
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    user.lastLoginAt = new Date().toISOString();
    await user.save();

    const payload = { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
    reply.setCookie('endo_session', JSON.stringify(payload), { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
    return { success: true, user: payload };
  });

  // GET /api/auth/me
  app.get('/api/auth/me', async (request) => {
    const cookie = request.cookies.endo_session;
    if (!cookie) return { user: null };
    try { return { user: JSON.parse(cookie) }; } catch { return { user: null }; }
  });

  // POST /api/auth/register
  app.post('/api/auth/register', async (request, reply) => {
    const body = request.body as { username: string; password: string; displayName: string; role: string };
    if (!body.username || !body.password || !body.displayName || !body.role) {
      return reply.status(400).send({ error: 'All fields required' });
    }
    const existing = await User.findOne({ username: body.username });
    if (existing) return reply.status(409).send({ error: 'Username already exists' });

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({ username: body.username, passwordHash, displayName: body.displayName, role: body.role as 'secretary' | 'doctor' | 'admin', active: true });
    return { success: true, user: { id: (user as any).id || (user as any)._id.toString(), username: user.username, displayName: user.displayName, role: user.role } };
  });

  // GET /api/auth/users
  app.get('/api/auth/users', async () => {
    const users = await User.find().lean();
    return users.map((u: any) => ({ id: u._id.toString(), username: u.username, displayName: u.displayName, role: u.role, active: u.active, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt }));
  });

  // PATCH /api/auth/users/:id
  app.patch('/api/auth/users/:id', async (request) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;
    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }
    await User.findByIdAndUpdate(id, { $set: updates });
    return { success: true };
  });

  // DELETE /api/auth/users/:id
  app.delete('/api/auth/users/:id', async (request) => {
    const { id } = request.params as { id: string };
    await User.findByIdAndDelete(id);
    return { success: true };
  });
}
