'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const VERSION = 'v1.9.2 (ajustes UI + tabs ayuda)';
  const versionEl = document.getElementById('versionLabel');
  if (versionEl) versionEl.textContent = VERSION;

  // Helper para selects tipo jQuery
  const $ = (sel) => document.querySelector(sel);

  // ============================
  // REFERENCIAS
  // ============================
  const opSel   = document.getElementById('operacion');
  const difSel  = document.getElementById('dificultad');
  const ronSel  = document.getElementById('rondas');

  const btnComenzar  = document.getElementById('btnComenzar');
  const btnReiniciar = document.getElementById('btnReiniciar');
  const btnPause     = document.getElementById('btnPause');

  const enunciado  = document.getElementById('enunciado');
  const feedback   = document.getElementById('feedback');
  const opcionesEl = document.getElementById('opciones');

  const pbFill   = document.getElementById('pbFill');
  const progTxt  = document.getElementById('progTxt');
  const aciertosEl = document.getElementById('aciertos');

  const timerText = document.getElementById('timerText');
  const timerFill = document.getElementById('timerFill');
  const timerBar  = document.querySelector('.timerBar');

  const finalActions = document.getElementById('finalActions');

  const srUpdates = document.getElementById('sr-updates');

  // Modal ayuda
  const aboutBtn = $("#aboutBtn");
  const aboutModal = $("#aboutModal");
  const aboutClose = $("#aboutClose");
  const aboutCloseX = $("#aboutCloseX");

  const tabComo = $("#tab-como");
  const tabPorques = $("#tab-porques");
  const contentComo = $("#content-como");
  const contentPorques = $("#content-porques");

  // ============================
  // ESTADO
  // ============================
  let rondasTotales = 8;
  let rondaActual   = 0;
  let aciertos      = 0;

  let operacion     = 'suma';   // suma / resta / mixto / multi / divi
  let dificultad    = 'facil';  // facil / medio / avanzado

  let respuestaCorrecta = null;

  // Timer
  let timerId   = null;
  let timeLeft  = 0;
  let timeMax   = 0;
  let paused    = false;

  // Métrica simple
  let totalTiempoAcumuladoMs = 0;

  // Handler de teclado
  let keyHandlerRef = null;

  // ============================
  // UTILIDADES
  // ============================
  const rand = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const setTxt = (el, txt) => {
    if (el) el.textContent = String(txt);
  };

  const barajar = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const announce = (msg) => {
    if (srUpdates) srUpdates.textContent = msg;
  };

  function rangoPorDificultad() {
    if (dificultad === 'facil')  return [0, 10];
    if (dificultad === 'medio')  return [0, 20];
    return [0, 50];
  }

  function tiempoBasePorDificultad() {
    if (dificultad === 'facil')  return 14000;
    if (dificultad === 'medio')  return 10000;
    return 7000;
  }

  function generarDistractores(correcta, min, max) {
    const set = new Set([correcta]);
    const candidatos = [];

    for (let d of [1, 2, 3]) {
      candidatos.push(correcta + d, correcta - d);
    }

    candidatos.push(min, max);
    for (let i = 0; i < 6; i++) {
      candidatos.push(rand(min, max));
    }

    const result = [];
    for (const n of candidatos) {
      if (
        Number.isInteger(n) &&
        n >= min && n <= max &&
        !set.has(n)
      ) {
        set.add(n);
        result.push(n);
      }
      if (result.length >= 6) break;
    }

    return result;
  }

  // ============================
  // TIMER
  // ============================
  function showTimer() {
    if (!timerText || !timerBar) return;
    timerText.style.display = '';
    timerText.setAttribute('aria-hidden', 'false');
    timerBar.style.display = '';
    timerBar.setAttribute('aria-hidden', 'false');
  }

  function hideTimer() {
    if (!timerText || !timerBar) return;
    timerText.style.display = 'none';
    timerText.setAttribute('aria-hidden', 'true');
    timerBar.style.display = 'none';
    timerBar.setAttribute('aria-hidden', 'true');
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer(ms) {
    stopTimer();
    timeMax = ms;
    timeLeft = ms;
    updateTimerUI();
    timerId = setInterval(() => {
      timeLeft -= 100;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateTimerUI();
        stopTimer();
        tiempoAgotado();
      } else {
        updateTimerUI();
      }
    }, 100);
  }

  function updateTimerUI() {
    if (!timerText || !timerFill) return;

    const s = Math.ceil(timeLeft / 1000);
    setTxt(timerText, s > 0 ? `Tiempo: ${s} s` : 'Tiempo: 0 s');

    const alerta = timeLeft <= 3000 && timeLeft > 0;
    timerText.classList.toggle('timer-alert', alerta);
    timerText.classList.toggle('timer-pulse', alerta);
    if (alerta && navigator.vibrate) navigator.vibrate(40);

    const pct = timeMax > 0
      ? Math.max(0, Math.min(100, Math.round((timeLeft / timeMax) * 100)))
      : 0;

    timerFill.style.width = `${pct}%`;

    let level = 'normal';
    if (timeLeft > 0) {
      if (pct <= 15) level = 'alert';
      else if (pct <= 35) level = 'warn';
    }
    timerFill.dataset.level = level;
  }

  // Pausa/Reanudar
  btnPause?.addEventListener('click', () => {
    if (!paused) {
      stopTimer();
      btnPause.textContent = 'Reanudar';
      paused = true;
    } else {
      startTimer(timeLeft);
      btnPause.textContent = 'Pausar';
      paused = false;
    }
  });

  // ============================
  // OPCIONES / UI
  // ============================
  function limpiarEstadosOpciones() {
    if (!opcionesEl) return;
    opcionesEl.querySelectorAll('button').forEach((b) => {
      b.classList.remove('is-selected', 'ok', 'bad', 'marcada');
      b.disabled = false;
    });
  }

  function marcarSeleccion(btn) {
    if (!opcionesEl) return;
    opcionesEl.querySelectorAll('button').forEach((x) => {
      x.classList.remove('is-selected');
    });
    btn.classList.add('is-selected');
  }

  function attachKeyHandler() {
    if (keyHandlerRef) {
      document.removeEventListener('keydown', keyHandlerRef);
    }

    keyHandlerRef = (e) => {
      if (!opcionesEl || opcionesEl.children.length === 0) return;

      const buttons = Array.from(opcionesEl.children);
      const letters = ['A', 'B', 'C', 'D'];
      const key = e.key;
      const up   = ['ArrowUp', 'ArrowLeft'].includes(key);
      const down = ['ArrowDown', 'ArrowRight'].includes(key);

      // Letras A–D
      const kU = key.toUpperCase();
      const letterIdx = letters.indexOf(kU);
      if (letterIdx >= 0 && buttons[letterIdx]) {
        buttons[letterIdx].click();
        return;
      }

      // Números 1–4
      if (/^[1-4]$/.test(key)) {
        const idx = Number(key) - 1;
        if (buttons[idx]) {
          buttons[idx].click();
        }
        return;
      }

      // Navegación con flechas (arriba/abajo)
      const current = opcionesEl.querySelector('.is-selected') || buttons[0];
      let i = buttons.indexOf(current);
      if (up) {
        i = (i - 1 + buttons.length) % buttons.length;
        buttons[i].focus();
        marcarSeleccion(buttons[i]);
        return;
      }
      if (down) {
        i = (i + 1) % buttons.length;
        buttons[i].focus();
        marcarSeleccion(buttons[i]);
        return;
      }

      // Enter / espacio activa
      if (key === 'Enter' || key === ' ') {
        (opcionesEl.querySelector('.is-selected') || buttons[0])?.click();
      }
    };

    document.addEventListener('keydown', keyHandlerRef);
  }

  function renderOpciones(lista) {
    if (!opcionesEl) return;

    const letras = ['A', 'B', 'C', 'D'];
    opcionesEl.innerHTML = '';

    lista.forEach((val, i) => {
      const btn = document.createElement('button');
      btn.className = 'opcion-btn';
      btn.type = 'button';
      btn.setAttribute('data-val', String(val));
      btn.setAttribute('aria-label', `Opción ${letras[i]}: ${val}`);
      btn.innerHTML = `<strong>${letras[i]}.</strong> ${val}`;

      btn.addEventListener('pointerdown', () => marcarSeleccion(btn));
      btn.addEventListener('focus', () => marcarSeleccion(btn));
      btn.addEventListener('mouseenter', () => marcarSeleccion(btn));
      btn.addEventListener('blur', () => btn.classList.remove('is-selected'));

      btn.addEventListener('click', () => {
        elegir(val, btn);
      });

      opcionesEl.appendChild(btn);
    });

    attachKeyHandler();
    opcionesEl.querySelector('button')?.focus();
  }

  // ============================
  // PROGRESO / UI GENERAL
  // ============================
  function actualizarProgreso() {
    setTxt(progTxt, `${Math.min(rondaActual, rondasTotales)}/${rondasTotales}`);
    setTxt(aciertosEl, aciertos);

    const pct = rondasTotales > 0
      ? Math.round((Math.min(rondaActual, rondasTotales) / rondasTotales) * 100)
      : 0;

    if (pbFill) pbFill.style.width = `${pct}%`;
  }

  function bloquearOpciones() {
    if (!opcionesEl) return;
    opcionesEl.querySelectorAll('button').forEach((b) => {
      b.disabled = true;
    });
  }

  function marcarCorrectaVisual() {
    if (!opcionesEl) return;

    const correctoBtn = Array.from(opcionesEl.children)
      .find((el) => Number(el.getAttribute('data-val')) === respuestaCorrecta);

    if (correctoBtn) {
      correctoBtn.classList.add('ok');
    }
  }

  // ============================
  // LÓGICA DEL JUEGO
  // ============================
  function nuevaPregunta() {
    // Determinar operación efectiva (si mixto, elegimos suma o resta al azar)
    let op = operacion;
    if (op === 'mixto') {
      op = Math.random() < 0.5 ? 'suma' : 'resta';
    }

    let [min, max] = rangoPorDificultad();

    // Ajustes para multi y divi (tablas acotadas)
    if (op === 'multi' || op === 'divi') {
      if (dificultad === 'facil') {
        min = 0; max = 10;
      } else if (dificultad === 'medio') {
        min = 0; max = 12;
      } else {
        min = 0; max = 15;
      }
    }

    let a = rand(min, max);
    let b = rand(min, max);

    if (op === 'resta') {
      if (b > a) [a, b] = [b, a];
      respuestaCorrecta = a - b;
      setTxt(enunciado, `${a} − ${b} = ?`);
    } else if (op === 'multi') {
      respuestaCorrecta = a * b;
      setTxt(enunciado, `${a} × ${b} = ?`);
    } else if (op === 'divi') {
      b = Math.max(1, b);
      const prod = a * b;
      respuestaCorrecta = a;
      setTxt(enunciado, `${prod} ÷ ${b} = ?`);
    } else { // suma (o mixto→suma)
      respuestaCorrecta = a + b;
      setTxt(enunciado, `${a} + ${b} = ?`);
    }

    // Rango para distractores
    const resMin = 0;
    const resMax =
      op === 'multi' ? max * max :
      op === 'divi'  ? max :
      op === 'resta' ? max :
      max + max;

    const distractores = generarDistractores(respuestaCorrecta, resMin, resMax).slice(0, 6);
    const opciones = barajar([respuestaCorrecta, ...barajar(distractores).slice(0, 3)]);

    limpiarEstadosOpciones();
    renderOpciones(opciones);

    setTxt(feedback, '');
    feedback.className = 'feedback muted';
    finalActions.hidden = true;

    actualizarProgreso();
    showTimer();

    const base = tiempoBasePorDificultad();
    const extraOp = (op === 'multi' || op === 'divi') ? 2000 : 0;
    startTimer(base + extraOp);

    if (btnPause) {
      btnPause.hidden = false;
      btnPause.textContent = 'Pausar';
    }
    paused = false;

    announce(`Nueva pregunta: ${enunciado.textContent}`);
  }

  function elegir(valor, btn) {
    stopTimer();

    // Tiempo invertido (aprox)
    totalTiempoAcumuladoMs += Math.min(timeMax, Math.max(0, timeMax - timeLeft));

    const ok = (valor === respuestaCorrecta);
    bloquearOpciones();

    btn.classList.add('marcada');
    btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) marcarCorrectaVisual();

    if (ok) {
      aciertos++;
      setTxt(feedback, '✔ ¡Correcto!');
      feedback.className = 'feedback ok';
      announce(`Correcto. Respuesta ${valor}. Progreso ${rondaActual + 1}/${rondasTotales}.`);
    } else {
      setTxt(feedback, `✘ Casi. La respuesta correcta era: ${respuestaCorrecta}.`);
      feedback.className = 'feedback bad';
      announce(`Incorrecto. La respuesta correcta era ${respuestaCorrecta}. Progreso ${rondaActual + 1}/${rondasTotales}.`);
    }

    rondaActual++;
    actualizarProgreso();

    if (rondaActual >= rondasTotales) {
      setTimeout(() => finalizarSesion(), 700);
    } else {
      setTimeout(() => nuevaPregunta(), 700);
    }
  }

  function tiempoAgotado() {
    bloquearOpciones();
    marcarCorrectaVisual();

    setTxt(feedback, `⏰ Tiempo agotado. La respuesta correcta era: ${respuestaCorrecta}.`);
    feedback.className = 'feedback bad';
    announce(`Tiempo agotado. La respuesta correcta era ${respuestaCorrecta}.`);

    totalTiempoAcumuladoMs += tiempoBasePorDificultad();

    rondaActual++;
    actualizarProgreso();

    if (rondaActual >= rondasTotales) {
      setTimeout(() => finalizarSesion(), 800);
    } else {
      setTimeout(() => nuevaPregunta(), 800);
    }
  }

  // ============================
  // CIERRE / RESUMEN
  // ============================
  function cierreDeSesion({ aciertos, rondas, tiempoPromedioMs = null }) {
    const pct = Math.round((aciertos / Math.max(1, rondas)) * 100);
    let titulo = '';
    let recomendacion = '';

    if (pct >= 90) {
      titulo = 'Excelente precisión.';
      recomendacion = 'Podés animarte a subir la dificultad.';
    } else if (pct >= 70) {
      titulo = 'Buen rendimiento.';
      recomendacion = 'Repetí este nivel hasta llegar al 90%.';
    } else if (pct >= 50) {
      titulo = 'Rendimiento estable.';
      recomendacion = 'Reforzá este nivel antes de subir.';
    } else {
      titulo = 'Sesión desafiante.';
      recomendacion = 'Conviene bajar un nivel para afianzar.';
    }

    const tiempoStr = tiempoPromedioMs != null
      ? ` • Promedio: ${(tiempoPromedioMs / 1000).toFixed(1)} s`
      : '';

    return `${titulo} Precisión: ${pct}%${tiempoStr}. ${recomendacion}`;
  }

  function renderFinalActions(pct) {
    finalActions.innerHTML = '';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn principal';

    if (pct >= 90) {
      btn.textContent = 'Continuar: Subir dificultad';
      btn.addEventListener('click', () => cambiarDificultad(+1));
    } else if (pct >= 70) {
      btn.textContent = 'Continuar: Repetir nivel';
      btn.addEventListener('click', () => btnComenzar.click());
    } else if (pct >= 50) {
      btn.textContent = 'Continuar: Reforzar este nivel';
      btn.addEventListener('click', () => btnComenzar.click());
    } else {
      btn.textContent = 'Continuar: Bajar dificultad';
      btn.addEventListener('click', () => cambiarDificultad(-1));
    }
    finalActions.appendChild(btn);

    const linkOtroJuego = document.createElement('a');
    linkOtroJuego.href = 'https://falltem.org/juegos/#games-cards';
    linkOtroJuego.target = '_blank';
    linkOtroJuego.rel = 'noopener noreferrer';
    linkOtroJuego.className = 'btn principal';
    linkOtroJuego.textContent = 'Elegir otro juego';
    finalActions.appendChild(linkOtroJuego);

    const linkConfig = document.createElement('button');
    linkConfig.type = 'button';
    linkConfig.className = 'btn texto';
    linkConfig.textContent = '⚙️ Elegir otra configuración';
    linkConfig.addEventListener('click', () => {
      btnReiniciar.click();
    });
    finalActions.appendChild(linkConfig);

    finalActions.hidden = false;
    btn.focus();
  }

  function finalizarSesion() {
    stopTimer();
    hideTimer();
    setTxt(timerText, '');
    if (timerFill) {
      timerFill.style.width = '0%';
      timerFill.dataset.level = 'normal';
    }

    const tiempoPromedio = rondasTotales > 0
      ? Math.round(totalTiempoAcumuladoMs / rondasTotales)
      : null;

    const texto = cierreDeSesion({
      aciertos,
      rondas: rondasTotales,
      tiempoPromedioMs: tiempoPromedio
    });

    const pct = rondasTotales > 0
      ? Math.round((aciertos / rondasTotales) * 100)
      : 0;

    setTxt(enunciado, 'Sesión finalizada');
    setTxt(feedback, texto);
    feedback.className = pct >= 70
      ? 'feedback ok'
      : pct >= 50
        ? 'feedback muted'
        : 'feedback bad';

    renderFinalActions(pct);

    btnReiniciar.hidden = false;
    btnComenzar.hidden = true;

    if (btnPause) {
      btnPause.hidden = true;
    }
    paused = false;

    if (keyHandlerRef) {
      document.removeEventListener('keydown', keyHandlerRef);
      keyHandlerRef = null;
    }
  }

  function cambiarDificultad(delta) {
    const orden = ['facil', 'medio', 'avanzado'];
    let idx = orden.indexOf(dificultad);
    idx = Math.max(0, Math.min(orden.length - 1, idx + delta));
    dificultad = orden[idx];
    difSel.value = dificultad;
    btnComenzar.click();
  }

  // ============================
  // EVENTOS PRINCIPALES
  // ============================
  btnComenzar?.addEventListener('click', () => {
    operacion  = opSel.value;
    dificultad = difSel.value;
    rondasTotales = Number(ronSel.value || 8) || 8;

    try {
      localStorage.setItem('calc_op', operacion);
      localStorage.setItem('calc_diff', dificultad);
      localStorage.setItem('calc_rondas', String(rondasTotales));
    } catch {}

    rondaActual   = 0;
    aciertos      = 0;
    totalTiempoAcumuladoMs = 0;

    btnComenzar.hidden = true;
    btnReiniciar.hidden = true;

    setTxt(timerText, '');
    if (timerFill) {
      timerFill.style.width = '0%';
      timerFill.dataset.level = 'normal';
    }

    nuevaPregunta();
  });

  btnReiniciar?.addEventListener('click', () => {
    stopTimer();
    hideTimer();
    setTxt(timerText, '');

    btnComenzar.hidden = false;
    btnReiniciar.hidden = true;

    setTxt(enunciado, 'Presioná “Comenzar” para iniciar.');
    setTxt(feedback, '');
    feedback.className = 'feedback muted';

    if (opcionesEl) opcionesEl.innerHTML = '';

    rondaActual   = 0;
    aciertos      = 0;
    totalTiempoAcumuladoMs = 0;

    if (timerFill) {
      timerFill.style.width = '0%';
      timerFill.dataset.level = 'normal';
    }

    finalActions.hidden = true;

    if (btnPause) btnPause.hidden = true;
    paused = false;

    if (keyHandlerRef) {
      document.removeEventListener('keydown', keyHandlerRef);
      keyHandlerRef = null;
    }

    actualizarProgreso();
  });

  // ============================
  // RESTAURAR PREFERENCIAS
  // ============================
  try {
    const opLS   = localStorage.getItem('calc_op');
    const diffLS = localStorage.getItem('calc_diff');
    const ronLS  = localStorage.getItem('calc_rondas');

    if (opLS && opSel.querySelector(`option[value="${opLS}"]`)) {
      opSel.value = opLS;
      operacion = opLS;
    }
    if (diffLS && difSel.querySelector(`option[value="${diffLS}"]`)) {
      difSel.value = diffLS;
      dificultad = diffLS;
    }
    if (ronLS && ronSel.querySelector(`option[value="${ronLS}"]`)) {
      ronSel.value = ronLS;
      rondasTotales = Number(ronLS);
    }
  } catch {}

  actualizarProgreso();
  hideTimer();

  // ============================
  // MODAL DE AYUDA
  // ============================
  function openAbout() {
    if (!aboutModal) return;
    aboutModal.hidden = false;
    aboutModal.setAttribute('aria-hidden', 'false');
    aboutBtn?.setAttribute('aria-expanded', 'true');
    // Ahora arrancamos en "¿Cómo se juega?"
    activarTab('como');
    aboutClose?.focus();
  }

  function closeAbout() {
    if (!aboutModal) return;
    aboutModal.hidden = true;
    aboutModal.setAttribute('aria-hidden', 'true');
    aboutBtn?.setAttribute('aria-expanded', 'false');
    aboutBtn?.focus();
  }

  aboutBtn?.addEventListener('click', openAbout);
  aboutClose?.addEventListener('click', closeAbout);
  aboutCloseX?.addEventListener('click', closeAbout);

  aboutModal?.addEventListener('click', (e) => {
    if (e.target === aboutModal) closeAbout();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aboutModal && !aboutModal.hidden) {
      closeAbout();
    }
  });

  // ============================
  // TABS DEL MODAL
  // ============================
  function activarTab(tab) {
    if (!tabPorques || !tabComo || !contentPorques || !contentComo) return;

    if (tab === 'porques') {
      contentPorques.hidden = false;
      contentComo.hidden = true;

      tabPorques.classList.add('tab-btn--active');
      tabComo.classList.remove('tab-btn--active');
    } else {
      contentPorques.hidden = true;
      contentComo.hidden = false;

      tabComo.classList.add('tab-btn--active');
      tabPorques.classList.remove('tab-btn--active');
    }
  }

  tabPorques?.addEventListener('click', () => activarTab('porques'));
  tabComo?.addEventListener('click', () => activarTab('como'));
});
