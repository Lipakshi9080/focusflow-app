import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  RotateCcw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSchedule, type ScheduleItem } from "@/lib/storage";
import { toast } from "sonner";

interface ScheduleManagerProps {
  trigger: React.ReactNode;
}

export default function ScheduleManager({ trigger }: ScheduleManagerProps) {
  const [open, setOpen] = useState(false);
  const { items, addItem, updateItem, removeItem, resetDaily } = useSchedule();

  // Add form state
  const [newSubject, setNewSubject] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [unit, setUnit] = useState<"min" | "hr">("min");
  const [addError, setAddError] = useState<string | null>(null);

  // Edit state
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  function handleAdd() {
    setAddError(null);
    const targetNum = Number(newTarget);
    if (!newSubject.trim()) {
      setAddError("Give the subject a name.");
      return;
    }
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      setAddError("Target must be a positive number.");
      return;
    }
    const minutes = unit === "hr" ? targetNum * 60 : targetNum;
    const result = addItem(newSubject, minutes);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    toast.success("Subject added", { description: newSubject.trim() });
    setNewSubject("");
    setNewTarget("");
  }

  function startEdit(item: ScheduleItem) {
    setEditingSubject(item.subject);
    setEditName(item.subject);
    setEditTarget(String(item.target));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingSubject(null);
    setEditError(null);
  }

  function saveEdit(original: string) {
    setEditError(null);
    const t = Number(editTarget);
    if (!editName.trim()) {
      setEditError("Subject can't be empty.");
      return;
    }
    if (!Number.isFinite(t) || t <= 0) {
      setEditError("Target must be a positive number.");
      return;
    }
    const result = updateItem(original, { subject: editName, target: t });
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    toast.success("Subject updated");
    setEditingSubject(null);
  }

  function handleRemove(subject: string) {
    removeItem(subject);
    toast(`Removed "${subject}" from your plan`);
  }

  function handleResetDaily() {
    resetDaily();
    toast.success("Daily progress reset");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <SheetTitle>Daily study plan</SheetTitle>
          </div>
          <SheetDescription>
            Choose what you want to study today and how long. Progress resets
            automatically at midnight.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Add form */}
          <div className="rounded-2xl border border-card-border bg-card/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
              Add a subject
            </p>
            <div className="space-y-2.5">
              <Input
                placeholder="Subject (e.g. OS, DBMS)"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                maxLength={40}
                data-testid="input-new-subject"
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  placeholder={unit === "min" ? "Target minutes" : "Target hours"}
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                  className="flex-1"
                  data-testid="input-new-target"
                />
                <div className="flex rounded-md border border-input overflow-hidden text-xs">
                  <button
                    type="button"
                    className={`px-3 ${
                      unit === "min"
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-transparent text-muted-foreground hover-elevate"
                    }`}
                    onClick={() => setUnit("min")}
                    data-testid="button-unit-min"
                  >
                    min
                  </button>
                  <button
                    type="button"
                    className={`px-3 border-l border-input ${
                      unit === "hr"
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-transparent text-muted-foreground hover-elevate"
                    }`}
                    onClick={() => setUnit("hr")}
                    data-testid="button-unit-hr"
                  >
                    hr
                  </button>
                </div>
              </div>
              <Button
                onClick={handleAdd}
                className="w-full gap-1.5"
                size="sm"
                data-testid="button-add-subject"
              >
                <Plus className="h-4 w-4" />
                Add subject
              </Button>
              <AnimatePresence>
                {addError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-destructive"
                  >
                    {addError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Schedule list */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Today's plan ({items.length})
            </p>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing scheduled yet. Add your first subject above.
                </p>
              </div>
            ) : (
              <ul className="space-y-2" data-testid="list-schedule">
                <AnimatePresence initial={false}>
                  {items.map((item) => {
                    const isEditing = editingSubject === item.subject;
                    const pct = Math.min(
                      100,
                      Math.round((item.completed / item.target) * 100)
                    );
                    return (
                      <motion.li
                        key={item.subject}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-xl border border-card-border bg-card/70 p-3"
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              maxLength={40}
                              data-testid={`edit-name-${item.subject}`}
                            />
                            <div className="flex gap-2 items-center">
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={editTarget}
                                onChange={(e) => setEditTarget(e.target.value)}
                                className="flex-1"
                                data-testid={`edit-target-${item.subject}`}
                              />
                              <span className="text-xs text-muted-foreground">
                                min
                              </span>
                            </div>
                            {editError && (
                              <p className="text-xs text-destructive">
                                {editError}
                              </p>
                            )}
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEdit}
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => saveEdit(item.subject)}
                                data-testid={`button-save-${item.subject}`}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {item.subject}
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                                  {item.completed} / {item.target} min
                                  <span className="ml-2">· {pct}%</span>
                                </p>
                              </div>
                              <div className="flex gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => startEdit(item)}
                                  aria-label={`Edit ${item.subject}`}
                                  data-testid={`button-edit-${item.subject}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemove(item.subject)}
                                  aria-label={`Remove ${item.subject}`}
                                  data-testid={`button-remove-${item.subject}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className="h-full bg-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                              />
                            </div>
                          </>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex justify-between items-center">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1.5"
                disabled={items.length === 0}
                data-testid="button-reset-daily"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset daily progress
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset today's progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  This sets each subject's completed minutes back to zero. Your
                  schedule itself is kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetDaily}>
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
