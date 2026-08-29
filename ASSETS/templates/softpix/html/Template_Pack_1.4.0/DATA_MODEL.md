# Modelo de Datos - Apnea Control Center

Especificación del modelo de datos, entidades, ciclo de vida y esquema del estado global del sistema.

---

## 1. Estructura del Estado Global (`GET /api/all`)

El estado global del servidor (`state`) se almacena en memoria y se persiste en `data/data.json`. La estructura principal contiene:

```json
{
  "competition": { ... },
  "athletes": [ ... ],
  "sessions": [ ... ],
  "attempts": [ ... ],
  "active_broadcast": {
    "session_id": "session_1781748811656815",
    "session_ot": "09:00"
  },
  "overlay_state": { ... },
  "server_now": 1788033000000
}
```

---

## 2. Entidades

### 2.1 Competencia (`competition`)

Objeto único que contiene la configuración general y reglas de la competencia.

| Campo | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `competition_name` | String | Nombre oficial del torneo | `"AIDA BAJAU 50 APNEA COMPETITION"` |
| `competition_federation` | String | Reglamento federativo activo (`"AIDA"` o `"CMAS"`) | `"AIDA"` |
| `competition_type` | String | Entorno (`"indoor"` piscina, `"outdoor"` profundidad) | `"indoor"` |
| `disciplines` | Array\<String\> | Disciplinas habilitadas en el torneo | `["STA", "DYN", "DYNB", "DNF"]` |
| `date_start` | String | Fecha de inicio (`YYYY-MM-DD`) | `"2026-10-09"` |
| `date_end` | String | Fecha de finalización (`YYYY-MM-DD`) | `"2026-10-11"` |
| `pool_length` | Number | Largo de piscina en metros (`25` o `50`) | `25` |
| `distance_step` | Number | Intervalo de posta/lap en metros | `5` |
| `rules` | String | Alias de federación para reglas | `"AIDA"` |
| `initial_speeds` | Object | Velocidades promedio estimadas (m/s) por disciplina y género | `{ "DYN": { "M": 1.2, "F": 1.05 } }` |

---

### 2.2 Atletas (`athletes`)

Array de atletas registrados en la competencia.

| Campo | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `athlete_id` | String | ID único (`"ath_<timestamp><random>"`) | `"ath_1783000000000000"` |
| `athlete_name` | String | Nombre y apellido del atleta (mayúsculas) | `"SILVIA MAIDANA"` |
| `athlete_gender` | String | Género (`"M"` o `"F"`) | `"F"` |
| `athlete_country` | String | Código de país ISO-3 (3 letras) | `"ARG"` |
| `athlete_category` | String | Categoría competitiva | `"Senior"` |

---

### 2.3 Sesiones (`sessions`)

Jornadas o bloques de competencia por disciplina.

| Campo | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `session_id` | String | ID único (`"session_<timestamp><random>"`) | `"session_1781748811656815"` |
| `session_name` | String | Nombre descriptivo de la sesión | `"SESSION 1 - STA"` |
| `session_date` | String | Fecha de realización (`YYYY-MM-DD`) | `"2026-10-09"` |
| `session_discipline` | String | Disciplina principal de la sesión | `"STA"` |
| `lanes_count` | Number | Cantidad de andariveles/líneas operativas | `4` |
| `interval_minutes` | Number | Minutos de intervalo entre Heats / OTs | `10` |
| `status` | String | Estado de la sesión (`"scheduled"`, `"active"`, `"closed"`) | `"scheduled"` |

---

### 2.4 Intentos / Performances (`attempts`)

Registro central de cada performance programada o juzgada.

| Campo | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `attemp_id` | String | ID único (`"att_<timestamp><random>"`) | `"att_1784000000000100"` |
| `athlete_id` | String | ID del atleta asociado | `"ath_1783000000000000"` |
| `session_id` | String | ID de la sesión asignada | `"session_1781748811656815"` |
| `attemp_lane` | Number | Número de andarivel o andarivel/carril | `1` |
| `attemp_ot` | String | Official Top (hora de salida en formato `HH:MM`) | `"09:00"` |
| `attemp_discipline` | String | Disciplina del intento (`"STA"`, `"DYN"`, etc.) | `"STA"` |
| `attemp_ap` | String | Announced Performance (Anuncio oficial) | `"03:00"` (STA) o `"100"` (DYN) |
| `attemp_rp` | String | Realized Performance (Resultado alcanzado) | `"03:05"` o `"105.5"` |
| `official_result` | String | Resultado oficial final validado | `"03:05"` |
| `preliminary_result` | String | Resultado preliminar medido en tiempo real | `"03:05"` |
| `attemp_card` | String | Tarjeta asignada (`"white"`, `"yellow"`, `"red"`, `"dns"`, `""`) | `"white"` |
| `attemp_status` | String | Estado del ciclo de vida (ver tabla 3.1) | `"JUDGED"` |
| `attemp_points` | Number | Puntaje final oficial (después de deducciones) | `36.0` |
| `notes` | Array\<String\> | Lista de penalizaciones, notas de récord o razones DQ | `["UNDER AP", "EARLY START"]` |
| `camera_id` | String | Identificador de cámara asociada | `"lane_1"` |
| `locked_by` | String | ID del juez que tiene tomado el intento | `"judge_a3f91b2"` |
| `locked_at` | Number/String | Timestamp del último lock/heartbeat del juez | `1788033010000` |
| `performance_finished_at`| Number/null | Timestamp de fin de performance | `1788033050000` |
| `judge_updates` | Array\<Object\> | Historial de eventos en vivo registrados por el juez | `[ { "event_type": "START", "timestamp": "..." } ]` |

---

## 3. Ciclo de Vida y Estados

### 3.1 Estados de un Intento (`attemp_status`)

```
   [PENDING] ────► [PERFORMING] ────► [DONE] ────► [JUDGED]
       │                                              ▲
       ├──────────────────────────────────────────────┤ (DNS / DQ directo)
       ▼                                              ▼
     [DNS]                                          [DQ]
```

- **`""` o `"PENDING"`**: Programado, esperando turno de entrada al agua.
- **`"PERFORMING"`**: Atleta en curso de su performance oficial (cronómetro/metros activos).
- **`"DONE"`**: Performance concluida, en protocolo de seguridad o esperando validación del juez.
- **`"JUDGED"`**: Juzgamiento confirmado con tarjeta (`white`, `yellow`, `red`, `dns`) y puntaje oficial guardado.
- **`"DQ"`**: Descalificado (tarjeta roja).
- **`"DNS"`**: Did Not Start (no se presentó a tiempo a la salida).

---

### 3.2 Sistema de Locks de Jueces

Para evitar conflictos entre jueces:
1. Al seleccionar un intento, el juez envía `POST /api/attempts/:id/claim` con `{ judge_id }`.
2. El servidor asigna `locked_by: judge_id` y `locked_at: now`.
3. Mientras el juez mantenga la pantalla abierta, envía `POST /api/attempts/:id/heartbeat` cada 5 a 10 segundos.
4. Si pasan más de 15 segundos sin heartbeat, el lock expira y otro juez puede reclamarlo.
5. Al salir o completar el juicio, se envía release con `{ release: true }` o vía `releaseAttemptBeacon()`.

---

## 4. Sistema de Penalizaciones y Notas (`notes`)

El campo `notes` almacena un array de strings en orden canónico oficial:

- **Tarjeta Blanca (`white`)**: Notas de récord (`"NR"`, `"CR"`, `"WR"`).
- **Tarjeta Amarilla (`yellow`)**: Penalizaciones con deducción de puntos (`"UNDER AP"`, `"EARLY START"`, `"LATE START"`, `"TURN x2"`, `"START"`, `"PULL"`, `"TAG"`, `"GRAB"`, `"LANYARD"`).
- **Tarjeta Roja (`red`)**: Razones de descalificación (`"DQ BO"`, `"DQ LATE START"`, `"DQ AIRWAYS"`, `"DQ CHECK-IN"`, `"DQ TOUCH"`, `"DQ SP"`, `"DQ OTHER"`, `"DQ PULL"`).
