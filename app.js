'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const VERSION = "v1.0";
  const versionEl = document.getElementById('versionLabel');
  if (versionEl) versionEl.textContent = VERSION;

  // Refs
  const opSel   = document.getElementById('operacion');
  const difSel  = document.getElementById('dificultad');
  const ronSel  = document.getElementById('rondas');

  const btnComenzar  = document.getElementById('btnComenzar');
  const btnReiniciar = document.getElementById('btnReiniciar');
  const btnComprobar = document.getElementById('btnComprobar');
  const inputResp    = document.getElementById('inputResp');

  const enunciado = document.getElementById('enunciado');
  const feedback  = document.getElementById('feedback');

  const pbFill    = document.getElementById('pbFill');
  const progTxt   = document.getElementById('progTxt');
  const aciertosEl= document.getElementById('aciertos');

  const themeBtn  = document.getElementById('themeToggle');
  const aboutBtn  = document.getElementById('aboutBtn');
  const aboutModal= document.getElementById('aboutModal');
  const aboutClose= document.getElementById('aboutClose');

  const teclado   = document.querySelector('.teclado');

  // Estado
  let rondasTotales = 8, ronda = 0, aciertos = 0;
  let operacion = 'suma';
  let dificultad = 'facil';
  let respuestaCorrecta = null;

  // Utils
  const rand = (min, max) => Math.floor(Math.random()*(max-min+1)) + min;
  const setTxt = (el, t) => { if (el) el.textContent = String(t); };

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

  function nuevaPregunta(){
    const [min, max] = rangoPorDificultad();
    const op = elegirOperacion();
    let a = rand(min, max), b = rand(min, max);

    if (op === 'resta'){
      // evitar negativos: mayor - menor
      if (b > a) [a,b] = [b,a];
      respuestaCorrecta = a - b;
      setTxt(enunciado, `${a} − ${b} = ?`);
    } else {
      respuestaCorrecta = a + b;
      setTxt(enunciado, `${a} + ${b} = ?`);
    }

    inputResp.value = '';
    inputResp.disabled = false;
    btnComprobar.disabled = false;
    inputResp.focus();

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

  function comprobar(){
    const val = Number(inputResp.value);
    if (Number.isNaN(val) || inputResp.value === '') {
      setTxt(feedback, 'Ingresá una respuesta.');
      feedback.className = 'feedback bad';
      inputResp.focus();
      return;
    }

    const ok = (val === respuestaCorrecta);
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
    inputResp.disabled = true;
    btnComprobar.disabled = true;

    if (ronda >= rondasTotales){
      // fin
      setTxt(enunciado, '🎉 ¡Buen trabajo!');
      setTxt(feedback, `Resultado final: ${aciertos} de ${rondasTotales}.`);
      feedback.className = ok ? 'feedback ok' : 'feedback';
      btnReiniciar.hidden = false;
      btnComenzar.hidden = true;
      actualizarUI();
    } else {
      // próxima
      setTimeout(nuevaPregunta, 600);
    }
  }

  // Teclado táctil
  teclado.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if (!btn || inputResp.disabled) return;

    const n = btn.getAttribute('data-n');
    const act = btn.getAttribute('data-act');

    if (n != null){
      inputResp.value = (inputResp.value || '') + n;
      inputResp.focus();
    } else if (act === 'borrar'){
      inputResp.value = '';
      inputResp.focus();
    } else if (act === 'enviar'){
      comprobar();
    }
  });

  // Enter para comprobar
  inputResp.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter') comprobar();
  });

  // Eventos
  btnComprobar.addEventListener('click', comprobar);

  btnComenzar.addEventListener('click', ()=>{
    operacion = opSel.value;
    dificultad = difSel.value;
    rondasTotales = Number(ronSel.value);

    // persistir preferencias
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
