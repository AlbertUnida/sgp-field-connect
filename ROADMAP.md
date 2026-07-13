# ROADMAP — SGP Field Connect

Documento de traspaso y mejoras futuras. Última actualización: 2026-07-11.
**Para el asistente que retome este proyecto: leé primero `CLAUDE.md` (contexto técnico, reglas de trabajo, estado de sesión) y después este archivo (qué construir a continuación).**

---

## Prompt de continuación (copiar y pegar para retomar)

> Estás retomando el desarrollo de SGP Field Connect, una PWA de gestión comercial de campo (React + Vite + TS + Tailwind + Supabase, deploy en Vercel). Leé `CLAUDE.md` completo: ahí están el stack, la arquitectura, el modelo de datos, las reglas de trabajo (el usuario hace los commits desde PowerShell; cualquier cambio de esquema se entrega como SQL explícito; mínimo código; no romper formularios compartidos) y el estado de la última sesión. Después leé `ROADMAP.md` y continuá con el primer ítem pendiente de la sección "Pendiente inmediato", verificando antes qué quedó sin commitear con git status. Trabajá en español rioplatense, igual que la documentación.

---

## Pendiente inmediato (verificar/terminar primero)

0. **Commitear TODO lo de la sesión 2026-07-11** (ver CLAUDE.md → "Estado de sesión 2026-07-11"). El último commit conocido es `b80f3ac` (Refactor Fase 0); todo lo de cobranzas/áreas, dashboard, ruta, monitoreo, fixes de tsc quedó sin commitear. En Windows: `git status` para confirmar, luego `git add <archivos reales>` (NO `git add -A`: evitar el churn de `supabase/schema.sql`, `vercel.json`, `vite.config.ts`, `vitest.config.ts`) y push. Correr las migraciones `20260711130000..170000` en Supabase si aún no se corrieron. Pendiente de este bloque de features: **Fase 1 del refactor** de ClienteDetalle (con click-testing) y el **hardening de RLS** (opcional).

1. **Setup de web push — HECHO (2026-07-10), falta probar en campo.** Ya está todo configurado: tabla `push_suscripciones` + RLS creada en Supabase (migración `supabase/migrations/20260710120000_push_suscripciones.sql`); extensiones `pg_cron` y `pg_net` habilitadas; secrets VAPID + CRON_SECRET cargados (`npx supabase secrets set`); Edge Function `enviar-alertas` deployada; cron `alertas-diarias` activo (jobid 1, `0 11 * * *` = 8am Paraguay); `VITE_VAPID_PUBLIC_KEY` en `.env.local` y en Vercel (Production) con redeploy hecho. **Claves VAPID definitivas: pública `BHOLK0a7kYaBQCgLUdVIbc_HAiBA0zUC2iUBxBA08N8aWHrWB3uU5NHdsmuSanT7IZcAyZiMjKA8hArRa-EtVYg`** (la privada y el CRON_SECRET viven solo en los secrets de Supabase). **Falta:** prueba real — activar desde Perfil → Notificaciones en el celular y disparar la función a mano (`curl.exe -X POST https://sdvhtupgzpchhejxrowg.supabase.co/functions/v1/enviar-alertas -H "Authorization: Bearer <CRON_SECRET>"`); requiere al menos un cliente con visita vencida. Pendiente commitear la migración (ver abajo).
2. **Verificar commits pendientes** — correr `git status`; puede haber quedado sin commitear el último lote (push, Perfil, sw.js, ROADMAP.md, claude.md).
3. **Prueba de campo del modo offline** — en el teléfono contra Vercel: abrir con conexión (instala SW v3), modo avión, registrar desde Registrar y desde la bitácora de un cliente, reconectar, verificar sync y foto.

## Mejoras futuras (orden de impacto sugerido)

### Alta prioridad
4. **Refactor de ClienteDetalle.tsx / Admin.tsx** — **Fase 0 HECHA (2026-07-11):** creado `src/components/cliente/` con `types.ts` (7 tipos + `INSTANCIA_COLORS`), `InfoRow.tsx` y `FotoGestion.tsx`; ClienteDetalle bajó 2370→2233 líneas, sin cambios de comportamiento (tsc en baseline: 5 errores preexistentes, 0 nuevos; build de Vite OK). **Fase 1 PENDIENTE:** extraer los modales de cobro (local y por lote de eventos) y los formularios de gestión/evento — comparten estado con el padre, así que hacerlo con `npm run dev` corriendo y click-testing por pantalla afectada, de a una extracción. Admin.tsx (1.511) sigue intacto.
5. **Script de migración de cartera existente** — **DECISIÓN (2026-07-11): diferido al cutover.** No construir la UI contra columnas que aún no conocemos. Ya hecho el núcleo puro `src/lib/importar-cartera.ts` + tests (mapeo de encabezados con alias, validación, resolución nombre→id de categoría/rubro/sub-rubro/ejecutivo, armado del payload igual a NuevoCliente). Al cutover: pedir el export real, terminar la página Admin (~1h). Recomendación acordada: **migrar estado, no historia** (identidad + clasificación + instancia + ejecutivo + datos de pago; sin reproducir gestiones pasadas). Baldes: local→COMERCIAL y local→COBRANZAS son fáciles (misma tabla `clientes`); evento→COMERCIAL es 2ª etapa (los eventos van en `eventos_agenda`, tabla aparte; COBRANZAS es a nivel evento). Hacer dry-run con el preview de rechazadas antes de insertar.
6. **Tests** — **INICIADO (2026-07-11):** suite viva con `format.test.ts`, `utils-field.test.ts` (distancias, addBusinessHours, filtros), `offline-queue.test.ts` (esErrorDeRed) e `importar-cartera.test.ts`. Falta: lógica de alertas vencidas, filtros de cartera, cálculos de cobros. Nota: en la máquina del usuario `npm test` corre normal; los binarios nativos de Linux solo hicieron falta en el sandbox del asistente.

### Media prioridad
7. ✅ **Dashboard gerencial (v1, 2026-07-11)** — `src/pages/DashboardGerencial.tsx` (`/app/dashboard`, link en menú "+", gated canManage): KPIs (cobrado del mes, N° cobros, activos, en cobranzas), barra meta del mes, cobros últimos 6 meses (BarChart recharts), ranking de ejecutivos del mes, clientes por instancia (PieChart), cobertura por ciudad. Agrega en JS. Mejora futura: heatmap real por zona, tasa de conversión entre instancias con histórico.
8. ✅ **Historial de recorrido en Monitoreo — HECHO (2026-07-11)**: tabla `ubicaciones_historial` (migración `20260711170000`, RLS + retención 7 días vía cron `limpiar-ubicaciones-historial`); `useTracking` inserta cada punto; toggle "Recorrido" en Monitoreo dibuja la polilínea del día por ejecutivo (color por persona, respeta filtro y fecha). Requiere correr la migración en Supabase.
9. **Cobros offline** — la cola offline cubre gestiones; extenderla a cobros (más delicado: montos, requiere validación anti-duplicados al sincronizar).
10. ✅ **Mejoras de Ruta del día — COMPLETO (2026-07-11)**: orden TSP vecino más cercano (`ordenarRutaVecinoMasCercano` + tests), marcar paradas completadas (check + localStorage por día + contador), e integración de eventos agendados para hoy (badge violeta, ubicación del venue, link al detalle del evento).
11. **Notificaciones push adicionales** — hoy solo alertas diarias 8am; agregar: aviso al supervisor de visita sospechosa (anti-fraude), aviso de reasignación de cartera, recordatorio de eventos próximos.

### Baja prioridad / deuda técnica
12. ✅ **Corregido (2026-07-11)** — los 5 errores de `tsc` (joins de Supabase tipados como array en ClienteDetalle, EventoDetalle, Reportes + reset de `referencia` en cobroEv). Fix type-only (`as unknown as ...`). `npx tsc -p tsconfig.app.json --noEmit` ahora da 0 errores.
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
