"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addMediaItemAsync,
  deleteMediaItemAsync,
  getMediaForSessionAsync,
  updateMediaItemAsync,
  serverHasMediaForSession,
  pullMediaFromServer,
  deleteLocalMediaForSession,
  type MediaContext,
} from "@/lib/media-db";
import { MediaFile } from "@/lib/types";
import { fileToDataUrl } from "@/lib/utils";
import {
  CropConfig,
  createCroppedStream,
  drawCroppedFrame,
  loadCropConfig,
} from "@/lib/crop-config";

function detectSource(label?: string): MediaFile["source"] {
  const normalized = label?.toLowerCase() ?? "";
  if (normalized.includes("hdmi") || normalized.includes("capture"))
    return "hdmi-capture";
  return "camera";
}

async function getBestStream(deviceId: string, exact: boolean): Promise<MediaStream> {
  const resolutions = [
    { width: { min: 3840, ideal: 3840 }, height: { min: 2160, ideal: 2160 } },
    { width: { min: 1920, ideal: 1920 }, height: { min: 1080, ideal: 1080 } },
    { width: { min: 1280, ideal: 1280 }, height: { min: 720, ideal: 720 } },
  ];

  const deviceConstraint = exact ? { exact: deviceId } : { ideal: deviceId };

  for (const res of resolutions) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceConstraint,
          ...res,
          frameRate: { ideal: 60, min: 30 }
        },
        audio: false,
      });
    } catch (err) {
      console.warn(`Failed to initialize stream at ${res.width.ideal}x${res.height.ideal} (exact: ${exact}):`, err);
    }
  }

  // Fallback to ideal 1080p
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: deviceConstraint,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60 }
      },
      audio: false,
    });
  } catch (err) {
    console.warn(`Failed to initialize fallback stream at 1080p ideal (exact: ${exact}):`, err);
  }

  // Final fallback: no constraints except deviceId
  return await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: deviceConstraint,
    },
    audio: false,
  });
}

export function useVideoCapture(sessionId: string) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<MediaFile[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [serverHasData, setServerHasData] = useState(false);
  const [cropConfig, setCropConfig] = useState<CropConfig>(() =>
    loadCropConfig(sessionId),
  );
  const [mediaContext, setMediaContext] = useState<MediaContext | undefined>(
    undefined,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<{ stop: () => void } | null>(null);

  // Reload crop config when sessionId changes
  useEffect(() => {
    setCropConfig(loadCropConfig(sessionId));
  }, [sessionId]);

  useEffect(() => {
    // Wait until mediaContext is set before trying to read from local folder
    // (otherwise buildSessionFolder falls back to sessionId which is the wrong folder name)
    if (!mediaContext?.patientName) {
      // Still check server for data availability
      serverHasMediaForSession(sessionId)
        .then(setServerHasData)
        .catch(() => {});
      return;
    }
    getMediaForSessionAsync(sessionId, mediaContext)
      .then((items) => {
        setCapturedMedia(items);
        if (items.length === 0) {
          serverHasMediaForSession(sessionId)
            .then(setServerHasData)
            .catch(() => {});
        } else {
          setServerHasData(false);
        }
      })
      .catch(console.error);
  }, [sessionId, mediaContext]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const syncMedia = useCallback(async () => {
    const media = await getMediaForSessionAsync(sessionId, mediaContext);
    setCapturedMedia(media);
    setServerHasData(false);
  }, [sessionId, mediaContext]);

  const pullFromServer = useCallback(async () => {
    setIsBusy(true);
    try {
      const items = await pullMediaFromServer(sessionId, mediaContext);
      setCapturedMedia(items);
      setServerHasData(false);
      if (items.length > 0) {
        toast.success(`Loaded ${items.length} media item(s) from server.`);
      } else {
        toast.info("No media found on server.");
      }
    } catch {
      toast.error("Failed to fetch media from server.");
    } finally {
      setIsBusy(false);
    }
  }, [sessionId, mediaContext]);

  const loadDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      toast.error(
        "Media devices are not available. Ensure the page is served over HTTPS.",
      );
      return;
    }

    if (!navigator.mediaDevices.getUserMedia) {
      toast.error("getUserMedia is not supported in this browser.");
      return;
    }

    try {
      // Request camera permission — this triggers the browser permission prompt
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      permissionStream.getTracks().forEach((track) => track.stop());
    } catch (error: unknown) {
      console.error("Camera permission error:", error);
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError") {
        toast.error(
          "Camera access was denied. Please allow camera permission in your browser settings and reload.",
        );
      } else if (name === "NotFoundError") {
        toast.error(
          "No camera device found. Please connect a camera and try again.",
        );
      } else {
        toast.error(
          "Unable to access camera. Please check browser permissions.",
        );
      }
      return;
    }

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = all.filter((device) => device.kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices[0])
        setSelectedDevice((prev) => prev || videoDevices[0].deviceId);
      toast.success(`Found ${videoDevices.length} video device(s).`);
    } catch (error) {
      console.error("Device enumeration error:", error);
      toast.error("Failed to list video devices.");
    }
  }, []);

  const stopStream = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
  }, [stream]);

  const startStream = useCallback(
    async (deviceId: string) => {
      if (!deviceId) {
        toast.error("Please select a video source first.");
        return;
      }

      try {
        stopStream();
        let newStream: MediaStream;
        try {
          newStream = await getBestStream(deviceId, true);
        } catch (exactError) {
          // Device may have been disconnected or ID became stale — fall back to preferred device
          if (
            exactError instanceof DOMException &&
            exactError.name === "NotFoundError"
          ) {
            toast.warning(
              "Selected device not found. Trying an available camera...",
            );
            newStream = await getBestStream(deviceId, false);
            // Refresh device list so the UI stays in sync
            const all = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = all.filter((d) => d.kind === "videoinput");
            setDevices(videoDevices);
            const activeTrack = newStream.getVideoTracks()[0];
            const activeDeviceId = activeTrack?.getSettings().deviceId;
            if (activeDeviceId) setSelectedDevice(activeDeviceId);
          } else {
            throw exactError;
          }
        }
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          await videoRef.current.play().catch(() => undefined);
        }
        setStream(newStream);
        const track = newStream.getVideoTracks()[0];
        const settings = track?.getSettings();
        const res = settings
          ? `${settings.width}×${settings.height}`
          : "unknown";
        toast.success(`Live preview started (${res}).`);
      } catch (error) {
        console.error(error);
        toast.error("Unable to start selected video source.");
      }
    },
    [stopStream],
  );

  const captureScreenshot = useCallback(async () => {
    if (!videoRef.current || !stream) {
      toast.error("Start the live preview before taking a screenshot.");
      return null;
    }

    try {
      const canvas = document.createElement("canvas");
      const sourceW = videoRef.current.videoWidth || 1920;
      const sourceH = videoRef.current.videoHeight || 1080;

      if (cropConfig.enabled) {
        // Draw cropped (and optionally circle-masked) frame
        drawCroppedFrame(
          videoRef.current,
          canvas,
          cropConfig,
          sourceW,
          sourceH,
        );
      } else {
        canvas.width = sourceW;
        canvas.height = sourceH;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        }
      }

      const dataUrl = canvas.toDataURL("image/png");
      const device = devices.find((item) => item.deviceId === selectedDevice);
      const imageCount =
        capturedMedia.filter((m) => m.type === "image").length + 1;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const media: MediaFile = {
        id,
        sessionId,
        type: "image",
        dataUrl,
        filename: `image-${imageCount}.png`,
        source: detectSource(device?.label),
        label: `Image ${imageCount}`,
        capturedAt: new Date().toISOString(),
      };
      await addMediaItemAsync(media, mediaContext);
      await syncMedia();
      toast.success(`Image ${imageCount} saved.`);
      return media;
    } catch (error) {
      console.error(error);
      toast.error("Failed to capture screenshot.");
      return null;
    }
  }, [
    capturedMedia,
    cropConfig,
    devices,
    selectedDevice,
    sessionId,
    stream,
    syncMedia,
  ]);

  const startRecording = useCallback(() => {
    if (!stream || !videoRef.current) {
      toast.error("Start the live preview before recording.");
      return;
    }

    try {
      chunksRef.current = [];

      // If crop is enabled, build a derived stream from a canvas pipeline
      let recordingStream: MediaStream;
      if (cropConfig.enabled) {
        const track = stream.getVideoTracks()[0];
        const activeFps = track?.getSettings().frameRate || 30;
        const cropped = createCroppedStream(videoRef.current, cropConfig, activeFps);
        recordingStream = cropped.stream;
        recordingStreamRef.current = cropped;
      } else {
        recordingStream = stream;
        recordingStreamRef.current = null;
      }

      let preferredMime = 'video/webm';
      if (typeof MediaRecorder !== 'undefined') {
        const candidateMimes = [
          'video/webm;codecs=h264',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
        ];
        for (const mime of candidateMimes) {
          if (MediaRecorder.isTypeSupported(mime)) {
            preferredMime = mime;
            break;
          }
        }
      }
      const recorder = new MediaRecorder(recordingStream, {
        mimeType: preferredMime,
        videoBitsPerSecond: 25_000_000,
      });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        try {
          setIsBusy(true);
          // Stop the cropped pipeline if any
          recordingStreamRef.current?.stop();
          recordingStreamRef.current = null;

          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          chunksRef.current = []; // Free memory immediately
          const dataUrl = URL.createObjectURL(blob);
          const device = devices.find(
            (item) => item.deviceId === selectedDevice,
          );
          const videoCount =
            capturedMedia.filter((m) => m.type === "video").length + 1;
          const id =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const media: MediaFile = {
            id,
            sessionId,
            type: "video",
            dataUrl,
            filename: `video-${videoCount}.webm`,
            source: detectSource(device?.label),
            label: `Video ${videoCount}`,
            capturedAt: new Date().toISOString(),
          };
          await addMediaItemAsync(media, mediaContext);
          await syncMedia();
          toast.success(`Video ${videoCount} saved.`);
        } catch (error) {
          console.error(error);
          toast.error("Failed to save recorded video.");
        } finally {
          setIsBusy(false);
        }
      };
      // Record in 2-second chunks to keep memory pressure low
      recorder.start(2000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.success("Recording started.");
    } catch (error) {
      console.error(error);
      toast.error("Recording is not supported on this device/browser.");
    }
  }, [
    capturedMedia,
    cropConfig,
    devices,
    selectedDevice,
    sessionId,
    stream,
    syncMedia,
  ]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      setIsBusy(true);
      try {
        for (const file of list) {
          const dataUrl = await fileToDataUrl(file);
          const id =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const media: MediaFile = {
            id,
            sessionId,
            type:
              file.type.startsWith("video") ||
              file.name.match(/\.(mp4|avi|mov|webm)$/i)
                ? "video"
                : "image",
            dataUrl,
            filename: file.name,
            source: "upload",
            label: file.name,
            capturedAt: new Date().toISOString(),
          };
          await addMediaItemAsync(media, mediaContext);
        }
        await syncMedia();
        toast.success("Media uploaded successfully.");
      } catch (error) {
        console.error(error);
        toast.error("Failed to upload one or more files.");
      } finally {
        setIsBusy(false);
      }
    },
    [sessionId, syncMedia],
  );

  const updateMedia = useCallback(
    async (mediaId: string, updates: Partial<MediaFile>) => {
      try {
        await updateMediaItemAsync(mediaId, { ...updates, sessionId });
        await syncMedia();
        toast.success("Media updated.");
      } catch (error) {
        console.error(error);
        toast.error("Failed to update media item.");
      }
    },
    [syncMedia],
  );

  const deleteMedia = useCallback(
    async (mediaId: string) => {
      try {
        await deleteMediaItemAsync(mediaId, sessionId);
        await syncMedia();
        toast.success("Media deleted.");
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete media item.");
      }
    },
    [sessionId, syncMedia],
  );

  const clearLocalMedia = useCallback(async () => {
    setIsBusy(true);
    try {
      await deleteLocalMediaForSession(sessionId, mediaContext);
      setCapturedMedia([]);
      // Check if server still has data
      const hasData = await serverHasMediaForSession(sessionId);
      setServerHasData(hasData);
      toast.success("Local media cleared.");
    } catch {
      toast.error("Failed to clear local media.");
    } finally {
      setIsBusy(false);
    }
  }, [sessionId, mediaContext]);

  return {
    devices,
    selectedDevice,
    setSelectedDevice,
    stream,
    videoRef,
    isRecording,
    capturedMedia,
    isBusy,
    serverHasData,
    loadDevices,
    startStream,
    stopStream,
    captureScreenshot,
    startRecording,
    stopRecording,
    uploadFiles,
    updateMedia,
    deleteMedia,
    refreshMedia: syncMedia,
    pullFromServer,
    clearLocalMedia,
    cropConfig,
    setCropConfig,
    mediaContext,
    setMediaContext,
  };
}
