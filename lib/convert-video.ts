import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

/**
 * Converts a WebM data URL to an MP4 Blob.
 * Runs entirely in the browser using FFmpeg WASM.
 */
export async function convertWebmToMp4(dataUrl: string): Promise<Blob> {
  const ff = await getFFmpeg();

  const response = await fetch(dataUrl);
  const webmData = await response.arrayBuffer();

  await ff.writeFile("input.webm", new Uint8Array(webmData));
  await ff.exec(["-i", "input.webm", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "output.mp4"]);

  const outputData = await ff.readFile("output.mp4");
  const mp4Blob = new Blob([outputData as BlobPart], { type: "video/mp4" });

  // Cleanup
  await ff.deleteFile("input.webm");
  await ff.deleteFile("output.mp4");

  return mp4Blob;
}
