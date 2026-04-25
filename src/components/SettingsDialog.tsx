import { useState, useEffect } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useTimerSettings, type TimerSettings } from "@/lib/storage";

export default function SettingsDialog() {
  const { settings, setSettings } = useTimerSettings();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TimerSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  function handleSave() {
    setSettings(draft);
    setOpen(false);
  }

  function handleReset() {
    setDraft({
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Timer settings"
          data-testid="button-open-settings"
          className="rounded-full"
        >
          <SettingsIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Timer settings</DialogTitle>
          <DialogDescription>Tune your sessions to match how you work.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <DurationField
            label="Focus"
            unit="minutes"
            value={draft.focusDuration}
            min={1}
            max={60}
            onChange={(v) => setDraft({ ...draft, focusDuration: v })}
            testId="slider-focus"
          />
          <DurationField
            label="Short break"
            unit="minutes"
            value={draft.shortBreakDuration}
            min={1}
            max={30}
            onChange={(v) => setDraft({ ...draft, shortBreakDuration: v })}
            testId="slider-short-break"
          />
          <DurationField
            label="Long break"
            unit="minutes"
            value={draft.longBreakDuration}
            min={1}
            max={45}
            onChange={(v) => setDraft({ ...draft, longBreakDuration: v })}
            testId="slider-long-break"
          />
          <DurationField
            label="Long break after"
            unit="focus sessions"
            value={draft.longBreakInterval}
            min={2}
            max={8}
            onChange={(v) => setDraft({ ...draft, longBreakInterval: v })}
            testId="slider-long-break-interval"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleReset} data-testid="button-reset-settings">
            Reset defaults
          </Button>
          <Button onClick={handleSave} data-testid="button-save-settings">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DurationField({
  label,
  unit,
  value,
  min,
  max,
  onChange,
  testId,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="text-foreground font-medium">{value}</span> {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(vals) => onChange(vals[0])}
        data-testid={testId}
      />
    </div>
  );
}
