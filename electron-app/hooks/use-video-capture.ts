"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addMediaItemAsync,
  deleteMediaItemAsync,
  getMediaForSessionAsync,
  updateMediaItemAsync,
} from "@/lib/media-db";
import { MediaFile } from "@/lib/types";
import { fileToDataUrl } from "@/lib/utils";

function detectSource(label?: string): MediaFile["source"] {
  const normalized = label?.toLowerCase() ?? "";
  if (normalized.includes("hdmi") || normalized.includes("capture"))
    return "hdmi-capture";
  return "camera";
}

export function useVideoCapture(sessionId: string) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<MediaFile[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    getMediaForSessionAsync(sessionId)
      .then(setCapturedMedia)
      .catch(console.error);
  }, [sessionId]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const syncMedia = useCallback(async () => {
    const media = await getMediaForSessionAsync(sessionId);
    setCapturedMedia(media);
  }, [sessionId]);

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
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId }, width: 1920, height: 1080 },
            audio: false,
          });
        } catch (exactError) {
          // Device may have been disconnected or ID became stale — fall back to preferred device
          if (
            exactError instanceof DOMException &&
            exactError.name === "NotFoundError"
          ) {
            toast.warning(
              "Selected device not found. Trying an available camera...",
            );
            newStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { ideal: deviceId },
                width: 1920,
                height: 1080,
              },
              audio: false,
            });
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
        toast.success("Live preview started.");
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
      canvas.width = videoRef.current.videoWidth || 1920;
      canvas.height = videoRef.current.videoHeight || 1080;
      canvas
        .getContext("2d")
        ?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
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
      await addMediaItemAsync(media);
      await syncMedia();
      toast.success(`Image ${imageCount} saved.`);
      return media;
    } catch (error) {
      console.error(error);
      toast.error("Failed to capture screenshot.");
      return null;
    }
  }, [capturedMedia, devices, selectedDevice, sessionId, stream, syncMedia]);

  const startRecording = useCallback(() => {
    if (!stream) {
      toast.error("Start the live preview before recording.");
      return;
    }

    try {
      chunksRef.current = [];
      const preferredMime =
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        try {
          setIsBusy(true);
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          const file = new File([blob], `recording-${Date.now()}.webm`, {
            type: "video/webm",
          });
          const dataUrl = await fileToDataUrl(file);
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
          await addMediaItemAsync(media);
          await syncMedia();
          toast.success(`Video ${videoCount} saved.`);
        } catch (error) {
          console.error(error);
          toast.error("Failed to save recorded video.");
        } finally {
          setIsBusy(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.success("Recording started.");
    } catch (error) {
      console.error(error);
      toast.error("Recording is not supported on this device/browser.");
    }
  }, [capturedMedia, devices, selectedDevice, sessionId, stream, syncMedia]);

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
          await addMediaItemAsync(media);
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
        await updateMediaItemAsync(mediaId, updates);
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
        await deleteMediaItemAsync(mediaId);
        await syncMedia();
        toast.success("Media deleted.");
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete media item.");
      }
    },
    [syncMedia],
  );

  return {
    devices,
    selectedDevice,
    setSelectedDevice,
    stream,
    videoRef,
    isRecording,
    capturedMedia,
    isBusy,
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
  };
}
