import { addMediaItemAsync, getMediaForSessionAsync, deleteMediaItemAsync } from '@/lib/media-db';
import { MediaFile, Patient, ProcedureSession, Report, AppSettings } from '@/lib/types';
import { formatDateTime, getProcedureLabel } from '@/lib/utils';

function uuid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Build the inner report HTML body — used for both the snapshot and live preview.
 */
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
  const sectionsHtml = report.sections
    .map(
      (s) => `
      <div class="section">
        <div class="section-title">${escapeHtml(s.title)}</div>
        <div class="section-text">${s.content || ''}</div>
      </div>`,
    )
    .join('');

  const diagnosisHtml = report.diagnosis.length
    ? `<div class="section">
        <div class="section-title">Diagnosis</div>
        <ol class="section-list">${report.diagnosis.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ol>
      </div>`
    : '';

  const recommendationsHtml = report.recommendations.length
    ? `<div class="section">
        <div class="section-title">Recommendations</div>
        <ol class="section-list">${report.recommendations.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ol>
      </div>`
    : '';

  const followUpHtml = report.followUp
    ? `<div class="section">
        <div class="section-title">Follow-up</div>
        <div class="section-text">${report.followUp}</div>
      </div>`
    : '';

  const biopsyHtml = report.biopsy
    ? `<div class="section">
        <div class="section-title">Biopsy</div>
        <div class="section-text">Taken from <strong>${escapeHtml(report.biopsyLocation || 'unspecified')}</strong>${report.biopsySentTo ? `, sent to ${escapeHtml(report.biopsySentTo)}` : ''}</div>
      </div>`
    : '';

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
            <div class="hospital-name">${escapeHtml(settings.hospitalName)}</div>
            <div class="hospital-dept">${escapeHtml(settings.departmentName)}</div>
            <div class="hospital-addr">${escapeHtml(settings.address)} · ${escapeHtml(settings.phone)}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div class="report-title"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAyMDAgNDAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMwZDk0ODgiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwNjViNWIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cGF0aCBkPSJNNSAyMCBRMTAgOCAxOCAxNSBRMjUgMjIgMjggMTIgUTMyIDUgMzYgMTgiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNnKSIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjM2IiBjeT0iMTgiIHI9IjMiIGZpbGw9IiMwZDk0ODgiIG9wYWNpdHk9IjAuNiIvPjx0ZXh0IHg9IjQ1IiB5PSIyNiIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjMGY3NjZlIj5FbmRvc2NvcHkgUmVwb3J0PC90ZXh0Pjwvc3ZnPg==" alt="Endoscopy Report" style="height:40px;" /></div>
          <div class="report-status">${report.status === 'final' ? '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNDAiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAxNDAgMjgiPjxyZWN0IHg9IjEiIHk9IjEiIHdpZHRoPSIxMzgiIGhlaWdodD0iMjYiIHJ4PSIxMyIgZmlsbD0iI2VjZmRmNSIgc3Ryb2tlPSIjMTBiOTgxIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxwYXRoIGQ9Ik0xOCAxNCBMMjMgMTkgTDMwIDExIiBmaWxsPSJub25lIiBzdHJva2U9IiMwNTk2NjkiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48dGV4dCB4PSIzOCIgeT0iMTgiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjMDU5NjY5Ij5GaW5hbCBSZXBvcnQ8L3RleHQ+PC9zdmc+" alt="Final Report" style="height:24px;" />' : '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAxMDAgMjgiPjxyZWN0IHg9IjEiIHk9IjEiIHdpZHRoPSI5OCIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSIjZmVmM2M3IiBzdHJva2U9IiNmNTljMTEiIHN0cm9rZS13aWR0aD0iMS41Ii8+PGNpcmNsZSBjeD0iMTgiIGN5PSIxNCIgcj0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZDk3NzA2IiBzdHJva2Utd2lkdGg9IjEuNSIvPjxwYXRoIGQ9Ik0xNSAxMSBBNSA1IDAgMSAxIDE1IDE3IiBmaWxsPSJub25lIiBzdHJva2U9IiNkOTc3MDYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1kYXNoYXJyYXk9IjIgMiIvPjx0ZXh0IHg9IjI4IiB5PSIxOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiNkOTc3MDYiPkRyYWZ0PC90ZXh0Pjwvc3ZnPg==" alt="Draft" style="height:24px;" />'}</div>
        </div>
      </div>

      <div class="patient-bar">
        <div><div class="info-cell-label">Patient</div><div class="info-cell-value">${escapeHtml(patient.fullName)}</div></div>
        <div><div class="info-cell-label">Code</div><div class="info-cell-value">${escapeHtml(patient.patientCode)}</div></div>
        <div><div class="info-cell-label">Age / Gender</div><div class="info-cell-value">${patient.age} / ${escapeHtml(patient.gender)}</div></div>
        <div><div class="info-cell-label">Date</div><div class="info-cell-value">${escapeHtml(formatDateTime(session.scheduledAt))}</div></div>
        <div><div class="info-cell-label">Doctor</div><div class="info-cell-value">${escapeHtml(report.doctorName)}</div></div>
        <div><div class="info-cell-label">Procedure</div><div class="info-cell-value">${escapeHtml(getProcedureLabel(session.procedureType))}</div></div>
      </div>
    </div>

    <div class="report-body">
      ${reportBodyHtml}
    </div>

    <div class="print-footer">
      <div class="signature-block">
        <div class="signature-line">
          ${escapeHtml(report.doctorName)}<br />
          <span class="signature-label">Signature</span>
        </div>
      </div>
      <div class="footer-text">${escapeHtml(settings.reportFooter)}</div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const existing = existingMedia.find((m) => m.type === 'report' && m.reportId === report.id);
  const existingReports = existingMedia.filter((m) => m.type === 'report');
  const reportNumber = existing
    ? Number(existing.filename.match(/Report-(\d+)/)?.[1] ?? existingReports.length + 1)
    : existingReports.length + 1;

  if (existing) {
    await deleteMediaItemAsync(existing.id, session.id);
  }

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  const media: MediaFile = {
    id: uuid(),
    sessionId: session.id,
    type: 'report',
    source: 'report',
    dataUrl,
    filename: `Report-${reportNumber}.html`,
    label: `Report ${reportNumber}${report.status === 'final' ? ' (Final)' : ' (Draft)'}`,
    capturedAt: new Date().toISOString(),
    reportId: report.id,
  };

  await addMediaItemAsync(media);
  return media;
}
