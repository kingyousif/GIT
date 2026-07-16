"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <button
        className={cn(
          "relative inline-flex h-9 w-16 items-center rounded-full border border-card-border bg-muted p-1",
          className,
        )}
        aria-label="Toggle theme"
      >
        <span className="h-7 w-7 rounded-full bg-card" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-9 w-16 items-center rounded-full border border-card-border bg-muted p-1 transition-colors",
        className,
      )}
      dir="ltr"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full bg-card shadow-sm transition-transform duration-300",
          theme === "dark" ? "translate-x-7" : "translate-x-0",
        )}
      >
        {theme === "dark" ? (
          <Moon className="h-3.5 w-3.5 text-blue-400" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
      </span>
    </button>
  );
}
