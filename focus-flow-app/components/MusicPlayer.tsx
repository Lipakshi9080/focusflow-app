import { useEffect, useMemo, useRef, useState } from "react";
import { Music, X, Search, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  parseMusicUrl,
  looksLikeMusicUrl,
  searchYouTube,
  youtubeVideoIdToParsed,
  isYouTubeSearchAvailable,
  YouTubeSearchError,
  type ParsedMusic,
  type YouTubeSearchResult,
} from "@/lib/music";
import { motion, AnimatePresence } from "framer-motion";

const URL_KEY = "ff_music_url";
const LABEL_KEY = "ff_music_label";

type Status =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; query: string; items: YouTubeSearchResult[] }
  | { kind: "empty"; query: string }
  | { kind: "error"; message: string };

export default function MusicPlayer() {
  // Currently playing track. Persisted so music selection survives reloads.
  const [current, setCurrent] = useState<ParsedMusic | null>(() => {
    const url = localStorage.getItem(URL_KEY);
    if (!url) return null;
    const parsed = parseMusicUrl(url);
    if (parsed) {
      const label = localStorage.getItem(LABEL_KEY);
      return label ? { ...parsed, label } : parsed;
    }
    return null;
  });

  const [draft, setDraft] = useState<string>("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (current) {
      // We cache the *original* url-like embedUrl so reloads find the same track.
      localStorage.setItem(URL_KEY, current.embedUrl);
      localStorage.setItem(LABEL_KEY, current.label);
    } else {
      localStorage.removeItem(URL_KEY);
      localStorage.removeItem(LABEL_KEY);
    }
  }, [current]);

  // Cancel any inflight search on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function runSearch(query: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus({ kind: "searching" });
    try {
      const items = await searchYouTube(query, 5, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (items.length === 0) {
        setStatus({ kind: "empty", query });
      } else {
        setStatus({ kind: "results", query, items });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const msg =
        e instanceof YouTubeSearchError
          ? e.message
          : "Something went wrong searching YouTube.";
      setStatus({ kind: "error", message: msg });
    }
  }

  function handleSubmit() {
    const value = draft.trim();
    if (!value) {
      // Empty submit acts like clearing the search panel.
      setStatus({ kind: "idle" });
      return;
    }
    if (looksLikeMusicUrl(value)) {
      const parsed = parseMusicUrl(value);
      if (parsed) {
        setCurrent(parsed);
        setStatus({ kind: "idle" });
        setDraft("");
        return;
      }
      // It looked like a URL but didn't parse — fall back to treating as query.
    }
    runSearch(value);
  }

  function pickResult(item: YouTubeSearchResult) {
    const parsed = youtubeVideoIdToParsed(item.videoId, item.title);
    setCurrent(parsed);
    setStatus({ kind: "idle" });
    setDraft("");
  }

  function clearCurrent() {
    setCurrent(null);
  }

  function clearSearch() {
    setStatus({ kind: "idle" });
    setDraft("");
    abortRef.current?.abort();
  }

  const iframeHeight = current?.provider === "youtube" ? 180 : 152;
  const searchEnabled = isYouTubeSearchAvailable();

  const helperText = useMemo(() => {
    if (status.kind === "error") return null;
    if (current) return `${current.label} · plays through timer transitions`;
    if (searchEnabled)
      return "Search music or paste a YouTube/Spotify link.";
    return "Paste a YouTube or Spotify link.";
  }, [current, status.kind, searchEnabled]);

  return (
    <div className="rounded-2xl border border-card-border bg-card/70 backdrop-blur-sm p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Background music</h3>
        </div>
        {current && (
          <Button
            onClick={clearCurrent}
            variant="ghost"
            size="icon"
            className="h-7 w-7 -mr-1"
            aria-label="Clear current track"
            data-testid="button-music-clear"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              searchEnabled
                ? "Search music or paste link..."
                : "Paste a YouTube or Spotify link..."
            }
            className="pl-8 h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              } else if (e.key === "Escape" && status.kind !== "idle") {
                clearSearch();
              }
            }}
            data-testid="input-music"
          />
        </div>
        <Button
          onClick={handleSubmit}
          size="sm"
          className="h-9 min-w-16"
          data-testid="button-music-submit"
          disabled={status.kind === "searching"}
        >
          {status.kind === "searching" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : looksLikeMusicUrl(draft) ? (
            "Load"
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {/* Status / results / helper text */}
      <AnimatePresence mode="wait">
        {status.kind === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                Top results for{" "}
                <span className="text-foreground">"{status.query}"</span>
              </p>
              <button
                type="button"
                onClick={clearSearch}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="button-clear-search"
              >
                Clear
              </button>
            </div>
            <ul className="space-y-1.5" data-testid="list-music-results">
              {status.items.map((item) => (
                <li key={item.videoId}>
                  <button
                    type="button"
                    onClick={() => pickResult(item)}
                    className="group w-full flex items-stretch gap-2.5 rounded-lg p-1.5 text-left hover-elevate active-elevate-2 border border-transparent"
                    data-testid={`result-${item.videoId}`}
                  >
                    <div className="relative shrink-0 h-12 w-20 rounded-md overflow-hidden bg-muted">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Play className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      {item.channelTitle && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {item.channelTitle}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {status.kind === "empty" && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-lg border border-dashed border-border/70 px-3 py-3 text-center"
          >
            <p className="text-xs text-muted-foreground">
              No results found for{" "}
              <span className="text-foreground">"{status.query}"</span>. Try
              another search.
            </p>
          </motion.div>
        )}

        {status.kind === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
          >
            <p className="text-xs text-destructive">{status.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player */}
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.embedUrl}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-3"
          >
            <div className="rounded-xl overflow-hidden border border-card-border">
              <iframe
                title={current.label}
                src={current.embedUrl}
                width="100%"
                height={iframeHeight}
                frameBorder={0}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                allowFullScreen
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper line */}
      {helperText && status.kind !== "results" && status.kind !== "empty" && (
        <p className="mt-3 text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
