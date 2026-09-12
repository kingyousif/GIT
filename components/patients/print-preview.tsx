"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ImageIcon,
  FileText,
  Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AppSettings,
  MediaFile,
  Patient,
  ProcedureSession,
  Report,
} from "@/lib/types";
import { formatDateTime, getProcedureLabel } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";
import { toast } from "sonner";

type PrintMode = "report-5" | "report-6" | "images-only" | "images-15";

function getModeLimit(mode: PrintMode): number {
  switch (mode) {
    case "report-5":
      return 5;
    case "report-6":
      return 6;
    case "images-15":
      return 15;
    case "images-only":
    default:
      return 12;
  }
}

function getStoredMode(sessionId: string): PrintMode {
  if (typeof window === "undefined") return "report-5";
  try {
    const saved = localStorage.getItem(`endo_print_mode_${sessionId}`);
    if (
      saved === "report-5" ||
      saved === "report-6" ||
      saved === "images-only" ||
      saved === "images-15"
    ) {
      return saved as PrintMode;
    }
    if (saved === "with-content") return "report-5";
  } catch {}
  return "report-5";
}

function getStoredSelection(
  sessionId: string,
  mode: PrintMode,
  availableMedia: MediaFile[],
  limit: number,
): string[] {
  if (typeof window === "undefined") {
    return availableMedia.slice(0, limit).map((m) => m.id);
  }
  try {
    const raw = localStorage.getItem(`endo_print_sel_${sessionId}_${mode}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((id) => availableMedia.some((m) => m.id === id))
          .slice(0, limit);
      }
    }
    if (mode === "images-15") {
      const raw12 = localStorage.getItem(
        `endo_print_sel_${sessionId}_images-only`,
      );
      if (raw12 !== null) {
        const parsed12 = JSON.parse(raw12);
        if (Array.isArray(parsed12) && parsed12.length > 0) {
          const base = parsed12.filter((id) =>
            availableMedia.some((m) => m.id === id),
          );
          const unused = availableMedia
            .filter((m) => !base.includes(m.id))
            .map((m) => m.id);
          return [...base, ...unused].slice(0, limit);
        }
      }
    }
    // Cross-pollinate from report-5 if switching to report-6 for the first time
    if (mode === "report-6") {
      const raw5 =
        localStorage.getItem(`endo_print_sel_${sessionId}_report-5`) ||
        localStorage.getItem(`endo_print_sel_${sessionId}_with-content`);
      if (raw5 !== null) {
        const parsed5 = JSON.parse(raw5);
        if (Array.isArray(parsed5) && parsed5.length > 0) {
          const base = parsed5.filter((id) =>
            availableMedia.some((m) => m.id === id),
          );
          const unused = availableMedia
            .filter((m) => !base.includes(m.id))
            .map((m) => m.id);
          return [...base, ...unused].slice(0, limit);
        }
      }
    } else if (mode === "report-5") {
      const rawOld = localStorage.getItem(
        `endo_print_sel_${sessionId}_with-content`,
      );
      if (rawOld !== null) {
        const parsedOld = JSON.parse(rawOld);
        if (Array.isArray(parsedOld)) {
          return parsedOld
            .filter((id) => availableMedia.some((m) => m.id === id))
            .slice(0, limit);
        }
      }
    }
  } catch {}
  return availableMedia.slice(0, limit).map((m) => m.id);
}

function hasSectionContent(content?: string | null): boolean {
  if (!content) return false;
  const text = content
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .trim();
  const hasMedia = /<img\s/i.test(content);
  return text.length > 0 || hasMedia;
}

export function PrintPreview({
  patient,
  session,
  report,
  media,
  settings,
}: {
  patient: Patient;
  session: ProcedureSession;
  report?: Report | null;
  media: MediaFile[];
  settings: AppSettings;
}) {
  const { t } = useLocale();
  const imageMedia = useMemo(
    () => media.filter((item) => item.type === "image"),
    [media],
  );
  const [printMode, setPrintMode] = useState<PrintMode>(() =>
    getStoredMode(session.id),
  );

  const maxImages = getModeLimit(printMode);

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const initialMode = getStoredMode(session.id);
    const limit = getModeLimit(initialMode);
    return getStoredSelection(session.id, initialMode, imageMedia, limit);
  });

  const [imagesCollapsed, setImagesCollapsed] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Sync / validate selectedIds when session, mode or imageMedia changes
  useEffect(() => {
    if (imageMedia.length === 0) return;
    setSelectedIds((current) => {
      const valid = current.filter((id) => imageMedia.some((m) => m.id === id));
      if (valid.length > 0) return valid.slice(0, maxImages);
      return getStoredSelection(session.id, printMode, imageMedia, maxImages);
    });
  }, [session.id, printMode, imageMedia, maxImages]);

  const selectedImages = imageMedia
    .filter((item) => selectedIds.includes(item.id))
    .slice(0, maxImages);

  const isReportWithImages =
    printMode === "report-5" || printMode === "report-6";
  const is12Images = printMode === "images-only";
  const is15Images = printMode === "images-15";
  const isImagesOnlyMode = is12Images || is15Images;

  const validSections = useMemo(
    () => report?.sections?.filter((s) => hasSectionContent(s.content)) ?? [],
    [report?.sections],
  );
  const validDiagnoses = useMemo(
    () => report?.diagnosis?.filter((d) => d && d.trim().length > 0) ?? [],
    [report?.diagnosis],
  );
  const validRecs = useMemo(
    () =>
      report?.recommendations?.filter((r) => r && r.trim().length > 0) ?? [],
    [report?.recommendations],
  );
  const hasFollowUp = hasSectionContent(report?.followUp);
  const hasBiopsy = Boolean(report?.biopsy);

  const toggleImage = (id: string) => {
    setSelectedIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
      } else if (prev.length >= maxImages) {
        toast.warning(
          `Maximum of ${maxImages} images already selected. Please uncheck an image first to choose another.`,
        );
        return prev;
      } else {
        next = [...prev, id];
      }
      try {
        localStorage.setItem(
          `endo_print_sel_${session.id}_${printMode}`,
          JSON.stringify(next),
        );
      } catch {}
      return next;
    });
  };

  const handleSelectFirst = () => {
    const topImages = imageMedia.slice(0, maxImages).map((m) => m.id);
    setSelectedIds(topImages);
    try {
      localStorage.setItem(
        `endo_print_sel_${session.id}_${printMode}`,
        JSON.stringify(topImages),
      );
    } catch {}
    toast.success(`Selected first ${topImages.length} image(s).`);
  };

  const handleClearAll = () => {
    setSelectedIds([]);
    try {
      localStorage.setItem(
        `endo_print_sel_${session.id}_${printMode}`,
        JSON.stringify([]),
      );
    } catch {}
  };

  const handleModeChange = (newMode: PrintMode) => {
    setPrintMode(newMode);
    try {
      localStorage.setItem(`endo_print_mode_${session.id}`, newMode);
    } catch {}
    const limit = getModeLimit(newMode);
    const stored = getStoredSelection(session.id, newMode, imageMedia, limit);
    setSelectedIds(stored);
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;

    const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Endoscopy Report - ${patient.fullName}</title>
  <style>
    @page { size: A4; margin: ${isImagesOnlyMode ? "5mm" : "8mm"}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #0f172a;
      background: white;
      padding: ${isImagesOnlyMode ? "5mm 8mm" : "10mm 14mm"};
    }

    /* Floating control bar (screen only) */
    .print-control-bar {
      position: sticky;
      top: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #0f172a;
      color: white;
      padding: 10px 18px;
      margin: ${isImagesOnlyMode ? "-5mm -8mm 12px -8mm" : "-10mm -14mm 16px -14mm"};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .control-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
    }
    .control-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0f766e;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 7px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-print:hover {
      background: #0d9488;
    }
    .btn-close {
      background: rgba(255,255,255,0.15);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-close:hover {
      background: rgba(255,255,255,0.25);
    }

    .print-header {
      padding-bottom: ${isImagesOnlyMode ? "8px" : "12px"};
      border-bottom: 2.5px solid #0f766e;
      margin-bottom: ${isImagesOnlyMode ? "8px" : "14px"};
    }
    .header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .hospital-info { display: flex; align-items: center; gap: 12px; }
    .hospital-logo {
      width: ${isImagesOnlyMode ? "40px" : "52px"}; height: ${isImagesOnlyMode ? "40px" : "52px"};
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      background: #f0fdfa;
      font-size: 24px;
    }
    .hospital-logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; }
    .hospital-name { font-size: ${isImagesOnlyMode ? "14px" : "16px"}; font-weight: 700; color: #0f172a; }
    .hospital-dept { font-size: 11px; color: #475569; }
    .hospital-addr { font-size: 10px; color: #64748b; }
    .report-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; text-align: right; }
    .report-status { font-size: 10px; color: #64748b; text-align: right; }
    .patient-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 12px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
    }
    .info-cell-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    .info-cell-value { font-size: 11px; font-weight: 500; color: #0f172a; }
    .body-with-images {
      display: grid;
      grid-template-columns: 1fr 50mm;
      gap: 12px;
      margin-top: 4px;
    }
    .body-images-only { margin-top: 4px; }
    .section { margin-top: 14px; margin-bottom: 8px; }
    .section:first-child { margin-top: 4px; }
    .section-title {
      font-size: 11.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 12px;
      margin-bottom: 4px;
      padding-bottom: 2px;
      display: inline-block;
    }
    .section-text { font-size: 11px; color: #1e293b; line-height: 1.55; }
    .section-text p { margin: 0 0 5px 0; }
    .section-text p:last-child { margin-bottom: 0; }
    .section-text h1 { font-size: 14px; font-weight: 800; color: #0f172a; margin: 14px 0 5px; }
    .section-text h2 { font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 12px 0 4px; }
    .section-text h3 { font-size: 11.5px; font-weight: 700; color: #0f172a; margin: 10px 0 3px; }
    .section-text ul, .section-text ol { padding-left: 16px; margin: 3px 0; }
    .section-text ul { list-style: disc; }
    .section-text ol { list-style: decimal; }
    .section-text li { margin: 1px 0; }
    .section-text blockquote { border-left: 2px solid #cbd5e1; padding-left: 8px; margin: 4px 0; font-style: italic; color: #475569; }
    .section-text strong { font-weight: 700; }
    .section-text em { font-style: italic; }
    .section-text u { text-decoration: underline; }
    .section-text s { text-decoration: line-through; }
    .section-text mark { background: #fef08a; padding: 0 2px; }
    .section-text code { background: #f1f5f9; padding: 1px 4px; border-radius: 2px; font-family: monospace; font-size: 10px; }
    .section-text hr { border: none; border-top: 1px solid #e2e8f0; margin: 6px 0; }
    .section-list { padding-left: 16px; font-size: 11px; color: #1e293b; line-height: 1.55; }
    .section-list li { margin-bottom: 2px; }
    .images-sidebar {
      display: flex;
      flex-direction: column;
      gap: ${selectedImages.length >= 6 ? "3px" : "5px"};
    }
    .images-sidebar figure {
      overflow: hidden;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .images-sidebar img {
      width: 100%;
      height: 31mm;
      object-fit: cover;
      display: block;
    }
    .images-sidebar figcaption {
      background: #f8fafc;
      padding: 2px 4px;
      text-align: center;
      font-size: 7.5px;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .images-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
    .images-grid figure { overflow: hidden; border-radius: 6px; border: 1px solid #e2e8f0; }
    .images-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
    .images-grid figcaption { background: #f8fafc; padding: 3px 4px; text-align: center; font-size: 8px; font-weight: 500; color: #475569; }
    .images-grid-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #0f766e; margin-bottom: 6px; }

    /* 12 Images single-page A4 print grid: 3 images per row */
    .images-grid-12 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5px;
      margin-top: 4px;
      page-break-inside: avoid;
    }
    .images-grid-12 figure {
      overflow: hidden;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .images-grid-12 img {
      width: 100%;
      height: 48mm;
      object-fit: cover;
      display: block;
    }
    .images-grid-12 figcaption {
      background: #f8fafc;
      padding: 2px 4px;
      text-align: center;
      font-size: 8px;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* 15 Images single-page A4 print grid: 3 images per row, 5 rows */
    .images-grid-15 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin-top: 2px;
      page-break-inside: avoid;
    }
    .images-grid-15 figure {
      overflow: hidden;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .images-grid-15 img {
      width: 100%;
      height: 37.5mm;
      object-fit: cover;
      display: block;
    }
    .images-grid-15 figcaption {
      background: #f8fafc;
      padding: 1.5px 3px;
      text-align: center;
      font-size: 7.5px;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .print-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .signature-block { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    .signature-line {
      width: 220px;
      border-top: 2px solid #0f172a;
      padding-top: 8px;
      text-align: center;
    }
    .doctor-name-print {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.02em;
      margin-bottom: 2px;
    }
    .signature-label {
      font-size: 9.5px;
      font-weight: 500;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .footer-text { font-size: 9px; color: #64748b; }

    @media print {
      .no-print {
        display: none !important;
      }
      body {
        padding: ${isImagesOnlyMode ? "5mm 8mm" : "10mm 14mm"} !important;
      }
      html, body {
        ${isImagesOnlyMode || selectedImages.length >= 6 ? "height: 100%; overflow: hidden; page-break-inside: avoid;" : ""}
      }
      .images-grid-15, .images-grid-15 figure, .images-grid-12, .images-grid-12 figure, .images-sidebar, .images-sidebar figure {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-control-bar no-print">
    <div class="control-brand">
      <span class="pulse-dot"></span>
      <strong>Endoscopy Report</strong> · <span>${patient.fullName} (${getProcedureLabel(session.procedureType)})</span>
    </div>
    <div class="control-actions">
      <button onclick="window.print()" class="btn-print">🖨️ Print Report</button>
      <button onclick="window.close()" class="btn-close">✕ Close Tab</button>
    </div>
  </div>
  ${printContent}
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (err) {
          console.error(err);
        }
      }, 400);
    });
  </script>
</body>
</html>`;

    try {
      const blob = new Blob([htmlDocument], {
        type: "text/html;charset=utf-8",
      });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
      toast.success(
        "Print report opened in a new tab. You can continue working in this window.",
      );
    } catch (err) {
      console.error(err);
      toast.error(t.printPreview.unavailable);
    }
  };

  if (!report) {
    return (
      <EmptyState
        icon={<Printer className="h-8 w-8" />}
        title={t.printPreview.unavailable}
        description={t.printPreview.unavailableDesc}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Print Options Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            {t.printPreview.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Mode Selection */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => handleModeChange("report-5")}
              className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                printMode === "report-5"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-card-border hover:border-primary/50"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">
                  {t.printPreview.report5Images}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {t.printPreview.report5ImagesDesc}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange("report-6")}
              className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                printMode === "report-6"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-card-border hover:border-primary/50"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">
                  {t.printPreview.report6Images}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {t.printPreview.report6ImagesDesc}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange("images-only")}
              className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                printMode === "images-only"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-card-border hover:border-primary/50"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">
                  {t.printPreview.imagesOnly12}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {t.printPreview.imagesOnly12Desc}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange("images-15")}
              className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                printMode === "images-15"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-card-border hover:border-primary/50"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">
                  {(t.printPreview as any).imagesOnly15 ||
                    "Images Only (15 Images)"}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {(t.printPreview as any).imagesOnly15Desc ||
                    "15 images across 5 rows (3 per row) on single A4"}
                </p>
              </div>
            </button>
          </div>

          {/* Image Selection — Collapsible with Sticky Floating Counter */}
          <div className="space-y-3">
            {/* Sticky Floating Status Bar for Image Selection */}
            <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3.5 shadow-lg backdrop-blur-md transition-all">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-transform ${
                    selectedIds.length === maxImages
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 scale-105 ring-2 ring-amber-500/30"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {selectedIds.length}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {selectedIds.length} / {maxImages} Images Selected
                    </span>
                    {selectedIds.length === maxImages && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Max reached
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {printMode === "report-5"
                      ? "Selected 5 images appear in the right column beside the text"
                      : printMode === "report-6"
                        ? "Selected 6 images appear in the right column beside the text"
                        : printMode === "images-15"
                          ? "15 images: 5 rows of 3 images on single A4 page layout"
                          : "12 images: single A4 page layout (header patient info & footer automatically hidden)"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectFirst}
                  disabled={imageMedia.length === 0}
                  className="h-8 text-xs"
                >
                  Select First {maxImages}
                </Button>
                {selectedIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    {t.printPreview.clearAll}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImagesCollapsed((v) => !v)}
                  className="h-8 text-xs"
                >
                  {imagesCollapsed ? "Show Images" : "Hide Images"}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePrint}
                  className="h-8 text-xs gap-1.5 shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print ({selectedIds.length})
                </Button>
              </div>
            </div>

            {!imagesCollapsed &&
              (imageMedia.length === 0 ? (
                <p className="rounded-xl border border-dashed border-card-border p-4 text-sm text-muted-foreground">
                  {t.printPreview.noImages}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {imageMedia.map((item) => {
                    const selectedIdx = selectedIds.indexOf(item.id);
                    const checked = selectedIdx !== -1;
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleImage(item.id)}
                        className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition ${
                          checked
                            ? "border-primary ring-2 ring-primary/25 bg-primary/5 shadow-xs"
                            : "border-card-border hover:border-primary/50 hover:shadow-xs"
                        }`}
                      >
                        {/* Numbered order badge for selected images */}
                        {checked && (
                          <div className="absolute right-2 top-2 z-10 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow-md animate-in zoom-in-75 duration-150">
                            #{selectedIdx + 1}
                          </div>
                        )}
                        <div className="absolute left-2 top-2 z-10">
                          <Checkbox
                            checked={checked}
                            className="pointer-events-none data-[state=checked]:bg-primary"
                          />
                        </div>
                        <div className="aspect-video w-full overflow-hidden bg-muted">
                          <img
                            src={item.dataUrl}
                            alt={item.label || item.filename}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-200"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-2 flex items-center justify-between">
                          <p className="truncate text-xs font-medium text-foreground">
                            {item.label || item.filename}
                          </p>
                          {checked && (
                            <span className="text-[10px] text-primary font-bold">
                              Selected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>

          <div className="flex justify-end border-t border-card-border pt-4">
            <Button onClick={handlePrint} size="lg" className="gap-2 shadow-sm">
              <Printer className="h-4 w-4" /> {t.printPreview.printReport} (
              {selectedIds.length}{" "}
              {selectedIds.length === 1 ? "image" : "images"})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* A4 Preview (visible on screen, also used as print source) */}
      <div className="print-page mx-auto" ref={printRef}>
        {/* Page Header */}
        <div className="print-header">
          <div
            className="header-row"
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div
              className="hospital-info"
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              {settings.hospitalLogo ? (
                <div className="hospital-logo">
                  <img
                    src={settings.hospitalLogo}
                    alt="Logo"
                    width={"70px"}
                    height={"70px"}
                  />
                </div>
              ) : (
                <div className="hospital-logo">🏥</div>
              )}
              <div>
                <div
                  className="hospital-name"
                  style={{ fontSize: "16px", fontWeight: 700 }}
                >
                  {settings.hospitalName}
                </div>
                <div
                  className="hospital-dept"
                  style={{ fontSize: "11px", color: "#475569" }}
                >
                  {settings.departmentName}
                </div>
                <div
                  className="hospital-addr"
                  style={{ fontSize: "10px", color: "#64748b" }}
                >
                  {settings.address} · {settings.phone}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="report-title">
                <img
                  src="/image/image.png"
                  alt={t.printPreview.endoscopyReport}
                  style={{ height: "40px" }}
                />
              </div>
              {/* <div className="report-status">
                {report.status === "final" ? (
                  <img
                    src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNDAiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAxNDAgMjgiPjxyZWN0IHg9IjEiIHk9IjEiIHdpZHRoPSIxMzgiIGhlaWdodD0iMjYiIHJ4PSIxMyIgZmlsbD0iI2VjZmRmNSIgc3Ryb2tlPSIjMTBiOTgxIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxwYXRoIGQ9Ik0xOCAxNCBMMjMgMTkgTDMwIDExIiBmaWxsPSJub25lIiBzdHJva2U9IiMwNTk2NjkiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48dGV4dCB4PSIzOCIgeT0iMTgiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjMDU5NjY5Ij5GaW5hbCBSZXBvcnQ8L3RleHQ+PC9zdmc+"
                    alt={t.printPreview.finalReport}
                    style={{ height: "24px" }}
                  />
                ) : (
                  <img
                    src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAxMDAgMjgiPjxyZWN0IHg9IjEiIHk9IjEiIHdpZHRoPSI5OCIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSIjZmVmM2M3IiBzdHJva2U9IiNmNTljMTEiIHN0cm9rZS13aWR0aD0iMS41Ii8+PGNpcmNsZSBjeD0iMTgiIGN5PSIxNCIgcj0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZDk3NzA2IiBzdHJva2Utd2lkdGg9IjEuNSIvPjxwYXRoIGQ9Ik0xNSAxMSBBNSA1IDAgMSAxIDE1IDE3IiBmaWxsPSJub25lIiBzdHJva2U9IiNkOTc3MDYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1kYXNoYXJyYXk9IjIgMiIvPjx0ZXh0IHg9IjI4IiB5PSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiNkOTc3MDYiPkRyYWZ0PC90ZXh0Pjwvc3ZnPg=="
                    alt={t.printPreview.draftReport}
                    style={{ height: "24px" }}
                  />
                )}
              </div> */}
            </div>
          </div>

          {/* Patient Info Bar — removed on images-only selection */}
          {!isImagesOnlyMode && (
            <div
              className="patient-bar"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
                marginTop: "12px",
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                background: "#f8fafc",
              }}
            >
              <InfoCell label="Patient" value={patient.fullName} />
              <InfoCell label="Code" value={patient.patientCode} />
              <InfoCell
                label="Age / Gender"
                value={`${patient.age} / ${patient.gender}`}
              />
              <InfoCell
                label="Date"
                value={formatDateTime(session.scheduledAt)}
              />
              <InfoCell label="Doctor" value={report.doctorName} />
              <InfoCell
                label="Procedure"
                value={getProcedureLabel(session.procedureType)}
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        {isReportWithImages ? (
          <div
            className="body-with-images"
            style={{
              display: "grid",
              gridTemplateColumns:
                selectedImages.length > 0 ? "1fr 188px" : "1fr",
              gap: "14px",
            }}
          >
            {/* Left: Report Content */}
            <div className="print-content">
              {report.freeReportHtml ? (
                <div
                  className="section-text tiptap-display"
                  dangerouslySetInnerHTML={{ __html: report.freeReportHtml }}
                />
              ) : (
                <>
                  {validSections.map((section, idx) => {
                    const titleCol = section.titleColor || "#0f172a";
                    const borderCol = section.titleColor || "#0f766e";
                    return (
                      <div
                        key={section.title}
                        className="section"
                        style={{
                          marginTop: idx === 0 ? "4px" : "14px",
                          marginBottom: "8px",
                        }}
                      >
                        <div
                          className="section-title"
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: titleCol,
                            marginBottom: "4px",
                            paddingBottom: "2px",
                            borderBottom: `2px solid ${borderCol}`,
                            display: "inline-block",
                          }}
                        >
                          {section.title}
                        </div>
                        <div
                          className="section-text tiptap-display"
                          style={{
                            fontSize: "11px",
                            color: "#1e293b",
                            lineHeight: 1.55,
                          }}
                          dangerouslySetInnerHTML={{
                            __html: section.content || "",
                          }}
                        />
                      </div>
                    );
                  })}

                  {validDiagnoses.length > 0 && (
                    <div
                      className="section"
                      style={{ marginTop: "14px", marginBottom: "8px" }}
                    >
                      <div
                        className="section-title"
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#0f172a",
                          marginBottom: "4px",
                          paddingBottom: "2px",
                          borderBottom: "2px solid #0f766e",
                          display: "inline-block",
                        }}
                      >
                        Diagnosis
                      </div>
                      <ol
                        className="section-list"
                        style={{
                          paddingLeft: "16px",
                          fontSize: "11px",
                          color: "#1e293b",
                          lineHeight: 1.55,
                        }}
                      >
                        {validDiagnoses.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {validRecs.length > 0 && (
                    <div
                      className="section"
                      style={{ marginTop: "14px", marginBottom: "8px" }}
                    >
                      <div
                        className="section-title"
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#0f172a",
                          marginBottom: "4px",
                          paddingBottom: "2px",
                          borderBottom: "2px solid #0f766e",
                          display: "inline-block",
                        }}
                      >
                        Recommendations
                      </div>
                      <ol
                        className="section-list"
                        style={{
                          paddingLeft: "16px",
                          fontSize: "11px",
                          color: "#1e293b",
                          lineHeight: 1.55,
                        }}
                      >
                        {validRecs.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {hasFollowUp && (
                    <div
                      className="section"
                      style={{ marginTop: "14px", marginBottom: "8px" }}
                    >
                      <div
                        className="section-title"
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#0f172a",
                          marginBottom: "4px",
                          paddingBottom: "2px",
                          borderBottom: "2px solid #0f766e",
                          display: "inline-block",
                        }}
                      >
                        Follow-up
                      </div>
                      <div
                        className="section-text tiptap-display"
                        style={{
                          fontSize: "11px",
                          color: "#1e293b",
                          lineHeight: 1.55,
                        }}
                        dangerouslySetInnerHTML={{ __html: report.followUp! }}
                      />
                    </div>
                  )}

                  {hasBiopsy && (
                    <div
                      className="section"
                      style={{ marginTop: "14px", marginBottom: "8px" }}
                    >
                      <div
                        className="section-title"
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#0f172a",
                          marginBottom: "4px",
                          paddingBottom: "2px",
                          borderBottom: "2px solid #0f766e",
                          display: "inline-block",
                        }}
                      >
                        Biopsy
                      </div>
                      <div
                        className="section-text"
                        style={{
                          fontSize: "11px",
                          color: "#1e293b",
                          lineHeight: 1.55,
                        }}
                      >
                        Taken from{" "}
                        <strong>
                          {report.biopsyLocation || "unspecified"}
                        </strong>
                        {report.biopsySentTo
                          ? `, sent to ${report.biopsySentTo}`
                          : ""}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: Images Column */}
            {selectedImages.length > 0 && (
              <div
                className="images-sidebar"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: selectedImages.length >= 6 ? "3px" : "5px",
                }}
              >
                {selectedImages.map((item) => (
                  <figure
                    key={item.id}
                    style={{
                      overflow: "hidden",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                    }}
                  >
                    <img
                      src={item.dataUrl}
                      alt={item.label || item.filename}
                      style={{
                        width: "100%",
                        height: "31mm",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    <figcaption
                      style={{
                        background: "#f8fafc",
                        padding: "2px 4px",
                        textAlign: "center",
                        fontSize: "7.5px",
                        fontWeight: 600,
                        color: "#334155",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.label || item.filename}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Images Only Mode */
          <div className="body-images-only">
            {is15Images ? (
              /* 15 Images single-page A4 layout: 3 columns x 5 rows */
              <div
                className="images-grid-15"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "4px",
                  marginTop: "2px",
                }}
              >
                {selectedImages.map((item, idx) => (
                  <figure
                    key={item.id}
                    style={{
                      overflow: "hidden",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                    }}
                  >
                    <img
                      src={item.dataUrl}
                      alt={item.label || item.filename}
                      style={{
                        width: "100%",
                        height: "37.5mm",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    <figcaption
                      style={{
                        background: "#f8fafc",
                        padding: "1.5px 3px",
                        textAlign: "center",
                        fontSize: "7.5px",
                        fontWeight: 600,
                        color: "#334155",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.label || `Image ${idx + 1}`}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : is12Images ? (
              /* 12 Images single-page A4 layout - without PROCEDURE IMAGES header */
              <div
                className="images-grid-12"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "5px",
                  marginTop: "4px",
                }}
              >
                {selectedImages.map((item, idx) => (
                  <figure
                    key={item.id}
                    style={{
                      overflow: "hidden",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                    }}
                  >
                    <img
                      src={item.dataUrl}
                      alt={item.label || item.filename}
                      style={{
                        width: "100%",
                        height: "48mm",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    <figcaption
                      style={{
                        background: "#f8fafc",
                        padding: "2px 4px",
                        textAlign: "center",
                        fontSize: "8px",
                        fontWeight: 600,
                        color: "#334155",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.label || `Image ${idx + 1}`}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              /* 3-column grid for < 12 images */
              <div>
                <div
                  className="images-grid-title"
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#0f766e",
                    marginBottom: "8px",
                  }}
                >
                  {t.printPreview.procedureImages}
                </div>
                <div
                  className="images-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                  }}
                >
                  {selectedImages.map((item) => (
                    <figure
                      key={item.id}
                      style={{
                        overflow: "hidden",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <img
                        src={item.dataUrl}
                        alt={item.label || item.filename}
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                      <figcaption
                        style={{
                          background: "#f8fafc",
                          padding: "3px 4px",
                          textAlign: "center",
                          fontSize: "8px",
                          fontWeight: 500,
                          color: "#475569",
                        }}
                      >
                        {item.label || item.filename}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer — removed on images-only selection */}
        {!isImagesOnlyMode && (
          <div
            className="print-footer"
            style={{
              marginTop: "24px",
              paddingTop: "12px",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: "9px", color: "#64748b" }}>
              {settings.reportFooter}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "220px",
                  borderTop: "2px solid #0f172a",
                  paddingTop: "8px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "0.02em",
                    marginBottom: "2px",
                  }}
                >
                  {report.doctorName}
                </div>
                <span
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 500,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {t.printPreview.signature}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="info-cell-label"
        style={{
          fontSize: "9px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#64748b",
        }}
      >
        {label}
      </div>
      <div
        className="info-cell-value"
        style={{ fontSize: "11px", fontWeight: 500, color: "#0f172a" }}
      >
        {value}
      </div>
    </div>
  );
}
