import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { Loader2, TrendingUp, Wallet, Users, Building2, MapPin } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { formatPYG } from "@/lib/format";

const INSTANCIA_COLOR: Record<string, string> = {
  CENSO: "#6b7280",
  COMERCIAL: "#3b82f6",
  COBRANZAS: "#22c55e",
  JURIDICO: "#ef4444",
};
const ORDEN_INSTANCIA = ["CENSO", "COMERCIAL", "COBRANZAS", "JURIDICO"];

// Instancias que "pertenecen" a cada área (para acotar la vista del supervisor)
const AREA_INSTANCIAS: Record<string, string[]> = {
  comercial: ["CENSO", "COMERCIAL"],
  cobranzas: ["COBRANZAS"],
  juridico: ["JURIDICO"],
};
const AREA_PRIMARY: Record<string, string> = { comercial: "COMERCIAL", cobranzas: "COBRANZAS", juridico: "JURIDICO" };
const AREA_LABEL: Record<string, string> = {
  comercial: "Cartera comercial",
  cobranzas: "Cartera cobranzas",
  juridico: "Cartera jurídica",
};

interface MesCobro { key: string; label: string; monto: number }
interface RankItem { nombre: string; monto: number }
interface InstItem { name: string; value: number }
interface CiudadItem { ciudad: string; total: number }

const DashboardGerencial = () => {
  const { isAdmin, canManage, profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();

  const esGlobal = isAdmin; // el admin ve todas las áreas; el supervisor solo la suya
  const viewerArea = profile?.area ?? "comercial";

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ cobradoMes: 0, nCobros: 0, activos: 0, primaria: 0, metaMes: 0 });
  const [porMes, setPorMes] = useState<MesCobro[]>([]);
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [instancias, setInstancias] = useState<InstItem[]>([]);
  const [ciudades, setCiudades] = useState<CiudadItem[]>([]);

  useEffect(() => {
    if (!profileLoading && !canManage) navigate("/app");
  }, [canManage, profileLoading, navigate]);

  useEffect(() => {
    if (!canManage || !profile) return;
    const cargar = async () => {
      setLoading(true);
      const now = new Date();
      const mesActual = now.getMonth() + 1;
      const anioActual = now.getFullYear();
      const primerDiaMes = `${anioActual}-${String(mesActual).padStart(2, "0")}-01`;
      const dSig = new Date(anioActual, mesActual, 1);
      const primerDiaSig = `${dSig.getFullYear()}-${String(dSig.getMonth() + 1).padStart(2, "0")}-01`;
      const desde6 = new Date(anioActual, now.getMonth() - 5, 1);
      const primerDia6 = `${desde6.getFullYear()}-${String(desde6.getMonth() + 1).padStart(2, "0")}-01`;

      const [cobros6, cobrosMes, clientesData, profilesData, metasData] = await Promise.all([
        supabase.from("cobros").select("monto, fecha_cobro, registrado_por").gte("fecha_cobro", primerDia6),
        supabase.from("cobros").select("monto, ejecutivo_id, registrado_por").gte("fecha_cobro", primerDiaMes).lt("fecha_cobro", primerDiaSig),
        supabase.from("clientes").select("instancia, ciudad").eq("activo", true),
        supabase.from("profiles").select("id, nombre, apellido, area"),
        supabase.from("metas").select("ejecutivo_id, monto_meta").eq("mes", mesActual).eq("anio", anioActual),
      ]);

      // Alcance por área (admin = todo)
      const nombreDe: Record<string, string> = {};
      const areaDe: Record<string, string> = {};
      (profilesData.data ?? []).forEach((p: { id: string; nombre: string | null; apellido: string | null; area: string | null }) => {
        nombreDe[p.id] = [p.nombre, p.apellido].filter(Boolean).join(" ") || "—";
        areaDe[p.id] = p.area ?? "comercial";
      });
      const instanciasArea = esGlobal ? ORDEN_INSTANCIA : (AREA_INSTANCIAS[viewerArea] ?? ORDEN_INSTANCIA);
      const cobroEsDelArea = (registrado_por: string | null) =>
        esGlobal || (registrado_por != null && areaDe[registrado_por] === viewerArea);

      // Cobros por mes (últimos 6), filtrados por área
      const buckets: MesCobro[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(anioActual, now.getMonth() - i, 1);
        buckets.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          label: d.toLocaleDateString("es-PY", { month: "short" }),
          monto: 0,
        });
      }
      (cobros6.data ?? []).forEach((c: { monto: number | null; fecha_cobro: string; registrado_por: string | null }) => {
        if (!cobroEsDelArea(c.registrado_por)) return;
        const b = buckets.find((x) => x.key === (c.fecha_cobro ?? "").slice(0, 7));
        if (b) b.monto += c.monto ?? 0;
      });
      setPorMes(buckets);

      // Ranking + cobrado del mes (por quién registró, filtrado por área)
      const porEje: Record<string, number> = {};
      let cobradoMes = 0;
      let nCobros = 0;
      (cobrosMes.data ?? []).forEach((c: { monto: number | null; ejecutivo_id: string | null; registrado_por: string | null }) => {
        if (!cobroEsDelArea(c.registrado_por)) return;
        const quien = c.registrado_por ?? c.ejecutivo_id ?? "—";
        porEje[quien] = (porEje[quien] ?? 0) + (c.monto ?? 0);
        cobradoMes += c.monto ?? 0;
        nCobros++;
      });
      setRanking(
        Object.entries(porEje)
          .map(([id, monto]) => ({ nombre: nombreDe[id] ?? "—", monto }))
          .sort((a, b) => b.monto - a.monto)
          .slice(0, 8)
      );

      // Clientes por instancia del área + cobertura por ciudad
      const porInst: Record<string, number> = {};
      const porCiudad: Record<string, number> = {};
      (clientesData.data ?? []).forEach((c: { instancia: string | null; ciudad: string | null }) => {
        const inst = c.instancia ?? "CENSO";
        if (!instanciasArea.includes(inst)) return;
        porInst[inst] = (porInst[inst] ?? 0) + 1;
        const ciu = (c.ciudad ?? "").trim() || "Sin ciudad";
        porCiudad[ciu] = (porCiudad[ciu] ?? 0) + 1;
      });
      setInstancias(ORDEN_INSTANCIA.filter((i) => porInst[i]).map((i) => ({ name: i, value: porInst[i] })));
      setCiudades(
        Object.entries(porCiudad)
          .map(([ciudad, total]) => ({ ciudad, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 8)
      );

      // Meta del mes: solo ejecutivos del área (admin = todos)
      const metaMes = (metasData.data ?? [])
        .filter((m: { ejecutivo_id: string; monto_meta: number | null }) => esGlobal || areaDe[m.ejecutivo_id] === viewerArea)
        .reduce((s: number, m: { monto_meta: number | null }) => s + (m.monto_meta ?? 0), 0);

      const primariaInst = esGlobal ? "COBRANZAS" : (AREA_PRIMARY[viewerArea] ?? "COMERCIAL");
      setKpis({
        cobradoMes,
        nCobros,
        activos: Object.values(porInst).reduce((s, n) => s + n, 0),
        primaria: porInst[primariaInst] ?? 0,
        metaMes,
      });
      setLoading(false);
    };
    cargar();
  }, [canManage, profile, esGlobal, viewerArea]);

  const pctMeta = kpis.metaMes > 0 ? Math.round((kpis.cobradoMes / kpis.metaMes) * 100) : null;
  const maxRank = ranking.length ? Math.max(...ranking.map((r) => r.monto)) : 0;
  const totalClientes = instancias.reduce((s, i) => s + i.value, 0);
  const primariaLabel = esGlobal ? "En cobranzas" : `En ${(AREA_PRIMARY[viewerArea] ?? "COMERCIAL").toLowerCase()}`;
  const alcanceLabel = esGlobal ? "Visión global · todas las áreas" : (AREA_LABEL[viewerArea] ?? "Cartera");

  return (
    <>
      <AppHeader title="Dashboard gerencial" subtitle={alcanceLabel} />

      <div className="px-4 pt-4 pb-8 space-y-5">
        {loading ? (
          <div className="flex justify-center pt-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard icon={<Wallet className="h-4 w-4" />} label="Cobrado del mes" value={formatPYG(kpis.cobradoMes)} accent="text-success" />
              <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Cobros del mes" value={String(kpis.nCobros)} accent="text-primary" />
              <KpiCard icon={<Users className="h-4 w-4" />} label="Clientes (cartera)" value={String(kpis.activos)} accent="text-foreground" />
              <KpiCard icon={<Building2 className="h-4 w-4" />} label={primariaLabel} value={String(kpis.primaria)} accent="text-emerald-600" />
            </div>

            {pctMeta !== null && (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold">Meta del mes</span>
                  <span className="text-muted-foreground">{formatPYG(kpis.cobradoMes)} / {formatPYG(kpis.metaMes)}</span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.min(pctMeta, 100)}%` }} />
                </div>
                <p className="mt-1 text-right text-xs font-semibold text-success">{pctMeta}%</p>
              </div>
            )}

            {/* Cobros por mes */}
            <Card title="Cobros — últimos 6 meses">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porMes} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                  <Tooltip formatter={(v: number) => formatPYG(v)} />
                  <Bar dataKey="monto" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Ranking ejecutivos */}
            <Card title="Ranking de ejecutivos — mes actual">
              {ranking.length === 0 ? (
                <EmptyMsg>Sin cobros registrados este mes.</EmptyMsg>
              ) : (
                <div className="space-y-2.5">
                  {ranking.map((r, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold truncate">{i + 1}. {r.nombre}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{formatPYG(r.monto)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${maxRank ? (r.monto / maxRank) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Distribución por instancia */}
            <Card title="Clientes por instancia">
              {totalClientes === 0 ? (
                <EmptyMsg>Sin clientes en la cartera.</EmptyMsg>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={180}>
                    <PieChart>
                      <Pie data={instancias} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {instancias.map((entry) => (
                          <Cell key={entry.name} fill={INSTANCIA_COLOR[entry.name] ?? "#9ca3af"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [`${v} clientes`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {instancias.map((i) => (
                      <div key={i.name} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: INSTANCIA_COLOR[i.name] }} />
                        <span className="flex-1 text-muted-foreground">{i.name}</span>
                        <span className="font-bold">{i.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Cobertura por ciudad */}
            <Card title="Cobertura por ciudad">
              {ciudades.length === 0 ? (
                <EmptyMsg>Sin datos de ciudad.</EmptyMsg>
              ) : (
                <div className="space-y-2">
                  {ciudades.map((c) => (
                    <div key={c.ciudad} className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{c.ciudad}</span>
                      <span className="font-bold">{c.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
};

const KpiCard = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${accent}`}>
      {icon}{label}
    </div>
    <p className="mt-1.5 text-lg font-bold truncate">{value}</p>
  </div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
    {children}
  </div>
);

const EmptyMsg = ({ children }: { children: React.ReactNode }) => (
  <p className="py-4 text-center text-sm text-muted-foreground">{children}</p>
);

export default DashboardGerencial;
