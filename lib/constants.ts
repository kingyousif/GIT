import { AppSettings, ProcedureType, ReportTemplate, Role } from '@/lib/types';

export const STORAGE_KEYS = {
  patients: "endo_patients",
  sessions: "endo_sessions",
  reports: "endo_reports",
  templates: "endo_templates",
  settings: "endo_settings",
  role: "endo_role",
  seeded: "endo_seeded",
  users: "endo_users",
  session: "endo_session",
} as const;

export const DEFAULT_PROCEDURES = [
  { id: "upper-endoscopy", label: "Upper Endoscopy (EGD)", icon: "🫁" },
  { id: "colonoscopy", label: "Colonoscopy", icon: "🩺" },
  { id: "sigmoidoscopy", label: "Sigmoidoscopy", icon: "🔎" },
  { id: "ercp", label: "ERCP", icon: "🧪" },
  { id: "bronchoscopy", label: "Bronchoscopy", icon: "🌬️" },
  { id: "capsule-endoscopy", label: "Capsule Endoscopy", icon: "💊" },
];

export const PROCEDURE_LABELS: Record<string, string> = {
  "upper-endoscopy": "Upper Endoscopy (EGD)",
  colonoscopy: "Colonoscopy",
  sigmoidoscopy: "Sigmoidoscopy",
  ercp: "ERCP",
  bronchoscopy: "Bronchoscopy",
  "capsule-endoscopy": "Capsule Endoscopy",
};

export const PROCEDURE_SHORT_LABELS: Record<string, string> = {
  "upper-endoscopy": "EGD",
  colonoscopy: "Colonoscopy",
  sigmoidoscopy: "Sigmoidoscopy",
  ercp: "ERCP",
  bronchoscopy: "Bronchoscopy",
  "capsule-endoscopy": "Capsule",
};

export const PROCEDURE_ICONS: Record<string, string> = {
  "upper-endoscopy": "🫁",
  colonoscopy: "🩺",
  sigmoidoscopy: "🔎",
  ercp: "🧪",
  bronchoscopy: "🌬️",
  "capsule-endoscopy": "💊",
};

export const ROLE_META: Record<
  Role,
  { label: string; kurdish: string; description: string }
> = {
  secretary: {
    label: "Secretary",
    kurdish: "سکرتێر",
    description:
      "Patient registration, daily list, and appointment management.",
  },
  doctor: {
    label: "Doctor",
    kurdish: "دکتۆر",
    description: "Patient review, media capture, and report writing.",
  },
  admin: {
    label: "Admin",
    kurdish: "ئەدمین",
    description: "Full access including settings, templates, and statistics.",
  },
};

export const STATUS_META = {
  waiting: { label: 'Waiting', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
} as const;

export const DIAGNOSIS_SUGGESTIONS: Record<string, string[]> = {
  "upper-endoscopy": [
    "Normal study",
    "Chronic gastritis",
    "Erosive gastritis",
    "Gastric ulcer",
    "Duodenal ulcer",
    "GERD",
    "Hiatal hernia",
    "Barrett's esophagus",
    "Gastric polyp",
  ],
  colonoscopy: [
    "Normal colonoscopy",
    "Internal hemorrhoids",
    "Diverticulosis",
    "Polyp",
    "Colitis",
    "Melanosis coli",
    "Colorectal cancer",
  ],
  sigmoidoscopy: [
    "Normal",
    "Hemorrhoids",
    "Proctitis",
    "Rectal polyp",
    "Colitis",
  ],
  ercp: [
    "Choledocholithiasis",
    "Biliary stricture",
    "Pancreatic duct abnormality",
    "Normal",
  ],
  bronchoscopy: ["Normal airway", "Inflammation", "Mass lesion", "Secretions"],
  "capsule-endoscopy": [
    "Normal study",
    "Small bowel bleeding",
    "Ulceration",
    "Polyp",
  ],
};

export const RECOMMENDATION_SUGGESTIONS = [
  "Continue current medications",
  "Start proton pump inhibitor",
  "Repeat endoscopy in 1 year",
  "Await biopsy results",
  "High-fiber diet advised",
  "Follow up in GI clinic",
  "Colorectal screening as scheduled",
];

export const DEFAULT_SETTINGS: AppSettings = {
  hospitalName: "Arena General Hospital",
  departmentName: "Department of Gastroenterology",
  address: "Kirkuk Road, Sulaymaniyah, Iraq",
  phone: "+964 770 000 0000",
  doctors: ["Dr. Ahmed", "Dr. Sara", "Dr. Omar"],
  procedures: DEFAULT_PROCEDURES,
  defaultPreparations: {
    "upper-endoscopy":
      "Fasting for 8 hours before procedure. Remove dentures and notify staff about allergies.",
    colonoscopy:
      "Clear liquid diet 24 hours before procedure. Split-dose bowel preparation as instructed.",
    sigmoidoscopy: "Light diet the day before. Enema 2 hours prior if advised.",
    ercp: "Nil per os for 8 hours. Review anticoagulants and obtain consent for sedation.",
    bronchoscopy:
      "Fasting for 6 hours. Arrange escort after sedation if planned.",
    "capsule-endoscopy":
      "Fasting for 12 hours. Small bowel prep if requested. Avoid MRI until capsule passes.",
  },
  reportFooter:
    "This report is generated electronically by the Endoscopy Unit. Please correlate clinically.",
};

export const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: "template-egd-default",
    name: "Upper Endoscopy (EGD) Default",
    procedureType: "upper-endoscopy",
    sections: [
      { title: "Indication", defaultContent: "Evaluation of [symptom]." },
      {
        title: "Procedure",
        defaultContent:
          "The procedure was performed with the patient in the left lateral decubitus position. Conscious sedation was administered. The endoscope was introduced through the mouth and advanced under direct visualization to the second part of the duodenum.",
      },
      {
        title: "Esophagus",
        defaultContent:
          "The esophagus was examined. Mucosa appears [normal/abnormal]. Z-line at [X] cm from the incisors.",
      },
      {
        title: "Stomach",
        defaultContent:
          "Adequate gastric preparation. Mucosa of the fundus, body, and antrum appears [normal/erythematous/atrophic]. No ulcers, polyps, or masses seen.",
      },
      {
        title: "Duodenum",
        defaultContent:
          "Duodenal bulb and second part examined. Mucosa appears normal.",
      },
      { title: "Impression", defaultContent: "[Free text]" },
    ],
    diagnoses: [
      "Normal study",
      "Chronic gastritis",
      "Erosive gastritis",
      "Gastric ulcer",
      "Duodenal ulcer",
      "GERD",
      "Hiatal hernia",
      "Barrett's esophagus",
      "Gastric polyp",
    ],
  },
  {
    id: "template-colonoscopy-default",
    name: "Colonoscopy Default",
    procedureType: "colonoscopy",
    sections: [
      {
        title: "Indication",
        defaultContent: "Evaluation of [symptom] / Screening colonoscopy.",
      },
      {
        title: "Preparation Quality",
        defaultContent:
          "Preparation quality: [Excellent / Good / Fair / Poor] — Boston Bowel Prep Scale: [X].",
      },
      {
        title: "Procedure",
        defaultContent:
          "Colonoscope introduced per anum. Cecum reached and identified by ileocecal valve and appendiceal orifice.",
      },
      { title: "Cecum", defaultContent: "Normal." },
      { title: "Ascending Colon", defaultContent: "Normal." },
      { title: "Transverse Colon", defaultContent: "Normal." },
      { title: "Descending Colon", defaultContent: "Normal." },
      { title: "Sigmoid Colon", defaultContent: "Normal." },
      { title: "Rectum", defaultContent: "Normal." },
      { title: "Impression", defaultContent: "[Free text]" },
    ],
    diagnoses: [
      "Normal colonoscopy",
      "Internal hemorrhoids",
      "Diverticulosis",
      "Polyp (specify size/location/morphology)",
      "Colitis",
      "Melanosis coli",
      "Colorectal cancer",
    ],
  },
];
