// Mock data + workflow stage definitions for SGP

export type StageKey =
  | "censo"
  | "contacto"
  | "presentacion"
  | "negociacion"
  | "cierre"
  | "contrato"
  | "pago"
  | "renovacion"
  | "baja";

export interface Stage {
  key: StageKey;
  num: number;
  label: string;
  short: string;
  color: string; // tailwind class for stage color bg
  text: string;
}

export const STAGES: Stage[] = [
  { key: "censo", num: 1, label: "Censo", short: "CENSO", color: "bg-stage-censo", text: "text-stage-censo" },
  { key: "contacto", num: 2, label: "Primer Contacto", short: "CONTACTO", color: "bg-stage-contacto", text: "text-stage-contacto" },
  { key: "presentacion", num: 3, label: "Presentación", short: "PRESENT.", color: "bg-stage-presentacion", text: "text-stage-presentacion" },
  { key: "negociacion", num: 4, label: "Negociación", short: "NEGOC.", color: "bg-stage-negociacion", text: "text-stage-negociacion" },
  { key: "cierre", num: 5, label: "Cierre", short: "CIERRE", color: "bg-stage-cierre", text: "text-stage-cierre" },
  { key: "contrato", num: 6, label: "Contrato", short: "CONTRATO", color: "bg-stage-contrato", text: "text-stage-contrato" },
  { key: "pago", num: 7, label: "Pago", short: "PAGO", color: "bg-stage-pago", text: "text-stage-pago" },
  { key: "renovacion", num: 8, label: "Renovación", short: "RENOV.", color: "bg-stage-renovacion", text: "text-stage-renovacion" },
  { key: "baja", num: 9, label: "Baja", short: "BAJA", color: "bg-stage-baja", text: "text-stage-baja" },
];

export const stageByKey = (k: StageKey) => STAGES.find((s) => s.key === k)!;

export interface Cliente {
  id: string;
  nombre: string;
  rubro: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  stage: StageKey;
  monto: number; // PYG
  ultimoContacto: string; // ISO
  proximaAccion?: string; // ISO
}

export interface Gestion {
  id: string;
  clienteId: string;
  tipo: "visita" | "llamada";
  resultado: "exitosa" | "sin_respuesta" | "reagendada" | "cerrada";
  notas: string;
  fecha: string;
  proximaAccion?: string;
}

const RUBROS = ["Bar", "Restaurante", "Hotel", "Discoteca", "Supermercado", "Estación de Servicio", "Salón de Eventos", "Gimnasio"];
const CIUDADES = ["Asunción", "Luque", "San Lorenzo", "Lambaré", "Fernando de la Mora", "Capiatá", "Encarnación", "Ciudad del Este"];
const NOMBRES = [
  "Bar Don Pedro", "Restaurante La Pascuala", "Hotel Guaraní", "Discoteca Glam",
  "Super Stock Centro", "Estación Petropar", "Salón Mburicaó", "Gym Power Fit",
  "Café Literario", "Pizzería Da Vinci", "Hotel Cecilia", "Pub Britannia",
  "Mercado Central SA", "Shell Av. España", "Eventos Costanera", "Sport Club",
  "Bar La Esquina", "Sushi Garden", "Hostel Asunción", "Karaoke Tokyo",
];

export const MOCK_CLIENTES: Cliente[] = NOMBRES.map((nombre, i) => {
  const stages: StageKey[] = ["censo", "contacto", "presentacion", "negociacion", "cierre", "contrato", "pago", "renovacion"];
  const stage = stages[i % stages.length];
  const daysAgo = Math.floor(Math.random() * 30);
  const ultimoContacto = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return {
    id: `cli-${i + 1}`,
    nombre,
    rubro: RUBROS[i % RUBROS.length],
    direccion: `Av. ${["España", "Mcal. López", "Eusebio Ayala", "Brasilia"][i % 4]} ${1000 + i * 37}`,
    ciudad: CIUDADES[i % CIUDADES.length],
    telefono: `+595 9${80 + (i % 10)} ${100 + i}-${200 + i}`,
    stage,
    monto: 500_000 + (i % 8) * 350_000,
    ultimoContacto,
    proximaAccion: i % 3 === 0 ? new Date(Date.now() + (i % 5) * 86400000).toISOString() : undefined,
  };
});

export const MOCK_GESTIONES: Gestion[] = MOCK_CLIENTES.flatMap((c, idx) => {
  const count = 1 + (idx % 3);
  return Array.from({ length: count }).map((_, j) => ({
    id: `g-${c.id}-${j}`,
    clienteId: c.id,
    tipo: j % 2 === 0 ? "visita" : "llamada",
    resultado: ["exitosa", "sin_respuesta", "reagendada"][j % 3] as Gestion["resultado"],
    notas: [
      "Cliente recibió folletería, mostró interés en plan anual.",
      "No atendieron, dejar mensaje con encargado.",
      "Reagendamos para próxima semana, traer cotización.",
    ][j % 3],
    fecha: new Date(Date.now() - (j + 1) * 3 * 86400000).toISOString(),
  })) as Gestion[];
});

// KPI / Goal mock
export const META_MENSUAL = {
  goal: 25_000_000, // PYG
  ejecutado: 18_350_000,
  deficitAnterior: 3_200_000,
  pendientes: 6_650_000,
};

export const FUNNEL_DATA = STAGES.slice(0, 7).map((s) => ({
  stage: s.short,
  count: MOCK_CLIENTES.filter((c) => c.stage === s.key).length || Math.floor(Math.random() * 8) + 2,
  color: s.key,
}));

export const EJECUTIVOS_PERFORMANCE = [
  { nombre: "María González", goal: 25_000_000, ejecutado: 22_400_000, clientes: 28 },
  { nombre: "Carlos Ramírez", goal: 25_000_000, ejecutado: 18_350_000, clientes: 24 },
  { nombre: "Lucía Benítez", goal: 25_000_000, ejecutado: 14_200_000, clientes: 19 },
  { nombre: "Diego Martínez", goal: 25_000_000, ejecutado: 26_800_000, clientes: 31 },
];

export const formatPYG = (n: number) =>
  new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(n);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-PY", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

export const relativeDate = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`;
  return formatDate(iso);
};
