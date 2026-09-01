/**
 * apnea-helpers.js
 * Funciones utilitarias compartidas para templates de transmisión SPX de Apnea.
 */

// Obtener Host de la API de forma centralizada y segura
function getApiBaseUrl() {
    try {
        const spxEl = (typeof document !== 'undefined') ? document.getElementById('_API_HOST') : null;
        const spxHost = spxEl ? spxEl.innerText.trim() : '';
        if (spxHost !== '') return spxHost.replace(/\/$/, '');

        if (typeof window !== 'undefined' && window.location) {
            const urlParams = new URLSearchParams(window.location.search);
            const paramHost = urlParams.get('api') || urlParams.get('host') || urlParams.get('api_host');
            if (paramHost) return paramHost.replace(/\/$/, '');

            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return `${window.location.protocol}//${window.location.hostname}:3100`;
            }
        }
    } catch (_) {}
    return "https://apnea.glamsi.com";
}

// Decodificar entidades HTML de forma segura
function htmlDecode(txt) {
    if (!txt) return '';
    try {
        var doc = new DOMParser().parseFromString(txt, "text/html");
        return doc.documentElement.textContent || '';
    } catch (_) {
        return txt;
    }
}

// Formatear segundos en m:ss (sin cero a la izquierda en minutos)
function formatSeconds(totalSec) {
    if (isNaN(totalSec) || totalSec === null || totalSec === undefined) return '0:00';
    const s = Math.max(0, Math.floor(totalSec));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Parsear formato mm:ss o segundos numéricos a segundos enteros
function parseFormattedTime(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).trim();
    if (str.includes(':')) {
        const parts = str.split(':');
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return (mins * 60) + secs;
    }
    return parseFloat(str) || 0;
}

// Formatear métrica según disciplina (Tiempo sin 0 a la izquierda para STA, Metros sin decimales para dinámicas)
function formatMetric(val, discipline) {
    if (!val || val === '-' || val === '') return '-';
    const disc = (discipline || '').toUpperCase();
    if (disc === 'STA') {
        if (typeof val === 'string') {
            const strVal = val.trim();
            if (strVal === 'DNS' || strVal === 'DQ' || strVal === 'EN CURSO') return strVal;
            if (strVal.includes(':')) {
                // Elimina 0 inicial en minutos: "03:45" -> "3:45", "00:25" -> "0:25"
                if (strVal.startsWith('0') && strVal.indexOf(':') === 2) {
                    return strVal.substring(1);
                }
                return strVal;
            }
            const sec = parseFloat(strVal);
            if (!isNaN(sec)) return formatSeconds(sec);
            return strVal;
        }
        return formatSeconds(parseFloat(val));
    }
    // Disciplinas de distancia DYN / DYNB / DNF / etc: Sin decimales
    if (typeof val === 'string' && (val === 'DNS' || val === 'DQ' || val === 'EN CURSO')) return val;
    if (typeof val === 'number') return `${Math.round(val)} m`;
    const cleanedStr = String(val).replace(/m$/i, '').trim();
    const num = parseFloat(cleanedStr);
    if (!isNaN(num)) return `${Math.round(num)} m`;
    return String(val);
}

// Mapas locales para persistencia de marcas de inicio y finalización
if (typeof window !== 'undefined') {
    if (!window.localAttemptStartMap) window.localAttemptStartMap = new Map();
    if (!window.localAttemptFinishMap) window.localAttemptFinishMap = new Map();
}
var localAttemptStartMap = (typeof window !== 'undefined') ? window.localAttemptStartMap : new Map();
var localAttemptFinishMap = (typeof window !== 'undefined') ? window.localAttemptFinishMap : new Map();

// Parsear timestamp a milisegundos de forma robusta
function parseTimestampMs(str, sessionDate) {
    if (!str && str !== 0) return 0;
    if (typeof str === 'number') return str < 10000000000 ? str * 1000 : str;
    if (typeof str === 'string') {
        const trimmed = str.trim();
        if (/^\d+$/.test(trimmed)) {
            const num = Number(trimmed);
            return num < 10000000000 ? num * 1000 : num;
        }

        const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const seconds = parseInt(timeMatch[3] || '0', 10);

            if (sessionDate && typeof sessionDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sessionDate)) {
                const dateParts = sessionDate.split(/[-T ]/);
                const y = parseInt(dateParts[0], 10);
                const m = parseInt(dateParts[1], 10) - 1;
                const d = parseInt(dateParts[2], 10);
                return new Date(y, m, d, hours, minutes, seconds, 0).getTime();
            }

            const d = sessionDate ? new Date(sessionDate) : new Date();
            d.setHours(hours, minutes, seconds, 0);
            return d.getTime();
        }

        const parsed = Date.parse(trimmed);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 0;
}

// Obtener duración de Protocolo de Superficie (SP) según reglas de la competencia
function getCompetitionSpDuration(competition) {
    if (!competition) return 15;
    if (typeof competition.sp_duration === 'number' && competition.sp_duration > 0) return competition.sp_duration;
    if (typeof competition.surface_protocol_duration === 'number' && competition.surface_protocol_duration > 0) return competition.surface_protocol_duration;
    if (typeof competition.sp_seconds === 'number' && competition.sp_seconds > 0) return competition.sp_seconds;
    
    const rules = (competition.competition_rules || competition.rules || '').toUpperCase();
    if (rules.includes('CMAS')) return 20;
    if (rules.includes('AIDA')) return 15;
    return 15;
}

// Obtener timestamp de finalización del intento con memoria local estable para SP Timer
function getAttemptFinishMs(att, nowMs, sessionDate) {
    if (!att) return nowMs || Date.now();
    const key = att.attemp_id || `lane_${att.attemp_lane || 1}`;

    let rawFinish = att.performance_finished_at || att.finished_at || att.end_time;
    if (!rawFinish && Array.isArray(att.judge_updates)) {
        const finishEv = att.judge_updates.slice().reverse().find(u => 
            ['PRESTOP', 'STOP', 'FINAL', 'SURFACE', 'DONE'].includes((u.event_type || u.type || '').toUpperCase())
        );
        if (finishEv) rawFinish = finishEv.timestamp || finishEv.time || finishEv.created_at;
    }

    let finishMs = parseTimestampMs(rawFinish, sessionDate);
    if (finishMs > 0) {
        if (!localAttemptFinishMap.has(key) || Math.abs(localAttemptFinishMap.get(key) - finishMs) > 1500) {
            localAttemptFinishMap.set(key, finishMs);
        }
        return localAttemptFinishMap.get(key);
    }

    if (!localAttemptFinishMap.has(key)) {
        localAttemptFinishMap.set(key, nowMs || Date.now());
    }
    return localAttemptFinishMap.get(key);
}

// Normalizar y extraer lista de notas y penalizaciones
function extractAttemptNotes(att) {
    if (!att) return [];

    let raw = [];
    if (att.notes !== undefined && att.notes !== null) {
        raw = att.notes;
    } else if (att.attemp_penalties !== undefined && att.attemp_penalties !== null) {
        raw = att.attemp_penalties;
    } else if (att.penalties !== undefined && att.penalties !== null) {
        raw = att.penalties;
    } else if (att.attemp_notes !== undefined && att.attemp_notes !== null) {
        raw = att.attemp_notes;
    }

    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        if (trimmed.includes(',')) raw = trimmed.split(',');
        else if (trimmed.includes(';')) raw = trimmed.split(';');
        else if (trimmed.includes(' · ')) raw = trimmed.split(' · ');
        else if (trimmed.includes(' | ')) raw = trimmed.split(' | ');
        else raw = [trimmed];
    }

    if (!Array.isArray(raw)) return [];

    const result = [];
    raw.forEach(item => {
        if (!item) return;
        if (typeof item === 'string') {
            const s = item.trim();
            if (s) result.push(s);
        } else if (typeof item === 'object') {
            const name = item.name || item.note || item.reason || item.title || item.penalty || '';
            const count = item.count || item.qty || item.quantity;
            if (name) {
                const countSuffix = (typeof count === 'number' && count > 1) ? ` x${count}` : '';
                result.push(`${name.trim()}${countSuffix}`);
            }
        }
    });

    return result;
}

// Resolver tarjeta, clases CSS y HTML de nota según el estado y tarjetas oficiales
function getAttemptCardAndNotes(att, isJudged, nowMs, competition, clockOffset, sessionDate) {
    if (!att) return { cardClass: 'card-none', noteHtml: '' };

    const key = att.attemp_id || `lane_${att.attemp_lane || 1}`;
    const card = (att.attemp_card || '').toLowerCase();
    const isPerforming = att.attemp_status === 'PERFORMING';
    const updates = Array.isArray(att.judge_updates) ? att.judge_updates : [];
    const isSpCanceledOrEnded = att.sp_canceled || att.sp_cancelled || att.sp_ended || 
                                updates.some(u => ['SP_CANCEL', 'SP_END', 'CANCEL_SP', 'END_SP', 'CANCEL'].includes((u.event_type || u.type || '').toUpperCase()));

    const isDoneOrSP = (att.attemp_status === 'DONE' || 
                        Boolean(att.performance_finished_at && !card && !isJudged) ||
                        (updates.some(u => ['PRESTOP', 'STOP', 'FINAL', 'SURFACE', 'DONE'].includes((u.event_type || u.type || '').toUpperCase())) && !card && !isJudged))
                       && !isSpCanceledOrEnded;

    let cardClass = 'card-none';
    let noteHtml = '';

    // 1. Durante la prueba (PERFORMING): columna de notas vacía
    if (isPerforming && !isJudged) {
        localAttemptFinishMap.delete(key);
        cardClass = 'card-none';
        noteHtml = '';
        return { cardClass, noteHtml };
    }

    // 2. Estado en Protocolo de Superficie (SP): cuenta regresiva de SP inicial (ej: 15) a 0
    if (isDoneOrSP && !card && !isJudged) {
        cardClass = 'card-none';
        const currentNow = nowMs || (Date.now() - (clockOffset || 0));
        const finishMs = getAttemptFinishMs(att, currentNow, sessionDate);
        const spTotalDuration = getCompetitionSpDuration(competition);
        const elapsedSpSec = Math.max(0, Math.floor((currentNow - finishMs) / 1000));
        const remainingSpSec = Math.max(0, spTotalDuration - elapsedSpSec);

        if (remainingSpSec > 0) {
            const ss = String(remainingSpSec).padStart(2, '0');
            noteHtml = `<span class="note-badge note-sp">SP ${ss}</span>`;
        } else {
            noteHtml = '';
        }
        return { cardClass, noteHtml };
    }

    // 3. Cuando tiene tarjeta o estado dictaminado (Juzgamiento realizado)
    localAttemptFinishMap.delete(key);
    localAttemptStartMap.delete(key);

    const effectiveCard = card || (att.attemp_status === 'DQ' ? 'red' : (att.attemp_status === 'DNS' ? 'dns' : (isJudged ? 'white' : '')));
    if (effectiveCard) {
        // En caso DNS no debe figurar ninguna tarjeta ni notas
        if (effectiveCard === 'dns' || att.attemp_status === 'DNS') {
            return { cardClass: 'card-none', noteHtml: '' };
        }

        cardClass = `card-${effectiveCard}`;

        const notesList = extractAttemptNotes(att);
        if (notesList.length > 0) {
            let firstNote = notesList[0];
            if (effectiveCard === 'red' || att.attemp_status === 'DQ') {
                firstNote = firstNote.replace(/^DQ\s*/i, '').trim();
            }

            const plusSuffix = notesList.length > 1 ? ' +' : '';
            const displayText = `${firstNote}${plusSuffix}`;

            // El color de la nota coincide con el color de la tarjeta
            let badgeClass = 'note-white';
            if (effectiveCard === 'red' || att.attemp_status === 'DQ') {
                badgeClass = 'note-red';
            } else if (effectiveCard === 'yellow') {
                badgeClass = 'note-yellow';
            }

            noteHtml = `<span class="note-badge ${badgeClass}" title="${htmlDecode(notesList.join(', '))}">${htmlDecode(displayText)}</span>`;
        }

        return { cardClass, noteHtml };
    }

    return { cardClass, noteHtml };
}
