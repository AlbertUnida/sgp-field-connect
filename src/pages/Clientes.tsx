import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, MapPin, Phone, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { StageBadge } from "@/components/StageBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MOCK_CLIENTES, STAGES, formatPYG, relativeDate, type StageKey } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const Clientes = () => {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StageKey | "all">("all");

  const filtered = useMemo(() => {
    return MOCK_CLIENTES.filter((c) => {
      const matchQ =
        !q ||
        c.nombre.toLowerCase().includes(q.toLowerCase()) ||
        c.rubro.toLowerCase().includes(q.toLowerCase()) ||
        c.ciudad.toLowerCase().includes(q.toLowerCase());
      const matchF = filter === "all" || c.stage === filter;
      return matchQ && matchF;
    });
  }, [q, filter]);

  return (
    <>
      <AppHeader title="Mi Cartera" subtitle={`${filtered.length} clientes asignados`} />

      <div className="px-4 pt-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, rubro o ciudad..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-12 rounded-2xl border-border bg-card pl-10 pr-12 shadow-card"
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 rounded-xl"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Stage filters */}
        <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1">
          <div className="flex gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              Todos
            </FilterChip>
            {STAGES.map((s) => (
              <FilterChip
                key={s.key}
                active={filter === s.key}
                onClick={() => setFilter(s.key)}
                color={`hsl(var(--stage-${s.key}))`}
              >
                {s.short}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="mt-4 space-y-2.5 pb-4">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to={`/app/clientes/${c.id}`}
              className="block rounded-2xl border border-border bg-card p-4 shadow-card transition-smooth hover:border-primary/40 hover:shadow-elevated active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold">{c.nombre}</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.rubro}</p>
                </div>
                <StageBadge stage={c.stage} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{c.ciudad}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{c.telefono}</span>
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Monto</p>
                  <p className="text-sm font-bold tabular-nums text-primary">{formatPYG(c.monto)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Último contacto</p>
                  <p className="text-xs font-semibold">{relativeDate(c.ultimoContacto)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm font-semibold">Sin resultados</p>
              <p className="mt-1 text-xs text-muted-foreground">Probá con otra búsqueda o filtro.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const FilterChip = ({
  children, active, onClick, color,
}: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-smooth",
      active
        ? "border-primary bg-primary text-primary-foreground shadow-card"
        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
    )}
  >
    {color && !active && (
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: color }} />
    )}
    {children}
  </button>
);

export default Clientes;
