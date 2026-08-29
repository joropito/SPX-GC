# Especificación de API - Apnea Control Center

Guía de integración e instrucciones de uso de la API REST, SSE y la librería cliente `lib/api-client.js` de Apnea Control Center.

---

## 1. Información General y Conexión

- **Puertos por defecto**:
  - `3100`: Servidor de Gestión (`manageServer`).
  - `3200`: Servidor de Jueces (`judgeServer`, configurable vía variable de entorno `PORT`).
- **Formato de datos**: JSON (`Content-Type: application/json`).
- **CORS**: Habilitado (`Access-Control-Allow-Origin: *`) con soporte para preflight `OPTIONS`.
- **Estructura de respuesta de error**: `{ "error": "Mensaje descriptivo" }`.
- **Ruta estática de la librería cliente**: `/lib/api-client.js` (servida directamente por ambos puertos).

---

## 2. Librería Cliente JS (`lib/api-client.js`)

Módulo ES6 que encapsula todas las llamadas REST, SSE y sendBeacon en funciones asíncronas reutilizables.

### 2.1 Importación

```javascript
import * as ApiClient from '/lib/api-client.js';
```

### 2.2 Formato de Retorno Estándar

Todas las funciones que ejecutan llamadas HTTP retornan una promesa con el siguiente formato:

```javascript
{
  ok: boolean,      // true si status HTTP está entre 200 y 299
  status: number,   // Código HTTP (200, 201, 404, 409, 0 si hay error de red)
  data: any         // Cuerpo JSON de respuesta o null
}
```

### 2.3 Catálogo Completo de Métodos

| Método | Endpoint HTTP | Descripción | Parámetros |
|---|---|---|---|
| `fetchAll()` | `GET /api/all` | Obtiene el estado completo de la BD | Ninguno |
| `connectSSE()` | `GET /api/events` | Retorna una instancia `EventSource` conectada | Ninguno |
| `resetDatabase()` | `POST /api/db/reset` | Vacía atletas, sesiones e intentos | Ninguno |
| `getCompetition()` | `GET /api/competition` | Obtiene la configuración del torneo | Ninguno |
| `updateCompetition(payload)` | `POST /api/competition` | Actualiza configuración del torneo | `payload` (Object) |
| `getAthletes()` | `GET /api/athletes` | Lista todos los atletas | Ninguno |
| `createAthlete(payload)` | `POST /api/athletes` | Crea un nuevo atleta | `payload` (Object) |
| `updateAthlete(id, payload)` | `PUT /api/athletes/:id` | Actualiza un atleta existente | `id` (String), `payload` (Object) |
| `deleteAthlete(id)` | `DELETE /api/athletes/:id` | Elimina un atleta y sus intentos | `id` (String) |
| `getSessions()` | `GET /api/sessions` | Lista todas las sesiones | Ninguno |
| `createSession(payload)` | `POST /api/sessions` | Crea una nueva sesión | `payload` (Object) |
| `updateSession(id, payload)` | `PUT /api/sessions/:id` | Actualiza una sesión existente | `id` (String), `payload` (Object) |
| `deleteSession(id)` | `DELETE /api/sessions/:id` | Elimina sesión y sus intentos | `id` (String) |
| `getAttempts(params)` | `GET /api/attempts` | Lista intentos (con filtros opcionales) | `params` (Object opcional) |
| `createAttempt(payload)` | `POST /api/attempts` | Crea un nuevo intento | `payload` (Object) |
| `updateAttempt(id, payload)` | `PUT /api/attempts/:id` | Actualiza datos de un intento | `id` (String), `payload` (Object) |
| `deleteAttempt(id)` | `DELETE /api/attempts/:id` | Elimina un intento | `id` (String) |
| `startAttempt(id, timestamp)` | `POST /api/attempts/:id/start` | Marca intento como `PERFORMING` | `id` (String), `timestamp` (Number/null) |
| `claimAttempt(id, payload)` | `POST /api/attempts/:id/claim` | Toma o libera el lock del juez | `id` (String), `payload` (`{ judge_id, force?, release? }`) |
| `sendAttemptHeartbeat(id, judgeId)`| `POST /api/attempts/:id/heartbeat`| Renueva el lock del juez | `id` (String), `judgeId` (String) |
| `sendAttemptLiveEvent(id, payload)`| `POST /api/attempts/:id/live` | Envía evento en vivo (`LAP`, `PRESTOP`, etc.) | `id` (String), `payload` (Object) |
| `setAttemptCard(id, card)` | `POST /api/attempts/:id/card` | Asigna tarjeta (`"white"`, `"yellow"`, `"red"`) | `id` (String), `card` (String) |
| `saveAttemptResult(id, payload)` | `POST /api/attempts/:id/result` | Guarda resultado y puntaje oficial | `id` (String), `payload` (Object) |
| `resetAttempt(id)` | `POST /api/attempts/:id/reset` | Resetea estado y resultados de un intento | `id` (String) |
| `resetAllAttempts()` | `POST /api/attempts/reset-all` | Resetea el estado de todos los intentos | Ninguno |
| `releaseAttemptBeacon(id, judgeId)`| `sendBeacon /api/attempts/:id/claim` | Libera lock en `pagehide` (fire-and-forget) | `id` (String), `judgeId` (String) |
| `getBroadcast()` | `GET /api/broadcast` | Obtiene sesión y heat activos | Ninguno |
| `updateBroadcast(payload)` | `POST /api/broadcast` | Actualiza sesión o heat activos | `payload` (`{ session_id?, session_ot? }`) |

---

## 3. Server-Sent Events (SSE) y Estado Global

### 3.1 Conexión SSE en tiempo real
- **Ruta**: `GET /api/events`
- **Uso con la librería**:
```javascript
const sse = ApiClient.connectSSE();
sse.onmessage = (e) => {
    if (e.data === 'update') {
        // Recargar datos con ApiClient.fetchAll()
    }
};
```
- **Eventos emitidos**:
  - `data: connected\n\n` al conectar.
  - `data: update\n\n` tras cada escritura en la base de datos.

### 3.2 Obtención de Estado Completo
- **Ruta**: `GET /api/all`
- **Uso con la librería**:
```javascript
const { ok, data } = await ApiClient.fetchAll();
if (ok) {
    console.log("Atletas:", data.athletes);
    console.log("Intentos:", data.attempts);
    console.log("Timestamp servidor:", data.server_now);
}
```

### 3.3 Reinicio de Base de Datos
- **Ruta**: `POST /api/db/reset`
- **Uso con la librería**:
```javascript
const res = await ApiClient.resetDatabase();
```

---

## 4. Competencia (`/api/competition`)

### 4.1 Obtener configuración
- **Ruta**: `GET /api/competition`
- **Uso**: `const { ok, data } = await ApiClient.getCompetition();`

### 4.2 Actualizar configuración
- **Ruta**: `POST /api/competition` o `PUT /api/competition`
- **Uso**: `await ApiClient.updateCompetition({ competition_name: "Torneo 2026", federation: "AIDA" });`

---

## 5. Atletas (`/api/athletes`)

### 5.1 Listar atletas
- **Ruta**: `GET /api/athletes`
- **Uso**: `const { data: athletes } = await ApiClient.getAthletes();`

### 5.2 Crear atleta
- **Ruta**: `POST /api/athletes`
- **Uso**:
```javascript
const res = await ApiClient.createAthlete({
    athlete_name: "JUAN PEREZ",
    athlete_gender: "M",
    athlete_country: "ARG"
});
```

### 5.3 Actualizar atleta
- **Ruta**: `PUT /api/athletes/:id`
- **Uso**: `await ApiClient.updateAthlete("ath_123", { athlete_country: "BRA" });`

### 5.4 Eliminar atleta
- **Ruta**: `DELETE /api/athletes/:id`
- **Uso**: `await ApiClient.deleteAthlete("ath_123");`

---

## 6. Sesiones (`/api/sessions`)

### 6.1 Listar sesiones
- **Ruta**: `GET /api/sessions`
- **Uso**: `const { data: sessions } = await ApiClient.getSessions();`

### 6.2 Crear sesión
- **Ruta**: `POST /api/sessions`
- **Uso**:
```javascript
await ApiClient.createSession({
    session_name: "SESSION 1 - STA",
    session_date: "2026-10-09",
    session_discipline: "STA",
    lanes_count: 4,
    interval_minutes: 10
});
```

### 6.3 Actualizar sesión
- **Ruta**: `PUT /api/sessions/:id`
- **Uso**: `await ApiClient.updateSession("session_123", { lanes_count: 5 });`

### 6.4 Eliminar sesión
- **Ruta**: `DELETE /api/sessions/:id`
- **Uso**: `await ApiClient.deleteSession("session_123");`

---

## 7. Intentos / Performances (`/api/attempts`)

### 7.1 Listar intentos
- **Ruta**: `GET /api/attempts`
- **Filtros opcionales query**: `?session_id=...&lane=...&ot=...`
- **Uso**: `const { data: attempts } = await ApiClient.getAttempts({ session_id: "session_123" });`

### 7.2 Crear intento
- **Ruta**: `POST /api/attempts`
- **Uso**:
```javascript
await ApiClient.createAttempt({
    athlete_id: "ath_123",
    session_id: "session_123",
    attemp_lane: 1,
    attemp_ot: "09:00",
    attemp_discipline: "STA",
    attemp_ap: "03:00"
});
```

### 7.3 Actualizar intento
- **Ruta**: `PUT /api/attempts/:id`
- **Uso**: `await ApiClient.updateAttempt("att_123", { attemp_ap: "03:30" });`

### 7.4 Iniciar intento (Start)
- **Ruta**: `POST /api/attempts/:id/start`
- **Uso**: `await ApiClient.startAttempt("att_123", Date.now());`

### 7.5 Bloquear / Reclamar intento (Claim / Heartbeat)
- **Claim / Bloqueo**:
```javascript
const claim = await ApiClient.claimAttempt("att_123", { judge_id: "judge_1" });
if (!claim.ok) console.warn("Intento ocupado por otro juez");
```
- **Heartbeat periódico (cada 5-10s)**:
```javascript
await ApiClient.sendAttemptHeartbeat("att_123", "judge_1");
```
- **Liberación normal**:
```javascript
await ApiClient.claimAttempt("att_123", { judge_id: "judge_1", release: true, force: true });
```
- **Liberación en `pagehide`**:
```javascript
window.addEventListener('pagehide', () => {
    ApiClient.releaseAttemptBeacon("att_123", "judge_1");
});
```

### 7.6 Enviar eventos en vivo de juzgamiento
- **Ruta**: `POST /api/attempts/:id/live`
- **Uso**:
```javascript
await ApiClient.sendAttemptLiveEvent("att_123", {
    event_type: "LAP",
    timestamp: Date.now(),
    preliminary_result: "50 m"
});
```

### 7.7 Guardar resultado oficial
- **Ruta**: `POST /api/attempts/:id/result`
- **Uso**:
```javascript
await ApiClient.saveAttemptResult("att_123", {
    attemp_rp: "03:05",
    official_result: "03:05",
    attemp_status: "JUDGED",
    attemp_points: 37.0,
    attemp_card: "white",
    notes: ["NR"]
});
```

### 7.8 Resetear intentos
- **Reset individual**: `await ApiClient.resetAttempt("att_123");`
- **Reset masivo**: `await ApiClient.resetAllAttempts();`

---

## 8. Broadcast y System Control (`/api/broadcast`)

- **Obtener activo**: `const { data } = await ApiClient.getBroadcast();`
- **Actualizar sesión o heat activo**:
```javascript
await ApiClient.updateBroadcast({
    session_id: "session_1781748811656815",
    session_ot: "09:00"
});
```
