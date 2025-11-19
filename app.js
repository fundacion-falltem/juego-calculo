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

  const srUpdates  = document.getElementById('sr-updates');
  const btnPause   = document.getElementById('btnPause'); // si algún día lo activás

  // Modal ayuda
  const aboutBtn   = document.getElementById('aboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const aboutClose = document.getElementById('aboutClose');
  const aboutCloseX= document.getElementById('aboutCloseX');

  if (aboutModal) {
    aboutModal.setAttribute('aria-hidden', 'true');
    aboutModal.hidden = true;
  }

  // ======================================================
  // ESTADO
  // ======================================================
  let operacion       = opSel?.value || 'suma';
  let dificultad      = difSel?.value || 'facil';
  let rondasTotales   = Number(ronSel?.value || 8);
  let ronda           = 0;
  let aciertos        = 0;
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
        if (result.length >= 3) break;
      }
    }
    while (result.length < 3){
      const n = rand(min, max);
      if (!set.has(n)){
        set.add(n); result.push(n);
      }
    }
    return barajar([correcta, ...result]);
  }

  // ======================================================
  // TIMER
  // ======================================================
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
    timerBar?.classList.remove('hidden');
  }

  function stopTimer(){
    if (timerId !== null){
      clearInterval(timerId);
      timerId = null;
    }
  }

  function hideTimer(){
    if (timerBar){
      timerBar.classList.add('hidden');
    }
    setTxt(timerText, '');
    timerFill.style.width = '0%';
    timerFill.dataset.level = 'normal';
  }

  function updateTimerUI(){
    const s = Math.ceil(timeLeft / 1000);
    setTxt(timerText, s > 0 ? `⏱ Tiempo: ${s} s` : '⏱ Tiempo: 0 s');

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

  // Pausa/Reanudar (si activás un botón de pausa)
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
  // RENDER OPCIONES + TECLADO
  // ======================================================
  function renderOpciones(opciones){
    opcionesEl.innerHTML = '';
    const letras = ['A','B','C','D'];

    opciones.forEach((valor, idx)=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opcion-btn';

      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = letras[idx] + '.';

      const span = document.createElement('span');
      span.className = 'texto';
      span.textContent = String(valor);

      btn.appendChild(tag);
      btn.appendChild(span);

      btn.dataset.valor = String(valor);

      btn.addEventListener('click', ()=>{
        manejarRespuesta(Number(btn.dataset.valor));
      });

      opcionesEl.appendChild(btn);
    });

    attachKeyHandler();
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

      // Letra A–D
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
        current?.click();
      }
    };
    document.addEventListener('keydown', keyHandlerRef);
  }

  // ======================================================
  // FLUJO DE JUEGO
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
      b = b || 1;
      const prod = a * b;
      respuestaCorrecta = a;
      setTxt(enunciado, `${prod} ÷ ${b} = ?`);
    } else if (op === 'mixto'){
      const isSuma = Math.random() < 0.5;
      if (!isSuma && b > a) [a,b] = [b,a];
      respuestaCorrecta = isSuma ? a + b : a - b;
      setTxt(enunciado, `${a} ${isSuma ? '+' : '−'} ${b} = ?`);
    } else {
      // suma
      respuestaCorrecta = a + b;
      setTxt(enunciado, `${a} + ${b} = ?`);
    }

    const opciones = generarDistractores(respuestaCorrecta, min, max);
    renderOpciones(opciones);

    ronda++;
    actualizarUI();

    const baseMs = tiempoBasePorDificultad();
    startTimer(baseMs);
  }

  function actualizarUI(){
    setTxt(progTxt, `${Math.min(ronda, rondasTotales)}/${rondasTotales}`);
    setTxt(aciertosEl, `Aciertos: ${aciertos}`);
    const pct = Math.round((Math.min(ronda, rondasTotales)/rondasTotales) * 100);
    pbFill.style.width = pct + '%';
  }

  function bloquearOpciones(){
    opcionesEl.querySelectorAll('button').forEach(b=> b.disabled = true);
  }

  function marcarCorrectaYSeleccionada(valorSeleccionado){
    const buttons = Array.from(opcionesEl.querySelectorAll('button'));
    let correctaBtn = null;
    let seleccionadaBtn = null;

    buttons.forEach(btn=>{
      const valor = Number(btn.dataset.valor);
      if (valor === respuestaCorrecta) correctaBtn = btn;
      if (valor === valorSeleccionado) seleccionadaBtn = btn;
    });

    if (correctaBtn) correctaBtn.classList.add('ok');
    if (seleccionadaBtn && seleccionadaBtn !== correctaBtn){
      seleccionadaBtn.classList.add('bad','is-selected');
    } else if (seleccionadaBtn){
      seleccionadaBtn.classList.add('is-selected');
    }
  }

  function manejarRespuesta(valorSeleccionado){
    if (respuestaCorrecta == null) return;
    stopTimer();
    bloquearOpciones();

    const delay = 800;

    const correcta = (valorSeleccionado === respuestaCorrecta);
    if (correcta){
      aciertos++;
      setTxt(feedback, '¡Bien! Respuesta correcta.');
      feedback.className = 'feedback ok';
      announce('Respuesta correcta');
    } else {
      setTxt(feedback, `La respuesta correcta era ${respuestaCorrecta}.`);
      feedback.className = 'feedback bad';
      announce('Respuesta incorrecta');
    }

    marcarCorrectaYSeleccionada(valorSeleccionado);
    actualizarUI();

    totalTiempoAcumuladoMs += delay;
    setTimeout(()=>{
      if (ronda >= rondasTotales){
        finalizarSesion();
      } else {
        nuevaPregunta();
      }
    }, delay);
  }

  function tiempoAgotado(){
    if (respuestaCorrecta == null) return;
    bloquearOpciones();
    marcarCorrectaYSeleccionada(undefined);

    setTxt(feedback, 'Se acabó el tiempo.');
    feedback.className = 'feedback bad';
    announce('Tiempo agotado');

    totalTiempoAcumuladoMs += tiempoBasePorDificultad();
    if (ronda >= rondasTotales){
      finalizarSesion();
    } else {
      setTimeout(()=> nuevaPregunta(), 800);
    }
  }

  // ======================================================
  // CIERRE DE SESIÓN
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

    const linkOtroJuego = document.createElement('a');
    linkOtroJuego.href = 'https://falltem.org/juegos/#games-cards';
    linkOtroJuego.className = 'btn secundario';
    linkOtroJuego.textContent = 'Elegir otro juego';
    linkOtroJuego.target = '_blank';
    linkOtroJuego.rel = 'noopener noreferrer';
    finalActions.appendChild(linkOtroJuego);

    const linkConfig = document.createElement('a');
    linkConfig.href = '#';
    linkConfig.textContent = '⚙️ Elegir otra configuración';
    linkConfig.addEventListener('click', (e)=> {
      e.preventDefault();
      btnReiniciar.click();
    });
    finalActions.appendChild(linkConfig);

    finalActions.hidden = false;
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
  // EVENTOS PRINCIPALES
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

    const juegoSection = document.getElementById('juego');
    if (juegoSection){
      juegoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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

    finalActions.hidden = true;

    if (btnPause) btnPause.hidden = true;
    paused = false;

    if (keyHandlerRef) document.removeEventListener('keydown', keyHandlerRef);
  });

  // ======================================================
  // ESTADO INICIAL
  // ======================================================
  try{
    const opLS   = localStorage.getItem('calc_op');
    const diffLS = localStorage.getItem('calc_diff');
    const ronLS  = localStorage.getItem('calc_rondas');
    if (opLS && opSel.querySelector(`option[value="${opLS}"]`)){
      opSel.value = opLS;
      operacion = opLS;
    }
    if (diffLS && difSel.querySelector(`option[value="${diffLS}"]`)){
      difSel.value = diffLS;
      dificultad = diffLS;
    }
    if (ronLS && ronSel.querySelector(`option[value="${ronLS}"]`)){
      ronSel.value = ronLS;
      rondasTotales = Number(ronLS);
    }
  }catch{}

  // ======================================================
  // MODAL AYUDA
  // ======================================================
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
  aboutCloseX?.addEventListener('click', closeAbout);

  aboutModal?.addEventListener('click', (e)=>{
    if (e.target === aboutModal) closeAbout();
  });

  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && aboutModal && !aboutModal.hidden){
      closeAbout();
    }
  });

  // ======================================================
  // SERVICE WORKER (PWA) – opcional
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
