export type Role = 'secretary' | 'doctor' | 'admin';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Patient {
  id: string;
  patientCode: string;
  fullName: string;
  age: number;
  gender: 'male' | 'female';
  phone: string;
  address?: string;
  referredBy?: string;
  createdAt: string;
}

export type ProcedureType = string;

export interface ProcedureQuestion {
  id: string;
  label: string;
  type: 'text' | 'dropdown' | 'yes-no' | 'multi-select';
  options?: string[]; // For dropdown and multi-select
  required?: boolean;
}

export interface ProcedureDefinition {
  id: string;
  label: string;
  icon?: string;
  questions?: ProcedureQuestion[];
}

export interface MediaFile {
  id: string;
  sessionId: string;
  type: 'image' | 'video' | 'report';
  dataUrl: string;
  filename: string;
  capturedAt: string;
  source: 'upload' | 'camera' | 'hdmi-capture' | 'report';
  label?: string;
  annotations?: string;
  reportId?: string;
}

export interface ReportSection {
  title: string;
  content: string;
}

export interface Report {
  id: string;
  sessionId: string;
  doctorName: string;
  templateUsed?: string;
  sections: ReportSection[];
  diagnosis: string[];
  recommendations: string[];
  followUp?: string;
  biopsy: boolean;
  biopsyLocation?: string;
  biopsySentTo?: string;
  freeReportHtml?: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'final';
}

export interface ProcedureSession {
  id: string;
  patientId: string;
  procedureType: ProcedureType;
  doctorName: string;
  scheduledAt: string;
  status: 'waiting' | 'in-progress' | 'completed' | 'cancelled';
  indication: string;
  preparation: string;
  sedation: 'none' | 'local' | 'conscious' | 'general';
  findings: string;
  mediaFiles: MediaFile[];
  report?: Report;
  questionnaireAnswers?: Record<string, string | string[] | boolean>;
  createdAt: string;
  completedAt?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  procedureType: ProcedureType;
  sections: { title: string; defaultContent: string }[];
  diagnoses: string[];
}

export interface AppSettings {
  hospitalName: string;
  hospitalLogo?: string;
  departmentName: string;
  address: string;
  phone: string;
  doctors: string[];
  procedures: ProcedureDefinition[];
  defaultPreparations: Record<ProcedureType, string>;
  reportFooter: string;
}

export interface AppBackup {
  patients: Patient[];
  sessions: ProcedureSession[];
  reports: Report[];
  templates: ReportTemplate[];
  settings: AppSettings;
  role: Role | null;
  media: Record<string, MediaFile[]>;
  users?: UserAccount[];
}

export interface PatientRegistrationFormValues {
  patientCode: string;
  fullName: string;
  age: number;
  gender: 'male' | 'female';
  phone: string;
  address?: string;
  referredBy?: string;
  procedureType: ProcedureType;
  doctorName: string;
  scheduledAt: string;
  indication: string;
  preparation: string;
  sedation: 'none' | 'local' | 'conscious' | 'general';
}

export interface PatientSessionJoined {
  patient: Patient;
  session: ProcedureSession;
  report?: Report;
  media: MediaFile[];
}
