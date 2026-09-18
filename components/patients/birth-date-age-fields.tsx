'use client';

import { CalendarDays, Hash, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/hooks/use-locale';
import {
  ageFromDateOfBirth,
  dateOfBirthFromAge,
  minBirthIsoDate,
  todayIsoDate,
} from '@/lib/age';
import { cn } from '@/lib/utils';

export function BirthDateAgeFields({
  dateOfBirth,
  age,
  onDateOfBirthChange,
  onAgeChange,
  dateError,
  ageError,
  className,
}: {
  dateOfBirth: string;
  age: number | string;
  onDateOfBirthChange: (value: string) => void;
  onAgeChange: (value: number | '') => void;
  dateError?: string;
  ageError?: string;
  className?: string;
}) {
  const { t } = useLocale();
  const ageValue = age === '' || age === undefined || Number.isNaN(Number(age)) ? '' : String(age);
  const calculatedAge = ageFromDateOfBirth(dateOfBirth);
  const linked = Boolean(dateOfBirth) && calculatedAge !== null && String(calculatedAge) === ageValue;

  const handleDateChange = (value: string) => {
    onDateOfBirthChange(value);
    const nextAge = ageFromDateOfBirth(value);
    if (nextAge !== null) onAgeChange(nextAge);
  };

  const handleAgeChange = (raw: string) => {
    if (raw === '') {
      onAgeChange('');
      return;
    }
    const nextAge = Number(raw);
    if (!Number.isFinite(nextAge)) return;
    onAgeChange(nextAge);
    if (nextAge >= 0 && nextAge <= 120) {
      onDateOfBirthChange(dateOfBirthFromAge(nextAge, dateOfBirth));
    }
  };

  return (
    <div className={cn('md:col-span-2', className)}>
      <div className="overflow-hidden rounded-2xl border border-card-border bg-muted/30">
        <div className="flex items-center justify-between gap-3 border-b border-card-border/80 px-4 py-2.5">
          <p className="text-sm font-semibold text-foreground">{t.newPatient.birthRecord}</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Link2 className="h-3 w-3" />
            {linked ? t.newPatient.fieldsLinked : t.newPatient.dateOfBirthHint}
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-2 p-4">
            <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {t.newPatient.dateOfBirth}
            </Label>
            <Input
              id="dateOfBirth"
              type="date"
              min={minBirthIsoDate()}
              max={todayIsoDate()}
              value={dateOfBirth}
              onChange={(event) => handleDateChange(event.target.value)}
            />
            {dateError ? <p className="text-sm text-rose-600">{dateError}</p> : null}
          </div>

          <div className="flex items-center justify-center px-2 py-1 md:flex-col md:px-0">
            <div className="hidden h-full w-px bg-card-border md:block" />
            <span className="rounded-full border border-card-border bg-background px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground md:my-0">
              {t.newPatient.autoFill}
            </span>
            <div className="hidden h-full w-px bg-card-border md:block" />
          </div>

          <div className="space-y-2 p-4">
            <Label htmlFor="age" className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-primary" />
              {t.newPatient.age}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                placeholder="—"
                className="flex-1"
                value={ageValue}
                onChange={(event) => handleAgeChange(event.target.value)}
              />
              <span className="shrink-0 text-sm font-medium text-muted-foreground">{t.common.years}</span>
            </div>
            {ageError ? <p className="text-sm text-rose-600">{ageError}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
