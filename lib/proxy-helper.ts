import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4001';

function logDebug(message: string) {
  try {
    const logDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'proxy_debug.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`, 'utf-8');
  } catch (err) {
    console.error('Failed to write debug log:', err);
  }
}

export async function handleProxy(request: NextRequest, subPath: string) {
  const url = new URL(request.url);
  const targetUrl = `${BACKEND_URL}${subPath}${url.search}`;
  
  logDebug(`Proxying: ${request.method} ${url.pathname}${url.search} -> ${targetUrl}`);

  const headers = new Headers();
  
  // Forward cookies
  const cookie = request.headers.get('cookie');
  if (cookie) {
    headers.set('cookie', cookie);
    logDebug(`Forwarded cookie: ${cookie.substring(0, 30)}...`);
  }
  
  // Forward Content-Type
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
    logDebug(`Forwarded content-type: ${contentType}`);
  }

  const options: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      if (contentType?.includes('multipart/form-data')) {
        options.body = await request.blob();
        logDebug(`Forwarded body size (blob): ${options.body.size} bytes`);
      } else {
        const text = await request.text();
        options.body = text;
        logDebug(`Forwarded body size (text): ${text.length} characters`);
      }
    } catch (err: any) {
      logDebug(`ERROR reading request body: ${err.message}`);
    }
  }

  try {
    const response = await fetch(targetUrl, options);
    logDebug(`Response from target: ${response.status} ${response.statusText}`);
    
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        responseHeaders.append(key, value);
        logDebug(`Received Set-Cookie: ${value.substring(0, 30)}...`);
      } else if (key.toLowerCase() === 'content-type') {
        responseHeaders.set(key, value);
      }
    });

    const body = await response.arrayBuffer();
    logDebug(`Response body size: ${body.byteLength} bytes`);
    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    logDebug(`ERROR fetching from target: ${error.message}`);
    console.error(`Proxy error for ${targetUrl}:`, error);
    return NextResponse.json({ error: 'Backend service unavailable' }, { status: 502 });
  }
}
