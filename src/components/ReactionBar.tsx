import type { ReactionSummary } from "@/lib/reactions";
import { toggleReaction } from "@/app/actions";

export function ReactionBar({
  kind,
  targetId,
  reactions,
  options,
  frozen = false,
}: {
  kind: "post" | "comment";
  targetId: number;
  reactions: ReactionSummary[];
  options: string[];
  frozen?: boolean;
}) {
  const byEmoji = new Map(reactions.map((r) => [r.emoji, r]));
  const shown = [...options, ...reactions.map((r) => r.emoji).filter((e) => !options.includes(e))];
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((emoji) => {
        const r = byEmoji.get(emoji);
        const blocked = frozen && emoji !== "🧂";
        return (
          <form key={emoji} action={toggleReaction.bind(null, kind, targetId, emoji)}>
            <button
              disabled={blocked}
              title={blocked ? "Conta congelada: só podes reagir com 🧂" : r ? r.names.join(", ") : `Reagir com ${emoji}`}
              aria-label={r ? `${emoji} ${r.names.length}: ${r.names.join(", ")}` : `Reagir com ${emoji}`}
              aria-pressed={r?.mine ?? false}
              className={`rounded-full border px-2 py-0.5 text-sm leading-tight transition ${
                r?.mine ? "border-scoop bg-scoop/10 font-bold" : "border-rule bg-white hover:border-ink"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {emoji}
              {r && <span className="ml-1 text-xs">{r.names.length}</span>}
            </button>
          </form>
        );
      })}
    </div>
  );
}
