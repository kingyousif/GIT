"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Crop, RotateCcw, Square, RectangleHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CropConfig,
  CropShape,
  DEFAULT_CROP,
  drawCroppedFrame,
} from "@/lib/crop-config";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";

type Handle = "nw" | "ne" | "sw" | "se" | "move" | null;

export function CropSettingsDialog({
  open,
  onOpenChange,
  liveVideo,
  initialConfig,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveVideo: HTMLVideoElement | null;
  initialConfig: CropConfig;
  onSave: (config: CropConfig) => void;
}) {
  const { t } = useLocale();
  const [config, setConfig] = useState<CropConfig>(initialConfig);
  const stageRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragState = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    startConfig: CropConfig;
    stageWidth: number;
    stageHeight: number;
  } | null>(null);

  // Reset to passed config every time the dialog opens
  useEffect(() => {
    if (open) {
      setConfig(initialConfig.enabled ? initialConfig : { ...initialConfig, enabled: true });
    }
  }, [open, initialConfig]);

  // Stage dimensions reflect a 16:9 area scaled to fit
  const aspectRatio = useMemo(() => {
    if (!liveVideo || !liveVideo.videoWidth) return 16 / 9;
    return liveVideo.videoWidth / liveVideo.videoHeight;
  }, [liveVideo]);

  // Live preview rendering — uses requestAnimationFrame
  useEffect(() => {
    if (!open) return;
    if (!previewCanvasRef.current || !liveVideo) return;
    let rafId = 0;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      if (liveVideo.readyState >= 2 && previewCanvasRef.current) {
        drawCroppedFrame(liveVideo, previewCanvasRef.current, config);
      }
      rafId = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [open, config, liveVideo]);

  // Enforce shape constraint when shape changes
  useEffect(() => {
    if (config.shape === "rect") return;
    setConfig((c) => {
      const side = Math.min(c.width, c.height);
      return { ...c, width: side, height: side };
    });
  }, [config.shape]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handle: Exclude<Handle, null>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      dragState.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startConfig: { ...config },
        stageWidth: rect.width,
        stageHeight: rect.height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [config],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds || !ds.handle) return;
    const dxN = (e.clientX - ds.startX) / ds.stageWidth;
    const dyN = (e.clientY - ds.startY) / ds.stageHeight;

    setConfig((prev) => {
      let { x, y, width, height } = ds.startConfig;
      const isSquare = prev.shape !== "rect";

      if (ds.handle === "move") {
        x = ds.startConfig.x + dxN;
        y = ds.startConfig.y + dyN;
      } else if (ds.handle === "se") {
        width = ds.startConfig.width + dxN;
        height = ds.startConfig.height + dyN;
        if (isSquare) {
          const side = Math.max(dxN, dyN);
          width = ds.startConfig.width + side;
          height = ds.startConfig.height + side;
        }
      } else if (ds.handle === "ne") {
        width = ds.startConfig.width + dxN;
        height = ds.startConfig.height - dyN;
        y = ds.startConfig.y + dyN;
        if (isSquare) {
          const side = Math.max(dxN, -dyN);
          width = ds.startConfig.width + side;
          height = ds.startConfig.height + side;
          y = ds.startConfig.y - side;
        }
      } else if (ds.handle === "sw") {
        width = ds.startConfig.width - dxN;
        height = ds.startConfig.height + dyN;
        x = ds.startConfig.x + dxN;
        if (isSquare) {
          const side = Math.max(-dxN, dyN);
          width = ds.startConfig.width + side;
          height = ds.startConfig.height + side;
          x = ds.startConfig.x - side;
        }
      } else if (ds.handle === "nw") {
        width = ds.startConfig.width - dxN;
        height = ds.startConfig.height - dyN;
        x = ds.startConfig.x + dxN;
        y = ds.startConfig.y + dyN;
        if (isSquare) {
          const side = Math.max(-dxN, -dyN);
          width = ds.startConfig.width + side;
          height = ds.startConfig.height + side;
          x = ds.startConfig.x - side;
          y = ds.startConfig.y - side;
        }
      }

      // Clamp
      width = Math.min(1, Math.max(0.05, width));
      height = Math.min(1, Math.max(0.05, height));
      x = Math.max(0, Math.min(1 - width, x));
      y = Math.max(0, Math.min(1 - height, y));

      return { ...prev, x, y, width, height };
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragState.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    dragState.current = null;
  }, []);

  const setShape = (shape: CropShape) => {
    setConfig((c) => ({ ...c, shape }));
  };

  const reset = () => setConfig({ ...DEFAULT_CROP, enabled: true });

  const sourceW = liveVideo?.videoWidth ?? 0;
  const sourceH = liveVideo?.videoHeight ?? 0;
  const cropPxW = sourceW ? Math.round(config.width * sourceW) : 0;
  const cropPxH = sourceH ? Math.round(config.height * sourceH) : 0;

  // Visual position/size of the crop overlay (percent of stage)
  // For square/circle, account for shape constraint based on aspectRatio.
  const stageAspect = aspectRatio;
  let overlayWidthPct = config.width * 100;
  let overlayHeightPct = config.height * 100;
  if (config.shape !== "rect") {
    // The shape is forced to a pixel-square. To represent that visually
    // on a non-square stage we need to mirror computeCropRect's logic.
    const wPx = config.width * 1000;
    const hPx = config.height * (1000 / stageAspect);
    const sidePx = Math.min(wPx, hPx);
    overlayWidthPct = (sidePx / 1000) * 100;
    overlayHeightPct = (sidePx / (1000 / stageAspect)) * 100;
  }
  const overlayStyle = {
    left: `${config.x * 100}%`,
    top: `${config.y * 100}%`,
    width: `${overlayWidthPct}%`,
    height: `${overlayHeightPct}%`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5 text-primary" />
            {t.media.cropTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          {/* LEFT: Stage with draggable crop */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="me-2 text-sm font-medium">
                {t.media.cropShape}:
              </Label>
              <Button
                type="button"
                size="sm"
                variant={config.shape === "rect" ? "default" : "outline"}
                onClick={() => setShape("rect")}
              >
                <RectangleHorizontal className="h-4 w-4" />
                {t.media.cropRectangle}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={config.shape === "square" ? "default" : "outline"}
                onClick={() => setShape("square")}
              >
                <Square className="h-4 w-4" />
                {t.media.cropSquare}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={config.shape === "circle" ? "default" : "outline"}
                onClick={() => setShape("circle")}
              >
                <Circle className="h-4 w-4" />
                {t.media.cropCircle}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={reset}
                className="ms-auto"
              >
                <RotateCcw className="h-4 w-4" />
                {t.media.cropReset}
              </Button>
            </div>

            <div
              ref={stageRef}
              className="relative w-full overflow-hidden rounded-2xl border border-card-border bg-slate-950"
              style={{ aspectRatio }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {liveVideo ? (
                <CroppedVideoMirror video={liveVideo} aspectRatio={aspectRatio} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                  {t.media.cropNoStream}
                </div>
              )}

              {/* Crop window — uses an outer box-shadow to dim everything outside */}
              <div
                className={cn(
                  "absolute cursor-move border-2 border-primary",
                  config.shape === "circle" ? "rounded-full" : "rounded-md",
                )}
                style={{
                  ...overlayStyle,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                }}
                onPointerDown={(e) => handlePointerDown(e, "move")}
              >
                {/* Resize handles */}
                {(["nw", "ne", "sw", "se"] as const).map((h) => (
                  <span
                    key={h}
                    onPointerDown={(e) => handlePointerDown(e, h)}
                    className={cn(
                      "absolute z-10 h-3 w-3 rounded-sm border border-white bg-primary shadow",
                      h === "nw" && "left-[-6px] top-[-6px] cursor-nwse-resize",
                      h === "ne" && "right-[-6px] top-[-6px] cursor-nesw-resize",
                      h === "sw" && "left-[-6px] bottom-[-6px] cursor-nesw-resize",
                      h === "se" && "right-[-6px] bottom-[-6px] cursor-nwse-resize",
                    )}
                  />
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{t.media.cropHelp}</p>
          </div>

          {/* RIGHT: Preview + info */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t.media.cropPreview}</Label>
            <div className="overflow-hidden rounded-2xl border border-card-border bg-slate-950 p-3">
              <div className="flex aspect-video w-full items-center justify-center">
                <canvas
                  ref={previewCanvasRef}
                  className={cn(
                    "max-h-full max-w-full",
                    config.shape === "circle" ? "rounded-full" : "rounded-md",
                  )}
                />
              </div>
            </div>

            <div className="rounded-xl border border-card-border bg-muted p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.media.cropSourceSize}:</span>
                <span className="font-mono font-medium">
                  {sourceW || "?"} × {sourceH || "?"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.media.cropOutputSize}:</span>
                <span className="font-mono font-medium">
                  {cropPxW} × {cropPxH}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.media.cropShape}:</span>
                <span className="font-medium capitalize">{config.shape}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-card-border p-3">
              <div className="space-y-0.5">
                <Label className="cursor-pointer text-sm font-medium">
                  {t.media.cropEnable}
                </Label>
                <p className="text-xs text-muted-foreground">{t.media.cropEnableHint}</p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig((c) => ({ ...c, enabled: checked }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => {
              onSave(config);
              onOpenChange(false);
            }}
          >
            {t.media.cropApply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mirrors a live video element into a canvas inside the crop dialog.
 * We can't use the same <video> element because it is owned by the
 * parent panel — instead we draw frames into a canvas at full size.
 */
function CroppedVideoMirror({
  video,
  aspectRatio,
}: {
  video: HTMLVideoElement;
  aspectRatio: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId = 0;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      if (video.readyState >= 2 && canvasRef.current) {
        const c = canvasRef.current;
        if (c.width !== video.videoWidth) c.width = video.videoWidth;
        if (c.height !== video.videoHeight) c.height = video.videoHeight;
        const ctx = c.getContext("2d");
        ctx?.drawImage(video, 0, 0, c.width, c.height);
      }
      rafId = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [video]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ aspectRatio }}
    />
  );
}
