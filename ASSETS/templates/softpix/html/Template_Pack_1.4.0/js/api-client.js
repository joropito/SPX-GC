/**
 * Librería centralizada de cliente API para Apnea Control Center.
 * Encapsula todos los endpoints REST, SSE y sendBeacon en funciones reutilizables.
 */

const API_BASE = '/api';

// --- Helper interno de peticiones HTTP ---

/**
 * Ejecuta una petición HTTP JSON al servidor.
 * @param {string} url - URL del endpoint
 * @param {string} method - Método HTTP
 * @param {object|null} payload - Cuerpo de la petición (null = sin body)
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function _request(url, method, payload = null) {
    try {
        const config = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (payload) config.body = JSON.stringify(payload);
        const res = await fetch(url, config);
        let data = null;
        try {
            data = await res.json();
        } catch (_) {}
        return { ok: res.ok, status: res.status, data };
    } catch (e) {
        console.error('ApiClient: error de red:', e);
        return { ok: false, status: 0, data: null };
    }
}

// =============================================
// Estado global y conexión
// =============================================

/** Obtiene el estado completo de la base de datos. GET /api/all */
export async function fetchAll() {
    return _request(`${API_BASE}/all`, 'GET');
}

/**
 * Crea y devuelve un EventSource conectado al canal SSE.
 * @returns {EventSource}
 */
export function connectSSE() {
    return new EventSource(`${API_BASE}/events`);
}

/** Reinicia la base de datos (borra atletas, sesiones, intentos). POST /api/db/reset */
export async function resetDatabase() {
    return _request(`${API_BASE}/db/reset`, 'POST', {});
}

// =============================================
// Competencia
// =============================================

/** Obtiene la configuración de la competencia. GET /api/competition */
export async function getCompetition() {
    return _request(`${API_BASE}/competition`, 'GET');
}

/** Actualiza la configuración de la competencia. POST /api/competition */
export async function updateCompetition(payload) {
    return _request(`${API_BASE}/competition`, 'POST', payload);
}

/**
 * Obtiene la duración inicial en segundos del Protocolo de Superficie (SP) según las reglas o configuración de la competencia.
 * @param {object} competition - Objeto de configuración de la competencia
 * @returns {number} Duración del SP en segundos (por defecto 15 para AIDA, 20 para CMAS o valor personalizado)
 */
export function getCompetitionSpDuration(competition) {
    if (!competition) return 15;
    if (typeof competition.sp_duration === 'number' && competition.sp_duration > 0) return competition.sp_duration;
    if (typeof competition.surface_protocol_duration === 'number' && competition.surface_protocol_duration > 0) return competition.surface_protocol_duration;
    if (typeof competition.sp_seconds === 'number' && competition.sp_seconds > 0) return competition.sp_seconds;
    if (competition.sp_duration && !isNaN(parseInt(competition.sp_duration, 10))) return parseInt(competition.sp_duration, 10);

    const fed = (competition.competition_federation || competition.rules || 'AIDA').trim().toUpperCase();
    if (fed === 'CMAS') return 20;
    return 15;
}

// =============================================
// Atletas
// =============================================

/** Lista todos los atletas. GET /api/athletes */
export async function getAthletes() {
    return _request(`${API_BASE}/athletes`, 'GET');
}

/** Crea un atleta. POST /api/athletes */
export async function createAthlete(payload) {
    return _request(`${API_BASE}/athletes`, 'POST', payload);
}

/** Actualiza un atleta. PUT /api/athletes/:id */
export async function updateAthlete(id, payload) {
    return _request(`${API_BASE}/athletes/${id}`, 'PUT', payload);
}

/** Elimina un atleta y sus intentos asociados. DELETE /api/athletes/:id */
export async function deleteAthlete(id) {
    return _request(`${API_BASE}/athletes/${id}`, 'DELETE');
}

// =============================================
// Sesiones
// =============================================

/** Lista todas las sesiones. GET /api/sessions */
export async function getSessions() {
    return _request(`${API_BASE}/sessions`, 'GET');
}

/** Crea una sesión. POST /api/sessions */
export async function createSession(payload) {
    return _request(`${API_BASE}/sessions`, 'POST', payload);
}

/** Actualiza una sesión. PUT /api/sessions/:id */
export async function updateSession(id, payload) {
    return _request(`${API_BASE}/sessions/${id}`, 'PUT', payload);
}

/** Elimina una sesión y sus intentos asociados. DELETE /api/sessions/:id */
export async function deleteSession(id) {
    return _request(`${API_BASE}/sessions/${id}`, 'DELETE');
}

// =============================================
// Intentos / Performances
// =============================================

/** Lista intentos con filtros opcionales. GET /api/attempts */
export async function getAttempts(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_BASE}/attempts?${query}` : `${API_BASE}/attempts`;
    return _request(url, 'GET');
}

/** Crea un intento. POST /api/attempts */
export async function createAttempt(payload) {
    return _request(`${API_BASE}/attempts`, 'POST', payload);
}

/** Actualiza un intento. PUT /api/attempts/:id */
export async function updateAttempt(id, payload) {
    return _request(`${API_BASE}/attempts/${id}`, 'PUT', payload);
}

/** Elimina un intento. DELETE /api/attempts/:id */
export async function deleteAttempt(id) {
    return _request(`${API_BASE}/attempts/${id}`, 'DELETE');
}

/** Inicia un intento (marca PERFORMING). POST /api/attempts/:id/start */
export async function startAttempt(id, timestamp = null) {
    const payload = timestamp ? { timestamp } : {};
    return _request(`${API_BASE}/attempts/${id}/start`, 'POST', payload);
}

/**
 * Toma o libera el lock de un intento por un juez. POST /api/attempts/:id/claim
 * @param {string} id - ID del intento
 * @param {object} payload - { judge_id, force?, release? }
 */
export async function claimAttempt(id, payload) {
    return _request(`${API_BASE}/attempts/${id}/claim`, 'POST', payload);
}

/** Envía heartbeat de renovación de lock. POST /api/attempts/:id/heartbeat */
export async function sendAttemptHeartbeat(id, judgeId) {
    return _request(`${API_BASE}/attempts/${id}/heartbeat`, 'POST', { judge_id: judgeId });
}

/**
 * Envía evento en vivo de juzgamiento. POST /api/attempts/:id/live
 * @param {string} id - ID del intento
 * @param {object} payload - { event_type, timestamp, ... }
 */
export async function sendAttemptLiveEvent(id, payload) {
    return _request(`${API_BASE}/attempts/${id}/live`, 'POST', payload);
}

/** Asigna tarjeta a un intento. POST /api/attempts/:id/card */
export async function setAttemptCard(id, card) {
    return _request(`${API_BASE}/attempts/${id}/card`, 'POST', { card });
}

/** Guarda resultado oficial de un intento. POST /api/attempts/:id/result */
export async function saveAttemptResult(id, payload) {
    return _request(`${API_BASE}/attempts/${id}/result`, 'POST', payload);
}

/** Resetea un intento individual. POST /api/attempts/:id/reset */
export async function resetAttempt(id) {
    return _request(`${API_BASE}/attempts/${id}/reset`, 'POST', {});
}

/** Resetea el estado de todos los intentos. POST /api/attempts/reset-all */
export async function resetAllAttempts() {
    return _request(`${API_BASE}/attempts/reset-all`, 'POST', {});
}

/**
 * Libera el lock de un intento usando sendBeacon (para pagehide).
 * No devuelve respuesta (fire-and-forget).
 * @param {string} id - ID del intento
 * @param {string} judgeId - ID del juez
 */
export function releaseAttemptBeacon(id, judgeId) {
    if (navigator.sendBeacon) {
        const payload = JSON.stringify({ judge_id: judgeId, release: true, force: true });
        navigator.sendBeacon(
            `${API_BASE}/attempts/${id}/claim`,
            new Blob([payload], { type: 'application/json' })
        );
    }
}

// =============================================
// Broadcast / System Control
// =============================================

/** Obtiene la sesión y heat activos. GET /api/broadcast */
export async function getBroadcast() {
    return _request(`${API_BASE}/broadcast`, 'GET');
}

/** Actualiza la sesión o heat activos. POST /api/broadcast */
export async function updateBroadcast(payload) {
    return _request(`${API_BASE}/broadcast`, 'POST', payload);
}

// =============================================
// Estimación de Distancia Dinámica en Vivo
// =============================================

const liveTrackers = new Map();

/**
 * Obtiene velocidad inicial e intervalo de posta según configuración de la competencia.
 * @param {object} attempt - Objeto del intento
 * @param {object} competition - Configuración de la competencia
 * @returns {{ initialV: number, intervaloPosta: number }}
 */
function getCompetitionParams(attempt, competition) {
    const disc = (attempt ? (attempt.attemp_discipline || '') : '').trim().toUpperCase();
    const compSpeeds = (competition && competition.initial_speeds) ? competition.initial_speeds : {};
    const gender = (attempt && (attempt.athlete_gender || attempt.gender) ? (attempt.athlete_gender || attempt.gender) : 'M').trim().toUpperCase();

    let initialV = 1.0;
    if (compSpeeds[disc] !== undefined) {
        if (typeof compSpeeds[disc] === 'object' && compSpeeds[disc] !== null) {
            const speedByGender = compSpeeds[disc][gender] || compSpeeds[disc].M || compSpeeds[disc].default;
            if (speedByGender !== undefined && !isNaN(parseFloat(speedByGender))) {
                initialV = parseFloat(speedByGender);
            }
        } else if (!isNaN(parseFloat(compSpeeds[disc]))) {
            initialV = parseFloat(compSpeeds[disc]);
        }
    } else if (compSpeeds.default !== undefined && !isNaN(parseFloat(compSpeeds.default))) {
        initialV = parseFloat(compSpeeds.default);
    } else {
        // Fallback por defecto según disciplina
        if (disc === 'DNF') initialV = 0.95;
        else if (disc === 'DYNB') initialV = 1.05;
        else if (disc === 'DYN') initialV = 1.15;
    }

    const intervaloPosta = (competition && competition.distance_step && !isNaN(parseFloat(competition.distance_step)))
        ? parseFloat(competition.distance_step)
        : 5;

    return { initialV, intervaloPosta };
}

/**
 * Calcula la distancia estimada matemática pura en un instante exacto.
 * @param {object} attempt - Objeto del intento
 * @param {object} competition - Configuración de la competencia
 * @param {number} targetTimeMs - Timestamp objetivo en ms
 * @returns {number} Distancia en metros redondeada hacia abajo
 */
export function calculatePureDistance(attempt, competition, targetTimeMs) {
    if (!attempt) return 0;
    const { initialV, intervaloPosta } = getCompetitionParams(attempt, competition);
    let updates = (attempt.judge_updates || []).filter(u => new Date(u.timestamp).getTime() <= targetTimeMs);
    let startEvent = updates.find(u => u.event_type === 'START');

    if (!startEvent && (attempt.started_at || attempt.start_time || attempt.start_timestamp || attempt.timestamp)) {
        startEvent = {
            event_type: 'START',
            timestamp: attempt.started_at || attempt.start_time || attempt.start_timestamp || attempt.timestamp
        };
        updates.unshift(startEvent);
    }

    if (!startEvent) return 0;

    let D_base = 0;
    let T_base = new Date(startEvent.timestamp).getTime();
    let V_actual = initialV;

    const splits = updates
        .filter(u => u.event_type === 'LAP')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const split of splits) {
        const T_real = new Date(split.timestamp).getTime();
        const deltaT_split = Math.max(0.1, (T_real - T_base) / 1000);

        let D_estimada_al_click = D_base + (V_actual * deltaT_split);
        let postaMasCercana = Math.round(D_estimada_al_click / intervaloPosta) * intervaloPosta;

        if (postaMasCercana <= D_base) {
            postaMasCercana = D_base + intervaloPosta;
        }

        const deltaD_split = postaMasCercana - D_base;
        const velocidadCalculada = deltaD_split / deltaT_split;

        const VELOCIDAD_CAP = 2.0;
        const VELOCIDAD_MISCLICK = 4.0;

        if (velocidadCalculada < VELOCIDAD_MISCLICK) {
            if (deltaT_split > 0 && deltaD_split > 0) {
                V_actual = Math.max(0.2, Math.min(velocidadCalculada, VELOCIDAD_CAP));
            }
            D_base = postaMasCercana;
            T_base = T_real;
        }
    }

    const rawDeltaT = Math.max(0, (targetTimeMs - T_base) / 1000);
    let D_final = D_base + (V_actual * rawDeltaT);

    const maximoPermitido = D_base + (intervaloPosta * 3) - 0.01;
    if (D_final > maximoPermitido) {
        D_final = maximoPermitido;
    }

    return Math.floor(D_final);
}

/**
 * Calcula la distancia estimada en vivo en tiempo real con suavizado continuo.
 * @param {object} attempt - Objeto del intento
 * @param {object} competition - Configuración de la competencia
 * @param {number} [nowMs=Date.now()] - Timestamp actual en ms
 * @param {boolean} [useSmoothing=true] - Aplica interpolación y suavizado de postas
 * @returns {number} Distancia estimada en metros
 */
export function calculateLiveDynamicDistance(attempt, competition, nowMs = Date.now(), useSmoothing = true) {
    if (!attempt || !attempt.attemp_id) return 0;
    const attemptId = attempt.attemp_id;
    let updates = Array.isArray(attempt.judge_updates) ? [...attempt.judge_updates] : [];
    let startEvent = updates.find(u => u.event_type === 'START');

    if (!startEvent && (attempt.started_at || attempt.start_time || attempt.start_timestamp || attempt.timestamp)) {
        startEvent = {
            event_type: 'START',
            timestamp: attempt.started_at || attempt.start_time || attempt.start_timestamp || attempt.timestamp
        };
        updates.unshift(startEvent);
    }

    if (updates.length === 0 || !startEvent) {
        if (liveTrackers.has(attemptId)) liveTrackers.delete(attemptId);
        return 0;
    }

    const stopEvent = updates.slice().reverse().find(u => u.event_type === 'PRESTOP' || u.event_type === 'FINAL');
    if (stopEvent) {
        if (liveTrackers.has(attemptId)) liveTrackers.delete(attemptId);
        return calculatePureDistance(attempt, competition, new Date(stopEvent.timestamp).getTime());
    }

    if (!useSmoothing) {
        return calculatePureDistance(attempt, competition, nowMs);
    }

    const { initialV, intervaloPosta } = getCompetitionParams(attempt, competition);
    const splits = updates
        .filter(u => u.event_type === 'LAP')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let tracker = liveTrackers.get(attemptId);

    if (tracker && tracker.originalStartTimestamp !== startEvent.timestamp) {
        liveTrackers.delete(attemptId);
        tracker = undefined;
    }

    if (!tracker) {
        tracker = {
            originalStartTimestamp: startEvent.timestamp,
            D_base: 0,
            T_base: new Date(startEvent.timestamp).getTime(),
            V_actual: initialV,
            D_actual: 0,
            OffsetCorreccion: 0,
            lastSplitTimestamp: startEvent.timestamp,
            isNewSplitTick: false,
            maxDeltaT: 0,
            hasCustomSpeed: false
        };
        liveTrackers.set(attemptId, tracker);
    }

    const latestSplit = splits.length > 0 ? splits[splits.length - 1] : startEvent;

    if (tracker.lastSplitTimestamp !== latestSplit.timestamp) {
        const T_real = new Date(latestSplit.timestamp).getTime();
        const deltaT_total = Math.max(0.1, (T_real - tracker.T_base) / 1000);

        let D_estimada_al_click = tracker.D_base + (tracker.V_actual * deltaT_total);
        let postaObjetivo = Math.round(D_estimada_al_click / intervaloPosta) * intervaloPosta;

        if (postaObjetivo <= tracker.D_base) {
            postaObjetivo = tracker.D_base + intervaloPosta;
        }

        const postasTotalesSaltadas = Math.round((postaObjetivo - tracker.D_base) / intervaloPosta);

        if (postasTotalesSaltadas > 1) {
            tracker.D_base = postaObjetivo;
            tracker.T_base = T_real;
        } else {
            const deltaD_split = postaObjetivo - tracker.D_base;
            let velocidadCalculada = deltaD_split / deltaT_total;
            const VELOCIDAD_CAP = 2.0;
            const VELOCIDAD_MISCLICK = 4.0;

            if (velocidadCalculada < VELOCIDAD_MISCLICK) {
                if (deltaT_total > 0 && deltaD_split > 0) {
                    tracker.V_actual = Math.max(0.2, Math.min(velocidadCalculada, VELOCIDAD_CAP));
                    tracker.hasCustomSpeed = true;
                }
                tracker.OffsetCorreccion = tracker.D_actual - postaObjetivo;
                tracker.D_base = postaObjetivo;
                tracker.T_base = T_real;
            }
        }

        tracker.lastSplitTimestamp = latestSplit.timestamp;
        tracker.isNewSplitTick = true;
        tracker.maxDeltaT = 0;
    }

    const rawDeltaT = Math.max(0, (nowMs - tracker.T_base) / 1000);
    tracker.maxDeltaT = Math.max(tracker.maxDeltaT, rawDeltaT);

    let D_ideal = tracker.D_base + (tracker.V_actual * tracker.maxDeltaT);

    const maximoPermitido = tracker.D_base + (intervaloPosta * 3) - 0.01;
    if (D_ideal > maximoPermitido) {
        D_ideal = maximoPermitido;
    }

    const D_actual_prev = tracker.D_actual;
    let D_calculado = D_ideal + tracker.OffsetCorreccion;

    if (D_calculado < D_actual_prev && !tracker.isNewSplitTick) {
        D_calculado = D_actual_prev;
    }

    tracker.D_actual = D_calculado;

    if (!tracker.isNewSplitTick) {
        tracker.OffsetCorreccion *= 0.85;
    } else {
        tracker.isNewSplitTick = false;
    }

    if (Math.abs(tracker.OffsetCorreccion) < 0.01) tracker.OffsetCorreccion = 0;

    return Math.floor(tracker.D_actual);
}
