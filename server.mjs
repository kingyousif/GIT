import { createServer as createHttpsServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { parse } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import next from 'next';

const dev = false;
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const certDir = path.join(process.cwd(), 'certificates');
const keyPath = process.env.SSL_KEY || path.join(certDir, 'localhost-key.pem');
const certPath = process.env.SSL_CERT || path.join(certDir, 'localhost.pem');

let httpsOptions = null;
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  try {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  } catch (err) {
    console.error('⚠️ Failed to read SSL certificates:', err);
  }
} else {
  console.warn(`⚠️ SSL certificate files not found at ${certPath} and ${keyPath}. Starting in HTTP mode.`);
}

app.prepare().then(() => {
  const server = httpsOptions
    ? createHttpsServer(httpsOptions, (req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      })
    : createHttpServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      });

  server.listen(port, hostname, () => {
    const protocol = httpsOptions ? 'https' : 'http';
    console.log(`▲ Next.js production server started`);
    console.log(`- Local:        ${protocol}://localhost:${port}`);
    console.log(`- Network:      ${protocol}://${hostname === '0.0.0.0' ? '172.18.1.68' : hostname}:${port}`);
  });

  const handleShutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
