"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ClipboardCopy,
  FileOutput,
  Save,
  Check,
  Bold,
  Highlighter,
  Palette,
  Trash2,
  Plus,
  Pencil,
  X,
  RotateCcw,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  DIAGNOSIS_SUGGESTIONS,
  RECOMMENDATION_SUGGESTIONS,
} from "@/lib/constants";
import { getTemplates, saveReport } from "@/lib/queries";
import { reportSchema } from "@/lib/schemas";
import {
  AppSettings,
  Patient,
  ProcedureSession,
  Report,
  ReportTemplate,
} from "@/lib/types";
import {
  cn,
  createTextReportCopy,
  formatDateTime,
  formatRecommendationHtml,
  getProcedureLabel,
  parseRecommendation,
} from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";
import { saveReportSnapshot } from "@/lib/report-snapshot";

const SECTION_TITLE_COLORS = [
  { name: "Navy / Default", value: "#0f172a" },
  { name: "Red", value: "#dc2626" },
  { name: "Teal", value: "#0f766e" },
  { name: "Blue", value: "#2563eb" },
  { name: "Orange", value: "#ea580c" },
  { name: "Amber", value: "#d97706" },
  { name: "Green", value: "#16a34a" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
];

const REC_TEXT_COLORS = [
  { name: "Default (Navy)", value: "#0f172a" },
  { name: "Red", value: "#dc2626" },
  { name: "Blue", value: "#2563eb" },
  { name: "Green", value: "#16a34a" },
  { name: "Amber", value: "#d97706" },
  { name: "Orange", value: "#ea580c" },
  { name: "Purple", value: "#7c3aed" },
];

const REC_BG_COLORS = [
  { name: "No Highlight", value: "transparent" },
  { name: "Yellow Highlight", value: "#fef08a" },
  { name: "Soft Red", value: "#fee2e2" },
  { name: "Soft Blue", value: "#dbeafe" },
  { name: "Soft Green", value: "#dcfce7" },
  { name: "Soft Amber", value: "#fef3c7" },
  { name: "Soft Purple", value: "#f3e8ff" },
];

const REC_FONT_SIZES = [
  { name: "Small", value: "10px" },
  { name: "Normal", value: "11.5px" },
  { name: "Medium", value: "13px" },
  { name: "Large", value: "15px" },
  { name: "XL", value: "17px" },
];

interface ReportFormValues {
  doctorName: string;
  templateUsed?: string;
  sections: { title: string; content: string; titleColor?: string }[];
  diagnosis: string[];
  recommendations: string[];
  followUp?: string;
  biopsy: boolean;
  biopsyLocation?: string;
  biopsySentTo?: string;
  status: "draft" | "final";
}

function buildDefaultSections(session: ProcedureSession) {
  return [
    {
      title: "Indication",
      content: session.indication || "Procedure indication not recorded.",
      titleColor: "#0f172a",
    },
    {
      title: "Procedure Description",
      content: "Procedure performed as per standard protocol.",
      titleColor: "#0f172a",
    },
    {
      title: "Findings",
      content: session.findings || "",
      titleColor: "#0f172a",
    },
    { title: "Impressions/Diagnosis", content: "", titleColor: "#0f172a" },
  ];
}

function buildInitialValues(
  session: ProcedureSession,
  report?: Report | null,
): ReportFormValues {
  return {
    doctorName: report?.doctorName ?? session.doctorName,
    templateUsed: report?.templateUsed,
    sections: report?.sections?.length
      ? report.sections
      : buildDefaultSections(session),
    diagnosis: report?.diagnosis ?? [],
    recommendations: report?.recommendations ?? [],
    followUp: report?.followUp ?? "",
    biopsy: report?.biopsy ?? false,
    biopsyLocation: report?.biopsyLocation ?? "",
    biopsySentTo: report?.biopsySentTo ?? "",
    status: report?.status ?? "draft",
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
  const currentReportIdRef = useRef<string | undefined>(report?.id);
  const lastSavedJsonRef = useRef<string>(
    JSON.stringify(buildInitialValues(session, report)),
  );
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);

  const templates = useMemo(
    () =>
      getTemplates().filter(
        (item) => item.procedureType === session.procedureType,
      ),
    [session.procedureType],
  );
  const [customDiagnosis, setCustomDiagnosis] = useState("");
  const [customRecommendation, setCustomRecommendation] = useState("");
  const [recBold, setRecBold] = useState(false);
  const [recColor, setRecColor] = useState("#0f172a");
  const [recBgColor, setRecBgColor] = useState("transparent");
  const [recFontSize, setRecFontSize] = useState("11.5px");
  const [editingRecIndex, setEditingRecIndex] = useState<number | null>(null);
  const [editingRecText, setEditingRecText] = useState("");
  const [activeRecColorPicker, setActiveRecColorPicker] = useState<number | null>(null);
  const [activeRecBgPicker, setActiveRecBgPicker] = useState<number | null>(null);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: buildInitialValues(session, report),
  });
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = form;
  const { fields, replace } = useFieldArray({ control, name: "sections" });

  useEffect(() => {
    // Only reset if switching to a genuinely different report (not on in-place saves)
    if (report?.id !== currentReportIdRef.current) {
      currentReportIdRef.current = report?.id;
      persistedReportRef.current = report ?? null;
      reset(buildInitialValues(session, report));
      lastSavedJsonRef.current = JSON.stringify(
        buildInitialValues(session, report),
      );
    }
  }, [report?.id, reset, session]);

  const selectedTemplateId = watch("templateUsed");
  const diagnoses = watch("diagnosis");
  const recommendations = watch("recommendations");
  const biopsy = watch("biopsy");
  const isLocked = watch("status") === "final";

  const quickDiagnosis = useMemo(() => {
    const template = templates.find((item) => item.id === selectedTemplateId);
    const fromTemplate = template?.diagnoses ?? [];
    return Array.from(
      new Set([
        ...fromTemplate,
        ...(DIAGNOSIS_SUGGESTIONS[session.procedureType] ?? []),
      ]),
    );
  }, [selectedTemplateId, session.procedureType, templates]);

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    replace(
      template.sections.map((section) => ({
        title: section.title,
        content: section.defaultContent,
        titleColor: section.titleColor || "#0f172a",
      })),
    );
    setValue("templateUsed", templateId, { shouldDirty: true });
    toast.success(`Applied template: ${template.name}`);
  };

  const toggleArrayValue = (
    fieldName: "diagnosis" | "recommendations",
    value: string,
  ) => {
    const current = getValues(fieldName);
    const exists = current.includes(value);
    const next = exists
      ? current.filter((item) => item !== value)
      : [...current, value];
    setValue(fieldName, next, { shouldDirty: true, shouldValidate: true });
  };

  const persistReport = async (
    status: "draft" | "final",
    values = getValues(),
    notifyParent = true,
    isAutoSave = false,
  ) => {
    const payload = { ...values, status };
    const parsed = reportSchema.safeParse(payload);
    if (!parsed.success) {
      if (!isAutoSave) {
        console.warn(
          "[ReportBuilder] Zod Validation Failed:",
          parsed.error.format(),
        );
        toast.error(
          `Validation failed: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
        );
      }
      return null;
    }

    // Preserve scroll position so viewport NEVER jumps
    const savedScrollY = typeof window !== "undefined" ? window.scrollY : 0;

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
        selectedImages: currentReport?.selectedImages,
        printMode: currentReport?.printMode,
        status,
      });

      persistedReportRef.current = saved;
      currentReportIdRef.current = saved.id;
      lastSavedJsonRef.current = JSON.stringify(values);

      // Create / update snapshot in media tab asynchronously without blocking
      saveReportSnapshot({ patient, session, report: saved, settings }).catch(
        (err) => {
          console.error("Snapshot failed:", err);
        },
      );

      if (isAutoSave) {
        // Silent background save: NO TOAST, NO RESET, NO SCROLL JUMP
        setLastAutoSavedAt(new Date());
        return saved;
      }

      if (notifyParent) await onAfterSave?.(saved);
      toast.success(
        status === "final"
          ? "Report finalized successfully."
          : "Draft saved successfully.",
      );

      // Restore scroll position as a guarantee against browser layout shifts
      if (
        typeof window !== "undefined" &&
        Math.abs(window.scrollY - savedScrollY) > 5
      ) {
        window.scrollTo({
          top: savedScrollY,
          behavior: "instant" as ScrollBehavior,
        });
      }

      return saved;
    } catch (error) {
      console.error(error);
      if (!isAutoSave) {
        toast.error("Unable to save report.");
      }
      return null;
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      const values = getValues();
      if (values.status === "final" || isLocked) return;

      const currentJson = JSON.stringify(values);
      // Skip if nothing changed since last save
      if (currentJson === lastSavedJsonRef.current) return;

      void persistReport("draft", values, false, true);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [getValues, isLocked]);

  const onInvalid = (errors: any) => {
    console.warn("[ReportBuilder] Form validation errors:", errors);
    toast.error(
      "Cannot save report: Please check for missing required fields (e.g. Doctor name).",
    );
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
      toast.success("Report copied to clipboard.");
    } catch (error) {
      console.error(error);
      toast.error("Clipboard access failed.");
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
              <Select
                value={selectedTemplateId || ""}
                onValueChange={applyTemplate}
                disabled={isLocked}
              >
                <SelectItem value="">
                  {t.reportBuilder.selectTemplate}
                </SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Doctor</Label>
              <Input {...register("doctorName")} disabled={isLocked} />
              {errors.doctorName ? (
                <p className="text-sm text-rose-600">
                  {errors.doctorName.message}
                </p>
              ) : null}
            </div>
          </div>

          {isLocked ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {t.reportBuilder.reportLocked}
            </div>
          ) : null}

          <div className="space-y-4">
            {fields.map((field, index) => {
              const currentTitleColor =
                watch(`sections.${index}.titleColor`) || "#0f172a";
              return (
                <div
                  key={field.id}
                  className="space-y-3 rounded-2xl border border-card-border bg-card/60 p-4.5 shadow-2xs transition-all hover:border-primary/40"
                  style={{
                    borderLeftWidth: "4px",
                    borderLeftColor: currentTitleColor,
                  }}
                >
                  {/* Section Title Bar & Color Palette */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border/60 pb-3">
                    <div className="flex flex-1 items-center gap-2.5 min-w-[240px]">
                      <span
                        className="h-3.5 w-3.5 rounded-full shrink-0 shadow-2xs transition-colors"
                        style={{ backgroundColor: currentTitleColor }}
                      />
                      <Input
                        {...register(`sections.${index}.title` as const)}
                        disabled={isLocked}
                        placeholder="Section Title (e.g. Procedure, Findings...)"
                        className="h-9 font-bold text-sm tracking-wide transition-colors"
                        style={{ color: currentTitleColor }}
                      />
                      <input
                        type="hidden"
                        {...register(`sections.${index}.titleColor` as const)}
                      />
                    </div>

                    {/* Color Swatches */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Title Color:
                      </span>
                      <div className="flex items-center gap-1 rounded-lg border border-card-border/70 bg-background/80 p-1 shadow-2xs">
                        {SECTION_TITLE_COLORS.map((c) => {
                          const active =
                            currentTitleColor.toLowerCase() ===
                            c.value.toLowerCase();
                          return (
                            <button
                              key={c.value}
                              type="button"
                              disabled={isLocked}
                              onClick={() =>
                                setValue(
                                  `sections.${index}.titleColor` as const,
                                  c.value,
                                  { shouldDirty: true },
                                )
                              }
                              className={cn(
                                "h-5 w-5 rounded-full transition-transform hover:scale-115 active:scale-95 shadow-2xs cursor-pointer",
                                active &&
                                  "ring-2 ring-primary ring-offset-1 scale-110",
                              )}
                              style={{ backgroundColor: c.value }}
                              title={c.name}
                            />
                          );
                        })}
                        {/* Custom Color Input */}
                        <label
                          className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-card-border bg-gradient-to-tr from-rose-500 via-amber-400 to-indigo-500 hover:scale-115 transition-transform shadow-2xs"
                          title="Custom Color..."
                        >
                          <input
                            type="color"
                            disabled={isLocked}
                            value={currentTitleColor}
                            onChange={(e) =>
                              setValue(
                                `sections.${index}.titleColor` as const,
                                e.target.value,
                                { shouldDirty: true },
                              )
                            }
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Section Content Editor */}
                  <Controller
                    control={control}
                    name={`sections.${index}.content` as const}
                    render={({ field: ctrlField }) => (
                      <RichTextEditor
                        value={ctrlField.value || ""}
                        onChange={ctrlField.onChange}
                        disabled={isLocked}
                        minHeight="120px"
                      />
                    )}
                  />
                  {errors.sections?.[index]?.content ? (
                    <p className="text-sm text-rose-600">
                      {errors.sections[index]?.content?.message}
                    </p>
                  ) : null}
                </div>
              );
            })}
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
                    onClick={() => toggleArrayValue("diagnosis", item)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-card-border bg-card text-foreground hover:border-primary hover:text-primary"}`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={customDiagnosis}
                onChange={(e) => setCustomDiagnosis(e.target.value)}
                placeholder={t.reportBuilder.addCustomDiagnosis}
                disabled={isLocked}
              />
              <Button
                variant="outline"
                disabled={isLocked || !customDiagnosis.trim()}
                onClick={() => {
                  const value = customDiagnosis.trim();
                  if (!value) return;
                  if (!diagnoses.includes(value))
                    setValue("diagnosis", [...diagnoses, value], {
                      shouldDirty: true,
                    });
                  setCustomDiagnosis("");
                }}
              >
                {t.reportBuilder.addDiagnosis}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {diagnoses.map((item) => (
                <Badge
                  key={item}
                  className="cursor-pointer"
                  onClick={() =>
                    !isLocked && toggleArrayValue("diagnosis", item)
                  }
                >
                  {item}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">{t.reportBuilder.recommendations}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select suggestions or add custom instructions with bold text, text color, and highlight styling.
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {recommendations.length} added
              </span>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap gap-2">
              {RECOMMENDATION_SUGGESTIONS.map((item) => {
                const active = recommendations.some(
                  (r) => parseRecommendation(r).text.toLowerCase() === item.toLowerCase()
                );
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) return;
                      const existingIndex = recommendations.findIndex(
                        (r) => parseRecommendation(r).text.toLowerCase() === item.toLowerCase()
                      );
                      if (existingIndex >= 0) {
                        const next = recommendations.filter((_, idx) => idx !== existingIndex);
                        setValue("recommendations", next, { shouldDirty: true });
                      } else {
                        const formatted = formatRecommendationHtml(item, {
                          bold: recBold,
                          color: recColor,
                          bgColor: recBgColor,
                          fontSize: recFontSize,
                        });
                        setValue("recommendations", [...recommendations, formatted], {
                          shouldDirty: true,
                        });
                      }
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer shadow-2xs",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-card-border bg-card/80 text-foreground hover:border-primary/60 hover:text-primary",
                    )}
                  >
                    {active ? "✓ " : "+ "}{item}
                  </button>
                );
              })}
            </div>

            {/* Custom Recommendation Input & Formatting Toolbar */}
            <div className="rounded-2xl border border-card-border bg-card/50 p-3.5 space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border/60 pb-2.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Text Style & Color
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Bold Button */}
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setRecBold(!recBold)}
                    className={cn(
                      "flex h-7 px-2.5 items-center gap-1 rounded-md border text-xs font-bold transition-all cursor-pointer shadow-2xs",
                      recBold
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-card-border bg-background/80 text-foreground hover:bg-muted",
                    )}
                    title="Toggle Bold"
                  >
                    <Bold className="h-3.5 w-3.5" />
                    <span>Bold</span>
                  </button>

                  {/* Text Color Swatches */}
                  <div className="flex items-center gap-1 rounded-md border border-card-border bg-background/80 px-2 py-1 shadow-2xs">
                    <span className="text-[11px] font-medium text-muted-foreground mr-1">Color:</span>
                    {REC_TEXT_COLORS.map((c) => {
                      const active = recColor.toLowerCase() === c.value.toLowerCase();
                      return (
                        <button
                          key={c.value}
                          type="button"
                          disabled={isLocked}
                          onClick={() => setRecColor(c.value)}
                          className={cn(
                            "h-4.5 w-4.5 rounded-full transition-transform hover:scale-120 cursor-pointer shadow-2xs",
                            active && "ring-2 ring-primary ring-offset-1 scale-110",
                          )}
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                        />
                      );
                    })}
                    <label
                      className="relative flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-full border border-card-border bg-gradient-to-tr from-rose-500 via-amber-400 to-indigo-500 hover:scale-120 transition-transform shadow-2xs"
                      title="Custom text color"
                    >
                      <input
                        type="color"
                        disabled={isLocked}
                        value={recColor}
                        onChange={(e) => setRecColor(e.target.value)}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {/* Highlight Background Swatches */}
                  <div className="flex items-center gap-1 rounded-md border border-card-border bg-background/80 px-2 py-1 shadow-2xs">
                    <Highlighter className="h-3 w-3 text-muted-foreground mr-1" />
                    <span className="text-[11px] font-medium text-muted-foreground mr-1">Highlight:</span>
                    {REC_BG_COLORS.map((c) => {
                      const active = recBgColor.toLowerCase() === c.value.toLowerCase();
                      return (
                        <button
                          key={c.value}
                          type="button"
                          disabled={isLocked}
                          onClick={() => setRecBgColor(c.value)}
                          className={cn(
                            "h-4.5 w-4.5 rounded-full border transition-transform hover:scale-120 cursor-pointer shadow-2xs",
                            c.value === "transparent" ? "border-dashed border-stone-400 bg-white dark:bg-stone-800" : "border-stone-300",
                            active && "ring-2 ring-primary ring-offset-1 scale-110",
                          )}
                          style={c.value !== "transparent" ? { backgroundColor: c.value } : undefined}
                          title={c.name}
                        />
                      );
                    })}
                    <label
                      className="relative flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-full border border-card-border bg-gradient-to-tr from-yellow-300 via-emerald-300 to-cyan-300 hover:scale-120 transition-transform shadow-2xs"
                      title="Custom highlight color"
                    >
                      <input
                        type="color"
                        disabled={isLocked}
                        value={recBgColor === "transparent" ? "#fef08a" : recBgColor}
                        onChange={(e) => setRecBgColor(e.target.value)}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {/* Font Size Selector */}
                  <div className="flex items-center gap-1.5 rounded-md border border-card-border bg-background/80 px-2 py-1 shadow-2xs">
                    <Type className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-medium text-muted-foreground mr-0.5">Size:</span>
                    <select
                      disabled={isLocked}
                      value={recFontSize}
                      onChange={(e) => setRecFontSize(e.target.value)}
                      className="h-5.5 rounded bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                    >
                      {REC_FONT_SIZES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.name} ({s.value})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reset formatting */}
                  {(recBold || recColor !== "#0f172a" || recBgColor !== "transparent" || recFontSize !== "11.5px") && (
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        setRecBold(false);
                        setRecColor("#0f172a");
                        setRecBgColor("transparent");
                        setRecFontSize("11.5px");
                      }}
                      className="flex h-7 px-2 items-center gap-1 rounded-md border border-card-border bg-background/80 text-[11px] font-medium text-muted-foreground hover:text-foreground transition shadow-2xs cursor-pointer"
                      title="Reset formatting"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Input & Add Button */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={customRecommendation}
                  onChange={(e) => setCustomRecommendation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const value = customRecommendation.trim();
                      if (!value) return;
                      const formatted = formatRecommendationHtml(value, {
                        bold: recBold,
                        color: recColor,
                        bgColor: recBgColor,
                        fontSize: recFontSize,
                      });
                      setValue("recommendations", [...recommendations, formatted], {
                        shouldDirty: true,
                      });
                      setCustomRecommendation("");
                    }
                  }}
                  placeholder={t.reportBuilder.addRecommendationPlaceholder || "Type custom recommendation..."}
                  disabled={isLocked}
                  className="flex-1"
                  style={{
                    color: recColor !== "#0f172a" ? recColor : undefined,
                    fontWeight: recBold ? 700 : undefined,
                    fontSize: recFontSize !== "11.5px" ? recFontSize : undefined,
                  }}
                />
                <Button
                  variant="outline"
                  disabled={isLocked || !customRecommendation.trim()}
                  onClick={() => {
                    const value = customRecommendation.trim();
                    if (!value) return;
                    const formatted = formatRecommendationHtml(value, {
                      bold: recBold,
                      color: recColor,
                      bgColor: recBgColor,
                      fontSize: recFontSize,
                    });
                    setValue("recommendations", [...recommendations, formatted], {
                      shouldDirty: true,
                    });
                    setCustomRecommendation("");
                  }}
                  className="shrink-0 font-medium"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t.reportBuilder.addRecommendation}
                </Button>
              </div>

              {/* Live Preview */}
              {customRecommendation.trim() ? (
                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground border-t border-card-border/40">
                  <span className="font-semibold text-foreground">Live Print Preview:</span>
                  <span
                    className="inline-block"
                    dangerouslySetInnerHTML={{
                      __html: formatRecommendationHtml(customRecommendation.trim(), {
                        bold: recBold,
                        color: recColor,
                        bgColor: recBgColor,
                        fontSize: recFontSize,
                      }),
                    }}
                  />
                </div>
              ) : null}
            </div>

            {/* List of Added Recommendations */}
            <div className="space-y-2">
              {recommendations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-card-border p-4 text-center text-xs text-muted-foreground">
                  No recommendations added yet. Click suggestions above or type custom instructions.
                </div>
              ) : (
                recommendations.map((item, index) => {
                  const parsed = parseRecommendation(item);
                  const isEditing = editingRecIndex === index;
                  const showColorPicker = activeRecColorPicker === index;
                  const showBgPicker = activeRecBgPicker === index;

                  return (
                    <div
                      key={index}
                      className="group flex flex-col gap-2 rounded-xl border border-card-border/80 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                            {index + 1}
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingRecText}
                                onChange={(e) => setEditingRecText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const text = editingRecText.trim();
                                    if (!text) {
                                      const next = recommendations.filter((_, idx) => idx !== index);
                                      setValue("recommendations", next, { shouldDirty: true });
                                    } else {
                                      const updated = formatRecommendationHtml(text, parsed);
                                      const next = [...recommendations];
                                      next[index] = updated;
                                      setValue("recommendations", next, { shouldDirty: true });
                                    }
                                    setEditingRecIndex(null);
                                    setEditingRecText("");
                                  }
                                  if (e.key === "Escape") {
                                    setEditingRecIndex(null);
                                    setEditingRecText("");
                                  }
                                }}
                                className="h-8 text-sm"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 px-2.5"
                                onClick={() => {
                                  const text = editingRecText.trim();
                                  if (!text) {
                                    const next = recommendations.filter((_, idx) => idx !== index);
                                    setValue("recommendations", next, { shouldDirty: true });
                                  } else {
                                    const updated = formatRecommendationHtml(text, parsed);
                                    const next = [...recommendations];
                                    next[index] = updated;
                                    setValue("recommendations", next, { shouldDirty: true });
                                  }
                                  setEditingRecIndex(null);
                                  setEditingRecText("");
                                }}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => {
                                  setEditingRecIndex(null);
                                  setEditingRecText("");
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="flex-1 text-sm leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: item }}
                            />
                          )}
                        </div>

                        {!isEditing && !isLocked && (
                          <div className="flex items-center gap-1 opacity-90 transition-opacity">
                            {/* Font size selector per card */}
                            <select
                              value={parsed.fontSize || "11.5px"}
                              onChange={(e) => {
                                const updated = formatRecommendationHtml(parsed.text, {
                                  ...parsed,
                                  fontSize: e.target.value,
                                });
                                const next = [...recommendations];
                                next[index] = updated;
                                setValue("recommendations", next, { shouldDirty: true });
                              }}
                              className="h-7 rounded-md border border-card-border bg-background px-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer shadow-2xs transition hover:border-primary/50"
                              title="Change Text Size"
                            >
                              {REC_FONT_SIZES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.name} ({s.value})
                                </option>
                              ))}
                            </select>

                            {/* Bold toggle */}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = formatRecommendationHtml(parsed.text, {
                                  ...parsed,
                                  bold: !parsed.bold,
                                });
                                const next = [...recommendations];
                                next[index] = updated;
                                setValue("recommendations", next, { shouldDirty: true });
                              }}
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold transition shadow-2xs cursor-pointer",
                                parsed.bold
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-card-border bg-background hover:bg-muted text-foreground",
                              )}
                              title="Toggle Bold"
                            >
                              <Bold className="h-3.5 w-3.5" />
                            </button>

                            {/* Color toggle button */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRecColorPicker(showColorPicker ? null : index);
                                setActiveRecBgPicker(null);
                              }}
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-md border text-xs transition shadow-2xs cursor-pointer",
                                showColorPicker
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-card-border bg-background hover:bg-muted",
                              )}
                              title="Change Text Color"
                            >
                              <Palette className="h-3.5 w-3.5" style={{ color: parsed.color !== "#0f172a" ? parsed.color : undefined }} />
                            </button>

                            {/* Background highlight toggle button */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRecBgPicker(showBgPicker ? null : index);
                                setActiveRecColorPicker(null);
                              }}
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-md border text-xs transition shadow-2xs cursor-pointer",
                                showBgPicker
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-card-border bg-background hover:bg-muted",
                              )}
                              title="Change Highlight Color"
                            >
                              <Highlighter className="h-3.5 w-3.5" style={{ color: parsed.bgColor !== "transparent" ? "#d97706" : undefined }} />
                            </button>

                            {/* Edit text button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRecIndex(index);
                                setEditingRecText(parsed.text);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-card-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition shadow-2xs cursor-pointer"
                              title="Edit Text"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => {
                                const next = recommendations.filter((_, idx) => idx !== index);
                                setValue("recommendations", next, { shouldDirty: true });
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-card-border bg-background text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shadow-2xs cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Expanded Text Color Picker for this item */}
                      {showColorPicker && (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-muted/40 p-2 text-xs animate-in fade-in duration-150">
                          <span className="font-medium text-muted-foreground text-[11px] mr-1">Choose Text Color:</span>
                          {REC_TEXT_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => {
                                const updated = formatRecommendationHtml(parsed.text, {
                                  ...parsed,
                                  color: c.value,
                                });
                                const next = [...recommendations];
                                next[index] = updated;
                                setValue("recommendations", next, { shouldDirty: true });
                                setActiveRecColorPicker(null);
                              }}
                              className={cn(
                                "h-5 w-5 rounded-full transition-transform hover:scale-120 cursor-pointer shadow-2xs",
                                parsed.color.toLowerCase() === c.value.toLowerCase() && "ring-2 ring-primary ring-offset-1 scale-110",
                              )}
                              style={{ backgroundColor: c.value }}
                              title={c.name}
                            />
                          ))}
                          <label
                            className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-card-border bg-gradient-to-tr from-rose-500 via-amber-400 to-indigo-500 hover:scale-120 transition-transform shadow-2xs ml-1"
                            title="Custom Color..."
                          >
                            <input
                              type="color"
                              value={parsed.color}
                              onChange={(e) => {
                                const updated = formatRecommendationHtml(parsed.text, {
                                  ...parsed,
                                  color: e.target.value,
                                });
                                const next = [...recommendations];
                                next[index] = updated;
                                setValue("recommendations", next, { shouldDirty: true });
                                setActiveRecColorPicker(null);
                              }}
                              className="sr-only"
                            />
                          </label>
                        </div>
                      )}

                      {/* Expanded Highlight Color Picker for this item */}
                      {showBgPicker && (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-muted/40 p-2 text-xs animate-in fade-in duration-150">
                          <span className="font-medium text-muted-foreground text-[11px] mr-1">Choose Highlight:</span>
                          {REC_BG_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => {
                                const updated = formatRecommendationHtml(parsed.text, {
                                  ...parsed,
                                  bgColor: c.value,
                                });
                                const next = [...recommendations];
                                next[index] = updated;
                                setValue("recommendations", next, { shouldDirty: true });
                                setActiveRecBgPicker(null);
                              }}
                              className={cn(
                                "h-5 w-5 rounded-full border transition-transform hover:scale-120 cursor-pointer shadow-2xs",
                                c.value === "transparent" ? "border-dashed border-stone-400 bg-white dark:bg-stone-800" : "border-stone-300",
                                parsed.bgColor.toLowerCase() === c.value.toLowerCase() && "ring-2 ring-primary ring-offset-1 scale-110",
                              )}
                              style={c.value !== "transparent" ? { backgroundColor: c.value } : undefined}
                              title={c.name}
                            />
                          ))}
                          <label
                            className="relative flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-card-border bg-gradient-to-tr from-yellow-300 via-emerald-300 to-cyan-300 hover:scale-120 transition-transform shadow-2xs ml-1"
                            title="Custom Highlight Color..."
                          >
                            <input
                              type="color"
                              value={parsed.bgColor === "transparent" ? "#fef08a" : parsed.bgColor}
                              onChange={(e) => {
                                const updated = formatRecommendationHtml(parsed.text, {
                                  ...parsed,
                                  bgColor: e.target.value,
                                });
                                const next = [...recommendations];
                                next[index] = updated;
                                setValue("recommendations", next, { shouldDirty: true });
                                setActiveRecBgPicker(null);
                              }}
                              className="sr-only"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-card-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.reportBuilder.biopsyTaken}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t.reportBuilder.biopsyDesc}
                  </p>
                </div>
                <Switch
                  checked={biopsy}
                  onCheckedChange={(value) =>
                    setValue("biopsy", value, { shouldDirty: true })
                  }
                  disabled={isLocked}
                />
              </div>
              {biopsy ? (
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>{t.reportBuilder.biopsyLocation}</Label>
                    <Input
                      {...register("biopsyLocation")}
                      disabled={isLocked}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.reportBuilder.sentToLab}</Label>
                    <Input {...register("biopsySentTo")} disabled={isLocked} />
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
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={isLocked}
                    placeholder={t.reportBuilder.followUpPlaceholder}
                    minHeight="140px"
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={isSubmitting}
              onClick={handleSubmit(
                async (values) =>
                  void persistReport("draft", values, true, false),
                onInvalid,
              )}
            >
              <Save className="h-4 w-4" /> {t.reportBuilder.saveDraft}
            </Button>
            <Button
              variant="outline"
              disabled={isLocked || isSubmitting}
              onClick={handleSubmit(
                async (values) =>
                  void persistReport("final", values, true, false),
                onInvalid,
              )}
            >
              <FileOutput className="h-4 w-4" />{" "}
              {t.reportBuilder.finalizeReport}
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
                const saved = await persistReport(
                  "draft",
                  values,
                  false,
                  false,
                );
                if (saved) await onOpenPrint?.(saved);
              }, onInvalid)}
            >
              🖨️ {t.reportBuilder.printReport}
            </Button>
            <Button variant="outline" onClick={() => copyToClipboard()}>
              <ClipboardCopy className="h-4 w-4" />{" "}
              {t.reportBuilder.copyClipboard}
            </Button>
            {lastAutoSavedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 ml-auto">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Draft autosaved (
                {lastAutoSavedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                )
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
