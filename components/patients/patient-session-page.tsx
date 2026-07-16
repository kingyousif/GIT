"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import {
  Activity,
  FileText,
  Image as ImageIcon,
  Info,
  Pencil,
  PlusCircle,
  Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { MediaCapturePanel } from "@/components/patients/media-capture-panel";
import { PrintPreview } from "@/components/patients/print-preview";
import { ReportBuilder } from "@/components/patients/report-builder";
import { FreeReportEditor } from "@/components/patients/free-report-editor";
import { useAppState } from "@/components/app-provider";
import {
  getJoinedSessionById,
  getSessionsForPatient,
  updatePatient,
  updateSession,
  createSessionForExistingPatient,
  deleteReport,
  getReportsForSession,
} from "@/lib/queries";
import { getMediaForSessionAsync, deleteMediaItemAsync } from "@/lib/media-db";
import {
  formatDateTime,
  getProcedureLabel,
  toDatetimeLocalValue,
} from "@/lib/utils";
import { MediaFile, PatientSessionJoined, ProcedureType, Report } from "@/lib/types";
import { useLocale } from "@/hooks/use-locale";

const editSchema = z.object({
  fullName: z.string().min(2),
  age: z.coerce.number().min(1).max(120),
  gender: z.enum(["male", "female"]),
  phone: z.string().min(3),
  address: z.string().optional(),
  referredBy: z.string().optional(),
  procedureType: z.string().min(1),
  doctorName: z.string().min(2),
  scheduledAt: z.string().min(1),
  indication: z.string().min(3),
  preparation: z.string().min(3),
  sedation: z.enum(["none", "local", "conscious", "general"]),
  status: z.enum(["waiting", "in-progress", "completed", "cancelled"]),
});

const allTabs = [
  {
    value: "info",
    labelKey: "tabInfo" as const,
    icon: <Info className="h-4 w-4" />,
    roles: ["secretary", "doctor", "admin"],
  },
  {
    value: "media",
    labelKey: "tabMedia" as const,
    icon: <ImageIcon className="h-4 w-4" />,
    roles: ["doctor", "admin"],
  },
  {
    value: "report",
    labelKey: "tabReport" as const,
    icon: <FileText className="h-4 w-4" />,
    roles: ["doctor", "admin"],
  },
  {
    value: "print",
    labelKey: "tabPrint" as const,
    icon: <Printer className="h-4 w-4" />,
    roles: ["doctor", "admin"],
  },
] as const;

export function PatientSessionPage() {
  const { t } = useLocale();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dataVersion, settings, role, refreshData } = useAppState();
  const [record, setRecord] = useState<PatientSessionJoined | null>(null);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [history, setHistory] = useState<PatientSessionJoined["session"][]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const [newVisitValues, setNewVisitValues] = useState({
    procedureType: "",
    doctorName: "",
    scheduledAt: "",
    indication: "",
    preparation: "",
    sedation: "conscious" as string,
  });
  const [editValues, setEditValues] = useState<Record<string, string | number>>(
    {},
  );

  const [editorReport, setEditorReport] = useState<Report | null>(null);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [selectedPrintReportId, setSelectedPrintReportId] = useState<string>('');

  const sessionReports = useMemo(() => {
    if (!record?.session?.id) return [];
    return getReportsForSession(record.session.id);
  }, [record?.session?.id, dataVersion]);

  const printReport = useMemo(() => {
    return sessionReports.find((r) => r.id === selectedPrintReportId) || sessionReports[0] || null;
  }, [sessionReports, selectedPrintReportId]);

  useEffect(() => {
    if (sessionReports.length > 0 && !selectedPrintReportId) {
      setSelectedPrintReportId(sessionReports[0].id);
    }
  }, [sessionReports, selectedPrintReportId]);

  useEffect(() => {
    const joined = getJoinedSessionById(params.id);
    setRecord(joined);
    if (joined) {
      setHistory(getSessionsForPatient(joined.patient.id));
      setEditValues({
        fullName: joined.patient.fullName,
        age: joined.patient.age,
        gender: joined.patient.gender,
        phone: joined.patient.phone,
        address: joined.patient.address ?? "",
        referredBy: joined.patient.referredBy ?? "",
        procedureType: joined.session.procedureType,
        doctorName: joined.session.doctorName,
        scheduledAt: toDatetimeLocalValue(joined.session.scheduledAt),
        indication: joined.session.indication,
        preparation: joined.session.preparation,
        sedation: joined.session.sedation,
        status: joined.session.status,
      });
      getMediaForSessionAsync(joined.session.id, {
        patientName: joined.patient.fullName,
        patientCode: joined.patient.patientCode,
        procedureType: joined.session.procedureType,
        scheduledAt: joined.session.scheduledAt,
      })
        .then(setMedia)
        .catch(console.error);
    }
  }, [dataVersion, params.id]);

  const visibleTabs = useMemo(
    () =>
      allTabs.filter(
        (tab) => !role || (tab.roles as readonly string[]).includes(role),
      ),
    [role],
  );
  const activeTab = visibleTabs.some(
    (tab) => tab.value === searchParams.get("tab"),
  )
    ? (searchParams.get("tab") ?? visibleTabs[0]?.value)
    : visibleTabs[0]?.value;

  if (!record || !settings) {
    return (
      <EmptyState
        icon={<Activity className="h-8 w-8" />}
        title={t.patientSession.notFound}
        description={t.patientSession.notFoundDesc}
      />
    );
  }

  const saveEdits = async () => {
    const parsed = editSchema.safeParse(editValues);
    if (!parsed.success) {
      toast.error("Please complete all required patient and session fields.");
      return;
    }

    try {
      await updatePatient(record.patient.id, {
        fullName: parsed.data.fullName,
        age: parsed.data.age,
        gender: parsed.data.gender,
        phone: parsed.data.phone,
        address: parsed.data.address,
        referredBy: parsed.data.referredBy,
      });
      await updateSession(record.session.id, {
        procedureType: parsed.data.procedureType,
        doctorName: parsed.data.doctorName,
        scheduledAt: new Date(parsed.data.scheduledAt).toISOString(),
        indication: parsed.data.indication,
        preparation: parsed.data.preparation,
        sedation: parsed.data.sedation,
        status: parsed.data.status,
      });
      setEditOpen(false);
      await refreshData();
      toast.success("Patient session updated successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update patient session.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.patientSession.eyebrow}
        title={`${record.patient.fullName} — ${record.patient.patientCode}`}
        description={`Scheduled ${formatDateTime(record.session.scheduledAt)} with ${record.session.doctorName}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={record.session.status} />
            <Button
              variant="outline"
              onClick={() => {
                setNewVisitValues({
                  procedureType: settings.procedures[0]?.id || "",
                  doctorName: settings.doctors[0] || "",
                  scheduledAt: new Date().toISOString().slice(0, 16),
                  indication: "",
                  preparation: "",
                  sedation: "conscious",
                });
                setNewVisitOpen(true);
              }}
            >
              <PlusCircle className="h-4 w-4" /> {t.patientSession.newVisit}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> {t.common.edit}
            </Button>
          </div>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          router.replace(`/patients/${record.session.id}?tab=${value}`)
        }
      >
        <TabsList className="w-full justify-center overflow-auto">
          {visibleTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="inline-flex items-center justify-center gap-2 flex-1"
            >
              {tab.icon}
              {t.patientSession[tab.labelKey]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>{t.patientSession.patientInfo}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <InfoBlock
                  label={t.newPatient.fullName}
                  value={record.patient.fullName}
                />
                <InfoBlock
                  label={t.patientSession.patientCode}
                  value={record.patient.patientCode}
                />
                <InfoBlock
                  label={t.newPatient.age}
                  value={String(record.patient.age)}
                />
                <InfoBlock
                  label={t.newPatient.gender}
                  value={record.patient.gender}
                />
                <InfoBlock
                  label={t.newPatient.phone}
                  value={record.patient.phone}
                />
                <InfoBlock
                  label={t.newPatient.address}
                  value={record.patient.address || "—"}
                />
                <InfoBlock
                  label={t.newPatient.referredBy}
                  value={record.patient.referredBy || "—"}
                />
                <InfoBlock
                  label={t.patientSession.created}
                  value={formatDateTime(record.patient.createdAt)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.patientSession.currentSession}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoBlock
                  label={t.dashboard.procedure}
                  value={getProcedureLabel(record.session.procedureType)}
                />
                <InfoBlock
                  label={t.dashboard.doctor}
                  value={record.session.doctorName}
                />
                <InfoBlock
                  label={t.patientSession.scheduledAt}
                  value={formatDateTime(record.session.scheduledAt)}
                />
                <InfoBlock
                  label={t.patientSession.sedation}
                  value={record.session.sedation}
                />
                <InfoBlock
                  label={t.newPatient.indication}
                  value={record.session.indication}
                />
                <InfoBlock
                  label={t.newPatient.preparation}
                  value={record.session.preparation}
                />
                <InfoBlock
                  label={t.patientSession.findings}
                  value={record.session.findings || t.patientSession.noFindings}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t.patientSession.sessionHistory}</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState
                  icon={<Activity className="h-8 w-8" />}
                  title={t.patientSession.noHistory}
                  description={t.patientSession.noHistoryDesc}
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Procedure</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((item) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            window.open(`/patients/${item.id}`, "_blank")
                          }
                        >
                          <TableCell>
                            {formatDateTime(item.scheduledAt)}
                          </TableCell>
                          <TableCell>
                            {getProcedureLabel(item.procedureType)}
                          </TableCell>
                          <TableCell>{item.doctorName}</TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <MediaCapturePanel
            sessionId={record.session.id}
            patientName={record.patient.fullName}
            patientCode={record.patient.patientCode}
            procedureType={record.session.procedureType}
            scheduledAt={record.session.scheduledAt}
            onMediaChanged={() => refreshData()}
            onOpenPrint={() =>
              router.replace(`/patients/${record.session.id}?tab=print`)
            }
          />
        </TabsContent>

        <TabsContent value="report">
          {!editorReport && !isCreatingReport ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg font-semibold">Reports Archive ({sessionReports.length})</CardTitle>
                <Button
                  onClick={() => {
                    setEditorReport(null);
                    setIsCreatingReport(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <PlusCircle className="h-4 w-4" /> Create New Report
                </Button>
              </CardHeader>
              <CardContent className="pt-2">
                {sessionReports.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-8 w-8" />}
                    title="No Reports Generated"
                    description="No reports have been written for this session yet. Click the button above to write one."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-card-border bg-card">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Report Name</TableHead>
                          <TableHead>Doctor Name</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionReports.map((r, idx) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-primary">
                              Report #{idx + 1}
                            </TableCell>
                            <TableCell>{r.doctorName}</TableCell>
                            <TableCell>{formatDateTime(r.updatedAt)}</TableCell>
                            <TableCell>
                              <StatusBadge status={r.status === 'final' ? 'completed' : 'in-progress'} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditorReport(r);
                                    setIsCreatingReport(false);
                                  }}
                                  className="h-8 px-2 flex items-center gap-1"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPrintReportId(r.id);
                                    router.replace(`/patients/${record.session.id}?tab=print`);
                                  }}
                                  className="h-8 px-2 flex items-center gap-1"
                                >
                                  <Printer className="h-3 w-3" /> Print
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    if (!confirm("Are you sure you want to delete this report?")) return;
                                    try {
                                      await deleteReport(r.id);
                                      const snapshot = media.find((item) => item.type === 'report' && item.reportId === r.id);
                                      if (snapshot) await deleteMediaItemAsync(snapshot.id, record.session.id);
                                      if (selectedPrintReportId === r.id) setSelectedPrintReportId('');
                                      await refreshData();
                                      toast.success("Report deleted successfully.");
                                    } catch (error) {
                                      console.error(error);
                                      toast.error(error instanceof Error ? error.message : "Unable to delete report.");
                                    }
                                  }}
                                  className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 hover:border-rose-300"
                                >
                                  🗑️ Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditorReport(null);
                    setIsCreatingReport(false);
                  }}
                >
                  ← Back to Reports List
                </Button>
                <div className="text-sm text-muted-foreground font-medium">
                  {isCreatingReport ? "Creating New Report" : `Editing Report`}
                </div>
              </div>
              <Tabs defaultValue="structured" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="structured">
                    {t.freeReport.structuredTab}
                  </TabsTrigger>
                  <TabsTrigger value="free">{t.freeReport.freeTab}</TabsTrigger>
                </TabsList>
                <TabsContent value="structured">
                  <ReportBuilder
                    patient={record.patient}
                    session={record.session}
                    report={editorReport}
                    settings={settings}
                    onAfterSave={async (saved) => {
                      setSelectedPrintReportId(saved.id);
                      await refreshData();
                      setEditorReport(null);
                      setIsCreatingReport(false);
                    }}
                    onOpenPrint={(saved) => {
                      setSelectedPrintReportId(saved.id);
                      router.replace(`/patients/${record.session.id}?tab=print`);
                    }}
                  />
                </TabsContent>
                <TabsContent value="free">
                  <FreeReportEditor
                    patient={record.patient}
                    session={record.session}
                    report={editorReport}
                    settings={settings}
                    onAfterSave={async (saved) => {
                      setSelectedPrintReportId(saved.id);
                      await refreshData();
                      setEditorReport(null);
                      setIsCreatingReport(false);
                    }}
                    onOpenPrint={(saved) => {
                      setSelectedPrintReportId(saved.id);
                      router.replace(`/patients/${record.session.id}?tab=print`);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </TabsContent>

        <TabsContent value="print">
          {sessionReports.length > 0 ? (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Printer className="h-4 w-4 text-primary" />
                    Select Report version to View/Print:
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedPrintReportId} onValueChange={setSelectedPrintReportId}>
                    {sessionReports.map((r, idx) => (
                      <SelectItem key={r.id} value={r.id}>
                        Report #{idx + 1} - Dr. {r.doctorName} ({r.status === 'final' ? 'Final' : 'Draft'}) - {formatDateTime(r.updatedAt)}
                      </SelectItem>
                    ))}
                  </Select>
                </CardContent>
              </Card>

              {printReport && (
                <PrintPreview
                  patient={record.patient}
                  session={record.session}
                  report={printReport}
                  media={media}
                  settings={settings}
                />
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  icon={<FileText className="h-8 w-8" />}
                  title="No Reports to Print"
                  description="Please create and save a report under the 'Reports' tab before viewing or printing."
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t.patientSession.editTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t.newPatient.fullName}>
              <Input
                value={String(editValues.fullName ?? "")}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    fullName: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label={t.newPatient.age}>
              <Input
                type="number"
                value={String(editValues.age ?? "")}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    age: Number(e.target.value),
                  }))
                }
              />
            </Field>
            <Field label={t.newPatient.gender}>
              <Select
                value={String(editValues.gender ?? "male")}
                onValueChange={(value) =>
                  setEditValues((prev) => ({ ...prev, gender: value }))
                }
              >
                <SelectItem value="male">{t.newPatient.male}</SelectItem>
                <SelectItem value="female">{t.newPatient.female}</SelectItem>
              </Select>
            </Field>
            <Field label={t.newPatient.phone}>
              <Input
                value={String(editValues.phone ?? "")}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </Field>
            <Field label={t.newPatient.address}>
              <Input
                value={String(editValues.address ?? "")}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label={t.newPatient.referredBy}>
              <Input
                value={String(editValues.referredBy ?? "")}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    referredBy: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label={t.newPatient.procedureType}>
              <Select
                value={String(editValues.procedureType ?? "upper-endoscopy")}
                onValueChange={(value) =>
                  setEditValues((prev) => ({
                    ...prev,
                    procedureType: value as ProcedureType,
                  }))
                }
              >
                {settings.procedures.map((proc) => (
                  <SelectItem key={proc.id} value={proc.id}>
                    {proc.label}
                  </SelectItem>
                ))}
              </Select>
            </Field>
            <Field label={t.dashboard.doctor}>
              <Select
                value={String(editValues.doctorName ?? "")}
                onValueChange={(value) =>
                  setEditValues((prev) => ({ ...prev, doctorName: value }))
                }
              >
                {settings.doctors.map((doctor) => (
                  <SelectItem key={doctor} value={doctor}>
                    {doctor}
                  </SelectItem>
                ))}
              </Select>
            </Field>
            <Field label={t.patientSession.scheduledAt}>
              <Input
                type="datetime-local"
                value={String(editValues.scheduledAt ?? "")}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    scheduledAt: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label={t.patientSession.sedation}>
              <Select
                value={String(editValues.sedation ?? "none")}
                onValueChange={(value) =>
                  setEditValues((prev) => ({ ...prev, sedation: value }))
                }
              >
                <SelectItem value="none">
                  {t.newPatient.sedationNone}
                </SelectItem>
                <SelectItem value="local">
                  {t.newPatient.sedationLocal}
                </SelectItem>
                <SelectItem value="conscious">
                  {t.newPatient.sedationConscious}
                </SelectItem>
                <SelectItem value="general">
                  {t.newPatient.sedationGeneral}
                </SelectItem>
              </Select>
            </Field>
            <Field label={t.common.status}>
              <Select
                value={String(editValues.status ?? "waiting")}
                onValueChange={(value) =>
                  setEditValues((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectItem value="waiting">{t.statuses.waiting}</SelectItem>
                <SelectItem value="in-progress">
                  {t.statuses.inProgress}
                </SelectItem>
                <SelectItem value="completed">
                  {t.statuses.completed}
                </SelectItem>
                <SelectItem value="cancelled">
                  {t.statuses.cancelled}
                </SelectItem>
              </Select>
            </Field>
            <Field label={t.newPatient.indication} className="md:col-span-2">
              <Textarea
                value={String(editValues.indication ?? "")}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    indication: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label={t.newPatient.preparation} className="md:col-span-2">
              <Textarea
                value={String(editValues.preparation ?? "")}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    preparation: e.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={saveEdits}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Visit Dialog */}
      <Dialog open={newVisitOpen} onOpenChange={setNewVisitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.patientSession.newVisit}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>{t.newPatient.procedureType}</Label>
              <Select
                value={newVisitValues.procedureType}
                onValueChange={(v) =>
                  setNewVisitValues((p) => ({ ...p, procedureType: v }))
                }
              >
                {settings.procedures.map((proc) => (
                  <SelectItem key={proc.id} value={proc.id}>
                    {proc.icon ? `${proc.icon} ` : ""}
                    {proc.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.dashboard.doctor}</Label>
              <Select
                value={newVisitValues.doctorName}
                onValueChange={(v) =>
                  setNewVisitValues((p) => ({ ...p, doctorName: v }))
                }
              >
                {settings.doctors.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.newPatient.dateTime}</Label>
              <Input
                type="datetime-local"
                value={newVisitValues.scheduledAt}
                onChange={(e) =>
                  setNewVisitValues((p) => ({
                    ...p,
                    scheduledAt: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t.newPatient.indication}</Label>
              <Textarea
                value={newVisitValues.indication}
                onChange={(e) =>
                  setNewVisitValues((p) => ({
                    ...p,
                    indication: e.target.value,
                  }))
                }
                placeholder={t.newPatient.indicationPlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVisitOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => {
                if (
                  !newVisitValues.procedureType ||
                  !newVisitValues.doctorName ||
                  !newVisitValues.scheduledAt
                ) {
                  toast.error("Please fill in procedure, doctor, and date.");
                  return;
                }
                try {
                  const { session } = createSessionForExistingPatient(
                    record.patient.id,
                    {
                      procedureType: newVisitValues.procedureType,
                      doctorName: newVisitValues.doctorName,
                      scheduledAt: newVisitValues.scheduledAt,
                      indication:
                        newVisitValues.indication || "Follow-up visit",
                      preparation: newVisitValues.preparation || "",
                      sedation: newVisitValues.sedation as
                        | "none"
                        | "local"
                        | "conscious"
                        | "general",
                    },
                  );
                  refreshData();
                  setNewVisitOpen(false);
                  toast.success(t.patientSession.newVisitCreated);
                  router.push(`/patients/${session.id}`);
                } catch (err) {
                  console.error(err);
                  toast.error("Failed to create new visit.");
                }
              }}
            >
              {t.patientSession.createVisit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-2xl bg-muted p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  );
}
