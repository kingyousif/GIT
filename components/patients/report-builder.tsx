'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardCopy, FileOutput, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { DIAGNOSIS_SUGGESTIONS, RECOMMENDATION_SUGGESTIONS } from '@/lib/constants';
import { getTemplates, saveReport } from '@/lib/queries';
import { reportSchema } from '@/lib/schemas';
import { AppSettings, Patient, ProcedureSession, Report, ReportTemplate } from '@/lib/types';
import { createTextReportCopy, formatDateTime, getProcedureLabel } from '@/lib/utils';
import { useLocale } from '@/hooks/use-locale';
import { saveReportSnapshot } from '@/lib/report-snapshot';

interface ReportFormValues {
  doctorName: string;
  templateUsed?: string;
  sections: { title: string; content: string }[];
  diagnosis: string[];
  recommendations: string[];
  followUp?: string;
  biopsy: boolean;
  biopsyLocation?: string;
  biopsySentTo?: string;
  status: 'draft' | 'final';
}

function buildDefaultSections(session: ProcedureSession) {
  return [
    { title: 'Indication', content: session.indication || 'Procedure indication not recorded.' },
    { title: 'Procedure Description', content: 'Procedure performed as per standard protocol.' },
    { title: 'Findings', content: session.findings || '' },
    { title: 'Impressions/Diagnosis', content: '' },
  ];
}

function buildInitialValues(session: ProcedureSession, report?: Report | null): ReportFormValues {
  return {
    doctorName: report?.doctorName ?? session.doctorName,
    templateUsed: report?.templateUsed,
    sections: report?.sections?.length ? report.sections : buildDefaultSections(session),
    diagnosis: report?.diagnosis ?? [],
    recommendations: report?.recommendations ?? [],
    followUp: report?.followUp ?? '',
    biopsy: report?.biopsy ?? false,
    biopsyLocation: report?.biopsyLocation ?? '',
    biopsySentTo: report?.biopsySentTo ?? '',
    status: report?.status ?? 'draft',
  };
}

export function ReportBuilder({
  patient,
  session,
  report,
  settings,
  onAfterSave,
  onOpenPrint,
}: {
  patient: Patient;
  session: ProcedureSession;
  report?: Report | null;
  settings: AppSettings;
  onAfterSave?: (saved: Report) => void | Promise<void>;
  onOpenPrint?: (saved: Report) => void | Promise<void>;
}) {
  const { t } = useLocale();
  const persistedReportRef = useRef<Report | null>(report ?? null);
  const templates = useMemo(() => getTemplates().filter((item) => item.procedureType === session.procedureType), [session.procedureType]);
  const [customDiagnosis, setCustomDiagnosis] = useState('');
  const [customRecommendation, setCustomRecommendation] = useState('');

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: buildInitialValues(session, report),
  });
  const { register, handleSubmit, setValue, watch, getValues, control, reset, formState: { errors, isDirty, isSubmitting } } = form;
  const { fields, replace } = useFieldArray({ control, name: 'sections' });

  useEffect(() => {
    persistedReportRef.current = report ?? null;
    reset(buildInitialValues(session, report));
  }, [report, reset, session]);

  const selectedTemplateId = watch('templateUsed');
  const diagnoses = watch('diagnosis');
  const recommendations = watch('recommendations');
  const biopsy = watch('biopsy');
  const isLocked = watch('status') === 'final';

  const quickDiagnosis = useMemo(() => {
    const template = templates.find((item) => item.id === selectedTemplateId);
    const fromTemplate = template?.diagnoses ?? [];
    return Array.from(new Set([...fromTemplate, ...(DIAGNOSIS_SUGGESTIONS[session.procedureType] ?? [])]));
  }, [selectedTemplateId, session.procedureType, templates]);

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    replace(template.sections.map((section) => ({ title: section.title, content: section.defaultContent })));
    setValue('templateUsed', templateId, { shouldDirty: true });
    toast.success(`Applied template: ${template.name}`);
  };

  const toggleArrayValue = (fieldName: 'diagnosis' | 'recommendations', value: string) => {
    const current = getValues(fieldName);
    const exists = current.includes(value);
    const next = exists ? current.filter((item) => item !== value) : [...current, value];
    setValue(fieldName, next, { shouldDirty: true, shouldValidate: true });
  };

  const persistReport = async (
    status: 'draft' | 'final',
    values = getValues(),
    notifyParent = true,
  ) => {
    const payload = { ...values, status };
    const parsed = reportSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn('[ReportBuilder] Zod Validation Failed:', parsed.error.format());
      toast.error(`Validation failed: ${parsed.error.errors.map(e => e.message).join(', ')}`);
      return null;
    }

    try {
      const currentReport = persistedReportRef.current;
      const saved = await saveReport({
        id: currentReport?.id,
        createdAt: currentReport?.createdAt,
        sessionId: session.id,
        doctorName: parsed.data.doctorName,
        templateUsed: parsed.data.templateUsed,
        sections: parsed.data.sections,
        diagnosis: parsed.data.diagnosis,
        recommendations: parsed.data.recommendations,
        followUp: parsed.data.followUp,
        biopsy: parsed.data.biopsy,
        biopsyLocation: parsed.data.biopsyLocation,
        biopsySentTo: parsed.data.biopsySentTo,
        status,
      });
      persistedReportRef.current = saved;
      reset(buildInitialValues(session, saved));
      // Create / update snapshot in media tab
      try {
        await saveReportSnapshot({ patient, session, report: saved, settings });
      } catch (err) {
        console.error('Snapshot failed:', err);
      }
      if (notifyParent) await onAfterSave?.(saved);
      toast.success(status === 'final' ? 'Report finalized successfully.' : 'Draft saved successfully.');
      return saved;
    } catch (error) {
      console.error(error);
      toast.error('Unable to save report.');
      return null;
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      const values = getValues();
      if (values.status === 'final' || !isDirty) return;
      void persistReport('draft', values, false);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [getValues, isDirty]);

  const onInvalid = (errors: any) => {
    console.warn('[ReportBuilder] Form validation errors:', errors);
    toast.error('Cannot save report: Please check for missing required fields (e.g. Doctor name).');
  };

  const copyToClipboard = async () => {
    const values = getValues();
    const text = createTextReportCopy({
      hospitalName: settings.hospitalName,
      departmentName: settings.departmentName,
      patientName: patient.fullName,
      patientCode: patient.patientCode,
      procedureLabel: getProcedureLabel(session.procedureType),
      doctorName: values.doctorName,
      dateTime: formatDateTime(session.scheduledAt),
      sections: values.sections,
      diagnosis: values.diagnosis,
      recommendations: values.recommendations,
      followUp: values.followUp,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Report copied to clipboard.');
    } catch (error) {
      console.error(error);
      toast.error('Clipboard access failed.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.reportBuilder.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label>{t.reportBuilder.templateSelector}</Label>
              <Select value={selectedTemplateId || ''} onValueChange={applyTemplate} disabled={isLocked}>
                <SelectItem value="">{t.reportBuilder.selectTemplate}</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Doctor</Label>
              <Input {...register('doctorName')} disabled={isLocked} />
              {errors.doctorName ? <p className="text-sm text-rose-600">{errors.doctorName.message}</p> : null}
            </div>
          </div>

          {isLocked ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {t.reportBuilder.reportLocked}
            </div>
          ) : null}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-2 rounded-2xl border border-card-border p-4">
                <Label>{field.title}</Label>
                <input type="hidden" {...register(`sections.${index}.title` as const)} />
                <Controller
                  control={control}
                  name={`sections.${index}.content` as const}
                  render={({ field: ctrlField }) => (
                    <RichTextEditor
                      value={ctrlField.value || ''}
                      onChange={ctrlField.onChange}
                      disabled={isLocked}
                      minHeight="120px"
                    />
                  )}
                />
                {errors.sections?.[index]?.content ? (
                  <p className="text-sm text-rose-600">{errors.sections[index]?.content?.message}</p>
                ) : null}
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>{t.reportBuilder.diagnosisQuickSelect}</Label>
            <div className="flex flex-wrap gap-2">
              {quickDiagnosis.map((item) => {
                const active = diagnoses.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={isLocked}
                    onClick={() => toggleArrayValue('diagnosis', item)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-card-border bg-card text-foreground hover:border-primary hover:text-primary'}`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={customDiagnosis} onChange={(e) => setCustomDiagnosis(e.target.value)} placeholder={t.reportBuilder.addCustomDiagnosis} disabled={isLocked} />
              <Button
                variant="outline"
                disabled={isLocked || !customDiagnosis.trim()}
                onClick={() => {
                  const value = customDiagnosis.trim();
                  if (!value) return;
                  if (!diagnoses.includes(value)) setValue('diagnosis', [...diagnoses, value], { shouldDirty: true });
                  setCustomDiagnosis('');
                }}
              >
                {t.reportBuilder.addDiagnosis}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {diagnoses.map((item) => (
                <Badge key={item} className="cursor-pointer" onClick={() => !isLocked && toggleArrayValue('diagnosis', item)}>
                  {item}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>{t.reportBuilder.recommendations}</Label>
            <div className="flex flex-wrap gap-2">
              {RECOMMENDATION_SUGGESTIONS.map((item) => {
                const active = recommendations.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={isLocked}
                    onClick={() => toggleArrayValue('recommendations', item)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-card-border bg-card text-foreground hover:border-primary hover:text-primary'}`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={customRecommendation} onChange={(e) => setCustomRecommendation(e.target.value)} placeholder={t.reportBuilder.addRecommendationPlaceholder} disabled={isLocked} />
              <Button
                variant="outline"
                disabled={isLocked || !customRecommendation.trim()}
                onClick={() => {
                  const value = customRecommendation.trim();
                  if (!value) return;
                  if (!recommendations.includes(value)) setValue('recommendations', [...recommendations, value], { shouldDirty: true });
                  setCustomRecommendation('');
                }}
              >
                {t.reportBuilder.addRecommendation}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendations.map((item) => (
                <Badge key={item} variant="secondary" className="cursor-pointer" onClick={() => !isLocked && toggleArrayValue('recommendations', item)}>
                  {item}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-card-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.reportBuilder.biopsyTaken}</Label>
                  <p className="text-sm text-muted-foreground">{t.reportBuilder.biopsyDesc}</p>
                </div>
                <Switch checked={biopsy} onCheckedChange={(value) => setValue('biopsy', value, { shouldDirty: true })} disabled={isLocked} />
              </div>
              {biopsy ? (
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>{t.reportBuilder.biopsyLocation}</Label>
                    <Input {...register('biopsyLocation')} disabled={isLocked} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.reportBuilder.sentToLab}</Label>
                    <Input {...register('biopsySentTo')} disabled={isLocked} />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-2 rounded-2xl border border-card-border p-4">
              <Label>{t.reportBuilder.followUp}</Label>
              <Controller
                control={control}
                name="followUp"
                render={({ field }) => (
                  <RichTextEditor
                    value={field.value || ''}
                    onChange={field.onChange}
                    disabled={isLocked}
                    placeholder={t.reportBuilder.followUpPlaceholder}
                    minHeight="140px"
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button disabled={isSubmitting} onClick={handleSubmit(async (values) => void persistReport('draft', values), onInvalid)}>
              <Save className="h-4 w-4" /> {t.reportBuilder.saveDraft}
            </Button>
            <Button variant="outline" disabled={isLocked || isSubmitting} onClick={handleSubmit(async (values) => void persistReport('final', values), onInvalid)}>
              <FileOutput className="h-4 w-4" /> {t.reportBuilder.finalizeReport}
            </Button>
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={handleSubmit(async (values) => {
                const currentReport = persistedReportRef.current;
                if (isLocked && currentReport) {
                  await onOpenPrint?.(currentReport);
                  return;
                }
                const saved = await persistReport('draft', values);
                if (saved) await onOpenPrint?.(saved);
              }, onInvalid)}
            >
              🖨️ {t.reportBuilder.printReport}
            </Button>
            <Button variant="outline" onClick={() => copyToClipboard()}>
              <ClipboardCopy className="h-4 w-4" /> {t.reportBuilder.copyClipboard}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
