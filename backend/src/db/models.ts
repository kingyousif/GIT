import mongoose, { Schema, Document } from 'mongoose';

// ===== Patient =====
const PatientSchema = new Schema({
  _id: { type: String, required: true },
  patientCode: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  phone: { type: String, required: true },
  address: String,
  referredBy: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
}, { timestamps: false, versionKey: false });

PatientSchema.set('toJSON', { virtuals: true, transform: (_doc: any, ret: any) => { ret.id = ret._id.toString(); delete ret._id; return ret; } });

export const Patient = mongoose.model('Patient', PatientSchema);

// ===== Session =====
const SessionSchema = new Schema({
  _id: { type: String, required: true },
  patientId: { type: String, required: true, index: true },
  procedureType: { type: String, required: true },
  doctorName: { type: String, required: true },
  scheduledAt: { type: String, required: true },
  status: { type: String, enum: ['waiting', 'in-progress', 'completed', 'cancelled'], default: 'waiting' },
  indication: { type: String, default: '' },
  preparation: { type: String, default: '' },
  sedation: { type: String, enum: ['none', 'local', 'conscious', 'general'], default: 'conscious' },
  findings: { type: String, default: '' },
  questionnaireAnswers: { type: Schema.Types.Mixed },
  createdAt: { type: String, default: () => new Date().toISOString() },
  completedAt: String,
}, { timestamps: false, versionKey: false });

SessionSchema.set('toJSON', { virtuals: true, transform: (_doc: any, ret: any) => { ret.id = ret._id.toString(); delete ret._id; return ret; } });

export const Session = mongoose.model('Session', SessionSchema);

// ===== Report =====
const ReportSectionSchema = new Schema({ title: String, content: String }, { _id: false });

const ReportSchema = new Schema({
  _id: { type: String, required: true },
  sessionId: { type: String, required: true, index: true },
  doctorName: { type: String, default: '' },
  templateUsed: String,
  sections: [ReportSectionSchema],
  diagnosis: [String],
  recommendations: [String],
  followUp: String,
  biopsy: { type: Boolean, default: false },
  biopsyLocation: String,
  biopsySentTo: String,
  freeReportHtml: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
  status: { type: String, enum: ['draft', 'final'], default: 'draft' },
}, { timestamps: false, versionKey: false });

ReportSchema.set('toJSON', { virtuals: true, transform: (_doc: any, ret: any) => { ret.id = ret._id.toString(); delete ret._id; return ret; } });

export const Report = mongoose.model('Report', ReportSchema);

// ===== Template =====
const TemplateSectionSchema = new Schema({ title: String, defaultContent: String }, { _id: false });

const TemplateSchema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  procedureType: { type: String, required: true },
  sections: [TemplateSectionSchema],
  diagnoses: [String],
}, { timestamps: false, versionKey: false });

TemplateSchema.set('toJSON', { virtuals: true, transform: (_doc: any, ret: any) => { ret.id = ret._id.toString(); delete ret._id; return ret; } });

export const Template = mongoose.model('Template', TemplateSchema);

// ===== Settings (singleton) =====
const ProcedureDefSchema = new Schema({ id: String, label: String, icon: String, questions: Schema.Types.Mixed }, { _id: false });

const SettingsSchema = new Schema({
  _key: { type: String, default: 'global', unique: true },
  hospitalName: { type: String, default: 'My Hospital' },
  hospitalLogo: String,
  departmentName: { type: String, default: 'GI Endoscopy Unit' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  doctors: { type: [String], default: [] },
  procedures: { type: [ProcedureDefSchema], default: [] },
  defaultPreparations: { type: Schema.Types.Mixed, default: {} },
  reportFooter: { type: String, default: '' },
}, { timestamps: false, versionKey: false });

SettingsSchema.set('toJSON', { transform: (_doc: any, ret: any) => { delete ret._id; delete ret._key; return ret; } });

export const Settings = mongoose.model('Settings', SettingsSchema);

// ===== User =====
const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String, required: true },
  role: { type: String, enum: ['secretary', 'doctor', 'admin'], required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
  lastLoginAt: String,
}, { timestamps: false, versionKey: false });

UserSchema.set('toJSON', { virtuals: true, transform: (_doc: any, ret: any) => { ret.id = ret._id.toString(); delete ret._id; return ret; } });

export const User = mongoose.model('User', UserSchema);

// ===== Media metadata (stored in DB, actual files on disk) =====
const MediaSchema = new Schema({
  sessionId: { type: String, required: true, index: true },
  type: { type: String, enum: ['image', 'video', 'report'], required: true },
  filename: { type: String, required: true },
  capturedAt: { type: String, default: () => new Date().toISOString() },
  source: { type: String, enum: ['upload', 'camera', 'hdmi-capture', 'report'], default: 'upload' },
  label: String,
  annotations: String,
  reportId: String,
  // Server-side storage info
  storagePath: { type: String, required: true }, // relative path inside MEDIA_DIR
  mimeType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
}, { timestamps: false, versionKey: false });

MediaSchema.set('toJSON', { virtuals: true, transform: (_doc: any, ret: any) => { ret.id = ret._id.toString(); delete ret._id; return ret; } });

export const Media = mongoose.model('Media', MediaSchema);

// ===== Generic key-value store (for frontend storage.ts compatibility) =====
const KVStoreSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed },
}, { timestamps: false, versionKey: false });

export const KVStore = mongoose.model('KVStore', KVStoreSchema);
