import { useState, useEffect, useRef, useCallback } from "react";

// ----------------------------------------------------------------------------
// Cross-component localStorage sync
// ----------------------------------------------------------------------------
// Multiple components read the same keys (stats, schedule, timer settings).
// Without a pubsub, an instance that calls a setter doesn't notify other
// instances, so reads go stale until the next mount. This pubsub keeps every
// useLocalStorage instance for a given key in sync within the same tab and
// also reacts to cross-tab "storage" events.

const listeners: Map<string, Set<() => void>> = new Map();

function subscribe(key: string, cb: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
  };
}

function notify(key: string, except?: () => void) {
  listeners.get(key)?.forEach((cb) => {
    if (cb !== except) cb();
  });
}

function readLS<T>(key: string, initial: T): T {
  if (typeof window === "undefined") return initial;
  const raw = localStorage.getItem(key);
  if (raw === null) return initial;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return initial;
  }
}

function useLocalStorage<T>(
  key: string,
  initial: T
): [T, (updater: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => readLS(key, initial));
  const initialRef = useRef(initial);
  const cbRef = useRef<() => void>(() => {});

  useEffect(() => {
    const cb = () => setState(readLS(key, initialRef.current));
    cbRef.current = cb;
    const unsubLocal = subscribe(key, cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubLocal();
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: T) => T)(prev)
            : updater;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore quota errors */
        }
        notify(key, cbRef.current);
        return next;
      });
    },
    [key]
  );

  return [state, setValue];
}

// ----------------------------------------------------------------------------
// Date helpers
// ----------------------------------------------------------------------------
function todayKey(): string {
  return new Date().toDateString();
}

// ----------------------------------------------------------------------------
// Stats — focus minutes and session counts
// ----------------------------------------------------------------------------
interface SubjectStats {
  minutes: number;
}

interface Stats {
  todayFocusMinutes: number;
  todaySessions: number;
  allTimeFocusMinutes: number;
  subjects: Record<string, SubjectStats>;
  lastActiveDate: string;
}

const defaultStats: Stats = {
  todayFocusMinutes: 0,
  todaySessions: 0,
  allTimeFocusMinutes: 0,
  subjects: {},
  lastActiveDate: todayKey(),
};

export function useStorage() {
  const [stats, setStats] = useLocalStorage<Stats>("ff_stats", defaultStats);

  // Roll over daily counters when the date changes.
  useEffect(() => {
    const t = todayKey();
    if (stats.lastActiveDate !== t) {
      setStats({
        ...stats,
        todayFocusMinutes: 0,
        todaySessions: 0,
        lastActiveDate: t,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.lastActiveDate]);

  const addSession = useCallback(
    (minutes: number, subject?: string) => {
      setStats((prev) => {
        const s = {
          ...prev,
          subjects: { ...prev.subjects },
          lastActiveDate: todayKey(),
        };
        s.todayFocusMinutes += minutes;
        s.allTimeFocusMinutes += minutes;
        s.todaySessions += 1;

        const key = subject?.trim();
        if (key) {
          const existing = s.subjects[key]?.minutes ?? 0;
          s.subjects[key] = { minutes: existing + minutes };
        }
        return s;
      });
    },
    [setStats]
  );

  return { stats, addSession };
}

// ----------------------------------------------------------------------------
// Timer settings
// ----------------------------------------------------------------------------
export interface TimerSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
}

const defaultTimerSettings: TimerSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
};

export function useTimerSettings() {
  const [settings, setSettings] = useLocalStorage<TimerSettings>(
    "ff_timer_settings",
    defaultTimerSettings
  );
  return { settings, setSettings };
}

// ----------------------------------------------------------------------------
// Daily study schedule
// ----------------------------------------------------------------------------
export interface ScheduleItem {
  subject: string;
  target: number; // minutes
  completed: number; // minutes accumulated today
}

interface ScheduleState {
  items: ScheduleItem[];
  lastResetDate: string;
}

const defaultSchedule: ScheduleState = {
  items: [],
  lastResetDate: todayKey(),
};

export type ScheduleAddResult =
  | { ok: true }
  | { ok: false; error: string };

export function useSchedule() {
  const [state, setState] = useLocalStorage<ScheduleState>(
    "ff_schedule",
    defaultSchedule
  );

  // Automatic daily reset: when the day flips, zero every "completed".
  useEffect(() => {
    const t = todayKey();
    if (state.lastResetDate !== t) {
      setState({
        items: state.items.map((it) => ({ ...it, completed: 0 })),
        lastResetDate: t,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastResetDate]);

  const addItem = useCallback(
    (subject: string, target: number): ScheduleAddResult => {
      const name = subject.trim();
      if (!name) return { ok: false, error: "Subject can't be empty." };
      if (name.length > 40)
        return { ok: false, error: "Subject is too long (max 40 chars)." };
      if (!Number.isFinite(target) || target <= 0)
        return { ok: false, error: "Target must be a positive number of minutes." };
      if (target > 24 * 60)
        return { ok: false, error: "Target must be 1440 minutes or fewer." };

      let duplicate = false;
      setState((prev) => {
        const exists = prev.items.some(
          (it) => it.subject.toLowerCase() === name.toLowerCase()
        );
        if (exists) {
          duplicate = true;
          return prev;
        }
        return {
          ...prev,
          items: [
            ...prev.items,
            { subject: name, target: Math.round(target), completed: 0 },
          ],
        };
      });
      if (duplicate)
        return { ok: false, error: "That subject is already in your plan." };
      return { ok: true };
    },
    [setState]
  );

  const updateItem = useCallback(
    (
      originalSubject: string,
      patch: { subject?: string; target?: number }
    ): ScheduleAddResult => {
      const newName = patch.subject?.trim();
      if (newName !== undefined) {
        if (!newName) return { ok: false, error: "Subject can't be empty." };
        if (newName.length > 40)
          return { ok: false, error: "Subject is too long (max 40 chars)." };
      }
      if (patch.target !== undefined) {
        if (!Number.isFinite(patch.target) || patch.target <= 0)
          return {
            ok: false,
            error: "Target must be a positive number of minutes.",
          };
        if (patch.target > 24 * 60)
          return {
            ok: false,
            error: "Target must be 1440 minutes or fewer.",
          };
      }

      let duplicate = false;
      setState((prev) => {
        if (newName) {
          const collision = prev.items.some(
            (it) =>
              it.subject !== originalSubject &&
              it.subject.toLowerCase() === newName.toLowerCase()
          );
          if (collision) {
            duplicate = true;
            return prev;
          }
        }
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.subject === originalSubject
              ? {
                  ...it,
                  subject: newName ?? it.subject,
                  target:
                    patch.target !== undefined
                      ? Math.round(patch.target)
                      : it.target,
                }
              : it
          ),
        };
      });
      if (duplicate)
        return { ok: false, error: "Another subject already uses that name." };
      return { ok: true };
    },
    [setState]
  );

  const removeItem = useCallback(
    (subject: string) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((it) => it.subject !== subject),
      }));
    },
    [setState]
  );

  const addCompleted = useCallback(
    (subject: string, minutes: number) => {
      const name = subject.trim();
      if (!name || minutes <= 0) return;
      setState((prev) => ({
        ...prev,
        lastResetDate: todayKey(),
        items: prev.items.map((it) =>
          it.subject === name
            ? { ...it, completed: it.completed + minutes }
            : it
        ),
      }));
    },
    [setState]
  );

  const resetDaily = useCallback(() => {
    setState((prev) => ({
      lastResetDate: todayKey(),
      items: prev.items.map((it) => ({ ...it, completed: 0 })),
    }));
  }, [setState]);

  return {
    schedule: state,
    items: state.items,
    addItem,
    updateItem,
    removeItem,
    addCompleted,
    resetDaily,
  };
}
