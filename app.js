'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const VERSION = "v1.1 (opciones)";
  const versionEl = document.getElementById('versionLabel');
  if (versionEl) versionEl.textContent = VERSION;

  // Refs
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

  // Estado
  let rondasTotales = 8, ronda = 0, aciertos = 0;
  let operacion = 'suma';
  let dificultad = 'facil';
  let respuestaCorrecta = null;

  // Utils
  const rand = (min, max) => Math.floor(Math.random()*(max-min+1)) + min;
  const setTxt = (el, t) => { if (el) el.textContent = String(t); };
  const barajar = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };

  function rangoPorDificultad(){
    if (dificultad === 'facil') return [0, 10];
    if (dificultad === 'medio') return [0, 20];
    return [0, 50]; // avanzado
  }

  function elegirOperacion(){
    if (operacion === 'mixto'){
      return Math.random() < 0.5 ? 'suma' : 'resta';
    }
    return operacion;
  }

  function generarDistractores(correcta, min, max){
    const set = new Set([correcta]);
    const candidatos = [];

    // cercanos +/-1..3
    for (let d of [1,2,3]){
      candidatos.push(correcta + d, correcta - d);
    }
    // límites de rango
    candidatos.push(min, max);

    // aleatorios del rango
    for (let i=0;i<6;i++) candidatos.push(rand(min, max));

    // filtrar fuera de rango y duplicados y no-negativos si el rango es >=0
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

  // Teclado A–D (mayúsculas o minúsculas)
  const keyHandler = (e)=>{
    const k = e.key.toUpperCase();
    const idx = letras.indexOf(k);
    if (idx >= 0) {
      opcionesEl.children[idx]?.click();
    }
  };
  document.addEventListener('keydown', keyHandler, {once:true});
}


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

    // generar 3 distractores plausibles
    const distractores = generarDistractores(respuestaCorrecta, min, max).slice(0, 6);
    const opciones = barajar([respuestaCorrecta, ...barajar(distractores).slice(0,3)]);
    renderOpciones(opciones);

    setTxt(feedback, '');
    feedback.className = 'feedback muted';
    actualizarUI();
  }

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

  function elegir(valor, btn){
    const ok = (valor === respuestaCorrecta);

    bloquearOpciones();
    btn.classList.add('marcada');
    btn.classList.add(ok ? 'ok' : 'bad');

    // resaltar la correcta si falló
    if (!ok){
      const correctoBtn = Array.from(opcionesEl.children).find(el => Number(el.getAttribute('data-val')) === respuestaCorrecta);
      if (correctoBtn) correctoBtn.classList.add('ok');
    }

    if (ok){
      aciertos++;
      setTxt(feedback, '✔ ¡Correcto!');
      feedback.className = 'feedback ok';
    } else {
      setTxt(feedback, `✘ Casi. Respuesta correcta: ${respuestaCorrecta}.`);
      feedback.className = 'feedback bad';
    }

    // avanzar
    ronda++;
    if (ronda >= rondasTotales){
      setTxt(enunciado, '🎉 ¡Buen trabajo!');
      setTxt(feedback, `Resultado final: ${aciertos} de ${rondasTotales}.`);
      feedback.className = ok ? 'feedback ok' : 'feedback';
      btnReiniciar.hidden = false;
      btnComenzar.hidden = true;
      actualizarUI();
    } else {
      setTimeout(nuevaPregunta, 700);
    }
  }

  // Eventos
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

    nuevaPregunta();
  });

  btnReiniciar.addEventListener('click', ()=>{
    btnComenzar.hidden = false;
    btnReiniciar.hidden = true;
    setTxt(enunciado, 'Presioná “Comenzar” para iniciar.');
    setTxt(feedback, '');
    feedback.className = 'feedback muted';
    opcionesEl.innerHTML = '';
    ronda = 0; aciertos = 0;
    actualizarUI();
  });

  // Restaurar prefs
  try{
    const op = localStorage.getItem('calc_op');
    if (op && ['suma','resta','mixto'].includes(op)) opSel.value = op;

    const df = localStorage.getItem('calc_diff');
    if (df && ['facil','medio','avanzado'].includes(df)) difSel.value = df;

    const rs = localStorage.getItem('calc_rondas');
    if (rs && ['6','8','10'].includes(rs)) ronSel.value = rs;
  }catch{}

  // Tema
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

  // Modal ayuda
  function openAbout(){ aboutModal?.setAttribute('aria-hidden','false'); aboutClose?.focus(); }
  function closeAbout(){ aboutModal?.setAttribute('aria-hidden','true'); }
  aboutBtn?.addEventListener('click', openAbout);
  aboutClose?.addEventListener('click', closeAbout);
  aboutModal?.addEventListener('click', (e)=>{ if(e.target===aboutModal) closeAbout(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeAbout(); });

  // Init
  actualizarUI();
});


'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const VERSION = "v1.2 (opciones + timer)";
  const versionEl = document.getElementById('versionLabel');
  if (versionEl) versionEl.textContent = VERSION;

  // Refs
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

  // Estado
  let rondasTotales = 8, ronda = 0, aciertos = 0;
  let operacion = 'suma';
  let dificultad = 'facil';
  let respuestaCorrecta = null;

  // Timer estado
  let timerId = null;
  let timeLeft = 0;      // ms restantes
  let timeMax = 0;       // ms por pregunta

  // Utils
  const rand = (min, max) => Math.floor(Math.random()*(max-min+1)) + min;
  const setTxt = (el, t) => { if (el) el.textContent = String(t); };
  const barajar = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };

  function rangoPorDificultad(){
    if (dificultad === 'facil') return [0, 10];
    if (dificultad === 'medio') return [0, 20];
    return [0, 50]; // avanzado
  }

  // Tiempo por dificultad (ms)
  function tiempoPorDificultad(){
    if (dificultad === 'facil') return 14000;   // 14s
    if (dificultad === 'medio') return 10000;   // 10s
    return 7000;                                // 7s
  }

  function elegirOperacion(){
    if (operacion === 'mixto'){
      return Math.random() < 0.5 ? 'suma' : 'resta';
    }
    return operacion;
  }

  function generarDistractores(correcta, min, max){
    const set = new Set([correcta]);
    const candidatos = [];

    // cercanos +/-1..3
    for (let d of [1,2,3]){
      candidatos.push(correcta + d, correcta - d);
    }
    // límites de rango
    candidatos.push(min, max);

    // aleatorios del rango
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

  // ===== Timer =====
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
        // tiempo agotado: marcar incorrecto y avanzar
        tiempoAgotado();
      } else {
        updateTimerUI();
      }
    }, 100);
  }
  function updateTimerUI(){
    if (timerText){
      const s = Math.ceil(timeLeft / 1000);
      setTxt(timerText, s > 0 ? `Tiempo: ${s} s` : 'Tiempo: 0 s');
    }
    if (timerFill && timeMax > 0){
      const pct = Math.max(0, Math.min(100, Math.round((timeLeft / timeMax) * 100)));
      timerFill.style.width = pct + '%';
    }
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
      b.addEventListener('click', ()=> elegir(val, b));
      opcionesEl.appendChild(b);
    });

    // Teclado A–D (mayúsculas o minúsculas)
    const keyHandler = (e)=>{
      const letras = ['A','B','C','D'];
      const k = e.key.toUpperCase();
      const idx = letras.indexOf(k);
      if (idx >= 0) {
        opcionesEl.children[idx]?.click();
      }
    };
    document.addEventListener('keydown', keyHandler, {once:true});
  }

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

    // arrancar tiempo para esta pregunta
    startTimer(tiempoPorDificultad());
  }

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
    const correctoBtn = Array.from(opcionesEl.children).find(el => Number(el.getAttribute('data-val')) === respuestaCorrecta);
    if (correctoBtn) correctoBtn.classList.add('ok');
  }

  function elegir(valor, btn){
    stopTimer(); // ← detener al responder

    const ok = (valor === respuestaCorrecta);

    bloquearOpciones();
    btn.classList.add('marcada');
    btn.classList.add(ok ? 'ok' : 'bad');

    if (!ok){ marcarCorrectaVisual(); }

    if (ok){
      aciertos++;
      setTxt(feedback, '✔ ¡Correcto!');
      feedback.className = 'feedback ok';
    } else {
      setTxt(feedback, `✘ Casi. Respuesta correcta: ${respuestaCorrecta}.`);
      feedback.className = 'feedback bad';
    }

    // avanzar
    ronda++;
    if (ronda >= rondasTotales){
      setTxt(enunciado, '🎉 ¡Buen trabajo!');
      setTxt(feedback, `Resultado final: ${aciertos} de ${rondasTotales}.`);
      feedback.className = ok ? 'feedback ok' : 'feedback';
      btnReiniciar.hidden = false;
      btnComenzar.hidden = true;
      actualizarUI();
      stopTimer();
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
      setTxt(timerText, '');
      if (timerFill) timerFill.style.width = '0%';
    } else {
      setTimeout(nuevaPregunta, 800);
    }
  }

  // Eventos
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
    setTxt(timerText, '');
    if (timerFill) timerFill.style.width = '0%';
  });

  // Restaurar prefs
  try{
    const op = localStorage.getItem('calc_op');
    if (op && ['suma','resta','mixto'].includes(op)) opSel.value = op;

    const df = localStorage.getItem('calc_diff');
    if (df && ['facil','medio','avanzado'].includes(df)) difSel.value = df;

    const rs = localStorage.getItem('calc_rondas');
    if (rs && ['6','8','10'].includes(rs)) ronSel.value = rs;
  }catch{}

  // Tema
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

  // Modal ayuda
  function openAbout(){ aboutModal?.setAttribute('aria-hidden','false'); aboutClose?.focus(); }
  function closeAbout(){ aboutModal?.setAttribute('aria-hidden','true'); }
  aboutBtn?.addEventListener('click', openAbout);
  aboutClose?.addEventListener('click', closeAbout);
  aboutModal?.addEventListener('click', (e)=>{ if(e.target===aboutModal) closeAbout(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeAbout(); });

  // Init
  actualizarUI();
});
