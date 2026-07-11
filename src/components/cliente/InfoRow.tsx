import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fila ícono + etiqueta + valor de la ficha del cliente. */
export const InfoRow = ({ icon, label, value, valueClass }: {
  icon: ReactNode; label: string; value: string; valueClass?: string;
}) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-sm break-words", valueClass)}>{value}</p>
    </div>
  </div>
);
