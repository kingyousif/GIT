import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { config, ensureMediaDir } from './config.js';
import { connectDB } from './db/connection.js';
import { authRoutes } from './routes/auth.js';
import { mediaRoutes } from './routes/media.js';
import { storageRoutes } from './routes/storage.js';

async function main() {
  // Connect to MongoDB
  await connectDB();
  ensureMediaDir();

  const app = Fastify({
    logger: {
      level: 'info',
      transport: { target: 'pino-pretty', options: { colorize: true } },
    },
    bodyLimit: 200 * 1024 * 1024,
  });

  // Plugins
  await app.register(cors, {
    origin: (origin, cb) => { cb(null, true); },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'Content-Disposition'],
  });

  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024, files: 50 } });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Routes
  await app.register(authRoutes);
  await app.register(mediaRoutes);
  await app.register(storageRoutes);

  // Start
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`\n🚀 Endo Backend running at http://${config.host}:${config.port}`);
    console.log(`   MongoDB: ${config.mongoUri}`);
    console.log(`   Media dir: ${config.mediaDir}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
