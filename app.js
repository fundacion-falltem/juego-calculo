'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const VERSION = "v1.2.3 (opciones + timer + alerta + mixto balanceado)";
  const versionEl = document.getElementById('versionLabel');
  if (versionEl) versionEl.textContent = VERSION;

  // ===== Refs
  const opSel   = document.getElementById('operacion');
  const difSel  = document.getElementById('dificultad');
  const ronSel  = document.getElementById('rondas');

  const btnComenzar  = document.getElementById('btnComenzar');
  const btnReiniciar = document.getElementById('btnReiniciar');

  const enunciado = document.getElementById('enunciado');
  const feedback  = document.getElementById('feedback');
  const opcionesEl= document.getElementById('opciones');

  const pbFill    = document.getElementById('pbFill');
  const progTxt   = document.getElementById('progTxt');
  const aciertosEl= document.getElementById('aciertos');

  const themeBtn  = document.getElementById('themeToggle');
  const aboutBtn  = document.getElementById('aboutBtn');
  const aboutModal= document.getElementById('aboutModal');
  const aboutClose= document.getElementById('aboutClose');

  // Timer
  const timerText = document.getElementById('timerText');
  const timerFill = document.getElementById('timerFill');
  const timerBar  = document.querySelector('.timerBar');

  // ===== Estado
  let rondasTotales = 8, ronda = 0, aciertos = 0;
  let operacion = 'suma';
  let dificultad = 'facil';
  let respuestaCorrecta = null;

  // control de “mixto”
  let lastOpUsed = null;
  let sameOpStreak = 0;

  // Timer estado
  let timerId = null;
  let timeLeft = 0;  // ms
  let timeMax  = 0;  // ms

  // ===== Utils
  const rand = (min, max) => Math.floor(Math.random()*(max-min+1)) + min;
  const setTxt = (el, t) => { if (el) el.textContent = String(t); };
  const barajar = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };

  function rangoPorDificultad(){
    if (dificultad === 'facil') return [0, 10];
    if (dificultad === 'medio') return [0, 20];
    return [0, 50]; // avanzado
  }
  function tiempoPorDificultad(){
    if (dificultad === 'facil') return 14000; // 14 s
    if (dificultad === 'medio') return 10000; // 10 s
    return 7000;                              // 7 s
  }

  function elegirOperacion(){
    if (operacion !== 'mixto') return operacion;

    let pick = Math.random() < 0.5 ? 'suma' : 'resta';
    // Evitar 3 seguidas del mismo tipo
    if (lastOpUsed === pick && sameOpStreak >= 2){
      pick = (pick === 'suma') ? 'resta' : 'suma';
    }
    // Actualizar racha
    if (lastOpUsed === pick){
      sameOpStreak++;
    } else {
      sameOpStreak = 1;
      lastOpUsed = pick;
    }
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
        set.add(n);
        result.push(n);
      }
      if (result.length >= 6) break;
    }
    return result;
  }

  // ===== Timer helpers
  function showTimer(){
    if (timerText){ timerText.style.display = ''; timerText.setAttribute('aria-hidden','false'); }
    if (timerBar){ timerBar.style.display = ''; timerBar.setAttribute('aria-hidden','true'); }
  }
  function hideTimer(){
    if (timerText){ timerText.style.display = 'none'; timerText.setAttribute('aria-hidden','true'); }
    if (timerBar){ timerBar.style.display = 'none'; timerBar.setAttribute('aria-hidden','true'); }
  }

  function stopTimer(){
    if (timerId){ clearInterval(timerId); timerId = null; }
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
    // texto
    if (timerText){
      const s = Math.ceil(timeLeft / 1000);
      setTxt(timerText, s > 0 ? `Tiempo: ${s} s` : 'Tiempo: 0 s');
      const alerta = timeLeft <= 3000 && timeLeft > 0;
      timerText.classList.toggle('timer-alert', alerta);
      timerText.classList.toggle('timer-pulse', alerta);
      if (alerta && navigator.vibrate) navigator.vibrate(40);
    }
    // barra
    if (timerFill && timeMax > 0){
      const pct = Math.max(0, Math.min(100, Math.round((timeLeft / timeMax) * 100)));
      timerFill.style.width = pct + '%';
      timerFill.classList.toggle('timer-alert', timeLeft <= 3000 && timeLeft > 0);
    }
  }

  // ===== Render de opciones A–D
  function renderOpciones(lista){
    const letras = ['A','B','C','D'];
    opcionesEl.innerHTML = '';
    lista.forEach((val, i)=>{
      const b = document.createElement('button');
      b.className = 'opcion-btn';
      b.setAttribute('data-val', String(val));
      b.setAttribute('aria-label', `Opción ${letras[i]}: ${val}`);
      b.innerHTML = `<strong>${letras[i]}.</strong> ${val}`;
      b.addEventListener('click', ()=> elegir(val, b));
      opcionesEl.appendChild(b);
    });

    // Teclado A–D
    const keyHandler = (e)=>{
      const k = e.key.toUpperCase();
      const idx = ['A','B','C','D'].indexOf(k);
      if (idx >= 0) opcionesEl.children[idx]?.click();
    };
    document.addEventListener('keydown', keyHandler, {once:true});
  }

  // ===== Nueva pregunta
  function nuevaPregunta(){
    const [min, max] = rangoPorDificultad();
    const op = elegirOperacion();
    let a = rand(min, max), b = rand(min, max);

    if (op === 'resta'){
      if (b > a) [a,b] = [b,a]; // evitar negativos
      respuestaCorrecta = a - b;
      setTxt(enunciado, `${a} − ${b} = ?`);
    } else {
      respuestaCorrecta = a + b;
      setTxt(enunciado, `${a} + ${b} = ?`);
    }

    const distractores = generarDistractores(respuestaCorrecta, min, max).slice(0, 6);
    const opciones = barajar([respuestaCorrecta, ...barajar(distractores).slice(0,3)]);
    renderOpciones(opciones);

    setTxt(feedback, '');
    feedback.className = 'feedback muted';
    actualizarUI();

    // tiempo por pregunta
    showTimer();
    startTimer(tiempoPorDificultad());
  }

  // ===== UI estado
  function actualizarUI(){
    setTxt(progTxt, `${Math.min(ronda, rondasTotales)}/${rondasTotales}`);
    setTxt(aciertosEl, aciertos);
    if (pbFill){
      const pct = Math.round((Math.min(ronda, rondasTotales)/rondasTotales) * 100);
      pbFill.style.width = pct + '%';
    }
  }
  function bloquearOpciones(){
    opcionesEl.querySelectorAll('button').forEach(b=> b.disabled = true);
  }
  function marcarCorrectaVisual(){
    const correctoBtn = Array.from(opcionesEl.children)
      .find(el => Number(el.getAttribute('data-val')) === respuestaCorrecta);
    if (correctoBtn) correctoBtn.classList.add('ok');
  }

  // ===== Respuesta / avance
  function elegir(valor, btn){
    stopTimer();

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
      setTxt(enunciado, '🎉 ¡Buen trabajo!');
      setTxt(feedback, `Resultado final: ${aciertos} de ${rondasTotales}.`);
      btnReiniciar.hidden = false;
      btnComenzar.hidden = true;
      actualizarUI();

      hideTimer();
      setTxt(timerText, '');
      if (timerFill) timerFill.style.width = '0%';
    } else {
      setTimeout(nuevaPregunta, 700);
    }
  }

  function tiempoAgotado(){
    bloquearOpciones();
    marcarCorrectaVisual();
    setTxt(feedback, `⏰ Tiempo agotado. La respuesta correcta era: ${respuestaCorrecta}.`);
    feedback.className = 'feedback bad';

    ronda++;
    if (ronda >= rondasTotales){
      setTxt(enunciado, '🎉 ¡Buen trabajo!');
      setTxt(feedback, `Resultado final: ${aciertos} de ${rondasTotales}.`);
      btnReiniciar.hidden = false;
      btnComenzar.hidden = true;
      actualizarUI();

      hideTimer();
      setTxt(timerText, '');
      if (timerFill) timerFill.style.width = '0%';
    } else {
      setTimeout(nuevaPregunta, 800);
    }
  }

  // ===== Eventos
  btnComenzar.addEventListener('click', ()=>{
    operacion = opSel.value;
    dificultad = difSel.value;
    rondasTotales = Number(ronSel.value);

    try{
      localStorage.setItem('calc_op', operacion);
      localStorage.setItem('calc_diff', dificultad);
      localStorage.setItem('calc_rondas', String(rondasTotales));
    }catch{}

    ronda = 0; aciertos = 0;
    btnComenzar.hidden = true;
    btnReiniciar.hidden = true;

    setTxt(timerText, '');
    if (timerFill) timerFill.style.width = '0%';

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

    ronda = 0; aciertos = 0;
    actualizarUI();

    hideTimer();
    setTxt(timerText, '');
    if (timerFill) timerFill.style.width = '0%';
  });

  // ===== Restaurar prefs
  try{
    const op = localStorage.getItem('calc_op');
    if (op && ['suma','resta','mixto'].includes(op)) opSel.value = op;

    const df = localStorage.getItem('calc_diff');
    if (df && ['facil','medio','avanzado'].includes(df)) difSel.value = df;

    const rs = localStorage.getItem('calc_rondas');
    if (rs && ['6','8','10'].includes(rs)) ronSel.value = rs;
  }catch{}

  // ===== Tema
  function applyTheme(mode){
    const m=(mode==='light'||mode==='dark')?mode:'dark';
    document.documentElement.setAttribute('data-theme', m);
    if (themeBtn){
      const isDark=(m==='dark');
      themeBtn.textContent = isDark ? 'Cambiar a claro' : 'Cambiar a oscuro';
      themeBtn.setAttribute('aria-pressed', String(isDark));
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', m==='dark' ? '#0b0b0b' : '#ffffff');
  }
  (function initTheme(){
    let mode='dark';
    try{
      const stored=localStorage.getItem('theme');
      if(stored==='light'||stored==='dark') mode=stored;
      else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) mode='light';
    }catch{}
    applyTheme(mode);
  })();
  themeBtn.addEventListener('click', ()=>{
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch {}
    applyTheme(next);
  });

  // ===== Modal ayuda
  function openAbout(){ aboutModal?.setAttribute('aria-hidden','false'); aboutClose?.focus(); }
  function closeAbout(){ aboutModal?.setAttribute('aria-hidden','true'); }
  aboutBtn?.addEventListener('click', openAbout);
  aboutClose?.addEventListener('click', closeAbout);
  aboutModal?.addEventListener('click', (e)=>{ if(e.target===aboutModal) closeAbout(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeAbout(); });

  // ===== Init
  actualizarUI();
  hideTimer(); // oculto timer hasta que arranque el juego
});

