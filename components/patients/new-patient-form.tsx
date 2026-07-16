'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { useAppState } from '@/components/app-provider';
import { createPatientWithSession, createSessionForExistingPatient, getPatientByCode, updateSession, getSettings as getLatestSettings } from '@/lib/queries';
import { patientRegistrationSchema } from '@/lib/schemas';
import { Patient, PatientRegistrationFormValues, ProcedureQuestion, ProcedureType } from '@/lib/types';
import { toDatetimeLocalValue } from '@/lib/utils';
import { useLocale } from '@/hooks/use-locale';
import { ProcedureQuestionnaire } from '@/components/patients/procedure-questionnaire';

export function NewPatientForm() {
  const { t } = useLocale();
  const router = useRouter();
  const { settings, refreshData } = useAppState();

  const defaultDoctor = settings?.doctors[0] ?? '';
  const defaultProcedure: ProcedureType = settings?.procedures[0]?.id ?? 'upper-endoscopy';

  const defaultValues = useMemo<PatientRegistrationFormValues>(
    () => ({
      patientCode: '',
      fullName: '',
      age: 30,
      gender: 'male',
      phone: '',
      address: '',
      referredBy: '',
      procedureType: defaultProcedure,
      doctorName: defaultDoctor,
      scheduledAt: toDatetimeLocalValue(new Date()),
      indication: '',
      preparation: settings?.defaultPreparations[defaultProcedure] ?? '',
      sedation: 'conscious',
    }),
    [defaultDoctor, settings],
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientRegistrationFormValues>({
    resolver: zodResolver(patientRegistrationSchema),
    defaultValues,
  });

  const selectedProcedure = watch('procedureType');
  const currentDoctor = watch('doctorName');

  // Existing patient detection
  const [existingPatient, setExistingPatient] = useState<Patient | null>(null);
  const [showExistingDialog, setShowExistingDialog] = useState(false);
  const [pendingValues, setPendingValues] = useState<PatientRegistrationFormValues | null>(null);

  // Questionnaire
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState<ProcedureQuestion[]>([]);
  const [questionnaireProcLabel, setQuestionnaireProcLabel] = useState('');

  useEffect(() => {
    if (settings) {
      if (!currentDoctor) setValue('doctorName', defaultDoctor || settings.doctors[0] || '');
      setValue('preparation', settings.defaultPreparations[selectedProcedure] ?? '');
    }
  }, [currentDoctor, defaultDoctor, selectedProcedure, setValue, settings]);

  const onSubmit = (values: PatientRegistrationFormValues) => {
    // Check if patient code already exists
    const found = getPatientByCode(values.patientCode);
    if (found) {
      setExistingPatient(found);
      setPendingValues(values);
      setShowExistingDialog(true);
      return;
    }

    // Create new patient + session
    try {
      const { session } = createPatientWithSession(values);
      toast.success(t.newPatient.patientCreated);
      maybeShowQuestionnaire(session.id, values.procedureType);
    } catch (error) {
      console.error(error);
      toast.error('Unable to save patient registration.');
    }
  };

  const maybeShowQuestionnaire = (sessionId: string, procedureType: string) => {
    // Read fresh settings directly from storage to ensure we have the latest questions
    const freshSettings = getLatestSettings();
    const proc = freshSettings?.procedures.find((p) => p.id === procedureType);
    const questions = proc?.questions?.filter((q) => q.label && q.label.trim()) || [];
    if (questions.length > 0) {
      setCreatedSessionId(sessionId);
      setQuestionnaireQuestions(questions);
      setQuestionnaireProcLabel(proc?.label || '');
      setShowQuestionnaire(true);
    } else {
      router.push(`/patients/${sessionId}`);
    }
  };

  const handleQuestionnaireSubmit = (answers: Record<string, string | string[] | boolean>) => {
    if (createdSessionId) {
      if (Object.keys(answers).length > 0) {
        updateSession(createdSessionId, { questionnaireAnswers: answers });
      }
      refreshData();
      router.push(`/patients/${createdSessionId}`);
    }
    setShowQuestionnaire(false);
    setCreatedSessionId(null);
  };

  const handleAssignExisting = () => {
    if (!existingPatient || !pendingValues) return;
    try {
      const { session } = createSessionForExistingPatient(existingPatient.id, pendingValues);
      toast.success(t.newPatient.sessionAssigned);
      maybeShowQuestionnaire(session.id, pendingValues.procedureType);
    } catch (error) {
      console.error(error);
      toast.error('Unable to assign session.');
    } finally {
      setShowExistingDialog(false);
      setExistingPatient(null);
      setPendingValues(null);
    }
  };

  const handleRejectDuplicate = () => {
    setShowExistingDialog(false);
    setExistingPatient(null);
    setPendingValues(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.newPatient.eyebrow}
        title={t.newPatient.title}
        description={t.newPatient.description}
      />

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>{t.newPatient.patientDemographics}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patientCode">{t.newPatient.patientCode}</Label>
              <Input id="patientCode" placeholder={t.newPatient.patientCodePlaceholder} {...register('patientCode')} />
              {errors.patientCode ? <p className="text-sm text-rose-600">{errors.patientCode.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">{t.newPatient.fullName}</Label>
              <Input id="fullName" placeholder={t.newPatient.fullNamePlaceholder} {...register('fullName')} />
              {errors.fullName ? <p className="text-sm text-rose-600">{errors.fullName.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="age">{t.newPatient.age}</Label>
              <Input id="age" type="number" min={1} {...register('age')} />
              {errors.age ? <p className="text-sm text-rose-600">{errors.age.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>{t.newPatient.gender}</Label>
              <div className="flex gap-4 rounded-xl border border-card-border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="male" {...register('gender')} /> {t.newPatient.male}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="female" {...register('gender')} /> {t.newPatient.female}
                </label>
              </div>
              {errors.gender ? <p className="text-sm text-rose-600">{errors.gender.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t.newPatient.phone}</Label>
              <Input id="phone" placeholder={t.newPatient.phonePlaceholder} {...register('phone')} />
              {errors.phone ? <p className="text-sm text-rose-600">{errors.phone.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="referredBy">{t.newPatient.referredBy}</Label>
              <Input id="referredBy" placeholder={t.newPatient.referredByPlaceholder} {...register('referredBy')} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">{t.newPatient.address}</Label>
              <Textarea id="address" placeholder={t.newPatient.addressPlaceholder} className="min-h-[90px]" {...register('address')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.newPatient.procedureScheduling}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.newPatient.procedureType}</Label>
              <Controller
                control={control}
                name="procedureType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    {settings?.procedures.map((proc) => (
                      <SelectItem key={proc.id} value={proc.id}>
                        {proc.icon ? `${proc.icon} ` : ''}{proc.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
              {errors.procedureType ? <p className="text-sm text-rose-600">{errors.procedureType.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>{t.newPatient.assignedDoctor}</Label>
              <Controller
                control={control}
                name="doctorName"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    {settings?.doctors.map((doctor) => (
                      <SelectItem key={doctor} value={doctor}>
                        {doctor}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
              {errors.doctorName ? <p className="text-sm text-rose-600">{errors.doctorName.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt">{t.newPatient.dateTime}</Label>
              <Input id="scheduledAt" type="datetime-local" {...register('scheduledAt')} />
              {errors.scheduledAt ? <p className="text-sm text-rose-600">{errors.scheduledAt.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>{t.newPatient.sedationType}</Label>
              <Controller
                control={control}
                name="sedation"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectItem value="none">{t.newPatient.sedationNone}</SelectItem>
                    <SelectItem value="local">{t.newPatient.sedationLocal}</SelectItem>
                    <SelectItem value="conscious">{t.newPatient.sedationConscious}</SelectItem>
                    <SelectItem value="general">{t.newPatient.sedationGeneral}</SelectItem>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="indication">{t.newPatient.indication}</Label>
              <Textarea id="indication" placeholder={t.newPatient.indicationPlaceholder} {...register('indication')} />
              {errors.indication ? <p className="text-sm text-rose-600">{errors.indication.message}</p> : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="preparation">{t.newPatient.preparation}</Label>
              <Textarea id="preparation" placeholder={t.newPatient.preparationPlaceholder} {...register('preparation')} />
              {errors.preparation ? <p className="text-sm text-rose-600">{errors.preparation.message}</p> : null}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/patients')}>
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t.newPatient.saving : t.newPatient.saveRegistration}
          </Button>
        </div>
      </form>

      {/* Existing Patient Dialog */}
      <AlertDialog open={showExistingDialog} onOpenChange={(open) => !open && handleRejectDuplicate()}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.newPatient.existingPatientTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.newPatient.existingPatientDesc}{' '}
              <strong>{existingPatient?.fullName}</strong> ({existingPatient?.patientCode}).
              <br /><br />
              {t.newPatient.existingPatientQuestion}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={handleRejectDuplicate}>
              {t.common.no}
            </Button>
            <Button onClick={handleAssignExisting}>
              {t.newPatient.assignExisting}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Procedure Questionnaire Modal */}
      <ProcedureQuestionnaire
        open={showQuestionnaire}
        onClose={() => {
          setShowQuestionnaire(false);
          if (createdSessionId) router.push(`/patients/${createdSessionId}`);
        }}
        onSubmit={handleQuestionnaireSubmit}
        questions={questionnaireQuestions}
        procedureLabel={questionnaireProcLabel}
      />
    </div>
  );
}
