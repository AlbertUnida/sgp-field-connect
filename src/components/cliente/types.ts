/**
 * Tipos y constantes compartidos de la ficha de cliente (ClienteDetalle).
 * Extraídos de ClienteDetalle.tsx (refactor Fase 0, sin cambios de comportamiento).
 */

export interface Cliente {
  id: number;
  numero_cliente: number | null;
  nombre_comercial: string;
  razon_social: string | null;
  ruc: string | null;
  telefono: string | null;
  email_cliente: string | null;
  ciudad: string | null;
  localidad: string | null;
  barrio: string | null;
  direccion: string | null;
  calle_secundaria: string | null;
  instancia: string | null;
  estado: string | null;
  tarifa_mensual: number | null;
  ejecutivo_id: string | null;
  creado_por: string | null;
  activo: boolean;
  notas: string | null;
  tipo_cliente: string | null;
  nombre_salon: string | null;
  capacidad: number | null;
  categoria: { nombre: string } | null;
  rubro_rel: { nombre: string } | null;
  sub_rubro_id: string | null;
  fecha_vencimiento: string | null;
  created_at: string | null;
}

export interface TipoResultado {
  id: string;
  nombre: string;
  tipo_formulario: "sin_medios" | "nota_comercial" | "nota_reclamo" | "visita_seguimiento" | "reunion" | null;
  tipo_cartera: string;
  activo: boolean;
  orden: number;
}

export interface Gestion {
  id: number;
  tipo: string;
  resultado: string | null;
  resultado_id: string | null;
  datos_extra: Record<string, unknown> | null;
  nota: string | null;
  fecha_inicio: string | null;
  created_at: string;
  foto_url: string | null;
  ejecutivo: { nombre: string; apellido: string } | null;
}

export interface CobroCliente {
  id: number;
  monto: number;
  metodo_pago: string | null;
  modalidad: string | null;
  fecha_cobro: string;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  notas: string | null;
  registrado_por_nombre: string | null;
  razon_social_factura?: string | null;
  ruc_factura?: string | null;
  eventos_ids?: string[] | null;
}

export interface HistorialInstancia {
  id: number;
  instancia_anterior: string | null;
  instancia_nueva: string;
  created_at: string;
  ejecutivo: { nombre: string; apellido: string } | null;
}

export interface EventoAgenda {
  id: string;
  numero_evento: number;
  nombre_evento: string | null;
  fecha_evento: string | null;
  tipo_evento: string | null;
  tarifa_evento: number | null;
  estado: string;
}

export interface EjecutivoOpcion {
  id: string;
  nombre: string | null;
  apellido: string | null;
}

export const INSTANCIA_COLORS: Record<string, string> = {
  CENSO: "bg-gray-500",
  COMERCIAL: "bg-blue-600",
  COBRANZAS: "bg-green-600",
  JURIDICO: "bg-red-600",
};
