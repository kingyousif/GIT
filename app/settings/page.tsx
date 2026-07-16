import { AccessGuard } from '@/components/shared/access-guard';
import { SettingsPageContent } from '@/components/settings/settings-page';

export default function SettingsPage() {
  return (
    <AccessGuard allowed={['admin']}>
      <SettingsPageContent />
    </AccessGuard>
  );
}
