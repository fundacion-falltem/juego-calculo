'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const VERSION = "v1.6.1 (feedback adaptativo + CTA minimalista)";
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

  const themeBtn   = document.getElementById('themeToggle');

  const timerText  = document.getElementById('timerText');
  const timerFill  = document.getElementById('timerFill');
  const timerBar   = document.querySelector('.timerBar');

  const finalActions = document.getElementById('finalActions');

  // ======================================================
  // ESTADO
  // ======================================================
  let rondasTotales = 8, ronda = 0, aciertos = 0;
  let operacion = 'suma';
  let dificultad = 'facil';
  let respuestaCorrecta = null;

  let lastOpUsed = null;
  let sameOpStreak = 0;

  let timerId = null;
  let timeLeft = 0, timeMax = 0;

  let totalTiempoAcumuladoMs = 0;

  // ======================================================
  // UTILS
  // ======================================================
  const rand = (min, max) => Math.floor(Math.random()*(max-min+1)) + min;
  const setTxt = (el, t) => { if (el) el.textContent = String(t); };
  const barajar = (arr) => { for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };

  function rangoPorDificultad(){
    if (dificultad === 'facil') return [0, 10];
    if (dificultad === 'medio') return [0, 20];
    return [0, 50];
  }
  function tiempoPorDificultad(){
    const extra = Number(localStorage.getItem('extra_time') || 0);
    if (dificultad === 'facil') return 14000 + extra;
    if (dificultad === 'medio') return 10000 + extra;
    return 7000 + extra;
  }
  function elegirOperacion(){
    if (operacion !== 'mixto') return operacion;
    let pick = Math.random() < 0.5 ? 'suma' : 'resta';
    if (lastOpUsed === pick && sameOpStreak >= 2){
      pick = (pick === 'suma') ? 'resta' : 'suma';
    }
    if (lastOpUsed === pick){ sameOpStreak++; }
    else { sameOpStreak = 1; lastOpUsed = pick; }
    return pick;
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
    timerText.style.display = ''; timerText.setAttribute('aria-hidden','false');
    timerBar.style.display  = ''; timerBar.setAttribute('aria-hidden','false');
  }
  function hideTimer(){
    timerText.style.display = 'none'; timerText.setAttribute('aria-hidden','true');
    timerBar.style.display  = 'none'; timerBar.setAttribute('aria-hidden','true');
  }
  function stopTimer(){ if (timerId){ clearInterval(timerId); timerId = null; } }
  function startTimer(ms){
    stopTimer(); timeMax = ms; timeLeft = ms; updateTimerUI();
    timerId = setInterval(()=>{
      timeLeft -= 100;
      if (timeLeft <= 0){ timeLeft = 0; updateTimerUI(); stopTimer(); tiempoAgotado(); }
      else updateTimerUI();
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
    if (timeLeft > 0){ if (pct <= 15) level = 'alert'; else if (pct <= 35) level = 'warn'; }
    timerFill.dataset.level = level;
  }

  // ======================================================
  // OPCIONES
  // ======================================================
  function limpiarEstadosOpciones(){
    opcionesEl.querySelectorAll('button').forEach(b=>{
      b.classList.remove('is-selected','ok','bad','marcada'); b.disabled = false;
    });
  }
  function marcarSeleccion(b){
    opcionesEl.querySelectorAll('button').forEach(x=>x.classList.remove('is-selected'));
    b.classList.add('is-selected');
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
    document.addEventListener('keydown', (e)=>{
      const k = e.key.toUpperCase();
      const idx = ['A','B','C','D'].indexOf(k);
      if (idx >= 0) opcionesEl.children[idx]?.click();
    }, {once:true});
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

  // Botón principal (Continuar)
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
  linkOtroJuego.target = '_blank';          // opcional: nueva pestaña
  linkOtroJuego.rel = 'noopener noreferrer';// seguridad/perform.
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
    const tiempoPromedio = (rondasTotales > 0) ? Math.round(totalTiempoAcumuladoMs / rondasTotales) : null;
    const texto = cierreDeSesion({ aciertos, rondas: rondasTotales, tiempoPromedioMs: tiempoPromedio });
    const pct = Math.round((aciertos / Math.max(1, rondasTotales)) * 100);

    setTxt(enunciado, 'Sesión finalizada');
    setTxt(feedback, texto);
    feedback.className = (pct >= 70) ? 'feedback ok' : (pct >= 50 ? 'feedback muted' : 'feedback bad');

    renderFinalActions(pct);

    btnReiniciar.hidden = false;
    btnComenzar.hidden = true;

    actualizarUI();
    hideTimer();
    setTxt(timerText, '');
    timerFill.style.width = '0%';
    timerFill.dataset.level = 'normal';
  }

  function cambiarDificultad(delta){
    const orden = ['facil','medio','avanzado'];
    let idx = orden.indexOf(dificultad);
    idx = Math.max(0, Math.min(orden.length-1, idx + delta));
    difSel.value = orden[idx];
    btnComenzar.click();
  }

  // ======================================================
  // FLUJO DE JUEGO
  // ======================================================
  function nuevaPregunta(){
    const [min, max] = rangoPorDificultad();
    const op = elegirOperacion();
    let a = rand(min, max), b = rand(min, max);

    if (op === 'resta'){
      if (b > a) [a,b] = [b,a];
      respuestaCorrecta = a - b;
      setTxt(enunciado, `${a} − ${b} = ?`);
    } else {
      respuestaCorrecta = a + b;
      setTxt(enunciado, `${a} + ${b} = ?`);
    }

    const distractores = generarDistractores(respuestaCorrecta, min, max).slice(0, 6);
    const opciones = barajar([respuestaCorrecta, ...barajar(distractores).slice(0,3)]);

    limpiarEstadosOpciones();
    renderOpciones(opciones);

    setTxt(feedback, '');
    feedback.className = 'feedback muted';
    finalActions.hidden = true;

    actualizarUI();
    showTimer();
    startTimer(tiempoPorDificultad());
  }

  function actualizarUI(){
    setTxt(progTxt, `${Math.min(ronda, rondasTotales)}/${rondasTotales}`);
    setTxt(aciertosEl, aciertos);
    const pct = Math.round((Math.min(ronda, rondasTotales)/rondasTotales) * 100);
    pbFill.style.width = pct + '%';
  }

  function bloquearOpciones(){ opcionesEl.querySelectorAll('button').forEach(b=> b.disabled = true); }

  function marcarCorrectaVisual(){
    const correctoBtn = Array.from(opcionesEl.children).find(el => Number(el.getAttribute('data-val')) === respuestaCorrecta);
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
    } else {
      setTxt(feedback, `✘ Casi. Respuesta correcta: ${respuestaCorrecta}.`);
      feedback.className = 'feedback bad';
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

    ronda = 0; aciertos = 0; totalTiempoAcumuladoMs = 0;

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

    ronda = 0; aciertos = 0; totalTiempoAcumuladoMs = 0;

    actualizarUI();
    hideTimer();
    setTxt(timerText, '');

    timerFill.style.width = '0%';
    timerFill.dataset.level = 'normal';

    finalActions.hidden = true;
  });

  try{
    const op = localStorage.getItem('calc_op');
    if (op && ['suma','resta','mixto'].includes(op)) opSel.value = op;

    const df = localStorage.getItem('calc_diff');
    if (df && ['facil','medio','avanzado'].includes(df)) difSel.value = df;

    const rs = localStorage.getItem('calc_rondas');
    if (rs && ['6','8','10'].includes(rs)) ronSel.value = rs;
  }catch{}

  // ======================================================
  // TEMA
  // ======================================================
  function applyTheme(mode){
    const m = (mode === 'light' || mode === 'dark') ? mode : 'dark';
    document.documentElement.setAttribute('data-theme', m);

    const isDark = (m === 'dark');
    themeBtn.setAttribute('aria-pressed', String(isDark));
    themeBtn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    themeBtn.setAttribute('title', isDark ? 'Cambiar a claro' : 'Cambiar a oscuro');

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', m === 'dark' ? '#0b0b0b' : '#ffffff');
  }

  (function initTheme(){
    let mode = 'dark';
    try{
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') { mode = stored; }
      else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) { mode = 'light'; }
    }catch{}
    applyTheme(mode);
  })();

  try {
    if (!localStorage.getItem('theme') && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      mq.addEventListener?.('change', (e) => applyTheme(e.matches ? 'light' : 'dark'));
    }
  } catch {}

  themeBtn?.addEventListener('click', ()=>{
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch {}
    applyTheme(next);
  });

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
  // INIT
  // ======================================================
  actualizarUI();
  hideTimer();
  finalActions.hidden = true;
});


