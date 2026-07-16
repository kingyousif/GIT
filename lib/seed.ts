import { addDays, subDays } from 'date-fns';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES, STORAGE_KEYS } from '@/lib/constants';
import { setStorage, getStorage, getMediaStorageKey } from '@/lib/storage';
import { AppSettings, MediaFile, Patient, ProcedureSession, Report, ReportTemplate } from '@/lib/types';
import { generateSvgPlaceholder } from '@/lib/utils';

interface SeedPayload {
  settings: AppSettings;
  templates: ReportTemplate[];
  patients: Patient[];
  sessions: ProcedureSession[];
  reports: Report[];
  media: Record<string, MediaFile[]>;
}

function createSamplePayload(): SeedPayload {
  const now = new Date();
  const todayMorning = new Date(now);
  todayMorning.setHours(9, 30, 0, 0);
  const todayNoon = new Date(now);
  todayNoon.setHours(11, 0, 0, 0);
  const previous = subDays(now, 3);
  previous.setHours(14, 15, 0, 0);
  const upcoming = addDays(now, 1);
  upcoming.setHours(10, 45, 0, 0);

  const patients: Patient[] = [
    {
      id: 'patient-001',
      patientCode: `ENT-${now.getFullYear()}-0001`,
      fullName: 'John Doe',
      age: 45,
      gender: 'male',
      phone: '+964 750 111 2233',
      address: 'Sulaymaniyah',
      referredBy: 'Dr. Khalid',
      createdAt: subDays(now, 5).toISOString(),
    },
    {
      id: 'patient-002',
      patientCode: `ENT-${now.getFullYear()}-0002`,
      fullName: 'Shler Hassan',
      age: 38,
      gender: 'female',
      phone: '+964 771 234 5678',
      address: 'Erbil',
      referredBy: 'Dr. Sara',
      createdAt: subDays(now, 3).toISOString(),
    },
    {
      id: 'patient-003',
      patientCode: `ENT-${now.getFullYear()}-0003`,
      fullName: 'Omar Karim',
      age: 57,
      gender: 'male',
      phone: '+964 770 999 4550',
      address: 'Kirkuk',
      referredBy: 'Dr. Ahmed',
      createdAt: subDays(now, 1).toISOString(),
    },
  ];

  const reports: Report[] = [
    {
      id: 'report-001',
      sessionId: 'session-001',
      doctorName: 'Dr. Ahmed',
      templateUsed: 'template-egd-default',
      sections: [
        { title: 'Indication', content: 'Evaluation of dyspepsia and recurrent epigastric pain.' },
        {
          title: 'Procedure',
          content:
            'Upper GI endoscopy performed under conscious sedation. Scope advanced to the second part of the duodenum without difficulty.',
        },
        {
          title: 'Findings',
          content:
            'Mild erythematous gastritis seen in the antrum. Esophagus and duodenum unremarkable. No active bleeding or ulceration noted.',
        },
        { title: 'Impressions/Diagnosis', content: 'Features are consistent with chronic gastritis.' },
      ],
      diagnosis: ['Chronic gastritis'],
      recommendations: ['Start proton pump inhibitor', 'Await biopsy results', 'Follow up in GI clinic'],
      followUp: 'Review in 2 weeks with pathology result.',
      biopsy: true,
      biopsyLocation: 'Antrum',
      biopsySentTo: 'Central pathology lab',
      createdAt: previous.toISOString(),
      updatedAt: previous.toISOString(),
      status: 'final',
    },
    {
      id: 'report-002',
      sessionId: 'session-002',
      doctorName: 'Dr. Sara',
      templateUsed: 'template-colonoscopy-default',
      sections: [
        { title: 'Indication', content: 'Screening colonoscopy with intermittent rectal bleeding.' },
        {
          title: 'Procedure',
          content: 'Colonoscopy completed to cecum. Withdrawal time adequate. Bowel preparation good.',
        },
        {
          title: 'Findings',
          content: 'Single 6 mm sigmoid polyp removed with cold snare. Internal hemorrhoids present.',
        },
        {
          title: 'Impressions/Diagnosis',
          content: 'Sigmoid polyp and internal hemorrhoids.',
        },
      ],
      diagnosis: ['Polyp', 'Internal hemorrhoids'],
      recommendations: ['Await biopsy results', 'High-fiber diet advised', 'Repeat colonoscopy as per histology'],
      biopsy: true,
      biopsyLocation: 'Sigmoid colon',
      biopsySentTo: 'Histopathology lab',
      createdAt: todayMorning.toISOString(),
      updatedAt: todayMorning.toISOString(),
      status: 'draft',
    },
  ];

  const mediaSession1: MediaFile[] = [
    {
      id: 'media-001',
      sessionId: 'session-001',
      type: 'image',
      dataUrl: generateSvgPlaceholder('Stomach antrum'),
      filename: 'stomach-antrum.png',
      capturedAt: previous.toISOString(),
      source: 'camera',
      label: 'Stomach antrum',
      annotations: 'Mild erythema',
    },
    {
      id: 'media-002',
      sessionId: 'session-001',
      type: 'image',
      dataUrl: generateSvgPlaceholder('Duodenum', '#2563EB'),
      filename: 'duodenum.png',
      capturedAt: previous.toISOString(),
      source: 'camera',
      label: 'Duodenum',
      annotations: 'Normal mucosa',
    },
  ];

  const mediaSession2: MediaFile[] = [
    {
      id: 'media-003',
      sessionId: 'session-002',
      type: 'image',
      dataUrl: generateSvgPlaceholder('Sigmoid polyp', '#CA8A04'),
      filename: 'sigmoid-polyp.png',
      capturedAt: todayMorning.toISOString(),
      source: 'upload',
      label: 'Sigmoid polyp',
      annotations: '6 mm sessile polyp',
    },
  ];

  const sessions: ProcedureSession[] = [
    {
      id: 'session-001',
      patientId: 'patient-001',
      procedureType: 'upper-endoscopy',
      doctorName: 'Dr. Ahmed',
      scheduledAt: previous.toISOString(),
      status: 'completed',
      indication: 'Epigastric pain and nausea',
      preparation: DEFAULT_SETTINGS.defaultPreparations['upper-endoscopy'],
      sedation: 'conscious',
      findings: 'Mild erythematous gastritis in the antrum.',
      mediaFiles: mediaSession1,
      report: reports[0],
      createdAt: subDays(now, 4).toISOString(),
      completedAt: previous.toISOString(),
    },
    {
      id: 'session-002',
      patientId: 'patient-002',
      procedureType: 'colonoscopy',
      doctorName: 'Dr. Sara',
      scheduledAt: todayMorning.toISOString(),
      status: 'in-progress',
      indication: 'Screening with intermittent rectal bleeding',
      preparation: DEFAULT_SETTINGS.defaultPreparations.colonoscopy,
      sedation: 'conscious',
      findings: 'Single sigmoid polyp removed; internal hemorrhoids.',
      mediaFiles: mediaSession2,
      report: reports[1],
      createdAt: subDays(now, 1).toISOString(),
    },
    {
      id: 'session-003',
      patientId: 'patient-003',
      procedureType: 'upper-endoscopy',
      doctorName: 'Dr. Omar',
      scheduledAt: todayNoon.toISOString(),
      status: 'waiting',
      indication: 'Dysphagia evaluation',
      preparation: DEFAULT_SETTINGS.defaultPreparations['upper-endoscopy'],
      sedation: 'local',
      findings: '',
      mediaFiles: [],
      createdAt: subDays(now, 1).toISOString(),
    },
    {
      id: 'session-004',
      patientId: 'patient-001',
      procedureType: 'capsule-endoscopy',
      doctorName: 'Dr. Ahmed',
      scheduledAt: upcoming.toISOString(),
      status: 'waiting',
      indication: 'Occult GI bleeding',
      preparation: DEFAULT_SETTINGS.defaultPreparations['capsule-endoscopy'],
      sedation: 'none',
      findings: '',
      mediaFiles: [],
      createdAt: now.toISOString(),
    },
  ];

  return {
    settings: DEFAULT_SETTINGS,
    templates: DEFAULT_TEMPLATES,
    patients,
    sessions,
    reports,
    media: {
      'session-001': mediaSession1,
      'session-002': mediaSession2,
      'session-003': [],
      'session-004': [],
    },
  };
}

export function seedAppData(force = false, withSamples = true) {
  // Client-side seeding is disabled to prevent overwriting the shared MongoDB server database.
  return;
}
