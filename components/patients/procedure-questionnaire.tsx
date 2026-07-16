'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProcedureQuestion } from '@/lib/types';
import { useLocale } from '@/hooks/use-locale';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (answers: Record<string, string | string[] | boolean>) => void;
  questions: ProcedureQuestion[];
  procedureLabel: string;
}

export function ProcedureQuestionnaire({ open, onClose, onSubmit, questions, procedureLabel }: Props) {
  const { t } = useLocale();
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>({});

  const updateAnswer = (questionId: string, value: string | string[] | boolean) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    onSubmit(answers);
    setAnswers({});
  };

  const handleSkip = () => {
    onSubmit({});
    setAnswers({});
  };

  if (questions.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.newPatient.questionnaire} — {procedureLabel}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t.newPatient.questionnaireDesc}</p>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label>{q.label}</Label>

              {q.type === 'text' && (
                <Input
                  value={(answers[q.id] as string) || ''}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                  placeholder={q.label}
                />
              )}

              {q.type === 'dropdown' && (
                <Select
                  value={(answers[q.id] as string) || ''}
                  onValueChange={(val) => updateAnswer(q.id, val)}
                >
                  <SelectItem value="">—</SelectItem>
                  {(q.options || []).map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </Select>
              )}

              {q.type === 'yes-no' && (
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === true}
                      onChange={() => updateAnswer(q.id, true)}
                    />
                    {t.common.yes}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === false}
                      onChange={() => updateAnswer(q.id, false)}
                    />
                    {t.common.no}
                  </label>
                </div>
              )}

              {q.type === 'multi-select' && (
                <div className="flex flex-wrap gap-3">
                  {(q.options || []).map((opt) => {
                    const selected = Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected}
                          onChange={() => {
                            const current = Array.isArray(answers[q.id]) ? [...(answers[q.id] as string[])] : [];
                            if (selected) {
                              updateAnswer(q.id, current.filter((v) => v !== opt));
                            } else {
                              updateAnswer(q.id, [...current, opt]);
                            }
                          }}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleSkip}>
            {t.newPatient.skipQuestionnaire}
          </Button>
          <Button onClick={handleSubmit}>
            {t.newPatient.submitQuestionnaire}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
