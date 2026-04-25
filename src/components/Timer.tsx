import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerSettings } from "@/lib/storage";
import { playChime, requestNotificationPermission, showNotification } from "@/lib/audio";
import { toast } from "sonner";

export type SessionKind = "focus" | "shortBreak" | "longBreak";

const SESSION_LABEL: Record<SessionKind, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

interface TimerProps {
  subject: string;
  onSessionComplete: (kind: SessionKind, minutes: number, subject: string) => void;
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Timer({ subject, onSessionComplete }: TimerProps) {
  const { settings } = useTimerSettings();

  const [kind, setKind] = useState<SessionKind>("focus");
  const [secondsLeft, setSecondsLeft] = useState(settings.focusDuration * 60);
  const [running, setRunning] = useState(false);
  const [completedFocusCount, setCompletedFocusCount] = useState(0);

  const intervalRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const totalSeconds = useMemo(() => {
    if (kind === "focus") return settings.focusDuration * 60;
    if (kind === "shortBreak") return settings.shortBreakDuration * 60;
    return settings.longBreakDuration * 60;
  }, [kind, settings]);

  // Reset countdown when settings change for the current kind
  useEffect(() => {
    if (!running) {
      setSecondsLeft(totalSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSeconds]);

  // Tick — interval-based for smoothness without drift
  useEffect(() => {
    if (!running) return;
    completedRef.current = false;

    const startTimestamp = Date.now();
    const startRemaining = secondsLeft;

    intervalRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
      const next = Math.max(0, startRemaining - elapsed);
      setSecondsLeft(next);
      if (next <= 0 && !completedRef.current) {
        completedRef.current = true;
        handleSessionEnd();
      }
    }, 250);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Update tab title with countdown
  useEffect(() => {
    document.title = running
      ? `${formatTime(secondsLeft)} · ${SESSION_LABEL[kind]} — FocusFlow`
      : "FocusFlow";
    return () => {
      document.title = "FocusFlow";
    };
  }, [secondsLeft, running, kind]);

  function handleSessionEnd() {
    setRunning(false);
    playChime();

    if (kind === "focus") {
      const minutes = settings.focusDuration;
      onSessionComplete("focus", minutes, subject);
      const nextCount = completedFocusCount + 1;
      setCompletedFocusCount(nextCount);

      const goLong = nextCount % settings.longBreakInterval === 0;
      const nextKind: SessionKind = goLong ? "longBreak" : "shortBreak";
      const nextSeconds =
        (goLong ? settings.longBreakDuration : settings.shortBreakDuration) * 60;

      showNotification("Focus complete", `Time for a ${SESSION_LABEL[nextKind].toLowerCase()}.`);
      toast.success("Focus session complete", {
        description: `Switching to ${SESSION_LABEL[nextKind].toLowerCase()}.`,
      });

      setKind(nextKind);
      setSecondsLeft(nextSeconds);
    } else {
      onSessionComplete(kind, 0, subject);
      const nextSeconds = settings.focusDuration * 60;
      showNotification("Break over", "Ready for another focus session?");
      toast("Break over", { description: "Ready for another focus session?" });
      setKind("focus");
      setSecondsLeft(nextSeconds);
    }
  }

  function handleStartPause() {
    if (!running) {
      // Require a subject for focus sessions only — breaks are unrestricted.
      if (kind === "focus" && !subject.trim()) {
        toast.error("Pick a subject first", {
          description: "Choose what you're studying from your plan to start a focus session.",
        });
        return;
      }
      requestNotificationPermission();
    }
    setRunning((r) => !r);
  }

  function handleReset() {
    setRunning(false);
    setSecondsLeft(totalSeconds);
  }

  function handleSkip() {
    setRunning(false);
    if (kind === "focus") {
      setKind("shortBreak");
      setSecondsLeft(settings.shortBreakDuration * 60);
    } else {
      setKind("focus");
      setSecondsLeft(settings.focusDuration * 60);
    }
  }

  function handleKindChange(next: SessionKind) {
    setRunning(false);
    setKind(next);
    if (next === "focus") setSecondsLeft(settings.focusDuration * 60);
    else if (next === "shortBreak") setSecondsLeft(settings.shortBreakDuration * 60);
    else setSecondsLeft(settings.longBreakDuration * 60);
  }

  const progress = totalSeconds === 0 ? 0 : 1 - secondsLeft / totalSeconds;
  const ringSize = 320;
  const stroke = 10;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Session kind tabs */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-card/60 backdrop-blur-sm border border-card-border shadow-xs mb-10">
        {(Object.keys(SESSION_LABEL) as SessionKind[]).map((k) => (
          <button
            key={k}
            onClick={() => handleKindChange(k)}
            className={`relative px-4 sm:px-5 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-colors ${
              kind === k
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`button-kind-${k}`}
          >
            {kind === k && (
              <motion.span
                layoutId="kind-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{SESSION_LABEL[k]}</span>
          </button>
        ))}
      </div>

      {/* Timer ring */}
      <div className="relative" style={{ width: ringSize, height: ringSize, maxWidth: "90vw" }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${ringSize} ${ringSize}`}
          className="-rotate-90"
        >
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.4, ease: "linear" }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
          <motion.div
            animate={running ? { scale: [1, 1.012, 1] } : { scale: 1 }}
            transition={running ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : {}}
            className="font-light tabular-nums text-foreground tracking-tight"
            style={{ fontSize: "clamp(3.5rem, 12vw, 5.5rem)" }}
            data-testid="text-countdown"
          >
            {formatTime(secondsLeft)}
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.p
              key={`${kind}-${completedFocusCount}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="mt-1 text-sm text-muted-foreground"
            >
              {SESSION_LABEL[kind]}
              {kind === "focus" ? ` · Session ${completedFocusCount + 1}` : ""}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-10 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={handleReset}
          aria-label="Reset"
          data-testid="button-reset"
          className="rounded-full h-12 w-12"
        >
          <RotateCcw className="h-5 w-5" />
        </Button>

        <Button
          size="lg"
          onClick={handleStartPause}
          aria-label={running ? "Pause" : "Start"}
          data-testid="button-start-pause"
          className="rounded-full h-14 min-w-[150px] text-base font-medium gap-2 shadow-lg"
        >
          {running ? (
            <>
              <Pause className="h-5 w-5" /> Pause
            </>
          ) : (
            <>
              <Play className="h-5 w-5" /> Start
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleSkip}
          aria-label="Skip session"
          data-testid="button-skip"
          className="rounded-full h-12 w-12"
        >
          <SkipForward className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
