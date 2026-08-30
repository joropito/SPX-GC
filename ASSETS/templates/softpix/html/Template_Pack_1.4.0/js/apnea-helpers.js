/**
 * apnea-helpers.js
 * Funciones utilitarias compartidas para templates de transmisión SPX de Apnea.
 */

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

// Formatear segundos en mm:ss
function formatSeconds(totalSec) {
    if (isNaN(totalSec) || totalSec === null || totalSec === undefined) return '00:00';
    const s = Math.max(0, Math.floor(totalSec));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

// Formatear métrica según disciplina (Tiempo para STA, Metros para dinámicas)
function formatMetric(val, discipline) {
    if (!val || val === '-' || val === '') return '-';
    const disc = (discipline || '').toUpperCase();
    if (disc === 'STA') {
        if (typeof val === 'string' && val.includes(':')) return val;
        return formatSeconds(parseFloat(val));
    }
    if (typeof val === 'number') return `${val.toFixed(2)} m`;
    const num = parseFloat(val);
    if (!isNaN(num)) return `${num.toFixed(2)} m`;
    return String(val);
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

// Obtener timestamp de finalización del intento
function getAttemptFinishMs(att, nowMs, sessionDate) {
    if (att && att.performance_finished_at) {
        let finMs = new Date(att.performance_finished_at).getTime();
        if (!isNaN(finMs)) return finMs;
        if (typeof att.performance_finished_at === 'string' && att.performance_finished_at.includes(':')) {
            const baseDate = sessionDate || new Date().toISOString().slice(0, 10);
            finMs = new Date(`${baseDate}T${att.performance_finished_at}`).getTime();
            if (!isNaN(finMs)) return finMs;
        }
    }

    if (att && Array.isArray(att.judge_updates)) {
        const stopEvt = att.judge_updates.find(u => u.event_type === 'PRESTOP' || u.event_type === 'FINAL');
        if (stopEvt && stopEvt.created_at) {
            const finMs = new Date(stopEvt.created_at).getTime();
            if (!isNaN(finMs)) return finMs;
        }
    }

    return nowMs || Date.now();
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
function getAttemptCardAndNotes(att, isJudged, nowMs, competition, clockOffset) {
    if (!att) return { cardClass: 'card-none', noteHtml: '' };

    const card = (att.attemp_card || '').toLowerCase();
    const isPerforming = att.attemp_status === 'PERFORMING';
    const updates = Array.isArray(att.judge_updates) ? att.judge_updates : [];
    const isSpCanceledOrEnded = att.sp_canceled || att.sp_cancelled || att.sp_ended || 
                                updates.some(u => ['SP_CANCEL', 'SP_END', 'CANCEL_SP', 'END_SP', 'CANCEL'].includes((u.event_type || u.type || '').toUpperCase()));

    const isDoneOrSP = (att.attemp_status === 'DONE' || 
                        Boolean(att.performance_finished_at && !card && !isJudged) ||
                        (updates.some(u => u.event_type === 'PRESTOP' || u.event_type === 'FINAL') && !card && !isJudged))
                       && !isSpCanceledOrEnded;

    let cardClass = 'card-none';
    let noteHtml = '';

    // 1. Durante la prueba (PERFORMING): se muestra "PRELIM." en la columna NOTES
    if (isPerforming && !isJudged) {
        cardClass = 'card-none';
        noteHtml = '<span class="note-badge note-prelim">PRELIM.</span>';
        return { cardClass, noteHtml };
    }

    // 2. Estado en Protocolo de Superficie (SP): cuenta regresiva de SP inicial (ej: 15) a 0
    if (isDoneOrSP && !card && !isJudged) {
        cardClass = 'card-none';
        const currentNow = nowMs || (Date.now() - (clockOffset || 0));
        const finishMs = getAttemptFinishMs(att, currentNow);
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
