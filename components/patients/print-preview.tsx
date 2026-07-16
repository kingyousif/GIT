"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImageIcon, FileText, Printer } from "lucide-react";
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

type PrintMode = "with-content" | "images-only";

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
  const [printMode, setPrintMode] = useState<PrintMode>("with-content");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [imagesCollapsed, setImagesCollapsed] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const maxImages = printMode === "with-content" ? 5 : 12;

  useEffect(() => {
    setSelectedIds(
      imageMedia
        .slice(0, Math.min(imageMedia.length, maxImages))
        .map((item) => item.id),
    );
  }, [imageMedia, maxImages]);

  const selectedImages = imageMedia
    .filter((item) => selectedIds.includes(item.id))
    .slice(0, maxImages);

  const toggleImage = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxImages) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      // Fallback if popup blocked
      toast.error(t.printPreview.unavailable);
    }

    printWindow?.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Endoscopy Report - ${patient.fullName}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #0f172a;
      background: white;
      padding: 12mm 15mm;
    }
    .print-header {
      padding-bottom: 12px;
      border-bottom: 2.5px solid #0f766e;
      margin-bottom: 14px;
    }
    .header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .hospital-info { display: flex; align-items: center; gap: 12px; }
    .hospital-logo {
      width: 52px; height: 52px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      background: #f0fdfa;
      font-size: 24px;
    }
    .hospital-logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; }
    .hospital-name { font-size: 16px; font-weight: 700; color: #0f172a; }
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
      grid-template-columns: 1fr 45mm;
      gap: 14px;
      margin-top: 4px;
    }
    .body-images-only { margin-top: 4px; }
    .section { margin-bottom: 10px; }
    .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #475569; margin-bottom: 2px; }
    .section-text { font-size: 11px; color: #1e293b; }
    .section-text p { margin: 0 0 4px 0; }
    .section-text p:last-child { margin-bottom: 0; }
    .section-text h1 { font-size: 14px; font-weight: 700; margin: 6px 0 3px; }
    .section-text h2 { font-size: 12px; font-weight: 700; margin: 5px 0 3px; }
    .section-text h3 { font-size: 11.5px; font-weight: 600; margin: 4px 0 2px; }
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
    .section-list { padding-left: 16px; font-size: 11px; color: #1e293b; }
    .section-list li { margin-bottom: 2px; }
    .images-sidebar { display: flex; flex-direction: column; gap: 6px; }
    .images-sidebar figure { overflow: hidden; border-radius: 6px; border: 1px solid #e2e8f0; }
    .images-sidebar img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
    .images-sidebar figcaption { background: #f8fafc; padding: 3px 6px; text-align: center; font-size: 8px; font-weight: 500; color: #475569; }
    .images-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
    .images-grid figure { overflow: hidden; border-radius: 6px; border: 1px solid #e2e8f0; }
    .images-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
    .images-grid figcaption { background: #f8fafc; padding: 3px 4px; text-align: center; font-size: 8px; font-weight: 500; color: #475569; }
    .images-grid-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #475569; margin-bottom: 8px; }
    .print-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .signature-block { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    .signature-line { width: 180px; border-top: 1px solid #64748b; padding-top: 6px; text-align: center; font-size: 11px; color: #1e293b; }
    .signature-label { font-size: 9px; color: #64748b; }
    .footer-text { font-size: 9px; color: #64748b; }
  </style>
</head>
<body>
  ${printContent}
  <script>
  window.onload = function() { window.print();} 
  window.onafterprint = function() { window.close(); }
  </script>
</body>
</html>`);
    printWindow?.document.close();
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
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPrintMode("with-content")}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
                printMode === "with-content"
                  ? "border-primary bg-primary/5"
                  : "border-card-border hover:border-primary/50"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {t.printPreview.reportImages}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.printPreview.reportImagesDesc}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPrintMode("images-only")}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
                printMode === "images-only"
                  ? "border-primary bg-primary/5"
                  : "border-card-border hover:border-primary/50"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {t.printPreview.imagesOnly}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.printPreview.imagesOnlyDesc}
                </p>
              </div>
            </button>
          </div>

          {/* Image Selection — Collapsible */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setImagesCollapsed((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition"
              >
                {imagesCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
                <Label className="cursor-pointer">
                  {t.printPreview.selectImages} ({selectedIds.length}/{maxImages}{" "}
                  {t.printPreview.max})
                </Label>
              </button>
              <div className="flex gap-2">
                {selectedIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds([])}
                  >
                    {t.printPreview.clearAll}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImagesCollapsed((v) => !v)}
                >
                  {imagesCollapsed ? "Show" : "Hide"}
                </Button>
              </div>
            </div>
            {!imagesCollapsed && (
              imageMedia.length === 0 ? (
                <p className="rounded-xl border border-dashed border-card-border p-4 text-sm text-muted-foreground">
                  {t.printPreview.noImages}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {imageMedia.map((item) => {
                    const checked = selectedIds.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`relative cursor-pointer overflow-hidden rounded-xl border-2 transition ${
                          checked
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-card-border hover:border-primary/50"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleImage(item.id)}
                          className="absolute left-2 top-2 z-10"
                        />
                        <img
                          src={item.dataUrl}
                          alt={item.label || item.filename}
                          className="aspect-video w-full object-cover"
                          loading="lazy"
                        />
                        <div className="p-2">
                          <p className="truncate text-xs font-medium text-foreground">
                            {item.label || item.filename}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )
            )}
          </div>

          <div className="flex justify-end border-t border-card-border pt-4">
            <Button onClick={handlePrint} size="lg">
              <Printer className="h-4 w-4" /> {t.printPreview.printReport}
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

          {/* Patient Info Bar */}
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
        </div>

        {/* Content Area */}
        {printMode === "with-content" ? (
          <div
            className="body-with-images"
            style={{
              display: "grid",
              gridTemplateColumns:
                selectedImages.length > 0 ? "1fr 160px" : "1fr",
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
                  {report.sections.map((section) => (
                    <div
                      key={section.title}
                      className="section"
                      style={{ marginBottom: "10px" }}
                    >
                      <div
                        className="section-title"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "#475569",
                          marginBottom: "2px",
                        }}
                      >
                        {section.title}
                      </div>
                      <div
                        className="section-text tiptap-display"
                        style={{ fontSize: "11px", color: "#1e293b" }}
                        dangerouslySetInnerHTML={{
                          __html: section.content || "",
                        }}
                      />
                    </div>
                  ))}

                  {report.diagnosis.length > 0 && (
                    <div className="section" style={{ marginBottom: "10px" }}>
                      <div
                        className="section-title"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "#475569",
                          marginBottom: "2px",
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
                        }}
                      >
                        {report.diagnosis.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {report.recommendations.length > 0 && (
                    <div className="section" style={{ marginBottom: "10px" }}>
                      <div
                        className="section-title"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "#475569",
                          marginBottom: "2px",
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
                        }}
                      >
                        {report.recommendations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {report.followUp && (
                    <div className="section" style={{ marginBottom: "10px" }}>
                      <div
                        className="section-title"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "#475569",
                          marginBottom: "2px",
                        }}
                      >
                        Follow-up
                      </div>
                      <div
                        className="section-text tiptap-display"
                        style={{ fontSize: "11px", color: "#1e293b" }}
                        dangerouslySetInnerHTML={{ __html: report.followUp }}
                      />
                    </div>
                  )}

                  {report.biopsy && (
                    <div className="section" style={{ marginBottom: "10px" }}>
                      <div
                        className="section-title"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "#475569",
                          marginBottom: "2px",
                        }}
                      >
                        Biopsy
                      </div>
                      <div
                        className="section-text"
                        style={{ fontSize: "11px", color: "#1e293b" }}
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
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
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
                        aspectRatio: "4/3",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    <figcaption
                      style={{
                        background: "#f8fafc",
                        padding: "3px 6px",
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
            )}
          </div>
        ) : (
          /* Images Only Mode */
          <div className="body-images-only">
            <div
              className="images-grid-title"
              style={{
                fontSize: "9px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#475569",
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

        {/* Footer */}
        <div
          className="print-footer"
          style={{
            marginTop: "24px",
            paddingTop: "12px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "180px",
                borderTop: "1px solid #64748b",
                paddingTop: "6px",
                textAlign: "center",
                fontSize: "11px",
                color: "#1e293b",
              }}
            >
              {report.doctorName}
              <br />
              <span style={{ fontSize: "9px", color: "#64748b" }}>
                {t.printPreview.signature}
              </span>
            </div>
          </div>
          <div style={{ fontSize: "9px", color: "#64748b" }}>
            {settings.reportFooter}
          </div>
        </div>
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
