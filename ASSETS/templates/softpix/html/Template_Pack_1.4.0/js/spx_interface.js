// ----------------------------------------------------------------
// (c) Copyright 2021- SPX Graphics (https://spxgraphics.com)
// ----------------------------------------------------------------

// Estado interno global de reproducción del template
window.SPX_STATE = 'STOPPED'; // 'STOPPED' | 'PLAYING' | 'STOPPING'
window.SPX_STOP_SAFETY_TIMER = null;

window.spxGetState = function() {
  return window.SPX_STATE || 'STOPPED';
};

window.spxIsPlaying = function() {
  return window.SPX_STATE === 'PLAYING';
};

window.spxIsStopped = function() {
  return window.SPX_STATE === 'STOPPED';
};

window.spxSetState = function(newState) {
  window.SPX_STATE = newState;
  if (newState === 'STOPPED' && window.SPX_STOP_SAFETY_TIMER) {
    clearTimeout(window.SPX_STOP_SAFETY_TIMER);
    window.SPX_STOP_SAFETY_TIMER = null;
  }
};

// Receive item data from SPX Graphics Controller
// and store values in hidden DOM elements for
// use in the template.

function update(data) {
  // console.log('----- Update handler called.')
  var templateData = JSON.parse(data);
  window.SPX_TEMPLATE_DATA = templateData;
  if (templateData.epochID || templateData.epoch) {
    window.SPX_EPOCH = templateData.epochID || templateData.epoch;
  }
  if (templateData.datafile) {
    window.SPX_DATAFILE = templateData.datafile;
  }

  for (var dataField in templateData) {
    var idField = document.getElementById(dataField);
    if (idField) {
      let fString = templateData[dataField];
      if ( fString != 'undefined' && fString != 'null' ) {
        idField.innerText = fString
      } else {
        idField.innerText = '';
      }
    } else {
      switch (dataField) {
        case 'comment':
        case 'epochID':
        case 'epoch':
        case 'datafile':
          // console.warn('FYI: Optional #' + dataField + ' missing from SPX template...');
          break;
        default:
          console.error('ERROR Placeholder #' + dataField + ' missing from SPX template.');
      }
    }
  }

  // Marcar como PLAYING antes de ejecutar el update
  window.spxSetState('PLAYING');

  if (typeof runTemplateUpdate === "function") { 
    runTemplateUpdate() // Play will follow
  } else {
    console.error('runTemplateUpdate() function missing from SPX template.')
  }
}

// Play handler
function play() {
  // console.log('----- Play handler called.')
  window.spxSetState('PLAYING');
  if (typeof runAnimationIN === "function") { 
    runAnimationIN();
  }
}

// Stop handler con protección contra ejecuciones repetidas
function stop() {
  // Si ya está detenido o en proceso de detención, ignorar comandos repetidos
  if (window.SPX_STATE === 'STOPPED' || window.SPX_STATE === 'STOPPING') {
    // console.warn('[SPX] stop() ignorado: el template ya está ' + window.SPX_STATE);
    return;
  }

  window.spxSetState('STOPPING');

  // Temporizador de seguridad: si la plantilla no reporta STOPPED en 1.5s, forzar STOPPED
  if (window.SPX_STOP_SAFETY_TIMER) clearTimeout(window.SPX_STOP_SAFETY_TIMER);
  window.SPX_STOP_SAFETY_TIMER = setTimeout(function() {
    window.spxSetState('STOPPED');
  }, 1500);

  if (typeof runAnimationOUT === "function") { 
    runAnimationOUT();
  } else {
    console.error('runAnimationOUT() function missing from SPX template.');
    window.spxSetState('STOPPED');
  }
}

// Continue handler
function next(data) {
  // console.log('----- Next handler called.')
  if (typeof runAnimationNEXT === "function") { 
    runAnimationNEXT()
  } else {
    console.error('runAnimationNEXT() function missing from SPX template.')
  }
}

// Encoded text to HTML
function htmlDecode(txt) {
  var doc = new DOMParser().parseFromString(txt, "text/html");
  return doc.documentElement.textContent;
}

// Utility function
function e(elementID) {
  if (!elementID) {
    console.warn('Element ID is falsy, returning null.');
    return null;
  }
  if (!document.getElementById(elementID)) {
    console.warn('Element ' + elementID + ' not found, returning null.');
    return null;
  }
  return document.getElementById(elementID);
}

window.onerror = function (msg, url, row, col, error) {
  let err = {};
  err.file = url;
  err.message = msg;
  err.line = row;
  console.log('%c' + 'SPX Template Error Detected:', 'font-weight:bold; font-size: 1.2em; margin-top: 2em;');
  console.table(err);
  // spxlog('Template Error Auto Detected: file: ' + url + ', line: ' + row + ', msg; ' + msg,'WARN')
};

function validString(str) {
  let S = str.toUpperCase();
  // console.log('checking validString(' + S +');');
  switch (S) {
    case "UNDEFINED":
    case "NULL":
    case "":
      return false  // not a valid string
      break;
  }
  return true; // is a valid string
}


