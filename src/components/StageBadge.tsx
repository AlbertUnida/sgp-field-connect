import { cn } from "@/lib/utils";
import { stageByKey, type StageKey } from "@/lib/format";

interface StageBadgeProps {
  stage: StageKey;
  size?: "sm" | "md";
  className?: string;
  showNum?: boolean;
}

export const StageBadge = ({ stage, size = "sm", className, showNum = true }: StageBadgeProps) => {
  const s = stageByKey(stage);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide",
        size === "sm" ? "px-2.5 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        "text-white",
        className,
      )}
      style={{ backgroundColor: `hsl(var(--stage-${s.key}))` }}
    >
      {showNum && <span className="opacity-75">{s.num}</span>}
      {s.short}
    </span>
  );
};
