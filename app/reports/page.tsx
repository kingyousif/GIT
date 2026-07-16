import { AccessGuard } from '@/components/shared/access-guard';
import { ReportsArchive } from '@/components/reports/reports-archive';

export default function ReportsPage() {
  return (
    <AccessGuard allowed={['doctor', 'admin']}>
      <ReportsArchive />
    </AccessGuard>
  );
}
