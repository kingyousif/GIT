"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Camera,
  CloudUpload,
  Columns2,
  Crop,
  Download,
  FileText,
  MonitorUp,
  Play,
  Printer,
  Rows2,
  RefreshCcw,
  Square,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useVideoCapture } from "@/hooks/use-video-capture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { CropSettingsDialog } from "@/components/patients/crop-settings-dialog";
import { MediaFile } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { convertWebmToMp4 } from "@/lib/convert-video";
import { saveCropConfig, type CropConfig } from "@/lib/crop-config";
import { useLocale } from "@/hooks/use-locale";
import {
  useUploadToServer,
  formatBytes,
  formatSpeed,
} from "@/hooks/use-upload-to-server";

export function MediaCapturePanel({
  sessionId,
  patientName,
  patientCode,
  procedureType,
  scheduledAt,
  onMediaChanged,
  onOpenPrint,
}: {
  sessionId: string;
  patientName?: string;
  patientCode?: string;
  procedureType?: string;
  scheduledAt?: string;
  onMediaChanged?: () => void;
  onOpenPrint?: () => void;
}) {
  const { t, dir } = useLocale();
  const [layout, setLayout] = useState<"split" | "stacked">("split");
  const [splitPercent, setSplitPercent] = useState(55);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const {
    devices,
    selectedDevice,
    setSelectedDevice,
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
    pullFromServer,
    clearLocalMedia,
    cropConfig,
    setCropConfig,
    setMediaContext,
  } = useVideoCapture(sessionId);

  // Set media context so local folder uses the same organized structure as the backend
  useEffect(() => {
    setMediaContext({ patientName, patientCode, procedureType, scheduledAt });
  }, [patientName, patientCode, procedureType, scheduledAt, setMediaContext]);

  const { progress, uploadMedia } = useUploadToServer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaFile | null>(null);
  const [reportPreview, setReportPreview] = useState<MediaFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftAnnotations, setDraftAnnotations] = useState("");
  const [dragging, setDragging] = useState(false);
  const [sortBy, setSortBy] = useState<"type" | "date" | "name">("type");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [videoFit, setVideoFit] = useState<"contain" | "cover" | "fill">(
    "contain",
  );
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  const handleSaveCrop = useCallback(
    (config: CropConfig) => {
      setCropConfig(config);
      saveCropConfig(sessionId, config);
      toast.success(
        config.enabled
          ? "Crop settings applied. New captures will be cropped."
          : "Crop disabled.",
      );
    },
    [sessionId, setCropConfig],
  );

  const sortedMedia = useMemo(() => {
    const sorted = [...capturedMedia];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "type") {
        // images first, then videos
        cmp = a.type.localeCompare(b.type);
        if (cmp === 0) {
          cmp =
            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
        }
      } else if (sortBy === "date") {
        cmp =
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
      } else {
        cmp = (a.label || a.filename).localeCompare(b.label || b.filename);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [capturedMedia, sortBy, sortDir]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const onMediaChangedRef = useRef(onMediaChanged);
  useEffect(() => {
    onMediaChangedRef.current = onMediaChanged;
  });

  const prevMediaRef = useRef(capturedMedia);
  useEffect(() => {
    if (prevMediaRef.current !== capturedMedia) {
      prevMediaRef.current = capturedMedia;
      onMediaChangedRef.current?.();
    }
  }, [capturedMedia]);

  useEffect(() => {
    if (previewMedia) {
      setDraftLabel(previewMedia.label ?? "");
      setDraftAnnotations(previewMedia.annotations ?? "");
    }
  }, [previewMedia]);

  // Drag resize handler for split view
  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current || !splitContainerRef.current) return;
        const rect = splitContainerRef.current.getBoundingClientRect();
        const x =
          dir === "rtl" ? rect.right - ev.clientX : ev.clientX - rect.left;
        const percent = Math.min(80, Math.max(20, (x / rect.width) * 100));
        setSplitPercent(percent);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [dir],
  );

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer.files;
    if (!files.length) return;
    await uploadFiles(files);
  };

  const [isConverting, setIsConverting] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<MediaFile | null>(null);

  const handleDownload = async (item: MediaFile, format: "mp4" | "webm") => {
    setDownloadTarget(null);
    if (format === "mp4" && item.filename.endsWith(".webm")) {
      try {
        setIsConverting(true);
        toast.info("Converting to MP4... This may take a moment.");
        const mp4Blob = await convertWebmToMp4(item.dataUrl);
        const url = URL.createObjectURL(mp4Blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = item.filename.replace(/\.webm$/, ".mp4");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("MP4 download started.");
      } catch (error) {
        console.error("Conversion failed:", error);
        toast.error("Failed to convert video. Downloading original WebM.");
        const link = document.createElement("a");
        link.href = item.dataUrl;
        link.download = item.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } finally {
        setIsConverting(false);
      }
    } else {
      const link = document.createElement("a");
      link.href = item.dataUrl;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadClick = (item: MediaFile) => {
    if (item.type === "video" && item.filename.endsWith(".webm")) {
      setDownloadTarget(item);
    } else {
      // Images or non-webm files download directly
      const link = document.createElement("a");
      link.href = item.dataUrl;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Keyboard shortcuts: A = screenshot, B = start recording, C = stop recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas/editors/selects
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          captureScreenshot();
          break;
        case "b":
          e.preventDefault();
          startRecording();
          break;
        case "c":
          e.preventDefault();
          stopRecording();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [captureScreenshot, startRecording, stopRecording]);

  return (
    <div className="space-y-4">
      {/* Layout toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={layout === "stacked" ? "default" : "outline"}
          size="sm"
          onClick={() => setLayout("stacked")}
          title="Stacked view"
        >
          <Rows2 className="h-4 w-4" />
        </Button>
        <Button
          variant={layout === "split" ? "default" : "outline"}
          size="sm"
          onClick={() => setLayout("split")}
          title="Split view"
        >
          <Columns2 className="h-4 w-4" />
        </Button>
      </div>

      {layout === "split" ? (
        /* ===== SPLIT VIEW ===== */
        <div
          ref={splitContainerRef}
          className="flex h-[calc(100vh-200px)] min-h-[500px] gap-0 overflow-hidden rounded-2xl border border-card-border"
        >
          {/* Left panel: Live video + controls */}
          <div
            className="flex flex-col overflow-y-auto"
            style={{ width: `${splitPercent}%` }}
          >
            <div className="flex-1 space-y-4 p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="space-y-2">
                  <Label>{t.media.selectSource}</Label>
                  <Select
                    value={selectedDevice}
                    onValueChange={setSelectedDevice}
                  >
                    {devices.length === 0 ? (
                      <SelectItem value="">{t.media.noDevices}</SelectItem>
                    ) : null}
                    {devices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Camera ${device.deviceId.slice(0, 5)}`}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadDevices()}
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => startStream(selectedDevice)}
                    disabled={!selectedDevice}
                  >
                    <Play className="h-4 w-4" /> {t.media.start}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => stopStream()}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-card-border bg-slate-950 dark:bg-black/40">
                <div className="relative aspect-video w-full">
                  <video
                    ref={videoRef}
                    className={cn(
                      "h-full w-full",
                      videoFit === "contain"
                        ? "object-contain"
                        : videoFit === "cover"
                          ? "object-cover"
                          : "object-fill",
                    )}
                    autoPlay
                    muted
                    playsInline
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => captureScreenshot()}
                  disabled={isBusy}
                >
                  <Camera className="h-4 w-4" /> {t.media.screenshot}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startRecording()}
                  disabled={isRecording || isBusy}
                >
                  <Video className="h-4 w-4" /> {t.media.recordVideo}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => stopRecording()}
                  disabled={!isRecording}
                >
                  <Square className="h-4 w-4" /> {t.media.stopRec}
                </Button>
                <Button
                  variant={cropConfig.enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCropDialogOpen(true)}
                  className={cn(
                    "ms-auto",
                    cropConfig.enabled && "bg-primary/90",
                  )}
                  title={t.media.cropEditButton}
                >
                  <Crop className="h-4 w-4" /> {t.media.cropEditButton}
                  {cropConfig.enabled && (
                    <span className="ms-1 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold capitalize">
                      {cropConfig.shape}
                    </span>
                  )}
                </Button>
              </div>
              {isRecording && (
                <p className="animate-pulse text-sm text-rose-500">
                  {t.media.recording}
                </p>
              )}
            </div>
          </div>

          {/* Draggable divider */}
          <div
            className="flex w-2 cursor-col-resize items-center justify-center bg-muted hover:bg-primary/20 transition-colors"
            onMouseDown={handleDividerMouseDown}
          >
            <div className="h-8 w-0.5 rounded-full bg-muted-foreground/40" />
          </div>

          {/* Right panel: Captured media */}
          <div
            className="flex flex-col overflow-y-auto"
            style={{ width: `${100 - splitPercent}%` }}
          >
            <div className="flex-1 space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  {t.media.capturedMedia}
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => uploadMedia(capturedMedia, { patientName, patientCode, procedureType, scheduledAt })}
                    disabled={progress.isUploading || capturedMedia.length === 0}
                  >
                    <CloudUpload className="h-4 w-4" />
                    {progress.isUploading
                      ? t.media.uploading
                      : t.media.uploadToServer}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearLocalMedia()}
                    disabled={isBusy || capturedMedia.length === 0}
                    title="Clear local cache and re-fetch from server"
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              </div>

              {progress.isUploading && (
                <div className="rounded-xl border border-card-border bg-muted p-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      {progress.uploadedFiles}/{progress.totalFiles}
                    </span>
                    <span>{formatSpeed(progress.speed)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-card-border">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${progress.totalBytes > 0 ? (progress.uploadedBytes / progress.totalBytes) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {capturedMedia.length === 0 && serverHasData ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center text-sm">
                  <p className="font-medium">{t.media.serverHasData}</p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={pullFromServer}
                    disabled={isBusy}
                  >
                    {isBusy ? t.common.loading : t.media.fetchFromServer}
                  </Button>
                </div>
              ) : capturedMedia.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t.media.noMedia}
                </p>
              ) : (
                <div className="grid gap-3 grid-cols-2">
                  {sortedMedia.map((item) => (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-xl border border-card-border bg-card"
                    >
                      <button
                        type="button"
                        className="block w-full"
                        onClick={() =>
                          item.type === "report"
                            ? setReportPreview(item)
                            : setPreviewMedia(item)
                        }
                      >
                        <div className="aspect-video overflow-hidden bg-muted">
                          {item.type === "image" ? (
                            <img
                              src={item.dataUrl}
                              alt={item.label || item.filename}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : item.type === "video" ? (
                            <video
                              src={item.dataUrl}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary">
                              <FileText className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                      </button>
                      <div className="p-2">
                        <p className="truncate text-xs font-medium">
                          {item.label || item.filename}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDateTime(item.capturedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ===== STACKED VIEW (original) ===== */
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.media.liveVideoFeed}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="space-y-2">
                  <Label>{t.media.selectSource}</Label>
                  <Select
                    value={selectedDevice}
                    onValueChange={setSelectedDevice}
                  >
                    {devices.length === 0 ? (
                      <SelectItem value="">{t.media.noDevices}</SelectItem>
                    ) : null}
                    {devices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Camera ${device.deviceId.slice(0, 5)}`}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => loadDevices()}>
                    <RefreshCcw className="h-4 w-4" /> {t.media.refreshDevices}
                  </Button>
                  <Button
                    onClick={() => startStream(selectedDevice)}
                    disabled={!selectedDevice}
                  >
                    <Play className="h-4 w-4" /> {t.media.start}
                  </Button>
                  <Button variant="outline" onClick={() => stopStream()}>
                    <Square className="h-4 w-4" /> {t.media.stop}
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-card-border bg-slate-950 p-4 text-white dark:bg-black/40">
                <div className="mb-2 flex items-center gap-1">
                  <span className="text-xs text-white/50 me-2">Fit:</span>
                  <button
                    type="button"
                    onClick={() => setVideoFit("contain")}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${videoFit === "contain" ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                  >
                    Contain
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoFit("cover")}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${videoFit === "cover" ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                  >
                    Cover
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoFit("fill")}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${videoFit === "fill" ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                  >
                    Fill
                  </button>
                </div>
                <div
                  className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 dark:bg-black/60 resize min-h-[150px] min-w-[200px] max-h-full max-w-full"
                  style={{ height: "360px", width: "100%" }}
                >
                  <video
                    ref={videoRef}
                    className={cn(
                      "h-full w-full",
                      videoFit === "contain"
                        ? "object-contain"
                        : videoFit === "cover"
                          ? "object-cover"
                          : "object-fill",
                    )}
                    autoPlay
                    muted
                    playsInline
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => captureScreenshot()} disabled={isBusy}>
                    <Camera className="h-4 w-4" /> {t.media.screenshot}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => startRecording()}
                    disabled={isRecording || isBusy}
                  >
                    <Video className="h-4 w-4" /> {t.media.recordVideo}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => stopRecording()}
                    disabled={!isRecording}
                  >
                    <Square className="h-4 w-4" /> {t.media.stopRec}
                  </Button>
                  <Button
                    variant={cropConfig.enabled ? "default" : "outline"}
                    onClick={() => setCropDialogOpen(true)}
                    className={cn(
                      "ms-auto",
                      !cropConfig.enabled &&
                        "border-white/20 bg-white/10 text-white hover:bg-white/15",
                    )}
                  >
                    <Crop className="h-4 w-4" /> {t.media.cropEditButton}
                    {cropConfig.enabled && (
                      <span className="ms-1 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold capitalize">
                        {cropConfig.shape}
                      </span>
                    )}
                  </Button>
                </div>
                {isRecording ? (
                  <p className="mt-3 animate-pulse text-sm text-rose-300">
                    {t.media.recording}
                  </p>
                ) : null}
              </div>

              <div
                className="relative rounded-2xl border-2 border-dashed border-card-border bg-muted p-6 text-center transition hover:border-primary hover:bg-primary/5"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div
                  className={
                    dragging
                      ? "rounded-xl border border-primary/30 bg-primary/5 p-3"
                      : undefined
                  }
                >
                  <MonitorUp className="mx-auto mb-3 h-8 w-8 text-primary" />
                  <p className="font-medium text-foreground">
                    {t.media.uploadFromUsb}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.media.dragDrop}
                  </p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> {t.media.browseFiles}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,video/mp4,video/webm,video/avi,video/quicktime"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files) uploadFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.media.capturedMedia}</CardTitle>
            </CardHeader>
            <CardContent>
              {capturedMedia.length === 0 && serverHasData ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
                  <p className="font-medium text-foreground">
                    {t.media.serverHasData}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.media.serverHasDataDesc}
                  </p>
                  <div className="mt-4 flex justify-center gap-3">
                    <Button onClick={pullFromServer} disabled={isBusy}>
                      {isBusy ? t.common.loading : t.media.fetchFromServer}
                    </Button>
                  </div>
                </div>
              ) : capturedMedia.length === 0 ? (
                <EmptyState
                  icon={<Camera className="h-8 w-8" />}
                  title={t.media.noMedia}
                  description={t.media.noMediaDesc}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t.media.sortBy}
                    </span>
                    <Button
                      variant={sortBy === "type" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSortBy("type")}
                    >
                      Type
                    </Button>
                    <Button
                      variant={sortBy === "date" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSortBy("date")}
                    >
                      Date
                    </Button>
                    <Button
                      variant={sortBy === "name" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSortBy("name")}
                    >
                      Name
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                      }
                      title={
                        sortDir === "asc"
                          ? t.media.ascending
                          : t.media.descending
                      }
                    >
                      {sortDir === "asc" ? (
                        <ArrowDownAZ className="h-4 w-4" />
                      ) : (
                        <ArrowUpAZ className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Upload to Server button + Clear local + progress */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => uploadMedia(capturedMedia, { patientName, patientCode, procedureType, scheduledAt })}
                        disabled={
                          progress.isUploading || capturedMedia.length === 0
                        }
                      >
                        <CloudUpload className="h-4 w-4" />
                        {progress.isUploading
                          ? t.media.uploading
                          : t.media.uploadToServer}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => clearLocalMedia()}
                        disabled={isBusy || capturedMedia.length === 0}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <Trash2 className="h-4 w-4" /> Clear Local
                      </Button>
                    </div>
                    {progress.isUploading && (
                      <div className="rounded-xl border border-card-border bg-muted p-3 text-sm">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {progress.uploadedFiles}/{progress.totalFiles} files
                          </span>
                          <span>{formatSpeed(progress.speed)}</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-card-border">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${progress.totalBytes > 0 ? (progress.uploadedBytes / progress.totalBytes) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {formatBytes(progress.uploadedBytes)} /{" "}
                            {formatBytes(progress.totalBytes)}
                          </span>
                          <span>{progress.currentFile}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {sortedMedia.map((item) => (
                      <div
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-card-border bg-card transition hover:shadow-soft"
                      >
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() =>
                            item.type === "report"
                              ? setReportPreview(item)
                              : setPreviewMedia(item)
                          }
                        >
                          <div className="aspect-video overflow-hidden bg-muted">
                            {item.type === "image" ? (
                              <img
                                src={item.dataUrl}
                                alt={item.label || item.filename}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : item.type === "video" ? (
                              <video
                                src={item.dataUrl}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                                <FileText className="h-10 w-10" />
                                <span className="text-xs font-medium uppercase tracking-wider">
                                  Report
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="line-clamp-1 font-medium text-foreground">
                                {item.label || item.filename}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(item.capturedAt)}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadClick(item)}
                                disabled={isConverting}
                                title="Download"
                              >
                                <Download className="h-4 w-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(item)}
                              >
                                <Trash2 className="h-4 w-4 text-rose-500" />
                              </Button>
                            </div>
                          </div>
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {item.annotations || t.media.noAnnotations}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        open={Boolean(previewMedia)}
        onOpenChange={(open) => !open && setPreviewMedia(null)}
      >
        <DialogContent className="max-w-4xl">
          {previewMedia ? (
            <>
              <DialogHeader>
                <DialogTitle>{t.media.previewAnnotation}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="overflow-hidden rounded-2xl border border-card-border bg-muted">
                  {previewMedia.type === "image" ? (
                    <img
                      src={previewMedia.dataUrl}
                      alt={previewMedia.label || previewMedia.filename}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <video
                      src={previewMedia.dataUrl}
                      controls
                      className="h-full w-full"
                    />
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.media.label}</Label>
                    <Input
                      value={draftLabel}
                      onChange={(event) => setDraftLabel(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.media.annotations}</Label>
                    <Textarea
                      value={draftAnnotations}
                      onChange={(event) =>
                        setDraftAnnotations(event.target.value)
                      }
                    />
                  </div>
                  <div className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        {t.media.filename}:
                      </span>{" "}
                      {previewMedia.filename}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        {t.media.source}:
                      </span>{" "}
                      {previewMedia.source}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        {t.media.captured}:
                      </span>{" "}
                      {formatDateTime(previewMedia.capturedAt)}
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewMedia(null)}>
                  {t.common.close}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadClick(previewMedia)}
                  disabled={isConverting}
                >
                  <Download className="h-4 w-4" />{" "}
                  {isConverting ? t.media.converting : t.common.download}
                </Button>
                <Button
                  onClick={() => {
                    updateMedia(previewMedia.id, {
                      label: draftLabel,
                      annotations: draftAnnotations,
                    });
                    toast.success("Annotation saved.");
                    setPreviewMedia({
                      ...previewMedia,
                      label: draftLabel,
                      annotations: draftAnnotations,
                    });
                  }}
                >
                  {t.media.saveChanges}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reportPreview)}
        onOpenChange={(open) => !open && setReportPreview(null)}
      >
        <DialogContent className="max-w-4xl">
          {reportPreview ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {reportPreview.label || reportPreview.filename}
                </DialogTitle>
              </DialogHeader>
              <div className="rounded-xl border border-card-border bg-white p-4 text-slate-900">
                <iframe
                  srcDoc={`<html><head><style>
                    body { font-family: 'IBM Plex Sans', system-ui, sans-serif; font-size: 12px; color: #0f172a; padding: 12px; margin: 0; }
                    .print-header { padding-bottom: 12px; border-bottom: 2px solid #0f766e; margin-bottom: 14px; }
                    .header-row { display: flex; justify-content: space-between; gap: 16px; }
                    .hospital-info { display: flex; align-items: center; gap: 12px; }
                    .hospital-logo { width: 48px; height: 48px; border-radius: 8px; background: #f0fdfa; display: flex; align-items: center; justify-content: center; font-size: 24px; }
                    .hospital-logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; }
                    .hospital-name { font-size: 15px; font-weight: 700; }
                    .hospital-dept, .hospital-addr { font-size: 11px; color: #64748b; }
                    .report-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
                    .report-status { font-size: 10px; color: #64748b; }
                    .patient-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
                    .info-cell-label { font-size: 9px; font-weight: 600; text-transform: uppercase; color: #64748b; }
                    .info-cell-value { font-size: 11px; font-weight: 500; }
                    .section { margin-bottom: 10px; }
                    .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #475569; margin-bottom: 2px; }
                    .section-text p { margin: 0 0 4px 0; }
                    .section-text h1 { font-size: 14px; font-weight: 700; margin: 6px 0 3px; }
                    .section-text h2 { font-size: 12px; font-weight: 700; margin: 5px 0 3px; }
                    .section-text h3 { font-size: 11.5px; font-weight: 600; margin: 4px 0 2px; }
                    .section-text ul, .section-text ol { padding-left: 16px; margin: 3px 0; }
                    .section-text ul { list-style: disc; }
                    .section-text ol { list-style: decimal; }
                    .section-text blockquote { border-left: 2px solid #cbd5e1; padding-left: 8px; margin: 4px 0; font-style: italic; color: #475569; }
                    .section-text mark { background: #fef08a; padding: 0 2px; }
                    .section-list { padding-left: 16px; }
                    .signature-line { width: 180px; border-top: 1px solid #64748b; padding-top: 6px; text-align: center; font-size: 11px; }
                    .signature-block { display: flex; justify-content: flex-end; margin-bottom: 16px; }
                    .signature-label { font-size: 9px; color: #64748b; }
                    .footer-text { font-size: 9px; color: #64748b; }
                    .print-footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
                  </style></head><body>${decodeURIComponent(reportPreview.dataUrl.replace(/^data:text\/html;charset=utf-8,/, ""))}</body></html>`}
                  className="h-[60vh] w-full rounded-md border border-card-border bg-white"
                  title="Report preview"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {t.media.reportPreviewHint}
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setReportPreview(null)}
                >
                  {t.common.close}
                </Button>
                <Button
                  onClick={() => {
                    setReportPreview(null);
                    onOpenPrint?.();
                  }}
                >
                  <Printer className="h-4 w-4" /> {t.reportBuilder.printReport}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.media.deleteMedia}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.media.deleteMediaDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return;
                deleteMedia(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {t.common.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(downloadTarget)}
        onOpenChange={(open) => !open && setDownloadTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.media.chooseFormat}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t.media.chooseFormatDesc}
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={() =>
                downloadTarget && handleDownload(downloadTarget, "mp4")
              }
              disabled={isConverting}
            >
              {isConverting ? t.media.converting : "MP4"}
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() =>
                downloadTarget && handleDownload(downloadTarget, "webm")
              }
              disabled={isConverting}
            >
              {t.media.webmOriginal}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CropSettingsDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        liveVideo={videoRef.current}
        initialConfig={cropConfig}
        onSave={handleSaveCrop}
      />
    </div>
  );
}
