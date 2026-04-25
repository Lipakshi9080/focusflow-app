import { Moon, Sun, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

const THEMES: { id: "calm" | "aesthetic" | "focus"; label: string; description: string; swatch: string }[] = [
  { id: "calm", label: "Calm", description: "Soft sage & sky", swatch: "linear-gradient(135deg, hsl(180 40% 88%), hsl(200 35% 90%))" },
  { id: "aesthetic", label: "Aesthetic", description: "Peach & lavender", swatch: "linear-gradient(135deg, hsl(20 85% 88%), hsl(340 65% 88%), hsl(280 50% 90%))" },
  { id: "focus", label: "Focus", description: "Deep indigo", swatch: "linear-gradient(135deg, hsl(245 50% 35%), hsl(232 45% 25%))" },
];

export default function ThemeSwitcher() {
  const { theme, setTheme, isDark, setIsDark } = useTheme();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setIsDark(!isDark)}
        data-testid="button-toggle-dark"
        className="rounded-full relative overflow-hidden"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.span
              key="moon"
              initial={{ opacity: 0, rotate: -45, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 45, scale: 0.6 }}
              transition={{ duration: 0.25 }}
              className="absolute"
            >
              <Moon className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ opacity: 0, rotate: 45, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -45, scale: 0.6 }}
              transition={{ duration: 0.25 }}
              className="absolute"
            >
              <Sun className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Choose theme"
            data-testid="button-open-theme"
            className="rounded-full"
          >
            <Palette className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Background theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEMES.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              data-testid={`theme-${t.id}`}
              className="gap-3 py-2.5"
            >
              <span
                className="h-7 w-7 rounded-full border border-card-border shadow-inner shrink-0"
                style={{ background: t.swatch }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium leading-tight">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
              {theme === t.id && (
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
