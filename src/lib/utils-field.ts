/**
 * utils-field.ts — Utilidades compartidas para formularios de campo (GPS, foto, alertas, tareas).
 * M6: funciones extraídas de Registrar, EventoDetalle, ClienteDetalle, Inicio, Alertas, Admin.
 */

// ── Tipos mínimos necesarios ─────────────────────────────────────────────────

interface TipoResultadoBase {
  id: string;
  tipo_formulario: string | null;
  tipo_cartera: string;
  orden: number;
}

// ── Horas hábiles (lun–vie) ──────────────────────────────────────────────────

/**
 * Agrega `hours` horas hábiles (lunes a viernes) a una fecha de inicio.
 * Usado para calcular el plazo de 24h de seguimiento post-visita.
 */
export function addBusinessHours(start: Date, hours: number): Date {
  const result = new Date(start);
  let remaining = hours;
  while (remaining > 0) {
    result.setTime(result.getTime() + 3_600_000);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

// ── GPS ──────────────────────────────────────────────────────────────────────

/**
 * Captura la posición GPS del dispositivo.
 * Retorna { lat, lng } o null si no está disponible.
 */
export function capturarGPSPromise(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ── Marca de agua en foto ────────────────────────────────────────────────────

/**
 * Dibuja una barra inferior con nombre del ejecutivo, fecha/hora y "SGP Paraguay".
 * Retorna un nuevo File JPEG con la marca aplicada.
 */
export function aplicarMarcaDeAgua(file: File, nombre: string): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const ahora = new Date();
      const fecha = ahora.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
      const hora = ahora.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const linea1 = nombre.toUpperCase();
      const linea2 = `${fecha}  •  ${hora}  •  SGP Paraguay`;

      const fontSize = Math.max(Math.round(img.width * 0.038), 22);
      const smallSize = Math.round(fontSize * 0.72);
      const padding = Math.round(fontSize * 0.7);
      const barHeight = fontSize + smallSize + padding * 2.5;

      ctx.fillStyle = "rgba(0, 0, 0, 0.70)";
      ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(0, img.height - barHeight, img.width, Math.round(fontSize * 0.18));

      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(linea1, padding, img.height - barHeight + padding);

      ctx.font = `${smallSize}px Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(linea2, padding, img.height - barHeight + padding + fontSize + Math.round(smallSize * 0.3));

      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// ── Filtro de tipos de resultado (tareas) ────────────────────────────────────

/**
 * Filtra y ordena los tipos de resultado según cartera y progreso secuencial.
 * - Filtra por tipo_cartera ("ambos" o el tipo exacto).
 * - Para nota_reclamo (secuencial): solo muestra el próximo pendiente.
 *
 * @param tiposResultado Lista completa de tipos de resultado activos
 * @param tipoCartera    "local" | "evento" según el cliente
 * @param completedIds   Set de resultado_id ya completados para este cliente/evento
 */
export function filtrarTiposResultado<T extends TipoResultadoBase>(
  tiposResultado: T[],
  tipoCartera: string,
  completedIds: Set<string>
): T[] {
  const porCartera = tiposResultado.filter(
    (t) => t.tipo_cartera === "ambos" || t.tipo_cartera === tipoCartera
  );
  const notaReclamo = porCartera
    .filter((t) => t.tipo_formulario === "nota_reclamo")
    .sort((a, b) => a.orden - b.orden);
  const proxPendiente = notaReclamo.find((t) => !completedIds.has(t.id));
  return [
    ...porCartera.filter((t) => t.tipo_formulario !== "nota_reclamo"),
    ...(proxPendiente ? [proxPendiente] : []),
  ];
}
