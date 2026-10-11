import {
  addMediaItemAsync,
  deleteMediaItemAsync,
  getMediaForSessionAsync,
} from "@/lib/media-db";
import {
  AppSettings,
  MediaFile,
  Patient,
  ProcedureSession,
  Report,
} from "@/lib/types";
import { formatDateTime, formatSedation, getProcedureLabel } from "@/lib/utils";
import { formatDateOfBirth } from "@/lib/age";
import { REPORT_HEADER_IMAGE } from "@/lib/header-image";

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Build the inner report HTML body — used for both the snapshot and live preview.
 */
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

export function buildReportHtmlBody({
  patient,
  session,
  report,
  settings,
}: {
  patient: Patient;
  session: ProcedureSession;
  report: Report;
  settings: AppSettings;
}): string {
  const validSections = report.sections.filter((s) =>
    hasSectionContent(s.content),
  );
  const sectionsHtml = validSections
    .map(
      (s) => `
      <div class="section" style="margin-top: 14px; margin-bottom: 8px;">
        <div class="section-title" style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: ${s.titleColor || "#0f172a"}; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 2px solid ${s.titleColor || "#0f766e"}; display: inline-block;">${escapeHtml(s.title)}</div>
        <div class="section-text" style="font-size: 11px; color: #1e293b; line-height: 1.55;">${s.content || ""}</div>
      </div>`,
    )
    .join("");

  const validDiagnoses =
    report.diagnosis?.filter((d) => d && d.trim().length > 0) ?? [];
  const diagnosisHtml = validDiagnoses.length
    ? `<div class="section" style="margin-top: 14px; margin-bottom: 8px;">
        <div class="section-title" style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 2px solid #0f766e; display: inline-block;">Diagnosis</div>
        <ol class="section-list" style="padding-left: 16px; font-size: 11px; color: #1e293b; line-height: 1.55;">${validDiagnoses.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ol>
      </div>`
    : "";

  const validRecs =
    report.recommendations?.filter((r) => r && r.trim().length > 0) ?? [];
  const recommendationsHtml = validRecs.length
    ? `<div class="section" style="margin-top: 14px; margin-bottom: 8px;">
        <div class="section-title" style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 2px solid #0f766e; display: inline-block;">Recommendations</div>
        <ol class="section-list" style="padding-left: 16px; font-size: 11px; color: #1e293b; line-height: 1.55;">${validRecs.map((r) => `<li style="margin-bottom: 4px;">${r}</li>`).join("")}</ol>
      </div>`
    : "";

  const followUpHtml = hasSectionContent(report.followUp)
    ? `<div class="section">
        <div class="section-title">Follow-up</div>
        <div class="section-text">${report.followUp}</div>
      </div>`
    : "";

  const biopsyHtml = report.biopsy
    ? `<div class="section">
        <div class="section-title">Biopsy</div>
        <div class="section-text">Taken from <strong>${escapeHtml(report.biopsyLocation || "unspecified")}</strong>${report.biopsySentTo ? `, sent to ${escapeHtml(report.biopsySentTo)}` : ""}</div>
      </div>`
    : "";

  const structuredBodyHtml = `
      ${sectionsHtml}
      ${diagnosisHtml}
      ${recommendationsHtml}
      ${followUpHtml}
      ${biopsyHtml}
  `;
  const reportBodyHtml = report.freeReportHtml || structuredBodyHtml;

  return `
    <div class="print-header">
      <div class="header-row">
        <div class="hospital-info">
          ${settings.hospitalLogo ? `<div class="hospital-logo"><img src="${settings.hospitalLogo}" alt="Logo" /></div>` : '<div class="hospital-logo">🏥</div>'}
          <div>
            <div class="hospital-name" style="font-size: 17.5px; font-weight: 800; color: #0f172a;">${escapeHtml(settings.hospitalName)}</div>
            <div class="hospital-dept" style="font-size: 12px; color: #475569;">${escapeHtml(settings.departmentName)}</div>
            <div class="hospital-addr" style="font-size: 11px; color: #64748b;">${escapeHtml(settings.address)} · ${escapeHtml(settings.phone)}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div class="report-title"><img src="${REPORT_HEADER_IMAGE}" alt="Endoscopy Report" style="height:40px; object-fit: contain;" /></div>
        </div>
      </div>

      <div class="patient-bar" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 12px; margin-top: 12px; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc;">
        <div><div class="info-cell-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px;">Patient</div><div class="info-cell-value" style="font-size: 12.5px; font-weight: 600; color: #0f172a;">${escapeHtml(patient.fullName)}</div></div>
        <div><div class="info-cell-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px;">Code</div><div class="info-cell-value" style="font-size: 12.5px; font-weight: 600; color: #0f172a;">${escapeHtml(patient.patientCode)}</div></div>
        <div><div class="info-cell-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px;">Age / Gender</div><div class="info-cell-value" style="font-size: 12.5px; font-weight: 600; color: #0f172a;">${patient.age} years / ${escapeHtml(patient.gender)}${formatDateOfBirth(patient.dateOfBirth) ? ` · ${escapeHtml(formatDateOfBirth(patient.dateOfBirth))}` : ""}</div></div>
        <div><div class="info-cell-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px;">Date</div><div class="info-cell-value" style="font-size: 12.5px; font-weight: 600; color: #0f172a;">${escapeHtml(formatDateTime(session.scheduledAt))}</div></div>
        <div><div class="info-cell-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px;">Procedure</div><div class="info-cell-value" style="font-size: 12.5px; font-weight: 600; color: #0f172a;">${escapeHtml(getProcedureLabel(session.procedureType))}</div></div>
        <div><div class="info-cell-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px;">Doctor</div><div class="info-cell-value" style="font-size: 12.5px; font-weight: 600; color: #0f172a;">${escapeHtml(report.doctorName || session.doctorName || "—")}</div></div>
        <div><div class="info-cell-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px;">Anesthesia</div><div class="info-cell-value" style="font-size: 12.5px; font-weight: 600; color: #0f172a;">${escapeHtml(formatSedation(session.sedation))}</div></div>
        <div><div class="info-cell-label" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px;">Referred Doctor</div><div class="info-cell-value" style="font-size: 12.5px; font-weight: 600; color: #0f172a;">${escapeHtml(patient.referredBy || "—")}</div></div>
      </div>
    </div>

    <div class="report-body">
      ${reportBodyHtml}
    </div>

    <div class="print-footer" style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;"> 
      <div class="signature-block" style="display: flex; justify-content: flex-start;">
        <div class="signature-line" style="width: 220px; border-top: 2px solid #0f172a; padding-top: 8px; text-align: center;">
          <div class="doctor-name-print" style="font-size:15px; font-weight:800; color:#0f172a; margin-bottom:2px;">${escapeHtml(report.doctorName)}</div>
          <span class="signature-label" style="font-size:9.5px; color:#64748b; font-weight:500; text-transform: uppercase; letter-spacing: 0.05em;">Signature</span>
        </div>
      </div>
      <div class="footer-text" style="font-size:9px; color:#64748b; text-align: right; max-width: 60%; word-break: break-word;">${escapeHtml(settings.reportFooter)}</div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Save (or update) the report snapshot as a media item with type "report".
 * Replaces the previous snapshot for the same report so we keep one entry per report.
 */
export async function saveReportSnapshot({
  patient,
  session,
  report,
  settings,
}: {
  patient: Patient;
  session: ProcedureSession;
  report: Report;
  settings: AppSettings;
}): Promise<MediaFile> {
  const html = buildReportHtmlBody({ patient, session, report, settings });

  // Find existing snapshot for the same reportId and remove it
  const existingMedia = await getMediaForSessionAsync(session.id);
  const existing = existingMedia.find(
    (m) => m.type === "report" && m.reportId === report.id,
  );
  const existingReports = existingMedia.filter((m) => m.type === "report");
  const reportNumber = existing
    ? Number(
        existing.filename.match(/Report-(\d+)/)?.[1] ??
          existingReports.length + 1,
      )
    : existingReports.length + 1;

  if (existing) {
    await deleteMediaItemAsync(existing.id, session.id);
  }

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  const media: MediaFile = {
    id: uuid(),
    sessionId: session.id,
    type: "report",
    source: "report",
    dataUrl,
    filename: `Report-${reportNumber}.html`,
    label: `Report ${reportNumber}${report.status === "final" ? " (Final)" : " (Draft)"}`,
    capturedAt: new Date().toISOString(),
    reportId: report.id,
  };

  await addMediaItemAsync(media);
  return media;
}
