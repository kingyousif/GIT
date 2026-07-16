// Per-session crop configuration. Stored in localStorage so it persists
// across page refreshes for the same session.

export type CropShape = 'rect' | 'square' | 'circle';

export interface CropConfig {
  // All values are normalized 0..1 relative to the source video frame
  x: number;
  y: number;
  width: number;
  height: number;
  shape: CropShape;
  enabled: boolean;
}

export const DEFAULT_CROP: CropConfig = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  shape: 'rect',
  enabled: false,
};

const KEY_PREFIX = 'endo_crop_';

export function loadCropConfig(sessionId: string): CropConfig {
  if (typeof window === 'undefined') return DEFAULT_CROP;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + sessionId);
    if (!raw) return DEFAULT_CROP;
    const parsed = JSON.parse(raw) as Partial<CropConfig>;
    return { ...DEFAULT_CROP, ...parsed };
  } catch {
    return DEFAULT_CROP;
  }
}

export function saveCropConfig(sessionId: string, config: CropConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_PREFIX + sessionId, JSON.stringify(config));
  } catch {
    // ignore quota errors
  }
}

export function clearCropConfig(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + sessionId);
  } catch {
    // ignore
  }
}

/**
 * Compute pixel-space crop region for a given source frame size.
 * Enforces shape constraints (square/circle => equal width/height).
 */
export function computeCropRect(config: CropConfig, sourceWidth: number, sourceHeight: number) {
  let w = Math.max(1, Math.round(config.width * sourceWidth));
  let h = Math.max(1, Math.round(config.height * sourceHeight));
  if (config.shape === 'square' || config.shape === 'circle') {
    const side = Math.min(w, h);
    w = side;
    h = side;
  }
  const x = Math.max(0, Math.min(sourceWidth - w, Math.round(config.x * sourceWidth)));
  const y = Math.max(0, Math.min(sourceHeight - h, Math.round(config.y * sourceHeight)));
  return { x, y, width: w, height: h };
}

/**
 * Draw a video/image source onto the destination canvas, applying the crop.
 * If the shape is 'circle' the corners are masked to transparent.
 * The destination canvas is resized to the crop's pixel size.
 */
export function drawCroppedFrame(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  destination: HTMLCanvasElement,
  config: CropConfig,
  sourceWidth?: number,
  sourceHeight?: number,
) {
  const sw =
    sourceWidth ??
    (source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLImageElement
        ? source.naturalWidth
        : source.width);
  const sh =
    sourceHeight ??
    (source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLImageElement
        ? source.naturalHeight
        : source.height);

  const rect = computeCropRect(config, sw, sh);

  // Resize destination canvas to the crop pixel size
  if (destination.width !== rect.width) destination.width = rect.width;
  if (destination.height !== rect.height) destination.height = rect.height;

  const ctx = destination.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, destination.width, destination.height);

  if (config.shape === 'circle') {
    // Clip to a circle inscribed in the crop rect
    const radius = Math.min(rect.width, rect.height) / 2;
    ctx.beginPath();
    ctx.arc(rect.width / 2, rect.height / 2, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );

  ctx.restore();
}

/**
 * Build a MediaStream that produces frames cropped from the source stream.
 * Returns the new stream plus a stop() function that cleans up resources.
 */
export function createCroppedStream(
  sourceVideo: HTMLVideoElement,
  config: CropConfig,
  fps = 30,
): { stream: MediaStream; stop: () => void } {
  const canvas = document.createElement('canvas');
  let stopped = false;
  let rafId = 0;

  const draw = () => {
    if (stopped) return;
    if (sourceVideo.readyState >= 2) {
      drawCroppedFrame(sourceVideo, canvas, config);
    }
    rafId = requestAnimationFrame(draw);
  };

  // Initialize canvas to a sensible size before first draw
  const sw = sourceVideo.videoWidth || 1920;
  const sh = sourceVideo.videoHeight || 1080;
  const initialRect = computeCropRect(config, sw, sh);
  canvas.width = initialRect.width;
  canvas.height = initialRect.height;

  draw();

  const stream = canvas.captureStream(fps);
  return {
    stream,
    stop: () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
