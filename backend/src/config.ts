import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, 'utf-8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  cookieSecret:
    process.env.COOKIE_SECRET ??
    'dev-only-secret-change-me-in-production-please-and-make-it-long',
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/endo_management',
  mediaDir: path.resolve(
    __dirname,
    '..',
    process.env.MEDIA_DIR ?? './data/media',
  ),
};

export function ensureMediaDir() {
  if (!fs.existsSync(config.mediaDir)) {
    fs.mkdirSync(config.mediaDir, { recursive: true });
  }
}
