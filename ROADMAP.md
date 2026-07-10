# ROADMAP — SGP Field Connect

Documento de traspaso y mejoras futuras. Última actualización: 2026-07-10.
**Para el asistente que retome este proyecto: leé primero `CLAUDE.md` (contexto técnico, reglas de trabajo, estado de sesión) y después este archivo (qué construir a continuación).**

---

## Prompt de continuación (copiar y pegar para retomar)

> Estás retomando el desarrollo de SGP Field Connect, una PWA de gestión comercial de campo (React + Vite + TS + Tailwind + Supabase, deploy en Vercel). Leé `CLAUDE.md` completo: ahí están el stack, la arquitectura, el modelo de datos, las reglas de trabajo (el usuario hace los commits desde PowerShell; cualquier cambio de esquema se entrega como SQL explícito; mínimo código; no romper formularios compartidos) y el estado de la última sesión. Después leé `ROADMAP.md` y continuá con el primer ítem pendiente de la sección "Pendiente inmediato", verificando antes qué quedó sin commitear con git status. Trabajá en español rioplatense, igual que la documentación.

---

## Pendiente inmediato (verificar/terminar primero)

1. **Setup de web push — HECHO (2026-07-10), falta probar en campo.** Ya está todo configurado: tabla `push_suscripciones` + RLS creada en Supabase (migración `supabase/migrations/20260710120000_push_suscripciones.sql`); extensiones `pg_cron` y `pg_net` habilitadas; secrets VAPID + CRON_SECRET cargados (`npx supabase secrets set`); Edge Function `enviar-alertas` deployada; cron `alertas-diarias` activo (jobid 1, `0 11 * * *` = 8am Paraguay); `VITE_VAPID_PUBLIC_KEY` en `.env.local` y en Vercel (Production) con redeploy hecho. **Claves VAPID definitivas: pública `BHOLK0a7kYaBQCgLUdVIbc_HAiBA0zUC2iUBxBA08N8aWHrWB3uU5NHdsmuSanT7IZcAyZiMjKA8hArRa-EtVYg`** (la privada y el CRON_SECRET viven solo en los secrets de Supabase). **Falta:** prueba real — activar desde Perfil → Notificaciones en el celular y disparar la función a mano (`curl.exe -X POST https://sdvhtupgzpchhejxrowg.supabase.co/functions/v1/enviar-alertas -H "Authorization: Bearer <CRON_SECRET>"`); requiere al menos un cliente con visita vencida. Pendiente commitear la migración (ver abajo).
2. **Verificar commits pendientes** — correr `git status`; puede haber quedado sin commitear el último lote (push, Perfil, sw.js, ROADMAP.md, claude.md).
3. **Prueba de campo del modo offline** — en el teléfono contra Vercel: abrir con conexión (instala SW v3), modo avión, registrar desde Registrar y desde la bitácora de un cliente, reconectar, verificar sync y foto.

## Mejoras futuras (orden de impacto sugerido)

### Alta prioridad
4. **Refactor de ClienteDetalle.tsx (2.365 líneas) y Admin.tsx (1.511)** — extraer componentes (bitácora, formulario de gestión, modales de cobro) a `src/components/cliente/`. Sin cambios de comportamiento; verificar contra los patrones de formularios documentados en CLAUDE.md.
5. **Script de migración de cartera existente** — importador Excel/CSV → Supabase para la carga inicial real: validaciones (RUC, teléfonos), mapeo de rubros/instancias/ejecutivos, `lat/lng` opcionales (NULL si no hay; nunca pisar existentes — regla en CLAUDE.md → "Georreferenciación"). Idealmente página Admin con preview y reporte de filas rechazadas.
6. **Tests** — hay vitest configurado pero sin suite. Empezar por lo crítico: `offline-queue.ts`, `utils-field.ts` (distancias, addBusinessHours, parseMontoPYG), lógica de alertas vencidas.

### Media prioridad
7. **Dashboard gerencial** — evolución mensual de cobros vs metas (recharts ya está instalado), ranking de ejecutivos, tasa de conversión CENSO→COMERCIAL→COBRANZAS, heatmap de cobertura por zona/ciudad.
8. **Historial de recorrido en Monitoreo** — además de la posición actual, dibujar la polilínea del recorrido del día por ejecutivo (guardar histórico de `ubicaciones_ejecutivos` en tabla `ubicaciones_historial` con retención de 7 días, o registrar puntos en localStorage y subirlos con la gestión).
9. **Cobros offline** — la cola offline cubre gestiones; extenderla a cobros (más delicado: montos, requiere validación anti-duplicados al sincronizar).
10. **Mejoras de Ruta del día** — optimización de orden tipo TSP simple (vecino más cercano ya que hoy es distancia directa), marcar paradas completadas, integrar eventos con fecha de hoy.
11. **Notificaciones push adicionales** — hoy solo alertas diarias 8am; agregar: aviso al supervisor de visita sospechosa (anti-fraude), aviso de reasignación de cartera, recordatorio de eventos próximos.

### Baja prioridad / deuda técnica
12. **Corregir los 5 errores preexistentes de `tsc`** — tipado de joins de Supabase en ClienteDetalle (3), EventoDetalle (1) y Reportes (1). No afectan el build de Vite; se listan al correr `npx tsc -p tsconfig.app.json --noEmit`.
13. **Roles más finos** — hoy los supervisores pueden asignar rol admin (riesgo residual aceptado de C3); revisar si conviene restringir.
14. **Selector de ejecutivo en Ruta del día para supervisores** — hoy la ruta es solo de la cartera propia.
15. **Modo oscuro** — el theme de shadcn/Tailwind ya lo soporta a medias; falta toggle y revisión de colores custom (gradient-hero, etc.).
16. **Actualizar browserslist** (`npx update-browserslist-db@latest`) y auditar dependencias (`npm audit` reporta 21 vulnerabilidades, 1 crítica — revisar si afectan producción; `xlsx` suele ser el culpable).
17. **Limpieza de `supabase/schema.sql`** duplicado del esquema (la fuente de verdad es `supabase/migrations/`); decidir si se elimina.

## Recordatorios operativos

- Cambios de esquema futuros: `npx supabase db pull` (requiere Docker Desktop abierto) y commitear la migración.
- El deploy es automático al pushear a `main` (Vercel).
- Realtime está habilitado para `gestiones` y `ubicaciones_ejecutivos`; si se agregan tablas al vivo: `ALTER PUBLICATION supabase_realtime ADD TABLE ...`.
- El SW se versiona a mano (`CACHE = "sgp-campo-vN"` en `public/sw.js`): subir la versión cuando cambie el shell cacheado.
