# Plan de Trabajo y Especificación de Overlays Gráficos
## Apnea Control Center + SPX Graphics Controller

Este documento define la arquitectura, la taxonomía de overlays gráficos, las mejores prácticas de desarrollo y el plan de trabajo por fases para la creación de plantillas gráficas (*broadcast overlays*) en el proyecto.

---

## 1. Contexto y Arquitectura General

El sistema gráfico opera mediante la combinación de dos subsistemas principales:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SPX GRAPHICS CONTROLLER                         │
│  - Operador de transmisión (UI de control, escaletas y capas)          │
│  - Interfaz bidireccional JS: `js/spx_interface.js`                    │
│  - Metadatos de plantilla: `window.SPXGCTemplateDefinition`            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Controles (Play, Stop, Next, Update)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          HTML5 OVERLAY LAYER                           │
│  - Render en navegador (OBS Browser Source / CasparCG / vMix)          │
│  - Motor de Animación: Anime.js / CSS Animations / Lottie              │
│  - Sistema de Estilos: Temas dinámicos (`themes/*.css`, `styles.css`)  │
│  - Formato de banderas: ISO-3 (`css/flag-icon.css`)                    │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ Consultas REST y Eventos SSE
┌───────────────────────────────────┴────────────────────────────────────┐
│                    APNEA CONTROL CENTER (BACKEND)                      │
│  - API REST: Puertos 3100 (Gestión) / 3200 (Jueces)                    │
│  - Server-Sent Events (SSE): `/api/events` (Push reactivo en vivo)     │
│  - Cliente Wrapper: `js/api-client.js`                                 │
│  - Modelo de Datos: `DATA_MODEL.md` (Atletas, Sesiones, Intentos, etc) │
└────────────────────────────────────────────────────────────────────────┘
```

### Componentes Clave de Integración

1. **SPX Controller Wrapper (`js/spx_interface.js`)**:
   - `update(data)`: Recibe JSON desde SPX, mapea variables a los nodos DOM correspondientes y ejecuta `runTemplateUpdate()`.
   - `play()`: Invoca la reproducción del gráfico.
   - `stop()`: Ejecuta la salida limpia del gráfico mediante `runAnimationOUT()`.
   - `next(data)`: Avanza al siguiente paso de animación mediante `runAnimationNEXT()`.
   - `window.SPXGCTemplateDefinition`: Declaración del formulario en SPX (campos de texto, dropdowns de carril, listas de temas CSS, capas de reproducción `playlayer`, número de pasos `steps`, y modo de salida `out`).

2. **API Client & SSE (`js/api-client.js` / `API_DOCS.md`)**:
   - `fetchAll()`: Obtiene el snapshot completo del estado del torneo (`GET /api/all`).
   - `connectSSE()`: Conexión persistente `EventSource('/api/events')` que emite eventos `update` en cada cambio en la base de datos (juzgamiento, inicio de intento, tiempos, tarjetas).
   - `getBroadcast()`: Obtiene la sesión y heat activos en transmisión.
   - `getAttempts(params)`: Filtra intentos por sesión, carril o estado.

3. **Modelo Deportivo de Apnea (`DATA_MODEL.md`)**:
   - **Disciplinas**: `STA` (Estática - formato tiempo `MM:SS`), `DYN`/`DYNB`/`DNF` (Dinámicas de piscina - formato distancia `XXX m`).
   - **Ciclo de vida del intento**: `PENDING` ➔ `PERFORMING` ➔ `DONE` ➔ `JUDGED` (o `DNS`/`DQ`).
   - **Métricas**: `attemp_ap` (Anuncio / Announced Performance), `attemp_rp` / `preliminary_result` (Resultado Realizado en vivo), `official_result` (Resultado validado).
   - **Tarjetas y Penalizaciones**: `attemp_card` (`white`, `yellow`, `red`, `dns`) y `notes` (Récords: `NR`, `CR`, `WR`; Deducciones: `UNDER AP`, `EARLY START`, etc.).

---

## 2. Taxonomía y Definición de Tipos de Overlays

A continuación se definen los **6 tipos de overlays** que componen la suite gráfica:

```
                                TIPOS DE OVERLAYS
                                        │
    ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
    ▼                   ▼                               ▼                   ▼
[1. Estático Simple] [2. Multi-Paso]           [3. Auto-Dismiss]    [4. Live Real-Time]
(Lower Third / Info) (Paginación/Reveal)       (Bumper/Stinger)     (Lane Tracker SSE)
                                                        │
                                ┌───────────────────────┴───────────────────────┐
                                ▼                                               ▼
                       [5. Ticker / Loop]                             [6. Full-Screen Boards]
                       (Carrusel/Feed)                                (Startlists/Podios)
```

---

### Tipo 1: Overlay Estático Simple (Show / Hide Manual)
*Control de entrada y salida manual con datos parametrizados desde la interfaz de SPX.*

- **Descripción**: Gráfico de un solo estado. Entra a pantalla al hacer *Play*, permanece visible indefinidamente y sale de pantalla cuando el operador pulsa *Stop*.
- **Comportamiento SPX**:
  - `out`: `"manual"`
  - `steps`: (no requerido o `1`)
  - Callbacks requeridos: `runTemplateUpdate()`, `runAnimationIN()`, `runAnimationOUT()`.
- **Casos de Uso**:
  - Zócalo de presentador / relator / comentarista (`NAME_LEFT.html`, `NAME_RIGHT.html`).
  - Identificador de lugar o información del recinto (`INFO_LEFT.html`, `INFO_RIGHT.html`).
  - Bug de transmisión / Logo de esquina con hashtag.
- **Estructura Técnica**:
  ```javascript
  function runTemplateUpdate() {
      e('DynamicTheme').href = e('f99').innerText;
      e('text1').innerHTML = htmlDecode(e('f0').innerText);
      e('text2').innerHTML = htmlDecode(e('f1').innerText);
      setTimeout(runAnimationIN, 50);
  }

  function runAnimationIN() {
      anime.timeline({ duration: 500, easing: 'easeOutCubic' })
          .add({ targets: '#gfx', opacity: [0, 1], translateX: ['-100%', '0%'] });
  }

  function runAnimationOUT() {
      anime.timeline({ duration: 400, easing: 'easeInCubic' })
          .add({ targets: '#gfx', opacity: [1, 0], translateX: ['0%', '-100%'] });
  }
  ```

---

### Tipo 2: Overlay Multi-Paso Manual (Multi-Step Controller Sequence)
*Gráfico con etapas secuenciales controladas paso a paso por el operador de SPX.*

- **Descripción**: El gráfico entra en un estado inicial (Paso 1). Cada pulsación del botón `Continue` (`next()`) en SPX desencadena la transición visual al siguiente paso (Paso 2, Paso 3, etc.) hasta que se presiona `Stop` para finalizar.
- **Comportamiento SPX**:
  - `out`: `"manual"`
  - `steps`: `N` (ej. `2`, `3`, `4`)
  - Callbacks requeridos: `runTemplateUpdate()`, `runAnimationIN()`, `runAnimationNEXT()`, `runAnimationOUT()`.
- **Casos de Uso**:
  - Título principal con revelación diferida de subtítulo o desglose (`TITLE_2_STEPS.html`).
  - Tabla de resultados o clasificaciones con paginación manual (`session_table.html` de 4 páginas).
  - Comparativa Cara a Cara (Head-to-Head): Paso 1 muestra atleta A; Paso 2 revela atleta B; Paso 3 revela estadísticas comparadas.
- **Estructura Técnica**:
  ```javascript
  let currentStep = 1;
  const totalSteps = 3;

  function runTemplateUpdate() {
      currentStep = 1;
      // Inicializar visibilidad de elementos del paso 1
      setTimeout(runAnimationIN, 50);
  }

  function runAnimationNEXT() {
      if (currentStep < totalSteps) {
          let currentEl = e('step-' + currentStep);
          currentStep++;
          let nextEl = e('step-' + currentStep);
          
          anime({
              targets: currentEl,
              opacity: [1, 0],
              duration: 300,
              complete: () => {
                  currentEl.style.display = 'none';
                  nextEl.style.display = 'flex';
                  anime({ targets: nextEl, opacity: [0, 1], duration: 300 });
              }
          });
      }
  }
  ```

---

### Tipo 3: Overlay de Animación Única y Auto-Finalización (Stinger / Bumper / One-Shot)
*Gráfico de transición o impacto visual con duración fija y auto-destrucción/salida automática.*

- **Descripción**: El gráfico inicia una secuencia animada de principio a fin (utilizando Lottie, video transparente o Anime.js), reproduce audio/efectos si corresponde, y ejecuta su salida automática sin requerir acción del operador.
- **Comportamiento SPX**:
  - `out`: `"auto"` o `"manual"` gestionado internamente con timeout.
  - Callbacks requeridos: `runTemplateUpdate()`, `runAnimationIN()`, `runAnimationOUT()`.
- **Casos de Uso**:
  - Transición de repetición / Replay Bumper (`BUMPER.html`).
  - Cortinilla de apertura / cierre de bloque publicitario o sesión.
  - Alerta flash de nuevo Récord (World Record / National Record alert flash de 4 segundos).
- **Estructura Técnica**:
  ```javascript
  function runAnimationIN() {
      // Opción A: Duración calculada vía Anime.js
      let tl = anime.timeline({
          easing: 'easeInOutQuad',
          complete: () => {
              setTimeout(runAnimationOUT, 1500); // Pausa en pantalla y auto-salida
          }
      });
      tl.add({ targets: '#stinger', scale: [0, 1], opacity: [0, 1], duration: 600 });
  }

  // Opción B: Integración Lottie
  anim.addEventListener('complete', () => {
      runAnimationOUT();
  });
  ```

---

### Tipo 4: Overlay Dinámico en Tiempo Real (Live API + SSE Connected / Lane Tracker)
*Gráfico reactivo conectado al servidor de gestión deportiva y jueces mediante Server-Sent Events.*

- **Descripción**: Muestra la performance en vivo de un carril o del atleta activo. Al entrar en pantalla establece una conexión SSE (`/api/events`). Cada vez que un juez modifica datos (AP, metros recorridos, cronómetro, estado `PERFORMING`, tarjetas `white`/`yellow`/`red` o penalizaciones), el overlay actualiza su DOM inmediatamente. Al salir de pantalla, cierra la conexión SSE y libera recursos.
- **Doble Modo de Operación**:
  1. **Modo SPX**: Seleccionado desde dropdown `_LANE` o asignado a sesión activa de broadcast.
  2. **Modo Standalone (OBS Browser Source)**: Carga vía URL con query param: `competitor_data.html?lane=1`.
- **Comportamiento SPX**:
  - `out`: `"manual"`
  - Campos SPX: `_LANE` (dropdown de carriles 1 a 4), `f99` (tema CSS).
  - Suscripción en: `runTemplateUpdate()` / `DOMContentLoaded`.
  - Desuscripción y limpieza en: `runAnimationOUT()`.
- **Casos de Uso**:
  - Barra de andarivel individual / Lower third de carril (`competitor_data.html`).
  - Gráfico de progreso de apnea (Cronómetro en vivo para STA / Odómetro de metros en piscina para DYN).
  - Veredicto y Tarjeta Oficial del Juez (Result reveal con tarjeta iluminada).
- **Estructura Técnica**:
  ```javascript
  let eventSource = null;

  function connectSSEStream() {
      if (eventSource) eventSource.close();
      eventSource = new EventSource(`${API_BASE}/api/events`);
      eventSource.onmessage = (event) => {
          syncWithServerState();
      };
  }

  async function syncWithServerState() {
      const laneId = getLaneIdentifier(); // Lee query param o campo SPX _LANE
      const response = await fetch(`${API_BASE}/api/all`);
      if (!response.ok) return;
      const state = await response.json();
      
      const activeCompetitor = extractActiveCompetitor(state, laneId);
      if (activeCompetitor) {
          renderCompetitor(activeCompetitor);
      }
  }

  function runAnimationOUT() {
      // Liberación obligatoria del socket SSE
      if (eventSource) {
          eventSource.close();
          eventSource = null;
      }
      anime({ targets: '#gfx', opacity: 0, duration: 400 });
  }
  ```

---

### Tipo 5: Overlay Automatizado / Ticker Cíclico (Looping Feed Engine)
*Zócalo o carrusel continuo que rota información de fuentes externas o base de datos de manera indefinida.*

- **Descripción**: Gráfico de emisión continua ubicado generalmente en la base de la pantalla. Lee un lote de elementos (noticias desde Excel, feed RSS o lista de clasificados de la API) y los muestra en rotación continua con transiciones de scroll o fade.
- **Comportamiento SPX**:
  - `out`: `"manual"`
  - Capa de reproducción recomendada: `playlayer: "1"` (fondo inferior).
  - Control de ciclo: Bucle controlado por temporizador y variable de control `stopped`.
- **Casos de Uso**:
  - News Ticker / Resultados en bucle inferior (`TICKER_EXCEL.html`, `TICKER_RSS.html`).
  - Carrusel de patrocinadores / Sponsors rotativos.
  - Tabla rodante de récords vigentes del torneo.
- **Estructura Técnica**:
  ```javascript
  let stopped = false;
  let timerID = null;

  function showNextBullet(index) {
      if (stopped) return;
      // Render del elemento y animación de entrada
      // Cálculo de scroll horizontal si el texto excede el ancho de la máscara
      timerID = setTimeout(() => {
          showNextBullet((index + 1) % items.length);
      }, displayInterval);
  }

  function runAnimationOUT() {
      stopped = true;
      if (timerID) clearTimeout(timerID);
      anime({ targets: '#tickerZone', opacity: 0, duration: 400 });
  }
  ```

---

### Tipo 6: Overlay de Pantalla Completa y Tablas Complejas (Full-Screen Data Boards)
*Gráficos 1920x1080 para previas, pausas comerciales, startlists y cuadros de medallas.*

- **Descripción**: Diseños de alta densidad informativa que cubren toda la pantalla o una ventana central dominante. Consultan la API del torneo para construir tablas dinámicas (Startlists de la jornada, resultados oficiales de la sesión, ranking general y podios).
- **Comportamiento SPX**:
  - `out`: `"manual"`
  - `steps`: `N` (para navegar entre páginas de atletas) o modo auto-scroll.
  - Capa de reproducción recomendada: `playlayer: "2"` o `"3"`.
- **Casos de Uso**:
  - **Startlist de la Sesión**: Lista de salida con andarivel, atleta, país y AP.
  - **Tabla Oficial de Resultados de Sesión**: Clasificación final con AP, RP, Puntos oficiales y Tarjeta.
  - **Podio y Ceremonia de Premiación**: Primeros 3 puestos (Oro, Plata, Bronce) por género y disciplina.
  - **Medallero por Países**: Tabla acumulada de medallas.

---

## 3. Matriz Comparativa de Tipos de Overlays

| Tipo | Denominación | Disparador de Entrada | Disparador de Salida | Fuente de Datos | Conexión SSE | Pasos (`steps`) |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | **Estático Simple** | Botón Play | Botón Stop | Campos SPX (`f0`, `f1`) | No | 1 |
| **2** | **Multi-Paso Manual** | Botón Play | Botón Stop | Campos SPX / JSON | No | 2 a N |
| **3** | **One-Shot / Bumper** | Botón Play | Automático (Timer/Event) | Fija / Lottie / SPX | No | 1 |
| **4** | **Live Real-Time** | Play o Auto-OBS | Stop o Cierre Source | API REST (`/api/all`) | **Sí** (`/api/events`) | 1 |
| **5** | **Ticker Cíclico** | Botón Play | Botón Stop | Excel / RSS / API | Opcional | Loop interno |
| **6** | **Full-Screen Board** | Botón Play | Botón Stop | API REST (`/api/all`) | Opcional | 1 o Paginado |

---

## 4. Estándares de Implementación y Buenas Prácticas

### 4.1 Ciclo de Vida y Limpieza de Recursos
- **Cerrar siempre EventSource**: En `runAnimationOUT()`, ejecutar `eventSource.close()` y asignar `eventSource = null`.
- **Detener Timers**: Limpiar todos los `setInterval` y `clearTimeout` activos en `runAnimationOUT()`.
- **Resetear animaciones Anime.js**: Cancelar timelines en progreso si se fuerza la salida antes de terminar la animación.

### 4.2 Soporte Dual: SPX Controller vs. Standalone OBS Source
Todo overlay dinámico debe poder funcionar tanto dentro del flujo de trabajo de SPX como insertado directamente como Browser Source en OBS:
- **Detección de parámetros URL**: Leer `?lane=X`, `?sessionId=Y`, `?theme=Z` en `DOMContentLoaded`.
- **Detección SPX**: Si se recibe `update()` desde SPX, priorizar la configuración enviada por el operador.

### 4.3 Formateo Deportivo y Reglas de Negocio
- **Disciplinas de Tiempo (`STA`)**:
  - Los valores deben formatearse siempre en `MM:SS` (ej. `03:45`).
  - Se debe aplicar la clase CSS de espaciado numérico proporcional o monoespaciado (`announce-time`).
- **Disciplinas de Distancia (`DYN`, `DYNB`, `DNF`)**:
  - Los valores deben formatearse como distancia en metros (ej. `125 m` o `125.5 m`).
- **Estados de Juzgamiento**:
  - Mientras el intento esté en `PERFORMING` o `DONE` (sin juzgar): Mostrar `preliminary_result` y ocultar tarjeta (`card-none`).
  - Cuando el intento pase a `JUDGED` o `DQ`: Mostrar `official_result`, resaltar tarjeta (`card-white`, `card-yellow`, `card-red`) y mostrar penalizaciones o notas de récord (`NR`, `WR`) si existen.

### 4.4 Unidades de Medida y Escalabilidad Gráfica
- **Prohibido el uso de píxeles fijos (`px`)** en layouts y tipografías.
- Utilizar exclusivamente unidades relativas al viewport: `vw`, `vh`, `vmin`, `%`, `em`, `rem`.
- Asegurar renderizado perfecto tanto en canvas `1920x1080` (Full HD) como en `3840x2160` (4K UHD).
- Centralizar colores, fuentes y radios de borde en variables CSS de temas (`themes/*.css`).

---

## 5. Plan de Trabajo y Roadmap de Implementación

### Detalle de Tareas por Fase

#### Fase 1: Arquitectura Base y Módulos Compartidos
- [ ] Crear módulo de utilidades compartidas `js/overlay_helpers.js`:
  - Parser de parámetros URL (`lane`, `theme`, `session`).
  - Formateador de métricas deportivas (`formatPerformance(val, discipline)`).
  - Gestor seguro de ciclo de vida SSE con reconexión automática.
  - Generador de flags ISO-3 dinámicos.
- [ ] Homogeneizar temas visuales (`themes/bajau.css`, `themes/Default.css`, etc.) con variables CSS estandarizadas.

#### Fase 2: Overlays de Presentación y Transmisión General (Tipos 1, 2 y 3)
- [ ] Refactorizar y estandarizar `NAME_LEFT.html` y `NAME_RIGHT.html` (Tipo 1).
- [ ] Implementar `TITLE_2_STEPS.html` para presentación de disciplinas y bloques (Tipo 2).
- [ ] Optimizar `BUMPER.html` con soporte Lottie ligero y salida automática sincronizada (Tipo 3).

#### Fase 3: Overlays de Competencia y Andarivel en Vivo (Tipo 4)
- [ ] Estandarizar `competitor_data.html` utilizando la librería cliente `js/api-client.js`.
- [ ] Integrar escucha de eventos SSE `/api/events` para actualización en vivo de:
  - Cambio de atleta en carril según `active_broadcast`.
  - Cronómetro de apnea estática o avance de distancia.
  - Revelación de tarjeta del juez (`white`, `yellow`, `red`, `dns`) con animación de énfasis.
  - Indicadores de penalización y notas (`UNDER AP`, `NR`, `WR`).

#### Fase 4: Tablas Complejas y Pantallas Completas (Tipo 6)
- [ ] Crear plantilla `STARTLIST_SESSION.html`: Grilla completa de salida de la sesión activa.
- [ ] Evolucionar `session_table.html` / `session_table2.html` a una tabla dinámica alimentada por `/api/all`:
  - Paginación manual con SPX (`steps: N`).
  - Modo auto-play (transición automática de páginas cada X segundos).
- [ ] Crear plantilla `PODIUM_RESULTS.html`: Pantalla de premiación con los 3 medallistas por categoría.

#### Fase 5: Tickers, Sponsors y Automatizaciones (Tipo 5)
- [ ] Actualizar `TICKER_EXCEL.html` y `TICKER_RSS.html` con soporte alternativo para leer los resultados destacados de la API `/api/all`.
- [ ] Desarrollar `SPONSOR_CAROUSEL.html` para rotación de logos de sponsors en esquinas o zócalos.

#### Fase 6: QA, Homologación y Documentación
- [ ] Pruebas de rendimiento en OBS Studio y vMix (verificar consumo de CPU/GPU y ausencia de fugas de memoria tras 4 horas de conexión continua).
- [ ] Validación de compatibilidad de resoluciones (1080p, 4K, 720p).
- [ ] Elaboración de guía rápida de operador de SPX.
