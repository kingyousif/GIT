import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';
import { Media } from '../db/models.js';

// ===== Helpers =====

function safeName(input: string): string {
  return input.replace(/[<>:"/\\|?*\x00-\x1f\s]+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 80) || 'untitled';
}

async function getSessionFolder(sessionId: string, fields?: Record<string, string>): Promise<string> {
  // Use fields sent by the client (patientName, patientCode, procedureType, scheduledAt)
  const patientName = safeName(fields?.patientName || 'unknown');
  const patientCode = safeName(fields?.patientCode || 'no-code');
  const date = safeName((fields?.scheduledAt || '').slice(0, 10) || (fields?.capturedAt || '').slice(0, 10) || 'no-date');
  const proc = safeName(fields?.procedureType || 'session');

  return `${patientName}__${patientCode}__${date}__${proc}`;
}

function getSubfolder(type: string): string {
  if (type === 'image') return 'images';
  if (type === 'video') return 'videos';
  return 'documents';
}

const EXT_MAP: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
  'text/html': 'html', 'application/pdf': 'pdf',
};

function extForMime(mime: string, filename?: string): string {
  if (EXT_MAP[mime]) return EXT_MAP[mime];
  if (filename) { const e = path.extname(filename).slice(1); if (e) return e; }
  return 'bin';
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } | null {
  const match = dataUrl.match(/^data:([^;]+);(?:charset=[^;]+;)?base64,([\s\S]+)$/);
  if (match) {
    return { buffer: Buffer.from(match[2], 'base64'), mimeType: match[1], ext: extForMime(match[1]) };
  }
  const textMatch = dataUrl.match(/^data:text\/html;charset=utf-8,([\s\S]+)$/);
  if (textMatch) {
    return { buffer: Buffer.from(decodeURIComponent(textMatch[1]), 'utf-8'), mimeType: 'text/html', ext: 'html' };
  }
  return null;
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  if (mimeType === 'text/html') return `data:text/html;charset=utf-8,${encodeURIComponent(buffer.toString('utf-8'))}`;
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

// ===== Routes =====

export async function mediaRoutes(app: FastifyInstance) {
  // GET /api/media?sessionId=xxx — list media for a session (returns full dataUrl)
  // GET /api/media?sessionId=xxx&check=true — lightweight check (returns count only, no file data)
  // GET /api/media?all=true — all media grouped by session
  app.get('/api/media', async (request, reply) => {
    const { sessionId, all, check } = request.query as { sessionId?: string; all?: string; check?: string };

    // Lightweight check — just return count, no file reading
    if (check === 'true' && sessionId) {
      const count = await Media.countDocuments({ sessionId });
      return { hasData: count > 0, count };
    }

    if (all === 'true') {
      const allMedia = await Media.find().lean();
      const grouped: Record<string, any[]> = {};
      for (const m of allMedia) {
        const sid = (m as any).sessionId;
        if (!grouped[sid]) grouped[sid] = [];
        // Read file and build dataUrl
        const filePath = path.join(config.mediaDir, (m as any).storagePath);
        let dataUrl = '';
        if (fs.existsSync(filePath)) {
          const buffer = await fsp.readFile(filePath);
          dataUrl = bufferToDataUrl(buffer, (m as any).mimeType);
        }
        grouped[sid].push({ ...(m as any), id: (m as any)._id.toString(), _id: undefined, dataUrl });
      }
      return grouped;
    }

    if (!sessionId) return reply.status(400).send([]);

    const items = await Media.find({ sessionId }).lean();
    const result = await Promise.all(items.map(async (m: any) => {
      const filePath = path.join(config.mediaDir, m.storagePath);
      let dataUrl = '';
      if (fs.existsSync(filePath)) {
        const buffer = await fsp.readFile(filePath);
        dataUrl = bufferToDataUrl(buffer, m.mimeType);
      }
      return { ...m, id: m._id.toString(), _id: undefined, dataUrl };
    }));

    return result;
  });

  // POST /api/media — save a media item (with dataUrl in body)
  app.post('/api/media', async (request, reply) => {
    const body = request.body as any;
    if (!body.id && !body.sessionId) {
      return reply.status(400).send({ error: 'sessionId required' });
    }

    const sessionId = body.sessionId;
    const mediaType = body.type || 'image';
    const filename = body.filename || `file-${Date.now()}`;
    const dataUrl = body.dataUrl || '';

    // Parse dataUrl to binary
    const parsed = dataUrlToBuffer(dataUrl);
    if (!parsed) {
      return reply.status(400).send({ error: 'Invalid or missing dataUrl' });
    }

    // Build folder path
    const sessionFolder = await getSessionFolder(sessionId, body);
    const sub = getSubfolder(mediaType);
    const targetDir = path.join(config.mediaDir, sessionFolder, sub);
    await fsp.mkdir(targetDir, { recursive: true });

    const mediaId = body.id || new (await import('mongoose')).default.Types.ObjectId().toString();
    const storedFilename = `${mediaId}.${parsed.ext}`;
    const storagePath = path.join(sessionFolder, sub, storedFilename);
    const absolutePath = path.join(config.mediaDir, storagePath);

    // Write file to disk
    await fsp.writeFile(absolutePath, parsed.buffer);

    // Upsert in MongoDB
    await Media.findOneAndUpdate(
      { _id: mediaId },
      {
        _id: mediaId,
        sessionId,
        type: mediaType,
        filename,
        capturedAt: body.capturedAt || new Date().toISOString(),
        source: body.source || 'upload',
        label: body.label,
        annotations: body.annotations,
        reportId: body.reportId,
        storagePath,
        mimeType: parsed.mimeType,
        size: parsed.buffer.length,
      },
      { upsert: true, new: true },
    ).catch(async () => {
      // If _id format doesn't match ObjectId, use a generated one
      await Media.create({
        sessionId,
        type: mediaType,
        filename,
        capturedAt: body.capturedAt || new Date().toISOString(),
        source: body.source || 'upload',
        label: body.label,
        annotations: body.annotations,
        reportId: body.reportId,
        storagePath,
        mimeType: parsed.mimeType,
        size: parsed.buffer.length,
      });
    });

    return { success: true };
  });

  // PATCH /api/media — update metadata
  app.patch('/api/media', async (request, reply) => {
    const { sessionId, mediaId, updates } = request.body as any;
    if (!sessionId || !mediaId) return reply.status(400).send({ error: 'sessionId and mediaId required' });

    await Media.findByIdAndUpdate(mediaId, { $set: updates }).catch(() => {
      // Try by custom id field
      Media.updateOne({ sessionId, _id: mediaId }, { $set: updates }).catch(() => {});
    });

    return { success: true };
  });

  // DELETE /api/media?sessionId=xxx&mediaId=yyy
  // DELETE /api/media?sessionId=xxx&deleteAll=true
  // DELETE /api/media?clearAll=true
  app.delete('/api/media', async (request) => {
    const { sessionId, mediaId, deleteAll, clearAll } = request.query as any;

    if (clearAll === 'true') {
      const allMedia = await Media.find().lean();
      for (const m of allMedia) {
        const fp = path.join(config.mediaDir, (m as any).storagePath);
        try { await fsp.unlink(fp); } catch {}
      }
      await Media.deleteMany({});
      return { success: true };
    }

    if (!sessionId) return { success: false };

    if (deleteAll === 'true') {
      const items = await Media.find({ sessionId }).lean();
      for (const m of items) {
        const fp = path.join(config.mediaDir, (m as any).storagePath);
        try { await fsp.unlink(fp); } catch {}
      }
      await Media.deleteMany({ sessionId });
      return { success: true };
    }

    if (mediaId) {
      const item = await Media.findById(mediaId).lean().catch(() => null);
      if (item) {
        const fp = path.join(config.mediaDir, (item as any).storagePath);
        try { await fsp.unlink(fp); } catch {}
        await Media.findByIdAndDelete(mediaId);
      }
      return { success: true };
    }

    return { success: false };
  });

  // POST /api/media/blob — multipart upload (file + metadata fields)
  app.post('/api/media/blob', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file' });

    const fields: Record<string, string> = {};
    for (const [key, field] of Object.entries(data.fields)) {
      if (field && typeof field === 'object' && 'value' in field) {
        fields[key] = (field as any).value;
      }
    }

    const sessionId = fields.sessionId;
    const mediaId = fields.mediaId;
    if (!sessionId || !mediaId) return reply.status(400).send({ error: 'sessionId and mediaId required' });

    const mimeType = data.mimetype || 'application/octet-stream';
    const ext = extForMime(mimeType, data.filename);
    const sessionFolder = await getSessionFolder(sessionId, fields);
    const mediaType = (fields.type || (mimeType.startsWith('video') ? 'video' : mimeType.startsWith('image') ? 'image' : 'report')) as 'image' | 'video' | 'report';
    const sub = getSubfolder(mediaType);
    const targetDir = path.join(config.mediaDir, sessionFolder, sub);
    await fsp.mkdir(targetDir, { recursive: true });

    const storedFilename = `${mediaId}.${ext}`;
    const storagePath = path.join(sessionFolder, sub, storedFilename);
    const absolutePath = path.join(config.mediaDir, storagePath);

    const writeStream = fs.createWriteStream(absolutePath);
    await pipeline(data.file, writeStream);
    const stat = fs.statSync(absolutePath);

    // Save metadata to MongoDB
    try {
      await Media.findOneAndUpdate(
        { _id: mediaId },
        {
          _id: mediaId,
          sessionId,
          type: mediaType,
          filename: fields.filename || data.filename || storedFilename,
          capturedAt: fields.capturedAt || new Date().toISOString(),
          source: (fields.source || 'upload') as any,
          label: fields.label || undefined,
          annotations: fields.annotations || undefined,
          storagePath,
          mimeType,
          size: stat.size,
        },
        { upsert: true, new: true },
      );
    } catch {
      // If ObjectId format issue, create with auto-generated _id
      await Media.create({
        sessionId,
        type: mediaType,
        filename: fields.filename || data.filename || storedFilename,
        capturedAt: fields.capturedAt || new Date().toISOString(),
        source: (fields.source || 'upload') as any,
        label: fields.label || undefined,
        annotations: fields.annotations || undefined,
        storagePath,
        mimeType,
        size: stat.size,
      });
    }

    return { success: true, size: stat.size, storagePath };
  });

  // GET /api/media/blob?sessionId=xxx&mediaId=yyy — serve file
  app.get('/api/media/blob', async (request, reply) => {
    const { sessionId, mediaId } = request.query as { sessionId?: string; mediaId?: string };
    if (!sessionId || !mediaId) return reply.status(400).send('Missing params');

    const item = await Media.findById(mediaId).lean().catch(() => null);
    if (!item) return reply.status(404).send('Not found');

    const filePath = path.join(config.mediaDir, (item as any).storagePath);
    if (!fs.existsSync(filePath)) return reply.status(404).send('File not found');

    const stat = fs.statSync(filePath);
    reply.header('Content-Type', (item as any).mimeType);
    reply.header('Content-Length', stat.size);
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(fs.createReadStream(filePath));
  });
}
