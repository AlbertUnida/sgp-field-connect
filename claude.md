# CLAUDE.md — SGP Field Connect

Guía para Claude al trabajar en este repositorio.
Última actualización: 2026-07-09

---

## Proyecto

**SGP Field Connect** — PWA de gestión comercial para SGP (Sociedad de Gestión de Productores Fonográficos del Paraguay). Permite a ejecutivos de campo registrar visitas, llamadas y cobros de licencias musicales desde el celular.

- **Repo:** `AlbertUnida/sgp-field-connect`
- **Deploy:** Vercel (automático al hacer push a `main`)
- **Supabase:** `https://sdvhtupgzpchhejxrowg.supabase.co`

---

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18 + Vite + TypeScript + Tailwind CSS |
| Componentes | shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Deploy | Vercel |
| Package manager | npm (lockfile oficial: `package-lock.json`; decidido 2026-07-10, bun no está instalado en la máquina de trabajo) |

---

## Comandos

```bash
# Instalar dependencias
npm install

# Desarrollo local
npm run dev

# Build de producción
npm run build
```

No hay test suite activa. Validación manual en `http://localhost:5173`.

---

## Arquitectura

### Flujo de datos

```
pages/          hooks/          lib/                supabase/
Clientes   →  useProfile  →  supabaseClient  →  DB + RLS
Registrar  →  useAuth     →  resultados-gestion.ts
EventoDetalle               mock-data.ts (solo formatters)
ClienteDetalle
Admin
```

### Páginas principales

- **`Clientes.tsx`** — Lista de clientes con filtros por instancia (CENSO / COMERCIAL / COBRANZAS / JURIDICO) y tipo (local / evento). Tab COBRANZAS muestra tarjetas de eventos cobrados.
- **`ClienteDetalle.tsx`** — Ficha del cliente: bitácora de gestiones inline, cobros (locales y por lote de eventos), historial de instancias, reasignación de ejecutivo.
- **`EventoDetalle.tsx`** — Gestión por evento: visita CON/SIN EVENTO, Llamada/WhatsApp/Email con bloque contacto, bitácora con badges.
- **`Registrar.tsx`** — Registro rápido de gestión desde cualquier cliente. Todos los canales con GPS + foto con marca de agua.
- **`Admin.tsx`** — CRUD de equipo, CENSO, categorías, tareas (tipos_resultado), rubros y tipos de evento.
- **`Reportes.tsx`** — Reportes mensuales por ejecutivo. Export Excel (4 hojas).
- **`Cobros.tsx`** — Lista de cobros con filtros y export Excel.
- **`Alertas.tsx`** — Visitas y contactos vencidos por ejecutivo.
- **`Scoring.tsx`** — Lead scoring de la cartera.
- **`Monitoreo.tsx`** — Solo admin/supervisor. Feed de gestiones en tiempo real (Supabase Realtime) + mapa Leaflet con pins de visitas y posición en vivo de ejecutivos (`ubicaciones_ejecutivos`, vigencia 15 min). Filtro multi-select por ejecutivo, selector de fecha. Ancho completo en desktop (ver `RUTAS_ANCHAS` en AppLayout).
- **`Inicio.tsx`** — Dashboard: KPIs del mes, alertas rápidas.
- **`RutaDia.tsx`** — Ruta del día (`/app/ruta`, todos los roles): visitas pendientes de la cartera propia ordenadas por cercanía GPS, con link a Google Maps.

### Modelo de datos clave

```
clientes (id BIGINT)
  └── instancia: CENSO → COMERCIAL → COBRANZAS → JURIDICO
  └── tipo_cliente: 'local' | 'evento'

eventos_agenda (id UUID)
  └── cliente_id → clientes
  └── instancia: 'COMERCIAL' (default) → 'COBRANZAS' al cobrar
  └── numero_evento: BIGINT IDENTITY (EV-001, EV-002...)

gestiones (id)
  └── cliente_id, evento_id (nullable)
  └── tipo: visita | llamada | whatsapp | email
  └── resultado_id → tipos_resultado (UUID, nullable)
  └── datos_extra JSONB (receptor, contacto, con_evento, score, etc.)
  └── proxima_accion TEXT

tipos_resultado
  └── tipo_cartera: 'ambos' | 'local' | 'evento'
  └── tipo_formulario: nota_comercial | nota_reclamo | visita_seguimiento | reunion | sin_medios

cobros
  └── eventos_ids UUID[] (cobro de eventos por lote)

ubicaciones_ejecutivos (tracking en vivo)
  └── ejecutivo_id UUID PK → profiles (1 fila por usuario, upsert)
  └── lat, lng, accuracy, updated_at
  └── Escrita por hook useTracking (AppLayout): watchPosition con throttle 90s/150m
  └── RLS: cada uno escribe la suya; solo admin/supervisor leen todas
  └── Realtime habilitado (igual que gestiones) vía supabase_realtime
```

### Georreferenciación de clientes (regla de prioridad)

`clientes.lat/lng` son **opcionales** (numeric, nullable). Prioridad en RutaDia y anti-fraude de Monitoreo:
1. Si el cliente tiene `lat/lng` cargados → se usan esos (fuente: migración o carga manual).
2. Si no → centroide de sus visitas con GPS (`gestiones.lat_inicio/lng_inicio`). El sistema "aprende" la ubicación solo con las visitas.
3. Sin ninguna de las dos → cliente funciona igual; en Ruta del día aparece al final como "Sin ubicación".

**Migración futura de cartera existente**: importar clientes con `lat/lng` si se conocen, NULL si no — no romper nada. No pisar `lat/lng` existentes desde el código.

### Roles

- `ejecutivo` — ve solo su cartera asignada
- `supervisor` — ve toda la cartera + Admin (CENSO, Categoría, Seguimiento)
- `admin` — acceso total + Admin completo (Equipo, Tareas, Eventos)

Hook `useProfile` expone: `isAdmin`, `isSupervisor`, `canManage` (admin OR supervisor), `nombreCompleto`.

### Modelo Local vs Evento (CRÍTICO)

- **Local permanente** (`tipo_cliente='local'`): el cliente mismo fluye entre instancias. Al cobrar → cliente pasa a COBRANZAS.
- **Casa de fiestas/Venue** (`tipo_cliente='evento'`): el cliente SIEMPRE queda en COMERCIAL. Tiene eventos hijos (eventos_agenda). Al cobrar un evento → ese evento pasa a `instancia='COBRANZAS'`, el cliente NO se mueve.
- **NUNCA** mover un cliente tipo evento a COBRANZAS. Solo los eventos individuales.

---

## Archivos lib clave

| Archivo | Contenido |
|---------|-----------|
| `src/lib/resultados-gestion.ts` | `RESULTADOS_GESTION` — 9 opciones con score y autoAgenda |
| `src/lib/mock-data.ts` | Solo `formatPYG`, `relativeDate`, `formatDate` (ignorar el resto) |
| `src/lib/supabaseClient.ts` | Cliente Supabase singleton |
| `src/lib/offline-queue.ts` | Cola offline de gestiones en IndexedDB (`sgp-offline`). `encolarGestion`, `sincronizarPendientes`, `esErrorDeRed`. Sync automático vía `useOfflineSync` (AppLayout: al abrir, al evento `online` y cada 60s). Indicador Wifi/pendientes en AppHeader (`useOfflineEstado`). Integrado en Registrar, ClienteDetalle (bitácora) y EventoDetalle. Registrar cachea clientes y tipos_resultado en localStorage para funcionar sin señal desde cero. `public/sw.js` (v3) tiene fallback SPA: cualquier navegación offline sirve el shell cacheado |
| `src/lib/utils.ts` | `cn()` helper de clases |

---

## Git — Workaround CRÍTICO (macOS FUSE)

El repo está montado desde macOS vía FUSE. Los lock files de `.git` no se pueden borrar desde Linux. **El usuario hace siempre el commit y push desde PowerShell de Windows.**

**Flujo correcto:**
1. Claude modifica los archivos en el mount compartido.
2. Claude NO intenta hacer commits desde Linux (fallan por lock files).
3. Claude le indica al usuario qué archivos stagear y el mensaje de commit.
4. El usuario ejecuta desde `C:\Projectsgp\sgp-field-connect`:

```powershell
git add <archivos>
git commit -m "<mensaje>"
git push
```

Si Claude necesita verificar el estado del repo, puede usar el workaround con `/tmp`:
```bash
cp -r /sessions/.../mnt/sgp-field-connect/.git /tmp/tmp_check
GIT_DIR=/tmp/tmp_check git log --oneline -5
```

---

## Bugs conocidos (auditoría 2026-07-03)

### CRÍTICOS (pendientes)
- **C1** ✅ CERRADO — `ResetPassword.tsx` creado y ruta registrada fuera de `PublicRoute`.
- **C2** ✅ CERRADO — Signups públicos deshabilitados en Auth. Edge Function `crear-usuario` con service_role es el único canal de creación de usuarios.
- **C3** ✅ CERRADO — RPC `admin_set_user_profile` ya valida `calling_role IN ('admin','supervisor')` antes de ejecutar. Riesgo residual menor: supervisores pueden asignar rol 'admin' (aceptado como comportamiento intencional).
- **C4** ✅ CERRADO — Esquema y RLS versionados en `supabase/migrations/20260709204905_remote_schema.sql` (db pull 2026-07-09; requiere Docker Desktop). Ante cambios de esquema futuros: repetir `npx supabase db pull` y commitear.

### ALTOS (pendientes)
- **A1** ✅ CERRADO — RPCs `registrar_cobro_local` y `registrar_cobro_eventos` en PostgreSQL; todo corre en una sola transacción.
- **A2** ✅ CERRADO — `cargarGestiones` en `EventoDetalle.tsx` ya incluye `resultado_id` en el select (verificado 2026-07-09).
- **A3** ✅ CERRADO — Bucket `gestiones-fotos` privado + RLS solo authenticated + código usa signed URLs.
- **A4** ✅ CERRADO — Queries de cartera usan JOIN (`clientes!inner(...)`) en Alertas, Inicio y Admin. Los `.in()` restantes son sobre listas fijas (roles, estados), sin problema de escala (verificado 2026-07-09).

### MEDIOS (pendientes)
- **M1** ✅ CERRADO — Visita CON EVENTO guarda `score` en datos_extra; vista `cliente_lead_scores` lo acumula.
- **M2** ✅ CERRADO — KPI "cobrado del mes" en Inicio.tsx ya usa `lt(primerDiaSiguiente)` como límite superior (verificado 2026-07-09).
- **M3** ✅ CERRADO — `parseMontoPYG` en `format.ts` reemplaza todos los parseos de monto; `replace(/\D/g, "")` restante es solo para búsqueda de clientes por ID.
- **M4** ✅ CERRADO — `fecha_vencimiento + "T00:00:00"` fuerza parsing local en Inicio, ClienteDetalle y Admin.
- **M5** ✅ CERRADO — `.not("instancia", "eq", "CENSO")` en la query de Registrar.tsx excluye clientes en CENSO.
- **M6** ✅ CERRADO — Helpers centralizados en `src/lib/utils-field.ts`; las páginas los importan (verificado 2026-07-09).
- **M8** ✅ CERRADO (por convención) — Locales: `proxima_accion` se guarda en `clientes` (alimenta alertas). Eventos: en `gestiones` (EventoDetalle). El código muerto de la bitácora ya no existe (verificado 2026-07-09).

### Cosméticos
- ✅ `lib/mock-data.ts` → renombrado a `lib/format.ts`.
- ✅ Archivos basura en raíz eliminados. Nota: `package-lock.json` existe porque se usa npm en Windows (bun no está instalado); decidir lockfile oficial.
- ✅ `package.json`: name `sgp-field-connect`, version `1.0.0`.
- `ClienteDetalle.tsx` (2.365 líneas) y `Admin.tsx` (1.511) demasiado grandes.

---

## Patrones establecidos — seguir siempre

### Formulario de gestión (visita)
1. Canal selector → reset form
2. Toggle CON EVENTO / SIN EVENTO (solo visita en EventoDetalle)
3. Tarea (tipos_resultado filtrado por tipo_cartera)
4. Receptor (si tipo_formulario requiere)
5. Resultado (RESULTADOS_GESTION para locales; RESULTADOS_EVENTO para eventos)
6. Notas + Próxima acción
7. GPS auto + Foto con marca de agua

### Formulario de gestión (llamada/whatsapp)
1. Bloque contacto: Nombre*, Apellido, Teléfono, Fecha
2. Resultado: RESULTADOS_GESTION
3. Notas + Próxima acción

### Formulario de gestión (email)
1. Bloque contacto: Nombre, Apellido, Email, Fecha
2. Sin resultado obligatorio
3. Notas + Próxima acción

### Validaciones críticas
- `resultado_id: UUID || null` — NUNCA string vacío `""` (rompe Postgres).
- `datos_extra: Object.keys(datosExtra).length > 0 ? datosExtra : null`
- Score en datos_extra: siempre guardar junto con resultado_real.

---

## Estado de sesión 2026-07-09 (retomar acá)

### Hecho hoy (todo en el working tree; verificar si falta commitear)
1. **Monitoreo en vivo** (`/app/monitoreo`, solo admin/supervisor): feed Realtime + mapa Leaflet + tracking de ejecutivos. Dependencia nueva: `leaflet` (instalada con npm; bun no existe en la máquina del usuario).
2. **Layout responsive tablet/PC**: AppLayout/AppHeader se ensanchan en md+/xl; Monitoreo a ancho completo (`RUTAS_ANCHAS`).
3. **Tracking en vivo**: hook `useTracking` + tabla `ubicaciones_ejecutivos` (SQL ya ejecutado en Supabase, Realtime habilitado).
4. **Auditoría 2026-07-03: 100% cerrada** (C1-C4, A1-A4, M1-M8). Esquema versionado en `supabase/migrations/20260709204905_remote_schema.sql`.
5. **Modo offline completo**: `offline-queue.ts` (IndexedDB) + `useOfflineSync` + SW v3 con fallback SPA + cache localStorage de clientes/tareas en Registrar. Integrado en Registrar, ClienteDetalle y EventoDetalle.

### Pendiente inmediato (mañana)
- [x] **Web push: SETUP COMPLETO (2026-07-10).** Código + infraestructura listos: tabla `push_suscripciones` + RLS (migración `supabase/migrations/20260710120000_push_suscripciones.sql`, ya ejecutada en Supabase); `pg_cron`/`pg_net` habilitadas; secrets VAPID + CRON_SECRET seteados; función `enviar-alertas` deployada; cron `alertas-diarias` activo (jobid 1, 0 11 * * *); `VITE_VAPID_PUBLIC_KEY` en `.env.local` y Vercel Production (redeploy hecho). Falta solo la prueba de campo (activar en el celular + disparo manual de la función). **Pendiente commitear:** `git add supabase/migrations/20260710120000_push_suscripciones.sql AUDITORIA-2026-07-03.md` (NO commitear los cambios de line-endings en `supabase/schema.sql` ni en la migración 20260709...; descartarlos con `git checkout --`).
- [x] Lockfile npm: decidido y `bun.lock` eliminado.

### Setup web push (pasos del usuario, una sola vez)
1. `npx web-push generate-vapid-keys` → copiar las dos claves.
2. `.env.local` y Vercel (Settings → Environment Variables): `VITE_VAPID_PUBLIC_KEY=<publica>` → redeploy.
3. Secrets de la función: `npx supabase secrets set VAPID_PUBLIC_KEY=<publica> VAPID_PRIVATE_KEY=<privada> CRON_SECRET=<inventar-uno-largo>`
4. Deploy: `npx supabase functions deploy enviar-alertas`
5. Cron diario 8am (SQL Editor, requiere extensiones pg_cron y pg_net habilitadas en Dashboard → Database → Extensions):
```sql
select cron.schedule('alertas-diarias', '0 11 * * *',  -- 11 UTC = 8am Paraguay
  $$ select net.http_post(
       url := 'https://sdvhtupgzpchhejxrowg.supabase.co/functions/v1/enviar-alertas',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     ) $$);
```
- [ ] Verificar que el usuario commiteó y pusheó el último lote offline (sw.js v3, offline-queue, useOfflineSync, Registrar, ClienteDetalle, EventoDetalle, AppHeader, AppLayout, CLAUDE.md).
- [ ] Probar offline en el teléfono contra Vercel: abrir con conexión (instala SW v3) → modo avión → registrar desde bitácora → reconectar → verificar sync.

### Backlog acordado (en orden de impacto)
1. ✅ **Anti-fraude GPS** (hecho 2026-07-10): en Monitoreo, visitas a >500m del centroide de visitas históricas del cliente (mín. 2 previas con GPS) se marcan con ⚠ en feed, pin con borde rojo y contador en KPIs. Constantes `UMBRAL_SOSPECHOSA_M` / `MIN_VISITAS_REFERENCIA` en Monitoreo.tsx; `distanciaMetros` en utils-field.ts.
2. ✅ **Ruta del día** (hecho 2026-07-10): página `/app/ruta` (RutaDia.tsx, todos los roles, menú +). Clientes de la cartera propia con visita vencida (dias_visita del rubro, 90 días de historial) o proxima_accion <= hoy, ordenados por cercanía GPS a la posición actual (fallback: por urgencia). Ubicación del cliente = centroide de visitas con GPS. Botón "Ir" abre Google Maps direcciones.
3. Push notifications (alertas vencidas). Paso previo hecho 2026-07-10: campanita del AppHeader funcional — badge con total de alertas vencidas (`useAlertasBadge`, cache localStorage 10 min, misma lógica que Inicio/Alertas) y link a /app/alertas. Falta: web push real (VAPID + Edge Function + cron).
4. Refactor de ClienteDetalle/Admin (muy grandes). 5. Decidir lockfile oficial (npm vs bun).

---

## Workflow Rules

1. **[Mínimo código]** Solo modificar lo necesario. No tocar código no relacionado.
2. **[No asumir]** Declarar supuestos antes de implementar. Si hay duda, preguntar.
3. **[Verificar antes de done]** No marcar tarea completa sin criterio verificable.
4. **[Bug activo → fix directo]** Cuando hay un bug reportado, arreglar sin preguntar.
5. **[Commit = usuario]** Claude edita archivos. El usuario hace `git add + commit + push` desde PowerShell.
6. **[SQL siempre explícito]** Cualquier cambio de esquema: dar el SQL exacto para que el usuario lo ejecute en Supabase SQL Editor.
7. **[No romper lo existente]** Antes de cambiar código compartido, verificar todos los formularios que lo usan (Registrar, ClienteDetalle, EventoDetalle).
