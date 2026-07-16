import { z } from 'zod';

export const patientRegistrationSchema = z.object({
  patientCode: z.string().min(1, 'Patient code is required.'),
  fullName: z.string().min(2, 'Full name is required.'),
  age: z.coerce.number().int().min(1, 'Age is required.').max(120, 'Enter a valid age.'),
  gender: z.enum(['male', 'female']),
  phone: z.string().min(3, 'Phone number is required.'),
  address: z.string().optional(),
  referredBy: z.string().optional(),
  procedureType: z.string().min(1, 'Procedure type is required.'),
  doctorName: z.string().min(2, 'Assigned doctor is required.'),
  scheduledAt: z.string().min(1, 'Date and time are required.'),
  indication: z.string().min(3, 'Indication is required.'),
  preparation: z.string().min(3, 'Preparation instructions are required.'),
  sedation: z.enum(['none', 'local', 'conscious', 'general']),
});

export const reportSectionSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(''),
});

export const reportSchema = z.object({
  doctorName: z.string().min(2, 'Doctor name is required.'),
  templateUsed: z.string().optional(),
  sections: z.array(reportSectionSchema).min(1),
  diagnosis: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  followUp: z.string().optional(),
  biopsy: z.boolean(),
  biopsyLocation: z.string().optional(),
  biopsySentTo: z.string().optional(),
  status: z.enum(['draft', 'final']),
});

export const procedureQuestionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: z.enum(['text', 'dropdown', 'yes-no', 'multi-select']),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

export const procedureDefinitionSchema = z.object({
  id: z.string().min(1, 'Procedure ID is required.'),
  label: z.string().min(1, 'Procedure label is required.'),
  icon: z.string().optional(),
  questions: z.array(procedureQuestionSchema).optional(),
});

export const settingsSchema = z.object({
  hospitalName: z.string().min(2, 'Hospital name is required.'),
  hospitalLogo: z.string().optional(),
  departmentName: z.string().min(2, 'Department name is required.'),
  address: z.string().min(2, 'Address is required.'),
  phone: z.string().min(2, 'Phone is required.'),
  doctors: z.array(z.string().min(2)).min(1, 'At least one doctor is required.'),
  procedures: z.array(procedureDefinitionSchema).min(1, 'At least one procedure is required.'),
  defaultPreparations: z.record(z.string(), z.string()),
  reportFooter: z.string().min(2, 'Footer is required.'),
});

export const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, 'Template name is required.'),
  procedureType: z.string().min(1, 'Procedure type is required.'),
  sections: z.array(
    z.object({
      title: z.string().min(1, 'Section title is required.'),
      defaultContent: z.string().min(1, 'Default content is required.'),
    }),
  ),
  diagnoses: z.array(z.string()),
});
