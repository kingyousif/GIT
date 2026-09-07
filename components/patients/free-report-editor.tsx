'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Save, Printer, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useLocale } from '@/hooks/use-locale';
import { AppSettings, Patient, ProcedureSession, Report } from '@/lib/types';
import { saveReport } from '@/lib/queries';
import { saveReportSnapshot } from '@/lib/report-snapshot';

interface Props {
  patient: Patient;
  session: ProcedureSession;
  report?: Report | null;
  settings: AppSettings;
  onAfterSave?: (saved: Report) => void | Promise<void>;
  onOpenPrint?: (saved: Report) => void | Promise<void>;
}

export function FreeReportEditor({ patient, session, report, settings, onAfterSave, onOpenPrint }: Props) {
  const { t } = useLocale();
  const [content, setContent] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);

  const persistedReportRef = useRef<Report | null>(report ?? null);
  const currentReportIdRef = useRef<string | undefined>(report?.id);
  const lastSavedContentRef = useRef<string>(report?.freeReportHtml || '');

  // Only sync when report ID actually changes (not on re-renders or in-place saves)
  useEffect(() => {
    if (report?.id !== currentReportIdRef.current) {
      currentReportIdRef.current = report?.id;
      persistedReportRef.current = report ?? null;
      setContent(report?.freeReportHtml || '<p></p>');
      lastSavedContentRef.current = report?.freeReportHtml || '';
    }
  }, [report?.id]);

  const handleSave = async (status: 'draft' | 'final', openPrint = false, isAutoSave = false) => {
    if (!isAutoSave) setSaving(true);
    const savedScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

    try {
      const currentReport = persistedReportRef.current;
      const saved = await saveReport({
        id: currentReport?.id,
        createdAt: currentReport?.createdAt,
        sessionId: session.id,
        doctorName: session.doctorName,
        templateUsed: report?.templateUsed,
        sections: report?.sections || [{ title: 'Free Report', content: 'See free-form report.' }],
        diagnosis: report?.diagnosis || [],
        recommendations: report?.recommendations || [],
        followUp: report?.followUp,
        biopsy: report?.biopsy ?? false,
        biopsyLocation: report?.biopsyLocation,
        biopsySentTo: report?.biopsySentTo,
        status,
        freeReportHtml: content,
      });

      persistedReportRef.current = saved;
      currentReportIdRef.current = saved.id;
      lastSavedContentRef.current = content;

      saveReportSnapshot({ patient, session, report: saved, settings }).catch((snapshotError) => {
        console.error('Snapshot failed:', snapshotError);
      });

      if (isAutoSave) {
        // Silent autosave: no toast, no scroll jump
        setLastAutoSavedAt(new Date());
        return;
      }

      await onAfterSave?.(saved);
      if (openPrint) await onOpenPrint?.(saved);
      toast.success(status === 'final' ? t.reportBuilder.reportFinalized : t.reportBuilder.draftSaved);

      if (typeof window !== 'undefined' && Math.abs(window.scrollY - savedScrollY) > 5) {
        window.scrollTo({ top: savedScrollY, behavior: 'instant' as ScrollBehavior });
      }
    } catch (err) {
      console.error(err);
      if (!isAutoSave) {
        toast.error('Failed to save report.');
      }
    } finally {
      if (!isAutoSave) setSaving(false);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (report?.status === 'final') return;
      if (!content || content === lastSavedContentRef.current) return;
      void handleSave('draft', false, true);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [content, report?.status]);

  const editorElement = (
    <RichTextEditor
      value={content}
      onChange={setContent}
      disabled={report?.status === 'final'}
      minHeight={fullscreen ? 'calc(100vh - 140px)' : '500px'}
      placeholder={t.freeReport.placeholder}
    />
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t.freeReport.title}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setFullscreen(true)}>
                <Maximize2 className="h-4 w-4" /> {t.freeReport.fullscreen}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => report?.status === 'final' ? onOpenPrint?.(report) : handleSave('draft', true)}
                disabled={saving}
              >
                <Printer className="h-4 w-4" /> {t.reportBuilder.printReport}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editorElement}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => handleSave('draft')} disabled={saving || report?.status === 'final'}>
              <Save className="h-4 w-4" /> {t.reportBuilder.saveDraft}
            </Button>
            <Button variant="outline" onClick={() => handleSave('final')} disabled={saving || report?.status === 'final'}>
              {t.reportBuilder.finalizeReport}
            </Button>
            {lastAutoSavedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 ml-auto">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Draft autosaved ({lastAutoSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Modal */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="h-[95vh] max-w-[95vw] flex flex-col p-4">
          <div className="flex items-center justify-between border-b border-card-border pb-3">
            <h2 className="text-lg font-semibold">{t.freeReport.title} — {patient.fullName}</h2>
            <div className="flex items-center gap-2">
              {lastAutoSavedAt && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Autosaved
                </span>
              )}
              <Button size="sm" onClick={() => handleSave('draft')} disabled={saving || report?.status === 'final'}>
                <Save className="h-4 w-4" /> {t.reportBuilder.saveDraft}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleSave('final')} disabled={saving || report?.status === 'final'}>
                {t.reportBuilder.finalizeReport}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFullscreen(false)}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <RichTextEditor
              value={content}
              onChange={setContent}
              disabled={report?.status === 'final'}
              minHeight="calc(95vh - 120px)"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
