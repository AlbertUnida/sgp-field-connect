# Auditoría de código — SGP Field Connect
**Fecha:** 2026-07-03 · **Alcance:** todo `src/` + configuración del repo · **Método:** lectura completa del código fuente, historial git y configuración. Lo que vive solo en Supabase (RLS, triggers, funciones SQL) no es verificable desde el repo y se marca como ⚠️ VERIFICAR.

---

## CRÍTICO

### C1. Recuperación de contraseña rota (ruta inexistente)
- **Ubicación:** `src/pages/ForgotPassword.tsx:22` → `redirectTo: ${origin}/reset-password`; `src/App.tsx` no define la ruta `/reset-password`.
- **Impacto:** el email de recuperación llega, el usuario hace clic y cae en NotFound. Nadie puede recuperar su contraseña sin intervención manual del admin. Flujo core roto en producción.
- **Fix:** crear `src/pages/ResetPassword.tsx` (formulario que llame `supabase.auth.updateUser({ password })` — la sesión de recovery ya viene en la URL) y registrar `<Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />`. Ojo: `PublicRoute` redirige a `/app` si hay sesión, y el link de recovery CREA sesión — la página debe ir fuera de `PublicRoute` o manejar el evento `PASSWORD_RECOVERY`.
- **Esfuerzo:** rápido (1-2 h).

### C2. Registro público de cuentas habilitado (implícito en la creación de usuarios)
- **Ubicación:** `src/pages/Admin.tsx:252-266` — `tempClient.auth.signUp(...)` con la **anon key**.
- **Impacto:** para que ese flujo funcione, el proyecto Supabase tiene signups públicos activados. La anon key y la URL van en el bundle JS (público). Cualquier persona puede crear una cuenta con `signUp` desde la consola del navegador. Como los ejecutivos ven **toda** la cartera (decisión de diseño en `Clientes.tsx:84`), las políticas SELECT son laxas: un desconocido autenticado probablemente pueda leer clientes, cobros, teléfonos y RUC de toda la cartera.
- **Fix:** (a) desactivar signups públicos en Supabase Auth; (b) mover la creación de usuarios a una Edge Function con `service_role` (`auth.admin.createUser`) que valide que el caller es admin; (c) si (b) es mucho ahora, mitigar con una política RLS que bloquee todo SELECT a usuarios sin fila en `profiles` con `activo = true`.
- **Esfuerzo:** medio (½ día). ⚠️ VERIFICAR configuración actual de Auth.

### C3. Posible escalación de privilegios vía `admin_set_user_profile`
- **Ubicación:** `src/pages/Admin.tsx:282` — RPC con SECURITY DEFINER ("bypasa RLS", según el comentario).
- **Impacto:** si la función no valida internamente que `auth.uid()` sea admin, **cualquier usuario autenticado** puede invocarla desde la consola y asignarse `rol = 'admin'`. Combinado con C2, un externo podría crear cuenta y volverse admin.
- **Fix:** revisar la definición en Supabase; agregar al inicio:
  ```sql
  if not exists (select 1 from profiles where id = auth.uid() and rol = 'admin') then
    raise exception 'No autorizado';
  end if;
  ```
- **Esfuerzo:** rápido (SQL de 5 líneas). ⚠️ VERIFICAR — es lo primero a chequear hoy.

### C4. Cero fuente de verdad del esquema y las políticas RLS
- **Ubicación:** no existe ningún `.sql` ni carpeta `migrations/` en el repo. El propio código lo confiesa: `Admin.tsx:238` ("Ejecutá el SQL de políticas RLS en Supabase"), `EditarCliente.tsx:163` ("pedile al administrador que ejecute la migración").
- **Impacto:** toda la seguridad del sistema (RLS) vive solo en el dashboard de Supabase, parcheada a mano. Si se pierde el proyecto o alguien toca una política, no hay forma de reconstruir ni auditar. Para vos, que no tenés desarrollador dedicado, este es el mayor punto único de falla.
- **Fix:** `npx supabase db pull` (o dashboard → Database → copiar definiciones) y commitear `supabase/migrations/` + un `SCHEMA.md` con tablas, vistas (`cliente_lead_scores`), funciones y políticas. De ahí en más, todo cambio de BD entra por archivo commiteado.
- **Esfuerzo:** medio (½ día una vez; luego gratis).

---

## ALTO

### A1. Flujos multi-paso sin atomicidad ni chequeo de errores
- **Ubicación:** `ClienteDetalle.tsx:503-562` (`registrarCobro`): inserta el cobro con chequeo, pero el `update` a COBRANZAS (línea 542) y el insert de historial (547) van sin verificar error. Mismo patrón en `registrarActividad` (813, update de `ultima_gestion`), `registrarCobroEventos` (629, con toast pero sin rollback), `asignarDesdeAdmin` (`Admin.tsx:343`).
- **Impacto:** si RLS o la red falla a mitad de camino: cobro registrado pero cliente sigue en COMERCIAL, sin `fecha_vencimiento`, sin historial — inconsistencia **silenciosa** que después nadie sabe explicar.
- **Fix:** una función Postgres `registrar_cobro(...)` que haga insert + update + historial en una transacción, llamada con un solo `.rpc()`. Mientras tanto, mínimo: chequear `error` de cada paso y avisar con toast.
- **Esfuerzo:** medio por flujo (el de cobros primero).

### A2. Filtro secuencial de nota_reclamo roto en eventos (bug de copia)
- **Ubicación:** `EventoDetalle.tsx:197-206` — el `select` de gestiones **no incluye `resultado_id`**, pero la línea 204 lo lee para armar `resultadosCompletados` → el Set queda siempre vacío → el filtro secuencial ofrece siempre la primera nota de reclamo, aunque ya se haya entregado.
- **Fix:** agregar `resultado_id` al select. Una línea.
- **Esfuerzo:** rápido (5 min). Nota: este bug existe porque la lógica está copiada en 3 archivos (ver M6).

### A3. Bucket de fotos público
- **Ubicación:** `Registrar.tsx:406` y `EventoDetalle.tsx:333` — `getPublicUrl` sobre `gestiones-fotos`.
- **Impacto:** las fotos de evidencia (con marca de agua: nombre del ejecutivo, fecha, hora, y a menudo la fachada del cliente) son accesibles a cualquiera con la URL, sin sesión. Datos personales de empleados y clientes expuestos.
- **Fix:** bucket privado + `createSignedUrl(path, 3600)` al mostrar. Guardar el `path` en `foto_url` en vez de la URL pública.
- **Esfuerzo:** medio (2-3 h, incluye migrar URLs viejas).

### A4. `.in("cliente_id", ids)` con toda la cartera — falla a escala
- **Ubicación:** `Inicio.tsx:155-160`, `Alertas.tsx:65-70`, `Admin.tsx:477-482` (Seguimiento).
- **Impacto:** se pasan TODOS los ids de clientes en la URL de la query. PostgREST/HTTP tiene límite de longitud: con unos cientos de clientes la request empieza a fallar (hoy con carga admin/supervisor ya viaja la cartera completa). Además se baja la tabla `gestiones` de 30 días entera al teléfono para calcular alertas en JS.
- **Fix:** vista o función SQL agregada (`cliente_alertas` con última visita, contacto vencido, etc.) y consultar eso. De paso desaparecen las 3 copias de la lógica.
- **Esfuerzo:** grande (1 día), pero es la única pieza que realmente no escala.

---

## MEDIO

### M1. Lead scoring: dos fuentes de verdad + eventos sin score
- **Ubicación:** (a) `ClienteDetalle.tsx:906-918` calcula el score sumando `datos_extra.score` de las gestiones cargadas; `Clientes.tsx:93` y `Scoring.tsx:61` leen la vista `cliente_lead_scores`. (b) `EventoDetalle.tsx:344-354`: la visita CON EVENTO guarda `resultado_real` pero **no guarda `score`** (llamada/whatsapp sí, línea 361-362).
- **Impacto:** el semáforo del header puede no coincidir con el de la lista; las visitas a eventos no puntúan → clientes de eventos aparecen más "fríos" de lo real.
- **Fix:** agregar `datosExtra.score` en la rama visita de EventoDetalle; y que el header de ClienteDetalle lea la misma vista que el resto. ⚠️ VERIFICAR cómo calcula la vista (si excluye eventos, mismo bug del lado SQL).
- **Esfuerzo:** rápido.

### M2. KPI "cobrado del mes" cuenta cobros futuros
- **Ubicación:** `Inicio.tsx:73-77` y `:125` — solo `gte` primer día del mes, sin límite superior. `Cobros.tsx:144-145` sí acota con `lt`.
- **Impacto:** un cobro cargado con fecha del mes siguiente infla la meta del mes actual; Inicio y Cobros muestran números distintos.
- **Fix:** agregar `.lt("fecha_cobro", primerDiaSiguiente)` como en Cobros.
- **Esfuerzo:** rápido.

### M3. Parseo de montos frágil
- **Ubicación:** `ClienteDetalle.tsx:513,600`, `EditarCliente.tsx:146`, `NuevoCliente.tsx:94`, `Admin.tsx:204` — `parseFloat(x.replace(/\D/g, ""))`.
- **Impacto:** elimina el punto decimal y el signo: "50.5" → 505. Con PYG (sin decimales) es tolerable, pero el `<Input type="number">` acepta decimales y `e`. Riesgo de cobros mal registrados por error de tipeo.
- **Fix:** util única `parseMontoPYG(s): number | null` que rechace valores no enteros positivos, usada en todos lados.
- **Esfuerzo:** rápido.

### M4. Comparación de `fecha_vencimiento` inconsistente (timezone)
- **Ubicación:** `ClienteDetalle.tsx:977-983` — para mostrar usa `+"T00:00:00"` (local) pero para comparar usa `new Date(fecha_vencimiento)` (UTC). Paraguay es UTC-3/-4.
- **Impacto:** un cliente aparece "vencido" desde las ~20-21h del día **anterior** al vencimiento. En Inicio/Admin las comparaciones también mezclan estilos.
- **Fix:** helper `parseFechaLocal(d) = new Date(d + "T00:00:00")` y usarlo siempre.
- **Esfuerzo:** rápido.

### M5. Registrar permite gestionar clientes en CENSO
- **Ubicación:** `Registrar.tsx:166-181` — la lista de clientes no filtra por instancia; `ClienteDetalle.tsx:1364` sí bloquea gestiones en CENSO.
- **Impacto:** un ejecutivo puede saltarse la regla de negocio ("las gestiones se habilitan en COMERCIAL") entrando por la pestaña Registrar.
- **Fix:** `.not("instancia", "eq", "CENSO")` en `cargarClientes` (o filtro equivalente en el dropdown).
- **Esfuerzo:** rápido.

### M6. Duplicación masiva de lógica de negocio (causa raíz de A2)
- **Ubicación:** `aplicarMarcaDeAgua` y `capturarGPSPromise` duplicadas en `Registrar.tsx` y `EventoDetalle.tsx`; armado de `datos_extra` + validaciones por canal triplicado (`Registrar`, `ClienteDetalle`, `EventoDetalle`); `tiposResultadoFiltrados` triplicado; `addBusinessHours` triplicado (`Inicio`, `Admin`, `Alertas`); `formatPYGLocal` en Admin duplica `formatPYG`.
- **Impacto:** cada fix hay que hacerlo 3 veces y ya quedó una copia atrás (A2). Es tu mayor costo de mantenimiento sin desarrollador dedicado.
- **Fix:** extraer a `src/lib/gestiones.ts` (validación + datos_extra + marca de agua + GPS) y `src/lib/fechas.ts` (addBusinessHours, parseFechaLocal). Los 3 formularios llaman lo mismo.
- **Esfuerzo:** medio (1 día), altísimo retorno.

### M7. `xlsx` 0.18.5 con vulnerabilidades conocidas
- **Ubicación:** `package.json` — SheetJS 0.18.5 (última en npm; el proyecto migró fuera de npm). CVE-2023-30533 (prototype pollution) y ReDoS conocidos.
- **Impacto:** bajo en la práctica (solo generás archivos, no parseás archivos ajenos), pero es dependencia abandonada en npm.
- **Fix:** migrar a la distribución oficial CDN de SheetJS (`https://cdn.sheetjs.com`) o a `exceljs`.
- **Esfuerzo:** rápido-medio.

### M8. Modelo de datos inconsistente para `proxima_accion`
- **Ubicación:** `Registrar.tsx:477` y `ClienteDetalle.tsx:813` la guardan en `clientes`; `EventoDetalle.tsx:384` la guarda en `gestiones`. `ClienteDetalle.tsx:2335` intenta mostrar `g.proxima_accion`, que nunca viene en el select (código muerto).
- **Impacto:** la próxima acción de un evento no aparece en ningún lado; el campo del cliente se pisa con cada gestión.
- **Fix:** decidir una sola casa (sugerido: `gestiones.proxima_accion` + `clientes.proxima_accion` como cache actualizado por trigger o por la RPC de A1) y limpiar el código muerto.
- **Esfuerzo:** medio.

### M9. `claude.md` del repo describe OTRO proyecto
- **Ubicación:** `claude.md` (raíz) — describe "LeadScrapper Paraguay" (Streamlit + Playwright), nada que ver con esta app.
- **Impacto:** cada sesión de Claude/Cursor arranca con contexto equivocado y "reglas" de otro repo. Es exactamente lo que el Módulo 3 debe arreglar.
- **Fix:** reescribir para SGP Field Connect (queda para Módulo 3).
- **Esfuerzo:** medio.

---

## BAJO

- **B1. Contraseñas mínimo 6 caracteres** (`Admin.tsx:247`, `Perfil.tsx:68`). Subir a 8+ y fijar política en Supabase Auth. *Rápido.*
- **B2. "Nunca visitado" = 30 días fijos** (`Inicio.tsx:175`, `Alertas.tsx:91`, `Admin.tsx:501`): la ventana de gestiones es de 30 días, así que (a) una visita de hace 40 días figura como "hace 30", y (b) rubros con `dias_visita >= 30` **nunca** alertan aunque jamás se visitó al cliente. *Fix junto con A4.*
- **B3. Service worker cachea errores** (`public/sw.js`): guarda en cache cualquier respuesta (404 incluido) sin chequear `res.ok`, y el cache crece sin límite. Además cada deploy requiere bump manual de `CACHE`. *Rápido.*
- **B4. Toast "ya puede iniciar sesión" puede ser falso** (`Admin.tsx:294`): si la confirmación de email está activa (el `emailRedirectTo` sugiere que sí), el usuario nuevo no puede entrar hasta confirmar. *Rápido; se resuelve solo con C2 (createUser con `email_confirm: true`).*
- **B5. Sin tests**: vitest configurado y un solo test trivial. Mínimo: tests para `parseMontoPYG`, `addBusinessHours`, `getLeadScoreInfo` y el filtro secuencial de nota_reclamo (habría atrapado A2). *Medio.*
- **B6. Sin paginación** en Clientes/Scoring (baja toda la tabla + todos los scores). OK hoy; doloroso a >1-2k clientes. *Se ataca junto con A4.*
- **B7. Embudo de Reportes visible para ejecutivos** (`Reportes.tsx:149-159`): todo ejecutivo ve el conteo global por instancia. Probablemente intencional; confirmar.

## COSMÉTICO

- `lib/mock-data.ts`: ~120 líneas de datos falsos muertos; solo se usan `formatPYG`/`relativeDate`/`formatDate` → mover a `lib/format.ts` y borrar el resto (el nombre confunde: `formatPYG` importado desde "mock-data" en toda la app).
- Basura en la raíz del working tree: `0001-feat-eventos-*.patch`, `vite.config.ts.timestamp-*.mjs`, y **dos** lockfiles de package manager (`bun.lock`/`bun.lockb` + `package-lock.json`) — elegí uno.
- `ClienteDetalle.tsx:2062-2067`: el mapa `METODO` del historial de cobros incluye "tarjeta" (no existe en el form) y omite "debito" (sí existe) → los débitos se muestran crudos.
- `package.json`: name `vite_react_shadcn_ts`, version `0.0.0`.
- `ClienteDetalle.tsx` (2.365 líneas) y `Admin.tsx` (1.511) hacen demasiado; dividir cuando se toque (no urgente).

---

## Tabla resumen priorizada

| # | Hallazgo | Severidad | Esfuerzo | Por qué en este orden |
|---|----------|-----------|----------|----------------------|
| 1 | C3 — Validar rol admin en RPC `admin_set_user_profile` | Crítico | Rápido | 5 líneas de SQL cierran la puerta de escalación. Verificalo HOY. |
| 2 | C1 — Ruta `/reset-password` | Crítico | Rápido | Flujo core roto; 1-2 h. |
| 3 | A2 — `resultado_id` faltante en EventoDetalle | Alto | Rápido | Una línea, bug de negocio activo. |
| 4 | M2 + M4 + M5 — filtros de fecha/instancia | Medio | Rápido | Lote de fixes de <1 h c/u, números correctos ya. |
| 5 | C2 — Cerrar signups públicos + Edge Function | Crítico | Medio | Riesgo real de fuga de cartera completa. |
| 6 | C4 — Migrations/esquema al repo | Crítico | Medio | Sin esto, todo lo demás es castillo de arena. |
| 7 | A3 — Bucket de fotos privado | Alto | Medio | Datos personales expuestos. |
| 8 | A1 — RPC transaccional para cobros | Alto | Medio | Evita inconsistencias de plata, lo más caro de arreglar después. |
| 9 | M6 — Desduplicar lógica de gestiones | Medio | Medio | Reduce el costo de TODO cambio futuro. |
| 10 | M1 — Score en eventos + una sola fuente | Medio | Rápido | Después de M6 es trivial. |
| 11 | A4 + B2 + B6 — Vista SQL de alertas + paginación | Alto | Grande | Necesario antes de que la cartera crezca. |
| 12 | M7, M8, M9, B1, B3-B5, cosméticos | Medio/Bajo | Variable | En el orden que convenga. |

**Criterio general:** primero lo que se arregla en minutos y cierra riesgo (1-4), después seguridad estructural (5-8), después mantenibilidad (9-12). Todo lo listado es aplicable sin desarrollador full-time; los ítems 5, 6 y 11 son los únicos que piden medio día o más de concentración.

**Límite de esta auditoría:** RLS, triggers, la vista `cliente_lead_scores` y la config de Auth/Storage viven solo en Supabase y no pude verificarlos. C2/C3 están redactados como riesgo probable; confirmalos en el dashboard antes de darlos por ciertos o falsos.
