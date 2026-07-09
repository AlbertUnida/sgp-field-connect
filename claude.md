# CLAUDE.md — SGP Field Connect

Guía para Claude al trabajar en este repositorio.
Última actualización: 2026-07-03

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
| Package manager | Bun (lockfile: `bun.lock`) |

---

## Comandos

```bash
# Instalar dependencias
bun install

# Desarrollo local
bun run dev

# Build de producción
bun run build
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
- **`Inicio.tsx`** — Dashboard: KPIs del mes, alertas rápidas.

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
```

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
- **C4** — Sin migrations en repo → esquema y RLS solo en dashboard Supabase. Fix: `npx supabase db pull` y commitear.

### ALTOS (pendientes)
- **A1** ✅ CERRADO — RPCs `registrar_cobro_local` y `registrar_cobro_eventos` en PostgreSQL; todo corre en una sola transacción.
- **A2** ✅ PENDIENTE — `cargarGestiones` en `EventoDetalle.tsx:197` no incluye `resultado_id` → filtro secuencial de nota_reclamo siempre en cero.
- **A3** ✅ CERRADO — Bucket `gestiones-fotos` privado + RLS solo authenticated + código usa signed URLs.
- **A4** — `.in("cliente_id", ids)` con toda la cartera → falla a escala (>200 clientes).

### MEDIOS (pendientes)
- **M1** ✅ CERRADO — Visita CON EVENTO guarda `score` en datos_extra; vista `cliente_lead_scores` lo acumula.
- **M2** — KPI "cobrado del mes" en Inicio.tsx sin límite superior de fecha.
- **M3** ✅ CERRADO — `parseMontoPYG` en `format.ts` reemplaza todos los parseos de monto; `replace(/\D/g, "")` restante es solo para búsqueda de clientes por ID.
- **M4** ✅ CERRADO — `fecha_vencimiento + "T00:00:00"` fuerza parsing local en Inicio, ClienteDetalle y Admin.
- **M5** ✅ CERRADO — `.not("instancia", "eq", "CENSO")` en la query de Registrar.tsx excluye clientes en CENSO.
- **M6** — `aplicarMarcaDeAgua`, `capturarGPSPromise`, `tiposResultadoFiltrados`, `addBusinessHours` duplicados/triplicados.
- **M8** — `proxima_accion` guardada en dos lugares distintos; campo en bitácora de ClienteDetalle nunca viene del select (código muerto).

### Cosméticos
- `lib/mock-data.ts` tiene ~120 líneas de datos muertos; renombrar a `lib/format.ts`.
- Archivos basura en raíz: `*.patch`, `vite.config.ts.timestamp-*.mjs`, lockfiles duplicados.
- `package.json`: name `vite_react_shadcn_ts`, version `0.0.0`.
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

## Workflow Rules

1. **[Mínimo código]** Solo modificar lo necesario. No tocar código no relacionado.
2. **[No asumir]** Declarar supuestos antes de implementar. Si hay duda, preguntar.
3. **[Verificar antes de done]** No marcar tarea completa sin criterio verificable.
4. **[Bug activo → fix directo]** Cuando hay un bug reportado, arreglar sin preguntar.
5. **[Commit = usuario]** Claude edita archivos. El usuario hace `git add + commit + push` desde PowerShell.
6. **[SQL siempre explícito]** Cualquier cambio de esquema: dar el SQL exacto para que el usuario lo ejecute en Supabase SQL Editor.
7. **[No romper lo existente]** Antes de cambiar código compartido, verificar todos los formularios que lo usan (Registrar, ClienteDetalle, EventoDetalle).
