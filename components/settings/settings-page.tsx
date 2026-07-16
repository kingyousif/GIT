"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
import { PageHeader } from "@/components/shared/page-header";
import { UserManagement } from "@/components/settings/user-management";
import { useAppState } from "@/components/app-provider";
import {
  exportAllData,
  getTemplates,
  importAllData,
  resetAppData,
  saveSettings,
  upsertTemplate,
  deleteTemplate as removeTemplate,
} from "@/lib/queries";
import { settingsSchema, templateSchema } from "@/lib/schemas";
import {
  AppBackup,
  AppSettings,
  ProcedureType,
  ReportTemplate,
} from "@/lib/types";
import { downloadJson, fileToDataUrl, safeJsonParse } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";

interface TemplateDraft {
  id: string;
  name: string;
  procedureType: ProcedureType;
  sections: { title: string; defaultContent: string }[];
  diagnosesText: string;
}

export function SettingsPageContent() {
  const { t } = useLocale();
  const { settings, dataVersion, refreshData, refreshSettings } = useAppState();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(
    null,
  );
  const [templateDeleteId, setTemplateDeleteId] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [questionsDialogIndex, setQuestionsDialogIndex] = useState<number | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const form = useForm<AppSettings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings ?? undefined,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const doctorsFieldArray = useFieldArray({
    control,
    name: "doctors" as never,
  });
  const proceduresFieldArray = useFieldArray({ control, name: "procedures" });

  useEffect(() => {
    if (settings) reset(settings);
    setTemplates(getTemplates());
  }, [dataVersion, reset, settings]);

  const onSaveSettings = (values: AppSettings) => {
    try {
      saveSettings(values);
      refreshSettings();
      toast.success("Settings saved successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Unable to save settings.");
    }
  };

  const openNewTemplate = () => {
    setTemplateDraft({
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      name: "",
      procedureType: settings?.procedures[0]?.id ?? "upper-endoscopy",
      sections: [
        { title: "Indication", defaultContent: "" },
        { title: "Findings", defaultContent: "" },
      ],
      diagnosesText: "",
    });
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (template: ReportTemplate) => {
    setTemplateDraft({
      id: template.id,
      name: template.name,
      procedureType: template.procedureType,
      sections: template.sections,
      diagnosesText: template.diagnoses.join(", "),
    });
    setTemplateDialogOpen(true);
  };

  const saveTemplate = () => {
    if (!templateDraft) return;
    const parsed = templateSchema.safeParse({
      id: templateDraft.id,
      name: templateDraft.name,
      procedureType: templateDraft.procedureType,
      sections: templateDraft.sections,
      diagnoses: templateDraft.diagnosesText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });

    if (!parsed.success) {
      toast.error("Please complete the template details.");
      return;
    }

    try {
      upsertTemplate(parsed.data);
      setTemplates(getTemplates());
      setTemplateDialogOpen(false);
      refreshData();
      toast.success("Template saved successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save template.");
    }
  };

  const templateCounts = useMemo(() => {
    return templates.reduce<Record<string, number>>((acc, template) => {
      acc[template.procedureType] = (acc[template.procedureType] ?? 0) + 1;
      return acc;
    }, {});
  }, [templates]);

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.settings.eyebrow}
        title={t.settings.title}
        description={t.settings.description}
      />

      <Tabs defaultValue="hospital" className="space-y-6">
        <TabsList className="w-full justify-cente overflow-auto">
          <TabsTrigger className="flex-1" value="hospital">
            {t.settings.hospitalInfo}
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="procedures">
            {t.settings.procedures}
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="templates">
            {t.settings.reportTemplates}
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="users">
            {t.users.title}
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="data">
            {t.settings.dataManagement}
          </TabsTrigger>
        </TabsList>

        {/* ===== Hospital & Doctors Tab ===== */}
        <TabsContent value="hospital">
          <form className="space-y-6" onSubmit={handleSubmit(onSaveSettings)}>
            <Card>
              <CardHeader>
                <CardTitle>{t.settings.hospitalInfo}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field
                  label={t.settings.hospitalName}
                  error={errors.hospitalName?.message}
                >
                  <Input {...register("hospitalName")} />
                </Field>
                <Field
                  label={t.settings.departmentName}
                  error={errors.departmentName?.message}
                >
                  <Input {...register("departmentName")} />
                </Field>
                <Field
                  label={t.settings.addressLabel}
                  className="md:col-span-2"
                  error={errors.address?.message}
                >
                  <Textarea className="min-h-[90px]" {...register("address")} />
                </Field>
                <Field
                  label={t.settings.phoneLabel}
                  error={errors.phone?.message}
                >
                  <Input {...register("phone")} />
                </Field>
                <Field
                  label={t.settings.reportFooter}
                  className="md:col-span-2"
                  error={errors.reportFooter?.message}
                >
                  <Textarea {...register("reportFooter")} />
                </Field>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t.settings.hospitalLogo}</Label>
                  <div className="flex flex-col gap-3 rounded-2xl border border-card-border p-4 md:flex-row md:items-center">
                    {form.watch("hospitalLogo") ? (
                      <img
                        src={form.watch("hospitalLogo")}
                        alt="Hospital logo"
                        className="h-20 w-20 rounded-xl object-contain"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-2xl">
                        🏥
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.onchange = async () => {
                            const file = input.files?.[0];
                            if (!file) return;
                            const dataUrl = await fileToDataUrl(file);
                            setValue("hospitalLogo", dataUrl, {
                              shouldDirty: true,
                            });
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4" /> {t.settings.uploadLogo}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setValue("hospitalLogo", "", { shouldDirty: true })
                        }
                      >
                        {t.settings.removeLogo}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.settings.doctors}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {doctorsFieldArray.fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      {...register(`doctors.${index}`)}
                      placeholder={`Doctor ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => doctorsFieldArray.remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => doctorsFieldArray.append("New Doctor")}
                >
                  <Plus className="h-4 w-4" /> {t.settings.addDoctor}
                </Button>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {t.settings.saveSettings}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ===== Procedures & Preparations Tab ===== */}
        <TabsContent value="procedures">
          <form className="space-y-6" onSubmit={handleSubmit(onSaveSettings)}>
            <Card>
              <CardHeader>
                <CardTitle>{t.settings.procedures}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t.settings.proceduresDesc}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {proceduresFieldArray.fields.map((field, index) => (
                  <div key={field.id} className="space-y-2 rounded-xl border border-card-border p-3">
                    <div className="grid gap-2 md:grid-cols-[80px_1fr_1fr_auto_auto] md:items-center">
                      <Input
                        {...register(`procedures.${index}.icon`)}
                        placeholder="🫁"
                        className="text-center"
                        maxLength={4}
                      />
                      <Input
                        {...register(`procedures.${index}.id`)}
                        placeholder={t.settings.procedureId}
                        className="font-mono text-sm"
                      />
                      <Input
                        {...register(`procedures.${index}.label`)}
                        placeholder={t.settings.procedureLabel}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuestionsDialogIndex(index)}
                      >
                        {t.settings.questions} ({form.watch(`procedures.${index}.questions`)?.length || 0})
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => proceduresFieldArray.remove(index)}
                        disabled={proceduresFieldArray.fields.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    proceduresFieldArray.append({
                      id: `procedure-${Date.now()}`,
                      label: "New Procedure",
                      icon: "🩺",
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> {t.settings.addProcedure}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.settings.defaultPreparations}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {settings.procedures.map((proc) => (
                  <Field
                    key={proc.id}
                    label={proc.label}
                    error={
                      (
                        errors.defaultPreparations as
                          | Record<string, { message?: string }>
                          | undefined
                      )?.[proc.id]?.message
                    }
                  >
                    <Textarea {...register(`defaultPreparations.${proc.id}`)} />
                  </Field>
                ))}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {t.settings.saveSettings}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ===== Templates Tab ===== */}
        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{t.settings.reportTemplates}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t.settings.reportTemplatesDesc}
                </p>
              </div>
              <Button onClick={openNewTemplate}>
                <Plus className="h-4 w-4" /> {t.settings.newTemplate}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {Object.entries(templateCounts).map(([type, count]) => (
                  <div
                    key={type}
                    className="rounded-2xl border border-card-border bg-muted p-4 text-sm text-muted-foreground"
                  >
                    <p className="font-medium capitalize text-foreground">
                      {type.replace(/-/g, " ")}
                    </p>
                    <p>
                      {count} {t.settings.templates}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-2xl border border-card-border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {template.name}
                        </h3>
                        <p className="text-sm capitalize text-muted-foreground">
                          {template.procedureType.replace(/-/g, " ")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditTemplate(template)}
                        >
                          {t.common.edit}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setTemplateDeleteId(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">
                          {t.settings.sections}:
                        </span>{" "}
                        {template.sections
                          .map((section) => section.title)
                          .join(", ")}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          {t.settings.quickDiagnoses}:
                        </span>{" "}
                        {template.diagnoses.join(", ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Users Tab ===== */}
        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        {/* ===== Data Management Tab ===== */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>{t.settings.dataManagement}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={async () =>
                  downloadJson("endo-backup.json", await exportAllData())
                }
              >
                <Download className="h-4 w-4" /> {t.settings.exportAll}
              </Button>
              <Button
                variant="outline"
                onClick={() => importRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> {t.settings.importBackup}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setClearDialogOpen(true)}
              >
                {t.settings.clearAll}
              </Button>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const raw = await file.text();
                    const parsed = safeJsonParse<Record<
                      string,
                      unknown
                    > | null>(raw, null);
                    if (!parsed) throw new Error("Invalid JSON");
                    await importAllData(parsed as unknown as AppBackup);
                    refreshData();
                    toast.success("Backup imported successfully.");
                  } catch (error) {
                    console.error(error);
                    toast.error(
                      "Import failed. Please choose a valid JSON backup.",
                    );
                  } finally {
                    event.currentTarget.value = "";
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-4xl">
          {templateDraft ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {templates.some((item) => item.id === templateDraft.id)
                    ? t.settings.editTemplate
                    : t.settings.newTemplate}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t.settings.templateName}>
                  <Input
                    value={templateDraft.name}
                    onChange={(e) =>
                      setTemplateDraft((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev,
                      )
                    }
                  />
                </Field>
                <Field label={t.newPatient.procedureType}>
                  <Select
                    value={templateDraft.procedureType}
                    onValueChange={(value) =>
                      setTemplateDraft((prev) =>
                        prev
                          ? { ...prev, procedureType: value as ProcedureType }
                          : prev,
                      )
                    }
                  >
                    {settings.procedures.map((proc) => (
                      <SelectItem key={proc.id} value={proc.id}>
                        {proc.icon ? `${proc.icon} ` : ""}
                        {proc.label}
                      </SelectItem>
                    ))}
                  </Select>
                </Field>
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>{t.settings.sections}</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTemplateDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                sections: [
                                  ...prev.sections,
                                  { title: "New Section", defaultContent: "" },
                                ],
                              }
                            : prev,
                        )
                      }
                    >
                      <Plus className="h-4 w-4" /> {t.settings.addSection}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {templateDraft.sections.map((section, index) => (
                      <div
                        key={index}
                        className="grid gap-3 rounded-2xl border border-card-border p-4"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={section.title}
                            onChange={(e) =>
                              setTemplateDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      sections: prev.sections.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, title: e.target.value }
                                            : item,
                                      ),
                                    }
                                  : prev,
                              )
                            }
                            placeholder={t.settings.sectionTitle}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setTemplateDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      sections: prev.sections.filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                    }
                                  : prev,
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                        <RichTextEditor
                          value={section.defaultContent}
                          onChange={(html) =>
                            setTemplateDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    sections: prev.sections.map(
                                      (item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, defaultContent: html }
                                          : item,
                                    ),
                                  }
                                : prev,
                            )
                          }
                          placeholder={t.settings.defaultContent}
                          minHeight="100px"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <Field
                  label={t.settings.quickDiagnoses}
                  className="md:col-span-2"
                >
                  <Textarea
                    value={templateDraft.diagnosesText}
                    onChange={(e) =>
                      setTemplateDraft((prev) =>
                        prev
                          ? { ...prev, diagnosesText: e.target.value }
                          : prev,
                      )
                    }
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setTemplateDialogOpen(false)}
                >
                  {t.common.cancel}
                </Button>
                <Button onClick={saveTemplate}>
                  {t.settings.saveTemplate}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Template Dialog */}
      <AlertDialog
        open={Boolean(templateDeleteId)}
        onOpenChange={(open) => !open && setTemplateDeleteId(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.deleteTemplate}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.deleteTemplateDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setTemplateDeleteId(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!templateDeleteId) return;
                removeTemplate(templateDeleteId);
                setTemplates(getTemplates());
                setTemplateDeleteId(null);
                refreshData();
                toast.success("Template deleted.");
              }}
            >
              {t.common.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Data Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.clearAllTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.clearAllDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await resetAppData();
                refreshData();
                setClearDialogOpen(false);
                toast.success("Application data cleared and reset.");
              }}
            >
              {t.settings.resetSystem}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Questions Dialog */}
      <Dialog open={questionsDialogIndex !== null} onOpenChange={(open) => !open && setQuestionsDialogIndex(null)}>
        <DialogContent className="max-w-2xl">
          {questionsDialogIndex !== null && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t.settings.questions} — {form.watch(`procedures.${questionsDialogIndex}.label`) || 'Procedure'}
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-3 overflow-y-auto">
                {(form.watch(`procedures.${questionsDialogIndex}.questions`) || []).map((q: { id: string; label: string; type: string; options?: string[] }, qIdx: number) => (
                  <div key={q.id} className="rounded-xl border border-card-border p-3 space-y-2">
                    <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                      <Input
                        value={q.label}
                        onChange={(e) => {
                          const questions = [...(form.getValues(`procedures.${questionsDialogIndex}.questions`) || [])];
                          questions[qIdx] = { ...questions[qIdx], label: e.target.value };
                          form.setValue(`procedures.${questionsDialogIndex}.questions`, questions, { shouldDirty: true });
                        }}
                        placeholder={t.settings.questionLabel}
                      />
                      <Select
                        value={q.type}
                        onValueChange={(val) => {
                          const questions = [...(form.getValues(`procedures.${questionsDialogIndex}.questions`) || [])];
                          questions[qIdx] = { ...questions[qIdx], type: val as "text" | "dropdown" | "yes-no" | "multi-select", options: val === 'text' || val === 'yes-no' ? undefined : questions[qIdx].options || [] };
                          form.setValue(`procedures.${questionsDialogIndex}.questions`, questions, { shouldDirty: true });
                        }}
                      >
                        <SelectItem value="text">{t.settings.questionText}</SelectItem>
                        <SelectItem value="dropdown">{t.settings.questionDropdown}</SelectItem>
                        <SelectItem value="yes-no">{t.settings.questionYesNo}</SelectItem>
                        <SelectItem value="multi-select">{t.settings.questionMultiSelect}</SelectItem>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" onClick={() => {
                        const questions = [...(form.getValues(`procedures.${questionsDialogIndex}.questions`) || [])];
                        questions.splice(qIdx, 1);
                        form.setValue(`procedures.${questionsDialogIndex}.questions`, questions, { shouldDirty: true });
                      }}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </div>
                    {(q.type === 'dropdown' || q.type === 'multi-select') && (
                      <div className="space-y-2">
                        <Label className="text-xs">{t.settings.questionOptions}</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {(q.options || []).map((opt: string, optIdx: number) => (
                            <span key={optIdx} className="inline-flex items-center gap-1 rounded-full border border-card-border bg-muted px-2.5 py-1 text-xs">
                              {opt}
                              <button type="button" className="text-rose-500 hover:text-rose-700" onClick={() => {
                                const questions = [...(form.getValues(`procedures.${questionsDialogIndex}.questions`) || [])];
                                const opts = [...(questions[qIdx].options || [])];
                                opts.splice(optIdx, 1);
                                questions[qIdx] = { ...questions[qIdx], options: opts };
                                form.setValue(`procedures.${questionsDialogIndex}.questions`, questions, { shouldDirty: true });
                              }}>×</button>
                            </span>
                          ))}
                        </div>
                        <Input
                          placeholder={t.settings.questionOptionsPlaceholder}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (!val) return;
                              const questions = [...(form.getValues(`procedures.${questionsDialogIndex}.questions`) || [])];
                              const opts = [...(questions[qIdx].options || []), val];
                              questions[qIdx] = { ...questions[qIdx], options: opts };
                              form.setValue(`procedures.${questionsDialogIndex}.questions`, questions, { shouldDirty: true });
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                        <p className="text-[10px] text-muted-foreground">{t.settings.questionOptionsHint}</p>
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const questions = [...(form.getValues(`procedures.${questionsDialogIndex}.questions`) || [])];
                    questions.push({ id: `q-${Date.now()}`, label: '', type: 'text', options: [] });
                    form.setValue(`procedures.${questionsDialogIndex}.questions`, questions, { shouldDirty: true });
                  }}
                >
                  <Plus className="h-4 w-4" /> {t.settings.addQuestion}
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setQuestionsDialogIndex(null)}>
                  {t.common.close}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
      {error ? <p className="mt-1 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
