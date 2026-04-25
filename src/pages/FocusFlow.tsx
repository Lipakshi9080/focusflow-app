import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Timer, { type SessionKind } from "@/components/Timer";
import MusicPlayer from "@/components/MusicPlayer";
import StudyTracker from "@/components/StudyTracker";
import SettingsDialog from "@/components/SettingsDialog";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import ScheduleManager from "@/components/ScheduleManager";
import { useStorage, useSchedule } from "@/lib/storage";

const SUBJECT_KEY = "ff_current_subject";

export default function FocusFlow() {
  const { items: scheduleItems } = useSchedule();
  const { addSession } = useStorage();
  const { addCompleted } = useSchedule();

  // Selected subject is the source of truth for "what am I studying right now".
  // Persisted across reloads. If the chosen subject is removed from the
  // schedule we clear it so the user has to choose again.
  const [subject, setSubject] = useState<string>(() => {
    return localStorage.getItem(SUBJECT_KEY) || "";
  });

  useEffect(() => {
    if (subject && !scheduleItems.some((i) => i.subject === subject)) {
      setSubject("");
      localStorage.removeItem(SUBJECT_KEY);
    }
  }, [scheduleItems, subject]);

  function handleSubjectChange(v: string) {
    setSubject(v);
    if (v) localStorage.setItem(SUBJECT_KEY, v);
    else localStorage.removeItem(SUBJECT_KEY);
  }

  function handleSessionComplete(
    kind: SessionKind,
    minutes: number,
    subj: string
  ) {
    if (kind === "focus" && minutes > 0) {
      addSession(minutes, subj);
      if (subj) addCompleted(subj, minutes);
    }
  }

  const hasSchedule = scheduleItems.length > 0;
  const subjectOptionsKey = useMemo(
    () => scheduleItems.map((i) => i.subject).join("|"),
    [scheduleItems]
  );

  return (
    <div className="min-h-screen w-full">
      {/* Top bar */}
      <header className="w-full px-5 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            FocusFlow
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ScheduleManager
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open study plan"
                data-testid="button-open-schedule"
                className="rounded-full"
              >
                <CalendarDays className="h-5 w-5" />
              </Button>
            }
          />
          <SettingsDialog />
          <ThemeSwitcher />
        </div>
      </header>

      <main className="px-5 sm:px-8 pb-12">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_360px] gap-8 lg:gap-10 items-start">
          {/* Center column: timer + subject selector */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center pt-6 sm:pt-12"
          >
            <Timer subject={subject} onSessionComplete={handleSessionComplete} />

            <div className="mt-10 w-full max-w-sm">
              <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-2 text-center">
                What are you working on?
              </label>

              {hasSchedule ? (
                <div className="flex gap-2">
                  <Select
                    key={subjectOptionsKey}
                    value={subject || undefined}
                    onValueChange={handleSubjectChange}
                  >
                    <SelectTrigger
                      className="bg-card/70 backdrop-blur-sm h-11 flex-1"
                      data-testid="select-subject"
                    >
                      <SelectValue placeholder="Choose a subject from your plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {scheduleItems.map((item) => {
                        const remaining = Math.max(
                          0,
                          item.target - item.completed
                        );
                        return (
                          <SelectItem
                            key={item.subject}
                            value={item.subject}
                            data-testid={`subject-option-${item.subject}`}
                          >
                            <div className="flex items-center justify-between gap-3 w-full">
                              <span className="font-medium">{item.subject}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {remaining > 0
                                  ? `${remaining}m left`
                                  : "complete"}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <ScheduleManager
                    trigger={
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Manage schedule"
                        data-testid="button-manage-schedule"
                        className="h-11 w-11 bg-card/70 backdrop-blur-sm shrink-0"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
              ) : (
                <ScheduleManager
                  trigger={
                    <Button
                      variant="outline"
                      className="w-full h-11 bg-card/70 backdrop-blur-sm gap-2 justify-between"
                      data-testid="button-empty-schedule"
                    >
                      <span className="text-muted-foreground">
                        Plan your study subjects
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  }
                />
              )}
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Focus sessions count toward the selected subject's daily target.
              </p>
            </div>
          </motion.section>

          {/* Side column: music + tracker */}
          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            className="space-y-5 lg:pt-6"
          >
            <MusicPlayer />
            <StudyTracker />
          </motion.aside>
        </div>
      </main>

      <footer className="pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          A quiet space to focus. Your data stays in your browser.
        </p>
      </footer>
    </div>
  );
}
