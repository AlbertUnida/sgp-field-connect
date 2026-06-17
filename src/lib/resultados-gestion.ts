/**
 * Opciones de RESULTADO DE GESTIÓN
 * Estas opciones representan el verdadero desenlace de cada tarea comercial.
 * score: puntaje que suma al Lead Scoring del cliente.
 * autoAgenda: si true, se programa automáticamente una próxima visita en 30 días.
 */
export const RESULTADOS_GESTION = [
  { key: "acuerdo_pago",       label: "🟢 Acordó pago",           score: 10, autoAgenda: false },
  { key: "promesa_pago",       label: "🟡 Promesa de pago",        score: 5,  autoAgenda: false },
  { key: "nueva_visita",       label: "🟡 Solicitó nueva visita",  score: 3,  autoAgenda: false },
  { key: "seguimiento",        label: "🟡 Seguimiento requerido",  score: 2,  autoAgenda: false },
  { key: "sin_musica",         label: "🔴 Sin música",             score: 0,  autoAgenda: true  },
  { key: "musica_free",        label: "🔴 Música Free",            score: 0,  autoAgenda: true  },
  { key: "cerrado_temporal",   label: "🔴 Cerrado Temporal",       score: -2, autoAgenda: true  },
  { key: "rechazo",            label: "🔴 Rechazó la gestión",     score: -3, autoAgenda: false },
  { key: "cerrado_permanente", label: "🔴 Cerrado Permanente",     score: -5, autoAgenda: false },
] as const;

export type ResultadoGestionKey = typeof RESULTADOS_GESTION[number]["key"];
