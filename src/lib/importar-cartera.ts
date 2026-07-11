/**
 * importar-cartera.ts — Lógica pura para el importador masivo de clientes (Admin).
 *
 * Toma filas crudas de un Excel/CSV (ya parseadas a objetos { encabezado: valor })
 * más los catálogos de referencia (categorías, rubros, sub-rubros, ejecutivos) y
 * devuelve las filas listas para insertar en `clientes` y las rechazadas con motivo.
 *
 * No depende de React ni de Supabase → fácilmente testeable.
 * El payload replica el de NuevoCliente.tsx; la página agrega `creado_por`.
 */

import { parseMontoPYG } from "./format";

// ── Catálogos de referencia ──────────────────────────────────────────────────

export interface RefCategoria { id: string; nombre: string }
export interface RefRubro { id: string; nombre: string; categoria_id: string | null }
export interface RefSubRubro { id: string; nombre: string; rubro_id: string | null }
export interface RefEjecutivo { id: string; nombre: string; apellido?: string | null; email: string }

export interface Referencias {
  categorias: RefCategoria[];
  rubros: RefRubro[];
  subRubros: RefSubRubro[];
  ejecutivos: RefEjecutivo[];
}

// ── Resultado ────────────────────────────────────────────────────────────────

export interface FilaValida {
  fila: number;
  nombre: string;
  payload: Record<string, unknown>;
  advertencias: string[];
}

export interface FilaRechazada {
  fila: number;
  datos: Record<string, string>;
  errores: string[];
}

export interface ResultadoImportacion {
  validas: FilaValida[];
  rechazadas: FilaRechazada[];
}

// ── Helpers de normalización ─────────────────────────────────────────────────

/** Minúsculas, sin acentos, sin espacios extra. Para comparar nombres. */
export function clave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Normaliza un encabezado a snake_case ascii para el mapa de alias. */
function normHeader(s: string): string {
  return clave(s).replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// Alias de encabezado → campo canónico
const ALIAS: Record<string, string> = {};
const registrar = (canonico: string, alias: string[]) =>
  [canonico, ...alias].forEach((a) => (ALIAS[normHeader(a)] = canonico));

registrar("nombre_comercial", ["nombre", "nombre_local", "local", "nombre_del_local", "comercio", "razon_comercial", "cliente"]);
registrar("razon_social", ["razon", "razon_soc"]);
registrar("ruc", ["r_u_c"]);
registrar("telefono", ["tel", "celular", "whatsapp", "contacto", "telefono_1"]);
registrar("tipo_cliente", ["tipo"]);
registrar("categoria", []);
registrar("rubro", []);
registrar("sub_rubro", ["subrubro"]);
registrar("ciudad", []);
registrar("localidad", ["distrito"]);
registrar("barrio", []);
registrar("direccion", ["calle", "calle_principal", "domicilio", "dir"]);
registrar("calle_secundaria", ["esquina", "entre_calles", "casi"]);
registrar("tarifa_mensual", ["tarifa", "monto", "monto_licencia", "licencia", "cuota"]);
registrar("instancia", ["etapa", "estado_comercial"]);
registrar("ejecutivo", ["ejecutivo_asignado", "vendedor", "asignado", "gestor"]);
registrar("lat", ["latitud"]);
registrar("lng", ["lon", "longitud", "long"]);
registrar("nombre_salon", ["salon", "venue", "lugar", "nombre_venue"]);

const INSTANCIAS = ["CENSO", "COMERCIAL", "COBRANZAS", "JURIDICO"];

/** Convierte una fila cruda (claves = encabezados originales) a claves canónicas. */
export function mapearFila(cruda: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cruda)) {
    const canon = ALIAS[normHeader(k)];
    if (!canon) continue;
    const val = v == null ? "" : String(v).trim();
    if (val !== "") out[canon] = val;
  }
  return out;
}

function buscarPorNombre<T extends { nombre: string }>(lista: T[], valor: string): T | undefined {
  const k = clave(valor);
  return lista.find((x) => clave(x.nombre) === k);
}

function buscarEjecutivo(ejecutivos: RefEjecutivo[], valor: string): RefEjecutivo | undefined {
  const k = clave(valor);
  return ejecutivos.find(
    (e) =>
      clave(e.email) === k ||
      clave(e.nombre) === k ||
      clave(`${e.nombre} ${e.apellido ?? ""}`) === k
  );
}

const RUC_RE = /^\d{1,10}-?[0-9kK]?$/;

// ── Procesamiento principal ──────────────────────────────────────────────────

/**
 * @param filas    Filas crudas del archivo (objeto por fila, claves = encabezados).
 * @param ref      Catálogos de referencia para resolver nombres → ids.
 * @param filaBase Número de la primera fila de datos (default 2: fila 1 = encabezados).
 */
export function procesarFilas(
  filas: Record<string, unknown>[],
  ref: Referencias,
  filaBase = 2
): ResultadoImportacion {
  const validas: FilaValida[] = [];
  const rechazadas: FilaRechazada[] = [];

  filas.forEach((cruda, i) => {
    const fila = filaBase + i;
    const d = mapearFila(cruda);

    // Fila totalmente vacía → se ignora en silencio
    if (Object.keys(d).length === 0) return;

    const errores: string[] = [];
    const advertencias: string[] = [];

    const nombre = d.nombre_comercial ?? "";
    if (!nombre) errores.push("Falta el nombre comercial");

    // Tipo de cliente
    let tipo = clave(d.tipo_cliente ?? "local");
    if (tipo === "") tipo = "local";
    if (tipo !== "local" && tipo !== "evento") {
      errores.push(`Tipo de cliente inválido: "${d.tipo_cliente}" (usá "local" o "evento")`);
    }

    // Instancia
    let instancia = (d.instancia ?? "").toUpperCase();
    if (instancia && !INSTANCIAS.includes(instancia)) {
      errores.push(`Instancia inválida: "${d.instancia}"`);
      instancia = "";
    }
    if (!instancia) instancia = tipo === "evento" ? "COMERCIAL" : "CENSO";
    // Regla de negocio: los eventos siempre quedan en COMERCIAL
    if (tipo === "evento" && instancia !== "COMERCIAL") {
      advertencias.push("Evento forzado a instancia COMERCIAL");
      instancia = "COMERCIAL";
    }

    // Clasificación (solo locales)
    let categoria_id: string | null = null;
    let rubro_id: string | null = null;
    let sub_rubro_id: string | null = null;

    if (tipo === "local") {
      if (!d.categoria) {
        errores.push("Falta la categoría (obligatoria en locales)");
      } else {
        const cat = buscarPorNombre(ref.categorias, d.categoria);
        if (!cat) errores.push(`La categoría "${d.categoria}" no existe`);
        else categoria_id = cat.id;
      }

      if (!d.rubro) {
        errores.push("Falta el rubro (obligatorio en locales)");
      } else {
        const candidatos = categoria_id
          ? ref.rubros.filter((r) => r.categoria_id === categoria_id)
          : ref.rubros;
        const rub = buscarPorNombre(candidatos, d.rubro);
        if (!rub) errores.push(`El rubro "${d.rubro}"${categoria_id ? " no pertenece a la categoría indicada" : " no existe"}`);
        else rubro_id = rub.id;
      }

      if (d.sub_rubro && rubro_id) {
        const subs = ref.subRubros.filter((s) => s.rubro_id === rubro_id);
        const sub = buscarPorNombre(subs, d.sub_rubro);
        if (!sub) advertencias.push(`Sub-rubro "${d.sub_rubro}" no encontrado, se ignora`);
        else sub_rubro_id = sub.id;
      }
    }

    // Ejecutivo asignado (opcional)
    let ejecutivo_id: string | null = null;
    if (d.ejecutivo) {
      const eje = buscarEjecutivo(ref.ejecutivos, d.ejecutivo);
      if (!eje) errores.push(`Ejecutivo "${d.ejecutivo}" no encontrado`);
      else ejecutivo_id = eje.id;
    }

    // Monto (solo locales)
    let tarifa_mensual: number | null = null;
    if (tipo === "local" && d.tarifa_mensual) {
      tarifa_mensual = parseMontoPYG(d.tarifa_mensual);
      if (tarifa_mensual === null) advertencias.push(`Monto "${d.tarifa_mensual}" inválido, se ignora`);
    }

    // RUC (formato dudoso → advertencia, no rechazo)
    if (d.ruc && !RUC_RE.test(d.ruc.replace(/\s/g, ""))) {
      advertencias.push(`RUC "${d.ruc}" con formato dudoso`);
    }

    // Coordenadas (opcionales)
    let lat: number | null = null;
    let lng: number | null = null;
    if (d.lat || d.lng) {
      const nlat = Number(String(d.lat ?? "").replace(",", "."));
      const nlng = Number(String(d.lng ?? "").replace(",", "."));
      const okLat = d.lat && Number.isFinite(nlat) && nlat >= -90 && nlat <= 90;
      const okLng = d.lng && Number.isFinite(nlng) && nlng >= -180 && nlng <= 180;
      if (okLat && okLng) { lat = nlat; lng = nlng; }
      else advertencias.push("Coordenadas inválidas o incompletas, se ignoran");
    }

    if (!d.direccion) advertencias.push("Sin dirección");

    if (errores.length > 0) {
      rechazadas.push({ fila, datos: d, errores });
      return;
    }

    const payload: Record<string, unknown> = {
      nombre_comercial: nombre,
      razon_social: d.razon_social ?? null,
      ruc: d.ruc ?? null,
      telefono: d.telefono ?? null,
      ciudad: d.ciudad ?? null,
      localidad: d.localidad ?? null,
      barrio: d.barrio ?? null,
      direccion: d.direccion ?? null,
      calle_secundaria: d.calle_secundaria ?? null,
      tarifa_mensual,
      categoria_id,
      rubro_id,
      sub_rubro_id,
      tipo_cliente: tipo,
      nombre_salon: tipo === "evento" ? (d.nombre_salon ?? null) : null,
      capacidad: null,
      instancia,
      estado: "activo",
      activo: true,
      ejecutivo_id,
      lat,
      lng,
    };

    validas.push({ fila, nombre, payload, advertencias });
  });

  return { validas, rechazadas };
}
