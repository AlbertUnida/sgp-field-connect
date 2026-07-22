# PLAN — Rediseño del flujo de VISITAS

Documento de diseño. Creado: 2026-07-22. Estado: **en planificación (sin implementar)**.
Ver también: `CLAUDE.md` (arquitectura, modelo de datos, georreferenciación) y `ROADMAP.md`.

---

## 1. Objetivo

Convertir la visita de un registro instantáneo a un **flujo con ciclo de vida** (iniciar → cerrar), con **geofence duro** para evitar marcaciones fuera del local, medición de **duración**, y **recordatorios push** para cerrar visitas abiertas. Reemplaza la alerta blanda actual de Monitoreo (⚠ a >500m) por un bloqueo real.

---

## 2. Decisiones tomadas (Alberto, 2026-07-22)

1. **Alcance:** aplica a **todas las visitas** (locales permanentes + eventos/venues). Flujo único y consistente. Aplica a ejecutivo, supervisor y admin por igual.
2. **Cliente sin ubicación:** la **primera visita fija la ubicación** (el GPS de inicio queda como `clientes.lat/lng` si estaba en NULL). Además, admin/supervisor tendrán un lugar para **cargar/editar coordenadas** manualmente.
3. **Recordatorios:** vía **web push** (llegan con la app cerrada). Ya existe la infraestructura (`push_suscripciones`, función `enviar-alertas`, cron).
4. **Cerrar visita:** **solo dentro de los 100m** del cliente. Si el ejecutivo ya se fue, no puede cerrar desde lejos (ver "visitas abandonadas", §9).

---

## 3. Geofence de un evento

Los eventos (`eventos_agenda`) **no tienen ubicación propia**; ocurren en el venue, que **es** el cliente tipo evento. Por lo tanto, el geofence de una visita a un evento se mide contra `clientes.lat/lng` del cliente padre (la casa de fiestas). Misma regla que un local.

---

## 4. Regla de geofence (DECIDIDA, 2026-07-22)

La planilla de la app de terceros muestra precisiones de inicio muy dispares: desde 2-3m hasta **64m, 92m, 100m**. Un radio duro de 100m con esa incertidumbre produciría bloqueos/permisos falsos. **No se aumenta el radio a lo bruto** (un radio grande permitiría marcar desde lejos, que es justo lo que se quiere evitar). En su lugar, la regla es **consciente de la precisión**, en tres piezas:

**1. Asentar el GPS antes de marcar (lo más importante).** El primer fix del celular suele ser malo (~100m, basado en antenas) y baja a GPS real (5-20m) en unos segundos al aire libre. Al tocar "Iniciar/Cerrar visita", muestrar la precisión en vivo y quedarse con la **mejor lectura** durante una ventana de asentamiento (`watchPosition`), hasta llegar a ≤20m o agotar ~8s.

**2. Comparar con margen de precisión, no contra el número pelado.** Bloquear solo si **`distancia − precisión > 100m`**. Ejemplos:
- A 500m con 50m de precisión → 450 > 100 → **bloqueado** (marcó desde la casa).
- A 90m con 40m de precisión → 50 < 100 → **permitido** (está en el local, GPS ruidoso).

**3. Piso de precisión para poder marcar.** Si tras la ventana de asentamiento la precisión sigue peor que **50m**, pedir "movete a un lugar más abierto / esperá". Si aun así no mejora, se permite marcar **pero queda flag `baja_precision=true` en `datos_extra`** para revisión del supervisor en Monitoreo. No se traba el trabajo, pero queda auditado.

**Configuración (constantes):** `RADIO_GEOFENCE_M = 100`, `PRECISION_MINIMA_M = 50`, `VENTANA_ASENTAMIENTO_MS = 8000` (o cortar al llegar a ≤20m). Todo con `position.coords.accuracy` (ya disponible) y `distanciaMetros` (utils-field.ts). Aplica igual al **iniciar** y al **cerrar**.

---

## 5. Importador de coordenadas — SON TRES SISTEMAS

Aclaración de Alberto (2026-07-22): el número que aparece en la app de visitas (ej. `101345`) **NO es de SGP Field Connect** — es el ID de **otro CRM** que usan aparte. Nuestra base **no guarda** ese ID. Entonces el cruce es de dos saltos:

```
App de visitas            CRM (aparte)             SGP Field Connect
(CRM-ID + lat/lng)  ──►   (CRM-ID + RUC/nombre) ──►  clientes (RUC/nombre → id)
```

- **Salto 1:** app de visitas → CRM por el **CRM-ID** (directo, ambos usan ese número).
- **Salto 2:** CRM → nuestros `clientes` por un **campo común**. Candidato #1: **RUC** (más confiable). Fallback: `nombre_comercial` / `razón social` (matching por texto normalizado, con preview de dudosos).

**Persistir el puente:** conviene agregar una columna `clientes.codigo_crm` (text, nullable, índice) y poblarla en esta importación. Así futuros cruces con el CRM o la app de visitas son directos y no dependen de re-matchear por RUC/nombre cada vez.

La coordenada por cliente = la **marcación de mejor precisión** (menor `accuracy`) entre sus filas de la app de visitas. Llenar solo donde `clientes.lat/lng` esté NULL por defecto (regla CLAUDE.md); opción de sobrescribir para managers.

### Análisis de las planillas reales (2026-07-22)

Recibidas: `Visitas App de visitas ejemplo.xls`, `crm clientes eventos.xlsx`, `crm clientes locales permanentes.xlsx`. Hallazgos:

- **Clave de cruce confirmada:** el CRM-ID de la app de visitas es la columna **`Documento`** (Tipo Documento = "COD"). En los CRM ese ID es **`nro_usuario`** (eventos) / **`ID USUARIO`** (locales). Las columnas `id_gestion` / `ID GESTION` son otro ID interno — **NO** son la clave (0 y 25 matches respectivamente).
- **Cobertura:** la planilla de visitas tiene 8.840 marcaciones con coordenadas → **1.307 clientes distintos** con GPS. De esos, cruzaron con los CRM: **844 locales + 66 eventos = ~910**. Los ~397 restantes no están en estos dos exports (algunos no son clientes: filas tipo "ALMUERZO/999", "Bella Vista Hotel" sin documento).
- **Los CRM NO traen RUC** → no se puede puentear CRM→SGP por RUC desde estos archivos. El puente confiable es **`codigo_crm`** (ver abajo).
- **Precisión GPS (valida la regla §4):** mediana 15,6m; 88% de las marcaciones ≤50m; **0% >100m**. Tomando la **mejor marcación por cliente**: 96% ≤50m, 100% ≤100m. O sea, sembrar la ubicación del cliente con su mejor marcación da coordenadas de buena calidad, y confirma la estrategia de "asentar y quedarse con la mejor lectura".

### Estrategia recomendada: unificar con el cutover de cartera

Como SGP no guarda el CRM-ID y los CRM no traen RUC, la vía limpia es **poblar `clientes.codigo_crm` durante la migración de cartera del cutover** (ROADMAP ítem 5 / `importar-cartera.ts`), que probablemente importa desde **estos mismos** exports del CRM. Al importar, guardar `codigo_crm = ID USUARIO/nro_usuario`. Después, las coordenadas de la app de visitas se cargan **join directo por `codigo_crm`**, sin matching difuso por nombre. Un solo pipeline (cartera + coordenadas), alineado con el objetivo de "una sola herramienta".

**Para cargar coordenadas en la base ACTUAL (antes del cutover)** haría falta un export de nuestros `clientes` (id, numero_cliente, nombre_comercial, ruc) para matchear por nombre con lista de revisión — más sucio. Recomendación: hacerlo bien en el cutover vía `codigo_crm`.

---

## 6. Modelo de datos

`gestiones` **ya tiene** las columnas necesarias: `fecha_inicio`, `fecha_fin`, `duracion_minutos`, `lat_inicio/lng_inicio`, `lat_fin/lng_fin`, `resultado_id`, `proxima_accion`, `datos_extra`. La visita se modela como **una sola fila** con ciclo de vida:

- **Iniciar:** INSERT con `tipo='visita'`, `fecha_inicio=now`, `lat_inicio/lng_inicio` (marcación validada), `estado_visita='abierta'`, `resultado_id=NULL`.
- **Cerrar:** UPDATE de esa fila: `fecha_fin=now`, `lat_fin/lng_fin` (marcación validada), `duracion_minutos` = diff, `estado_visita='cerrada'`, `resultado_id`, `nota`, `proxima_accion`.

Falta **una** columna discriminadora, `estado_visita`, porque las visitas históricas ya tienen `fecha_fin` NULL y no deben contar como "abiertas". Las filas viejas quedan con `estado_visita=NULL` (no participan del flujo nuevo).

Regla **una sola visita abierta por ejecutivo**: índice único parcial sobre `ejecutivo_id where estado_visita='abierta'`.

### Migración (borrador)
```sql
alter table public.gestiones
  add column if not exists estado_visita text
  check (estado_visita in ('abierta','cerrada'));  -- NULL para gestiones que no son visitas del flujo nuevo

create unique index if not exists uniq_visita_abierta_por_ejecutivo
  on public.gestiones (ejecutivo_id)
  where estado_visita = 'abierta';
```
(La UI/geofence es del lado del cliente; el índice garantiza a nivel DB que no haya dos visitas abiertas simultáneas del mismo ejecutivo.)

---

## 7. Flujo de UI (Registrar + EventoDetalle)

1. Ejecutivo elige **visita** → la app pide GPS (con `accuracy`).
2. **Si el cliente tiene ubicación:** calcular distancia. Aplicar la regla de §4. Fuera de rango → bloquear ("estás a Xm, fuera del rango de 100m, no podés iniciar la visita"). En rango → habilitar **"Iniciar visita"**.
   **Si el cliente NO tiene ubicación:** permitir iniciar; al iniciar, setear `clientes.lat/lng` con este GPS (solo si estaba NULL).
3. Al **Iniciar**: se crea la fila abierta. Aparece un **banner global "Visita en curso"** con cronómetro (visible en toda la app vía AppLayout).
4. Mientras está abierta: **push cada ~5 min** recordando cerrar, y push si el ejecutivo **sale del rango** con la visita abierta (§8).
5. **Cerrar visita:** la app vuelve a pedir GPS; debe estar en rango (§4) → si no, bloquear ("acercate al local para cerrar la visita"). Al cerrar se muestra el **formulario de resultado** (tarea/resultado como hoy) + notas + próxima acción.
6. Duración = `fecha_fin − fecha_inicio` (se guarda en `duracion_minutos`).

Los otros canales (llamada/whatsapp/email) **no cambian**: siguen siendo registro instantáneo sin geofence ni ciclo de vida.

---

## 8. Recordatorios push (app cerrada)

Edge Function nueva `recordar-visitas-abiertas` + cron cada 5 min (patrón igual a `enviar-alertas` + `pg_cron`):
- Busca visitas con `estado_visita='abierta'`.
- Para cada una, envía push al `ejecutivo_id`: "Tenés una visita sin cerrar en <cliente> (abierta hace Nm)".
- **Fuera de rango:** compara la última posición del ejecutivo (`ubicaciones_ejecutivos`, que `useTracking` actualiza ~cada 90s) con la ubicación del cliente de la visita abierta; si `>100m`, push más fuerte: "Te alejaste con una visita abierta — volvé al local para cerrarla".

Reutiliza `push_suscripciones` y las claves VAPID ya configuradas.

---

## 9. Puntos de diseño a resolver antes de codear

- **Visitas abandonadas:** como cerrar exige estar dentro de 100m, un ejecutivo que se va sin cerrar deja la visita "abierta" para siempre. Propuesta: (a) supervisor/admin puede **forzar cierre** desde Monitoreo/Alertas; (b) **auto-expiración** tras N horas (p. ej. 4h) marcándola `estado_visita='cerrada'` con un flag `abandonada=true` en `datos_extra` y sin resultado. Confirmar N y comportamiento.
- **Offline:** el ciclo iniciar→cerrar offline es más complejo que el insert actual. Propuesta v1: el flujo de visita **requiere conexión** para iniciar/cerrar (mostrar aviso claro si no hay señal); el offline-queue actual sigue para el resto. Confirmar si es aceptable o hay que encolar el ciclo.
- **Geofence es del lado del cliente** (GPS del navegador): no se puede forzar 100% en el servidor. El anti-fraude de Monitoreo (detección a posteriori) **se mantiene** como capa de control. La marcación guardada (`lat/lng` + accuracy) queda auditada.
- **Radio y precisión:** cerrar §4.

---

## 10. UI de carga de coordenadas (admin/supervisor)

- v1: campos `lat`/`lng` en el formulario de edición de cliente (gateado a `canManage`), para pegar coordenadas de Google Maps o de la app de terceros.
- v1+: mini-mapa Leaflet (ya instalado) para soltar el pin, y el importador masivo del §5.
- RLS: la política "Editar clientes" ya permite a managers actualizar; el auto-set de la primera visita solo escribe si `lat/lng` es NULL.

---

## 11. Fases de implementación sugeridas

1. **Datos + coordenadas:** migración `estado_visita` + índice único; UI de carga manual de lat/lng; importador desde la planilla de terceros. (Desbloquea el geofence con datos reales.)
2. **Geofence + ciclo de vida:** iniciar/cerrar en Registrar y EventoDetalle, banner global "visita en curso", medición de duración, regla de §4.
3. **Recordatorios push:** Edge Function + cron 5 min + lógica fuera de rango.
4. **Cierre de bordes:** visitas abandonadas (forzar cierre / auto-expiración), reportes de duración, ajuste fino del radio.

---

## 12. Pendiente de Alberto
- ✅ Regla de §4 (geofence): **DECIDIDA** (radio 100m + margen por precisión + asentamiento + piso 50m).
- ✅ ID del importador: **son 3 sistemas** — el número de la app de visitas es de un CRM aparte, no de SGP. Cruce en 2 saltos (por CRM-ID y luego RUC/nombre); agregar `clientes.codigo_crm` (ver §5).
- Pasar **las dos planillas** (CRM + app de visitas) en CSV/Excel para analizar el cruce real.
- Confirmar §9 (abandonadas: N horas; offline: requiere conexión ok?).
