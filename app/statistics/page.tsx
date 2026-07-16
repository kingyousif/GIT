import { AccessGuard } from '@/components/shared/access-guard';
import { StatisticsDashboard } from '@/components/statistics/statistics-dashboard';

export default function StatisticsPage() {
  return (
    <AccessGuard allowed={['admin']}>
      <StatisticsDashboard />
    </AccessGuard>
  );
}
