'use client';

import { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/hooks/use-locale';
import { isDefaultMediaLabel } from '@/lib/media-label';
import { cn } from '@/lib/utils';

export function MediaLabelEditor({
  label,
  filename,
  compact = false,
  disabled = false,
  onSave,
}: {
  label?: string | null;
  filename: string;
  compact?: boolean;
  disabled?: boolean;
  onSave: (nextLabel: string) => void | Promise<void>;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(label ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const custom = !isDefaultMediaLabel({ label: value, filename });

  useEffect(() => {
    setValue(label ?? '');
  }, [label]);

  const commit = async (next = value) => {
    const trimmed = next.trim();
    if (trimmed === (label ?? '').trim()) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setValue('');
    await commit('');
  };

  return (
    <div
      className={cn('flex items-center gap-1', compact ? 'mt-0.5' : 'mt-1')}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="relative min-w-0 flex-1">
        <Pencil className="pointer-events-none absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          disabled={disabled || saving}
          placeholder={t.media.labelPlaceholder}
          aria-label={t.media.label}
          className={cn(
            'border-card-border/80 bg-background/80 pe-8 ps-7',
            compact ? 'h-7 text-[11px]' : 'h-8 text-xs',
            custom ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
          )}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setValue(label ?? '');
              event.currentTarget.blur();
            }
          }}
        />
        {value ? (
          <button
            type="button"
            className="absolute end-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title={t.media.clearLabel}
            aria-label={t.media.clearLabel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void clear()}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      {saved ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
      ) : null}
    </div>
  );
}
