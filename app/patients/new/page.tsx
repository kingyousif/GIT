import { AccessGuard } from '@/components/shared/access-guard';
import { NewPatientForm } from '@/components/patients/new-patient-form';

export default function NewPatientPage() {
  return (
    <AccessGuard allowed={['secretary', 'admin']}>
      <NewPatientForm />
    </AccessGuard>
  );
}
