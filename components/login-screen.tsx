'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Stethoscope, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { authenticateUser } from '@/lib/auth';
import { UserAccount } from '@/lib/types';
import { useLocale } from '@/hooks/use-locale';

export function LoginScreen({ onLogin }: { onLogin: (user: UserAccount) => void }) {
  const { t } = useLocale();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(t.auth.bothRequired);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await authenticateUser(username.trim(), password);
      if (!user) {
        setError(t.auth.invalidCredentials);
        setLoading(false);
        return;
      }
      toast.success(`Welcome back, ${user.displayName}`);
      onLogin(user);
    } catch (err) {
      console.error(err);
      setError(t.auth.loginError);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="absolute right-6 top-6 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Stethoscope className="h-8 w-8" />
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">{t.auth.arenaEndoscopy}</p>
          <h1 className="text-3xl font-semibold text-foreground">{t.auth.signIn}</h1>
          <p className="text-sm text-muted-foreground">
            {t.auth.enterCredentials}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-base">{t.auth.workstationLogin}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t.auth.username}</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder={t.auth.enterUsername}
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(''); }}
                    className="pl-10"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t.auth.enterPassword}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    className="pl-10 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="h-4 w-4" />
                {loading ? t.auth.signingIn : t.auth.signIn}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-card-border bg-muted p-4 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t.auth.defaultAccounts}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-card p-2">
              <p className="font-medium text-foreground">{t.auth.admin}</p>
              <p>admin / admin123</p>
            </div>
            <div className="rounded-lg bg-card p-2">
              <p className="font-medium text-foreground">{t.auth.doctor}</p>
              <p>doctor / doctor123</p>
            </div>
            <div className="rounded-lg bg-card p-2">
              <p className="font-medium text-foreground">{t.auth.secretary}</p>
              <p>secretary / secretary123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
