import { BookOpen, Clock, Flame, Trophy, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStorage, useSchedule } from "@/lib/storage";

function formatMinutes(total: number): string {
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface StudyTrackerProps {
  onOpenSchedule?: () => void;
}

export default function StudyTracker({ onOpenSchedule }: StudyTrackerProps) {
  const { stats } = useStorage();
  const { items } = useSchedule();

  return (
    <div className="rounded-2xl border border-card-border bg-card/70 backdrop-blur-sm p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Today &amp; beyond</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Today"
          value={formatMinutes(stats.todayFocusMinutes)}
        />
        <StatCard
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Sessions"
          value={String(stats.todaySessions)}
        />
        <StatCard
          icon={<Trophy className="h-3.5 w-3.5" />}
          label="All time"
          value={formatMinutes(stats.allTimeFocusMinutes)}
        />
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Today's plan
          </p>
          {items.length > 0 && onOpenSchedule && (
            <button
              type="button"
              onClick={onOpenSchedule}
              className="text-xs text-primary hover:underline"
              data-testid="link-edit-schedule"
            >
              Edit
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              You haven't planned any subjects yet.
            </p>
            {onOpenSchedule && (
              <button
                type="button"
                onClick={onOpenSchedule}
                className="text-sm font-medium text-primary hover:underline"
                data-testid="button-create-plan"
              >
                Create your plan
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3" data-testid="list-progress">
            <AnimatePresence initial={false}>
              {items.map((item, idx) => {
                const pct = Math.min(
                  100,
                  Math.round((item.completed / item.target) * 100)
                );
                const done = item.completed >= item.target;
                return (
                  <motion.li
                    key={item.subject}
                    layout
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {done && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                        <span className="font-medium text-foreground truncate">
                          {item.subject}
                        </span>
                      </div>
                      <span className="tabular-nums text-muted-foreground text-xs shrink-0 pl-2">
                        {item.completed}
                        <span className="text-muted-foreground/70">
                          {" / "}
                          {item.target}m
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={`h-full ${
                          done ? "bg-primary" : "bg-primary/80"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-3 flex flex-col items-start">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
