'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const VERSION = "v1.9.1 (accesibilidad, pausa, atajos, PWA)";
  const versionEl = document.getElementById('versionLabel');
  if (versionEl) versionEl.textContent = VERSION;

  // ======================================================
  // REFERENCIAS
  // ======================================================
  const opSel   = document.getElementById('operacion');
  const difSel  = document.getElementById('dificultad');
  const ronSel  = document.getElementById('rondas');

  const btnComenzar  = document.getElementById('btnComenzar');
  const btnReiniciar = document.getElementById('btnReiniciar');

  const enunciado  = document.getElementById('enunciado');
  const feedback   = document.getElementById('feedback');
  const opcionesEl = document.getElementById('opciones');

  const pbFill     = document.getElementById('pbFill');
  const progTxt    = document.getElementById('progTxt');
  const aciertosEl = document.getElementById('aciertos');

  const timerText  = document.getElementById('timerText');
  const timerFill  = document.getElementById('timerFill');
  const timerBar   = document.querySelector('.timerBar');

  const finalActions = document.getElementById('finalActions');

  // Accesibilidad + pausa
  const srUpdates  = document.getElementById('sr-updates');
  const btnPause   = document.getElementById('btnPause');

  // ======================================================
  // ESTADO
  // ======================================================
  let rondasTotales = 8, ronda = 0, aciertos = 0;
  let operacion = 'suma';
  let dificultad = 'facil';
  let respuestaCorrecta = null;

  // timer
  let timerId = null;
  let timeLeft = 0, timeMax = 0;
  let paused = false;

  // métrica simple
  let totalTiempoAcumuladoMs = 0;

  // handler de teclado por pregunta
  let keyHandlerRef = null;

  // ======================================================
  // UTILS
  // ======================================================
  const rand = (min, max) => Math.floor(Math.random()*(max-min+1)) + min;
  const setTxt = (el, t) => { if (el) el.textContent = String(t); };
  const barajar = (arr) => { for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };
  const announce = (msg) => { if (srUpdates) srUpdates.textContent = msg; };

  function rangoPorDificultad(){
    if (dificultad === 'facil') return [0, 10];
    if (dificultad === 'medio') return [0, 20];
    return [0, 50];
  }

  function tiempoBasePorDificultad(){
    const extra = Number(localStorage.getItem('extra_time') || 0);
    if (dificultad === 'facil') return 14000 + extra;
    if (dificultad === 'medio') return 10000 + extra;
    return 7000 + extra;
  }

  function generarDistractores(correcta, min, max){
    const set = new Set([correcta]);
    const candidatos = [];
    for (let d of [1,2,3]) candidatos.push(correcta + d, correcta - d);
    candidatos.push(min, max);
    for (let i=0;i<6;i++) candidatos.push(rand(min, max));
    const result = [];
    for (const n of candidatos){
      if (Number.isInteger(n) && n>=min && n<=max && !set.has(n)){
        set.add(n); result.push(n);
      }
      if (result.length >= 6) break;
    }
    return result;
  }

  // ======================================================
  // TIMER
  // ======================================================
  function showTimer(){
    timerText.style.display = '';
    timerText.setAttribute('aria-hidden','false');
    timerBar.style.display  = '';
    timerBar.setAttribute('aria-hidden','false');
  }

  function hideTimer(){
    timerText.style.display = 'none';
    timerText.setAttribute('aria-hidden','true');
    timerBar.style.display  = 'none';
    timerBar.setAttribute('aria-hidden','true');
  }

  function stopTimer(){
    if (timerId){
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer(ms){
    stopTimer();
    timeMax = ms;
    timeLeft = ms;
    updateTimerUI();
    timerId = setInterval(()=>{
      timeLeft -= 100;
      if (timeLeft <= 0){
        timeLeft = 0;
        updateTimerUI();
        stopTimer();
        tiempoAgotado();
      } else {
        updateTimerUI();
      }
    }, 100);
  }

  function updateTimerUI(){
    const s = Math.ceil(timeLeft / 1000);
    setTxt(timerText, s > 0 ? `Tiempo: ${s} s` : 'Tiempo: 0 s');

    const alerta = timeLeft <= 3000 && timeLeft > 0;
    timerText.classList.toggle('timer-alert', alerta);
    timerText.classList.toggle('timer-pulse', alerta);
    if (alerta && navigator.vibrate) navigator.vibrate(40);

    const pct = Math.max(0, Math.min(100, Math.round((timeLeft / timeMax) * 100)));
    timerFill.style.width = pct + '%';
    let level = 'normal';
    if (timeLeft > 0){
      if (pct <= 15) level = 'alert';
      else if (pct <= 35) level = 'warn';
    }
    timerFill.dataset.level = level;
  }

  // Pausa/Reanudar
  btnPause?.addEventListener('click', ()=>{
    if (!paused) {
      stopTimer();
      if (btnPause) btnPause.textContent = 'Reanudar';
      paused = true;
    } else {
      startTimer(timeLeft);
      if (btnPause) btnPause.textContent = 'Pausar';
      paused = false;
    }
  });

  // ======================================================
  // OPCIONES
  // ======================================================
  function limpiarEstadosOpciones(){
    opcionesEl.querySelectorAll('button').forEach(b=>{
      b.classList.remove('is-selected','ok','bad','marcada');
      b.disabled = false;
    });
  }

  function marcarSeleccion(b){
    opcionesEl.querySelectorAll('button').forEach(x=>x.classList.remove('is-selected'));
    b.classList.add('is-selected');
  }

  function attachKeyHandler(){
    if (keyHandlerRef) document.removeEventListener('keydown', keyHandlerRef);
    keyHandlerRef = (e)=>{
      if (!opcionesEl || opcionesEl.children.length === 0) return;

      const buttons = Array.from(opcionesEl.children);
      const letters = ['A','B','C','D'];
      const key = e.key;
      const up = ['ArrowUp','ArrowLeft'].includes(key);
      const down = ['ArrowDown','ArrowRight'].includes(key);

      // Letras A–D
      const kU = key.toUpperCase();
      const letterIdx = letters.indexOf(kU);
      if (letterIdx >= 0 && buttons[letterIdx]) { buttons[letterIdx].click(); return; }

      // Números 1–4
      if (/^[1-4]$/.test(key)) { const idx = Number(key)-1; buttons[idx]?.click(); return; }

      // Navegación con flechas
      const current = opcionesEl.querySelector('.is-selected') || buttons[0];
      let idx = buttons.indexOf(current);
      if (up)   { idx = (idx - 1 + buttons.length) % buttons.length; buttons[idx].focus(); return; }
      if (down) { idx = (idx + 1) % buttons.length; buttons[idx].focus(); return; }

      // Activación
      if (key === 'Enter' || key === ' ') {
        (opcionesEl.querySelector('.is-selected') || buttons[0])?.click();
        return;
      }
    };
    document.addEventListener('keydown', keyHandlerRef);
  }

  function renderOpciones(lista){
    const letras = ['A','B','C','D'];
    opcionesEl.innerHTML = '';
    lista.forEach((val, i)=>{
      const b = document.createElement('button');
      b.className = 'opcion-btn';
      b.setAttribute('data-val', String(val));
      b.setAttribute('aria-label', `Opción ${letras[i]}: ${val}`);
      b.innerHTML = `<strong>${letras[i]}.</strong> ${val}`;
      b.addEventListener('pointerdown', ()=> marcarSeleccion(b));
      b.addEventListener('focus',      ()=> marcarSeleccion(b));
      b.addEventListener('mouseenter', ()=> marcarSeleccion(b));
      b.addEventListener('blur',       ()=> b.classList.remove('is-selected'));
      b.addEventListener('click', ()=> elegir(val, b));
      opcionesEl.appendChild(b);
    });
    attachKeyHandler();
    opcionesEl.querySelector('button')?.focus();
  }

  // ======================================================
  // FEEDBACK + CIERRE
  // ======================================================
  function cierreDeSesion({ aciertos, rondas, tiempoPromedioMs = null }){
    const pct = Math.round((aciertos / Math.max(1, rondas)) * 100);
    let titulo = '', recomendacion = '';
    if (pct >= 90){ titulo = 'Excelente precisión.'; recomendacion = 'Podés animarte a subir la dificultad.'; }
    else if (pct >= 70){ titulo = 'Buen rendimiento.'; recomendacion = 'Repetí este nivel hasta llegar al 90%.'; }
    else if (pct >= 50){ titulo = 'Rendimiento estable.'; recomendacion = 'Reforzá este nivel antes de subir.'; }
    else { titulo = 'Sesión desafiante.'; recomendacion = 'Conviene bajar un nivel para afianzar.'; }
    const tiempoStr = (tiempoPromedioMs != null) ? ` • Promedio: ${(tiempoPromedioMs/1000).toFixed(1)} s` : '';
    return `${titulo} Precisión: ${pct}%${tiempoStr}. ${recomendacion}`;
  }

  function renderFinalActions(pct){
    finalActions.innerHTML = '';

    // Botón principal
    const btn = document.createElement('button');
    btn.className = 'btn principal';

    if (pct >= 90){
      btn.textContent = 'Continuar: Subir dificultad';
      btn.addEventListener('click', ()=> cambiarDificultad(+1));
    } else if (pct >= 70){
      btn.textContent = 'Continuar: Repetir nivel';
      btn.addEventListener('click', ()=> btnComenzar.click());
    } else if (pct >= 50){
      btn.textContent = 'Continuar: Reforzar este nivel';
      btn.addEventListener('click', ()=> btnComenzar.click());
    } else {
      btn.textContent = 'Continuar: Bajar dificultad';
      btn.addEventListener('click', ()=> cambiarDificultad(-1));
    }
    finalActions.appendChild(btn);

    // Botón secundario: Elegir otro juego
    const linkOtroJuego = document.createElement('a');
    linkOtroJuego.href = 'https://falltem.org/juegos/#games-cards';
    linkOtroJuego.className = 'btn secundario';
    linkOtroJuego.textContent = 'Elegir otro juego';
    linkOtroJuego.target = '_blank';
    linkOtroJuego.rel = 'noopener noreferrer';
    finalActions.appendChild(linkOtroJuego);

    // Link pequeño: Elegir otra configuración
    const linkConfig = document.createElement('a');
    linkConfig.href = '#';
    linkConfig.textContent = '⚙️ Elegir otra configuración';
    linkConfig.addEventListener('click', (e)=> {
      e.preventDefault();
      btnReiniciar.click();
    });
    finalActions.appendChild(linkConfig);

    finalActions.hidden = false;
    btn.focus();
  }

  function finalizarSesion(){
    const tiempoPromedio = (rondasTotales > 0)
      ? Math.round(totalTiempoAcumuladoMs / rondasTotales)
      : null;

    const texto = cierreDeSesion({
      aciertos,
      rondas: rondasTotales,
      tiempoPromedioMs: tiempoPromedio
    });

    const pct = Math.round((aciertos / Math.max(1, rondasTotales)) * 100);

    setTxt(enunciado, 'Sesión finalizada');
    setTxt(feedback, texto);
    feedback.className = (pct >= 70)
      ? 'feedback ok'
      : (pct >= 50 ? 'feedback muted' : 'feedback bad');

    renderFinalActions(pct);

    btnReiniciar.hidden = false;
    btnComenzar.hidden = true;

    actualizarUI();
    hideTimer();
    setTxt(timerText, '');
    timerFill.style.width = '0%';
    timerFill.dataset.level = 'normal';

    if (btnPause) btnPause.hidden = true;
    paused = false;

    if (keyHandlerRef) document.removeEventListener('keydown', keyHandlerRef);
  }

  function cambiarDificultad(delta){
    const orden = ['facil','medio','avanzado'];
    let idx = orden.indexOf(dificultad);
    idx = Math.max(0, Math.min(orden.length-1, idx + delta));
    difSel.value = orden[idx];
    btnComenzar.click();
  }

  // ======================================================
  // FLUJO DE JUEGO (4 operaciones)
  // ======================================================
  function nuevaPregunta(){
    const op = operacion;

    // rangos base (suma/resta)
    let [min, max] = rangoPorDificultad();

    // ajustar rangos para multiplicación/división (tablas)
    if (op === 'multi' || op === 'divi'){
      if (dificultad === 'facil')      { min = 0; max = 10; }
      else if (dificultad === 'medio') { min = 0; max = 12; }
      else                             { min = 0; max = 15; }
    }

    let a = rand(min, max), b = rand(min, max);

    if (op === 'resta'){
      if (b > a) [a,b] = [b,a];
      respuestaCorrecta = a - b;
      setTxt(enunciado, `${a} − ${b} = ?`);
    } else if (op === 'multi'){
      respuestaCorrecta = a * b;
      setTxt(enunciado, `${a} × ${b} = ?`);
    } else if (op === 'divi'){
      b = Math.max(1, b);
      const prod = a * b;
      respuestaCorrecta = a;
      setTxt(enunciado, `${prod} ÷ ${b} = ?`);
    } else {
      respuestaCorrecta = a + b;
      setTxt(enunciado, `${a} + ${b} = ?`);
    }

    // rango de distractores según operación
    const resMin = 0;
    const resMax = (op === 'multi') ? (max * max)
                  : (op === 'divi') ? max
                  : (op === 'resta') ? max
                  : (max + max);

    const distractores = generarDistractores(respuestaCorrecta, resMin, resMax).slice(0, 6);
    const opciones = barajar([respuestaCorrecta, ...barajar(distractores).slice(0,3)]);

    limpiarEstadosOpciones();
    renderOpciones(opciones);

    setTxt(feedback, '');
    feedback.className = 'feedback muted';
    finalActions.hidden = true;

    actualizarUI();
    showTimer();

    const base = tiempoBasePorDificultad();
    const extraOp = (op === 'multi' || op === 'divi') ? 2000 : 0;
    startTimer(base + extraOp);

    // Mostrar pausa (si existe el botón)
    if (btnPause) {
      btnPause.hidden = false;
      btnPause.textContent = 'Pausar';
    }
    paused = false;

    announce(`Nueva pregunta. ${enunciado.textContent}`);
  }

  function actualizarUI(){
    setTxt(progTxt, `${Math.min(ronda, rondasTotales)}/${rondasTotales}`);
    setTxt(aciertosEl, aciertos);
    const pct = Math.round((Math.min(ronda, rondasTotales)/rondasTotales) * 100);
    pbFill.style.width = pct + '%';
  }

  function bloquearOpciones(){
    opcionesEl.querySelectorAll('button').forEach(b=> b.disabled = true);
  }

  function marcarCorrectaVisual(){
    const correctoBtn = Array.from(opcionesEl.children)
      .find(el => Number(el.getAttribute('data-val')) === respuestaCorrecta);
    if (correctoBtn) correctoBtn.classList.add('ok');
  }

  function elegir(valor, btn){
    stopTimer();
    totalTiempoAcumuladoMs += Math.min(timeMax, Math.max(0, timeMax - timeLeft));

    const ok = (valor === respuestaCorrecta);
    bloquearOpciones();
    btn.classList.add('marcada', ok ? 'ok' : 'bad');
    if (!ok) marcarCorrectaVisual();

    if (ok){
      aciertos++;
      setTxt(feedback, '✔ ¡Correcto!');
      feedback.className = 'feedback ok';
      announce(`Correcto. Respuesta ${valor}. Progreso ${ronda+1}/${rondasTotales}.`);
    } else {
      setTxt(feedback, `✘ Casi. Respuesta correcta: ${respuestaCorrecta}.`);
      feedback.className = 'feedback bad';
      announce(`Incorrecto. La correcta era ${respuestaCorrecta}. Progreso ${ronda+1}/${rondasTotales}.`);
    }

    ronda++;
    if (ronda >= rondasTotales){
      finalizarSesion();
    } else {
      setTimeout(nuevaPregunta, 700);
    }
  }

  function tiempoAgotado(){
    bloquearOpciones();
    marcarCorrectaVisual();
    setTxt(feedback, `⏰ Tiempo agotado. La respuesta correcta era: ${respuestaCorrecta}.`);
    feedback.className = 'feedback bad';
    totalTiempoAcumuladoMs += timeMax;

    announce(`Tiempo agotado. La respuesta correcta era ${respuestaCorrecta}. Progreso ${ronda+1}/${rondasTotales}.`);

    ronda++;
    if (ronda >= rondasTotales){
      finalizarSesion();
    } else {
      setTimeout(nuevaPregunta, 800);
    }
  }

  // ======================================================
  // EVENTOS
  // ======================================================
  btnComenzar.addEventListener('click', ()=>{
    operacion = opSel.value;
    dificultad = difSel.value;
    rondasTotales = Number(ronSel.value);

    try{
      localStorage.setItem('calc_op', operacion);
      localStorage.setItem('calc_diff', dificultad);
      localStorage.setItem('calc_rondas', String(rondasTotales));
    }catch{}

    ronda = 0;
    aciertos = 0;
    totalTiempoAcumuladoMs = 0;

    btnComenzar.hidden = true;
    btnReiniciar.hidden = true;

    setTxt(timerText, '');
    timerFill.style.width = '0%';
    timerFill.dataset.level = 'normal';

    nuevaPregunta();
  });

  btnReiniciar.addEventListener('click', ()=>{
    stopTimer();
    btnComenzar.hidden = false;
    btnReiniciar.hidden = true;

    setTxt(enunciado, 'Presioná “Comenzar” para iniciar.');
    setTxt(feedback, '');
    feedback.className = 'feedback muted';
    opcionesEl.innerHTML = '';

    ronda = 0;
    aciertos = 0;
    totalTiempoAcumuladoMs = 0;

    actualizarUI();
    hideTimer();
    setTxt(timerText, '');

    timerFill.style.width = '0%';
    timerFill.dataset.level = 'normal';

    finalActions.hidden = true;

    if (btnPause) btnPause.hidden = true;
    paused = false;

    if (keyHandlerRef) document.removeEventListener('keydown', keyHandlerRef);
  });

  // Restaurar prefs
  try{
    const op = localStorage.getItem('calc_op');
    if (op && ['suma','resta','multi','divi'].includes(op)) opSel.value = op;

    const df = localStorage.getItem('calc_diff');
    if (df && ['facil','medio','avanzado'].includes(df)) difSel.value = df;

    const rs = localStorage.getItem('calc_rondas');
    if (rs && ['6','8','10'].includes(rs)) ronSel.value = rs;
  }catch{}

  // ======================================================
  // MODAL DE AYUDA
  // ======================================================
  const aboutBtn   = document.getElementById('aboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const aboutClose = document.getElementById('aboutClose');

  if (aboutModal) {
    aboutModal.setAttribute('aria-hidden', 'true');
    aboutModal.hidden = true;
  }

  function openAbout(){
    if (!aboutModal) return;
    aboutModal.hidden = false;
    aboutModal.setAttribute('aria-hidden', 'false');
    aboutBtn?.setAttribute('aria-expanded', 'true');
    aboutClose?.focus();
  }

  function closeAbout(){
    if (!aboutModal) return;
    aboutModal.hidden = true;
    aboutModal.setAttribute('aria-hidden', 'true');
    aboutBtn?.setAttribute('aria-expanded', 'false');
  }

  aboutBtn?.addEventListener('click', openAbout);
  aboutClose?.addEventListener('click', closeAbout);
  aboutModal?.addEventListener('click', (e)=>{ if (e.target === aboutModal) closeAbout(); });
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeAbout(); });

  // ======================================================
  // SW (PWA)
  // ======================================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(()=>{ /* noop */ });
    });
  }

  // ======================================================
  // INIT
  // ======================================================
  actualizarUI();
  hideTimer();
  finalActions.hidden = true;
  if (btnPause) btnPause.hidden = true;
});

/* ============================================================
   CLOUD flare — Eventos personalizados para "Cálculo amable"
   ============================================================ */

/**
 * Envía un evento personalizado a Cloudflare Web Analytics
 * usando navigator.sendBeacon() para no bloquear la UI.
 *
 * @param {string} eventName — nombre del evento (string)
 * @param {object} data — info extra opcional
 */
function track(eventName, data = {}) {
  try {
    const payload = {
      event: eventName,
      timestamp: Date.now(),
      ...data,
      // Token del sitio (el mismo que ya usás)
      token: "96e0f7e2211041628691aed5f9d88f31"
    };

    navigator.sendBeacon(
      "https://cloudflareinsights.com/beacon",
      JSON.stringify(payload)
    );
  } catch (err) {
    console.warn("Cloudflare track() error:", err);
  }
}

/* ============================================================
   EVENTOS AUTOMÁTICOS (podés borrarlos si no los querés)
   Usá estos como plantillas según tu lógica del juego.
   ============================================================ */

/* Cuando el usuario toca "Comenzar" */
document.getElementById("btnComenzar")?.addEventListener("click", () => {
  track("calculo_comenzar", {
    operacion: document.getElementById("operacion")?.value,
    dificultad: document.getElementById("dificultad")?.value,
    rondas: document.getElementById("rondas")?.value
  });
});

/* Cuando finaliza una ronda correcta */
function trackRespuestaCorrecta(valorCorrecto) {
  track("calculo_respuesta_correcta", {
    respuesta: valorCorrecto
  });
}

/* Cuando finaliza una ronda incorrecta */
function trackRespuestaIncorrecta(valorIncorrecto) {
  track("calculo_respuesta_incorrecta", {
    respuesta: valorIncorrecto
  });
}

/* Cuando termina el juego completo */
function trackFinDeJuego(stats) {
  // stats puede contener: { aciertos, total, tiempoPromedio }
  track("calculo_finalizado", stats);
}

/* Cuando el usuario cambia la operación */
document.getElementById("operacion")?.addEventListener("change", (e) => {
  track("calculo_cambio_operacion", { operacion: e.target.value });
});

/* Cuando cambia la dificultad */
document.getElementById("dificultad")?.addEventListener("change", (e) => {
  track("calculo_cambio_dificultad", { dificultad: e.target.value });
});
