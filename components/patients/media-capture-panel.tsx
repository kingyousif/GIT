"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Camera,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Columns2,
  Crop,
  Download,
  Eye,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  MonitorUp,
  Play,
  Plus,
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
    markItemSynced,
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

  const { progress, uploadingIds, uploadMedia, uploadSingleMedia } = useUploadToServer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaFile | null>(null);
  const [reportPreview, setReportPreview] = useState<MediaFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftAnnotations, setDraftAnnotations] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [autoSaveToServer, setAutoSaveToServer] = useState(true);
  const [sortBy, setSortBy] = useState<"type" | "date" | "name">("type");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [videoFit, setVideoFit] = useState<"contain" | "cover" | "fill">(
    "contain",
  );
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      await uploadFiles(files, autoSaveToServer);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onMediaChanged?.();
    },
    [uploadFiles, autoSaveToServer, onMediaChanged],
  );

  const handleDropFiles = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      await uploadFiles(files, autoSaveToServer);
      onMediaChanged?.();
    },
    [uploadFiles, autoSaveToServer, onMediaChanged],
  );

  const handleUploadAll = useCallback(async () => {
    const res = await uploadMedia(
      capturedMedia,
      { patientName, patientCode, procedureType, scheduledAt },
      (syncedItem) => {
        markItemSynced(syncedItem.id, syncedItem);
      }
    );
    if (res.success) {
      onMediaChanged?.();
    }
  }, [capturedMedia, uploadMedia, patientName, patientCode, procedureType, scheduledAt, markItemSynced, onMediaChanged]);

  const handleUploadSingle = useCallback(
    async (item: MediaFile) => {
      await uploadSingleMedia(
        item,
        { patientName, patientCode, procedureType, scheduledAt },
        (syncedItem) => {
          markItemSynced(syncedItem.id, syncedItem);
          if (previewMedia?.id === syncedItem.id) {
            setPreviewMedia(syncedItem);
          }
          onMediaChanged?.();
        }
      );
    },
    [uploadSingleMedia, patientName, patientCode, procedureType, scheduledAt, markItemSynced, previewMedia, onMediaChanged],
  );

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
    <div
      className="relative space-y-4"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragOver(false);
      }}
      onDrop={handleDropFiles}
    >
      {/* Hidden file input for importing image or video */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/90 p-6 backdrop-blur-md animate-in fade-in-50 duration-200 shadow-2xl">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary shadow-inner animate-bounce">
            <Upload className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Drop Images or Videos Here</h3>
          <p className="mt-1.5 max-w-md text-center text-sm text-muted-foreground">
            Files will be imported immediately into this session and {autoSaveToServer ? "saved to the main server" : "stored locally"}.
          </p>
          <div className="mt-4 flex items-center gap-2.5 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1 rounded-full bg-muted/80 px-3 py-1 shadow-sm">
              <ImageIcon className="h-3.5 w-3.5 text-blue-500" /> JPG, PNG, WEBP, GIF
            </span>
            <span className="flex items-center gap-1 rounded-full bg-muted/80 px-3 py-1 shadow-sm">
              <Video className="h-3.5 w-3.5 text-purple-500" /> MP4, WEBM, MOV, MKV
            </span>
          </div>
        </div>
      )}

      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-card-border/80 bg-card/60 p-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Layout buttons */}
          <div className="flex items-center rounded-lg border border-card-border bg-muted/40 p-0.5">
            <Button
              variant={layout === "stacked" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2.5"
              onClick={() => setLayout("stacked")}
              title="Stacked view"
            >
              <Rows2 className="h-4 w-4" />
            </Button>
            <Button
              variant={layout === "split" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2.5"
              onClick={() => setLayout("split")}
              title="Split view"
            >
              <Columns2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Auto-save to Server toggle */}
          <Button
            variant={autoSaveToServer ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              const next = !autoSaveToServer;
              setAutoSaveToServer(next);
              toast.info(next ? "Auto-save to server enabled" : "Auto-save to server disabled");
            }}
            className={cn(
              "h-8 gap-1.5 text-xs transition-colors",
              autoSaveToServer && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
            )}
            title="When active, newly added media or captures are immediately saved to the main server."
          >
            <Cloud className={cn("h-3.5 w-3.5", autoSaveToServer ? "text-emerald-500" : "text-muted-foreground")} />
            <span>Auto-Save to Server: <strong>{autoSaveToServer ? "ON" : "OFF"}</strong></span>
          </Button>
        </div>

        {/* Add Media Action Button */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 shadow-sm font-medium"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
          >
            <Plus className="h-4 w-4" />
            <span>Add Media (Image/Video)</span>
          </Button>
        </div>
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
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {t.media.capturedMedia}
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                    {capturedMedia.length}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                    className="gap-1 shadow-xs text-xs h-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUploadAll}
                    disabled={progress.isUploading || capturedMedia.length === 0}
                    className="gap-1 text-xs h-8"
                  >
                    {progress.isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <CloudUpload className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span>{progress.isUploading ? t.media.uploading : t.media.uploadToServer}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearLocalMedia()}
                    disabled={isBusy || capturedMedia.length === 0}
                    title="Clear local cache and re-fetch from server"
                    className="h-8 px-2"
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              </div>

              {progress.isUploading && (
                <div className="rounded-xl border border-card-border bg-muted p-2.5 text-xs shadow-xs">
                  <div className="flex justify-between text-muted-foreground font-medium">
                    <span>
                      Uploading {progress.uploadedFiles}/{progress.totalFiles} ({progress.currentFile})
                    </span>
                    <span>{formatSpeed(progress.speed)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-card-border">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
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
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-card-border/80 bg-muted/20 p-8 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Add Images or Videos</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-[200px]">
                    Click to browse files or drag & drop directly here
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-0.5">JPG, PNG, WEBP</span>
                    <span className="rounded-md bg-muted px-2 py-0.5">MP4, WEBM, MOV</span>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-2">
                  {sortedMedia.map((item) => (
                    <div
                      key={item.id}
                      className="group relative overflow-hidden rounded-xl border border-card-border bg-card shadow-xs transition hover:shadow-md hover:border-primary/40"
                    >
                      {/* Thumbnail button */}
                      <button
                        type="button"
                        className="relative block w-full text-left"
                        onClick={() =>
                          item.type === "report"
                            ? setReportPreview(item)
                            : setPreviewMedia(item)
                        }
                      >
                        <div className="aspect-video overflow-hidden bg-muted relative">
                          {item.type === "image" ? (
                            <img
                              src={item.dataUrl}
                              alt={item.label || item.filename}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-200"
                              loading="lazy"
                            />
                          ) : item.type === "video" ? (
                            <div className="relative h-full w-full">
                              <video
                                src={item.dataUrl}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors">
                                <div className="rounded-full bg-background/80 p-1.5 backdrop-blur-xs shadow-xs">
                                  <Play className="h-3.5 w-3.5 text-primary fill-primary" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary">
                              <FileText className="h-6 w-6" />
                            </div>
                          )}

                          {/* Type tag */}
                          <div className="absolute top-1 left-1">
                            {item.type === "video" ? (
                              <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-semibold bg-purple-700/90 text-white shadow-xs">
                                <Video className="h-2.5 w-2.5" /> Video
                              </span>
                            ) : item.type === "image" ? (
                              <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-semibold bg-blue-700/90 text-white shadow-xs">
                                <Camera className="h-2.5 w-2.5" /> Image
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-semibold bg-emerald-700/90 text-white shadow-xs">
                                <FileText className="h-2.5 w-2.5" /> Report
                              </span>
                            )}
                          </div>

                          {/* Server Sync badge */}
                          <div className="absolute top-1 right-1">
                            {item.isSynced ? (
                              <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-medium bg-emerald-700/90 text-white shadow-xs" title="Saved on main server">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Server
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-medium bg-amber-600/90 text-white shadow-xs" title="Local only">
                                <HardDrive className="h-2.5 w-2.5" /> Local
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Card Content & Action Buttons */}
                      <div className="p-2 space-y-1">
                        <p className="truncate text-xs font-medium text-foreground" title={item.label || item.filename}>
                          {item.label || item.filename}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{formatDateTime(item.capturedAt)}</span>
                          {item.size ? <span>{formatBytes(item.size)}</span> : null}
                        </div>

                        {/* Quick action bar */}
                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-card-border/50">
                          {!item.isSynced && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-primary hover:bg-primary/10"
                              onClick={() => handleUploadSingle(item)}
                              disabled={uploadingIds.includes(item.id)}
                              title="Save to main server"
                            >
                              {uploadingIds.includes(item.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CloudUpload className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => item.type === "report" ? setReportPreview(item) : setPreviewMedia(item)}
                            title="Preview"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => handleDownloadClick(item)}
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-rose-500"
                            onClick={() => setDeleteTarget(item)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-card-border/80 bg-muted/20 p-6 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {t.media.uploadFromUsb}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.media.dragDrop}
                </p>
                <Button
                  className="mt-3 gap-1.5 shadow-xs"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Plus className="h-4 w-4" /> Add Image or Video
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <CardTitle>{t.media.capturedMedia}</CardTitle>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground font-medium">
                  {capturedMedia.length}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                  className="gap-1.5 shadow-xs text-xs h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Media</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUploadAll}
                  disabled={progress.isUploading || capturedMedia.length === 0}
                  className="gap-1.5 text-xs h-8"
                >
                  {progress.isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <CloudUpload className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>{progress.isUploading ? t.media.uploading : t.media.uploadToServer}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearLocalMedia()}
                  disabled={isBusy || capturedMedia.length === 0}
                  title="Clear local cache and re-fetch from server"
                  className="h-8 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
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
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-card-border/80 bg-muted/20 p-8 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Add Images or Videos</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-[220px]">
                    Click to browse files or drag & drop directly into this session
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-0.5">JPG, PNG, WEBP</span>
                    <span className="rounded-md bg-muted px-2 py-0.5">MP4, WEBM, MOV</span>
                  </div>
                </div>
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
                          className="h-full rounded-full bg-primary transition-all duration-300"
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

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {sortedMedia.map((item) => (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-2xl border border-card-border bg-card shadow-xs transition hover:shadow-md hover:border-primary/40"
                      >
                        <button
                          type="button"
                          className="relative block w-full text-left"
                          onClick={() =>
                            item.type === "report"
                              ? setReportPreview(item)
                              : setPreviewMedia(item)
                          }
                        >
                          <div className="aspect-video overflow-hidden bg-muted relative">
                            {item.type === "image" ? (
                              <img
                                src={item.dataUrl}
                                alt={item.label || item.filename}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-200"
                                loading="lazy"
                              />
                            ) : item.type === "video" ? (
                              <div className="relative h-full w-full">
                                <video
                                  src={item.dataUrl}
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors">
                                  <div className="rounded-full bg-background/80 p-2 backdrop-blur-xs shadow-xs">
                                    <Play className="h-4 w-4 text-primary fill-primary" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                                <FileText className="h-10 w-10" />
                                <span className="text-xs font-medium uppercase tracking-wider">
                                  Report
                                </span>
                              </div>
                            )}

                            {/* Type tag */}
                            <div className="absolute top-2 left-2">
                              {item.type === "video" ? (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-purple-700/90 text-white shadow-xs">
                                  <Video className="h-3 w-3" /> Video
                                </span>
                              ) : item.type === "image" ? (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-700/90 text-white shadow-xs">
                                  <Camera className="h-3 w-3" /> Image
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-700/90 text-white shadow-xs">
                                  <FileText className="h-3 w-3" /> Report
                                </span>
                              )}
                            </div>

                            {/* Server Sync badge */}
                            <div className="absolute top-2 right-2">
                              {item.isSynced ? (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-700/90 text-white shadow-xs" title="Saved on main server">
                                  <CheckCircle2 className="h-3 w-3" /> Server
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-600/90 text-white shadow-xs" title="Local only">
                                  <HardDrive className="h-3 w-3" /> Local
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-foreground text-sm" title={item.label || item.filename}>
                                {item.label || item.filename}
                              </p>
                              <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                                <span>{formatDateTime(item.capturedAt)}</span>
                                {item.size ? <span>{formatBytes(item.size)}</span> : null}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {!item.isSynced && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleUploadSingle(item)}
                                  disabled={uploadingIds.includes(item.id)}
                                  title="Save to main server"
                                  className="text-primary hover:bg-primary/10"
                                >
                                  {uploadingIds.includes(item.id) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CloudUpload className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
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
                          {item.annotations ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {item.annotations}
                            </p>
                          ) : null}
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
                  <div className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground space-y-2">
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
                    {previewMedia.size ? (
                      <p>
                        <span className="font-medium text-foreground">Size:</span>{" "}
                        {formatBytes(previewMedia.size)}
                      </p>
                    ) : null}
                    <div className="pt-1 flex items-center gap-2">
                      <span className="font-medium text-foreground">Server Storage:</span>
                      {previewMedia.isSynced ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Saved on Server
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <HardDrive className="h-3.5 w-3.5" /> Local Only (Unsaved)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2 sm:gap-0">
                {!previewMedia.isSynced && (
                  <Button
                    variant="default"
                    className="gap-1.5 me-auto"
                    onClick={() => handleUploadSingle(previewMedia)}
                    disabled={uploadingIds.includes(previewMedia.id)}
                  >
                    {uploadingIds.includes(previewMedia.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CloudUpload className="h-4 w-4" />
                    )}
                    Save to Server
                  </Button>
                )}
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
                    .section { margin-top: 14px; margin-bottom: 8px; }
                    .section-title { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; margin-top: 12px; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 2px solid #0f766e; display: inline-block; }
                    .section-text p { margin: 0 0 4px 0; }
                    .section-text h1 { font-size: 14px; font-weight: 800; color: #0f172a; margin: 14px 0 5px; }
                    .section-text h2 { font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 12px 0 4px; }
                    .section-text h3 { font-size: 11.5px; font-weight: 700; color: #0f172a; margin: 10px 0 3px; }
                    .section-text ul, .section-text ol { padding-left: 16px; margin: 3px 0; }
                    .section-text ul { list-style: disc; }
                    .section-text ol { list-style: decimal; }
                    .section-text blockquote { border-left: 2px solid #cbd5e1; padding-left: 8px; margin: 4px 0; font-style: italic; color: #475569; }
                    .section-text mark { background: #fef08a; padding: 0 2px; }
                    .section-list { padding-left: 16px; }
                    .signature-line { width: 220px; border-top: 2px solid #0f172a; padding-top: 8px; text-align: center; }
                    .doctor-name-print { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
                    .signature-block { display: flex; justify-content: flex-end; margin-bottom: 16px; }
                    .signature-label { font-size: 9.5px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
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
