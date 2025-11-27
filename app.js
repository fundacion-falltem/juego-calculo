/* ======================================================
   FALLTEM — Juego "Cálculo amable"
   app.js — versión con UI unificada (sin alterar lógica)
   ====================================================== */

/* ===== UTILIDADES ===== */
const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => [...parent.querySelectorAll(sel)];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ===== ELEMENTOS ===== */
const enunciado = $("#enunciado");
const feedback = $("#feedback");
const opciones = $("#opciones");
const progTxt = $("#progTxt");
const aciertosEl = $("#aciertos");
const pbFill = $("#pbFill");
const timerFill = $("#timerFill");
const timerText = $("#timerText");
const finalActions = $("#finalActions");
const srUpdates = $("#sr-updates");

const btnComenzar = $("#btnComenzar");
const btnReiniciar = $("#btnReiniciar");
const btnPause = $("#btnPause");

const selOperacion = $("#operacion");
const selRondas = $("#rondas");
const selDificultad = $("#dificultad");

const aboutBtn = $("#aboutBtn");
const aboutModal = $("#aboutModal");
const aboutClose = $("#aboutClose");
const aboutCloseX = $("#aboutCloseX");

const tabPorques = $("#tab-porques");
const tabComo = $("#tab-como");
const contentPorques = $("#content-porques");
const contentComo = $("#content-como");

let jugando = false;
let pausa = false;
let rondaActual = 0;
let totalRondas = 0;
let aciertos = 0;

let operacionElegida = "suma";
let dificultad = "facil";

let tiempoMax = 11500; // 11.5s
let tiempoIni = 0;

let timerId = null;
let preguntaActual = null;

/* ===== MODAL ===== */
function abrirModal() {
  aboutModal.removeAttribute("hidden");
  document.body.classList.add("no-scroll");
  aboutBtn.setAttribute("aria-expanded", "true");
}

function cerrarModal() {
  aboutModal.setAttribute("hidden", "");
  document.body.classList.remove("no-scroll");
  aboutBtn.setAttribute("aria-expanded", "false");
}

aboutBtn.addEventListener("click", abrirModal);
aboutClose.addEventListener("click", cerrarModal);
aboutCloseX.addEventListener("click", cerrarModal);

aboutModal.addEventListener("click", (e) => {
  if (e.target === aboutModal) cerrarModal();
});

/* ===== TABS MODAL ===== */
tabPorques.addEventListener("click", () => {
  tabPorques.classList.add("tab-btn--active");
  tabComo.classList.remove("tab-btn--active");
  contentPorques.hidden = false;
  contentComo.hidden = true;
});

tabComo.addEventListener("click", () => {
  tabComo.classList.add("tab-btn--active");
  tabPorques.classList.remove("tab-btn--active");
  contentComo.hidden = false;
  contentPorques.hidden = true;
});

/* ===== GENERAR OPERACIÓN ===== */
function generarOperacion() {
  const dif = selDificultad.value;
  let max = 10;
  if (dif === "medio") max = 20;
  if (dif === "avanzado") max = 50;

  let tipo = selOperacion.value;
  if (tipo === "mixto") {
    tipo = ["suma", "resta"][randInt(0, 1)];
  }

  let a = randInt(0, max);
  let b = randInt(0, max);

  if (tipo === "resta" && b > a) [a, b] = [b, a];
  if (tipo === "divi") {
    b = randInt(1, max);
    a = b * randInt(0, Math.floor(max / b));
  }

  let texto = "";
  let res = 0;

  switch (tipo) {
    case "suma":
      texto = `${a} + ${b}`;
      res = a + b;
      break;
    case "resta":
      texto = `${a} - ${b}`;
      res = a - b;
      break;
    case "multi":
      texto = `${a} × ${b}`;
      res = a * b;
      break;
    case "divi":
      texto = `${a} ÷ ${b}`;
      res = b === 0 ? 0 : a / b;
      break;
  }

  return { texto, resultado: res };
}

/* ===== MOSTRAR PREGUNTA ===== */
function mostrarPregunta() {
  preguntaActual = generarOperacion();
  enunciado.textContent = preguntaActual.texto;

  opciones.innerHTML = "";

  const correcta = preguntaActual.resultado;
  let respuestas = new Set([correcta]);

  while (respuestas.size < 4) {
    const desvio = randInt(-10, 10);
    const cand = correcta + desvio;
    if (cand !== correcta) respuestas.add(cand);
  }

  const lista = [...respuestas].sort(() => Math.random() - 0.5);

  lista.forEach((num) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "opcion-btn";
    btn.textContent = num;
    btn.addEventListener("click", () => seleccionarRespuesta(num));
    opciones.appendChild(btn);
  });
}

/* ===== SELECCIONAR RESPUESTA ===== */
function seleccionarRespuesta(num) {
  if (!jugando || pausa) return;

  const correcta = preguntaActual.resultado;

  opciones.querySelectorAll(".opcion-btn").forEach((btn) => {
    btn.setAttribute("aria-disabled", "true");
    if (Number(btn.textContent) === correcta) btn.classList.add("ok");
    else btn.classList.add("bad");
  });

  if (num === correcta) {
    aciertos++;
    feedback.textContent = "¡Bien!";
    srUpdates.textContent = "Respuesta correcta.";
  } else {
    feedback.textContent = "Incorrecto";
    srUpdates.textContent = "Respuesta incorrecta.";
  }

  aciertosEl.textContent = aciertos;

  clearInterval(timerId);
  setTimeout(siguienteRonda, 800);
}

/* ===== SIGUIENTE RONDA ===== */
function siguienteRonda() {
  rondaActual++;
  if (rondaActual > totalRondas) {
    finalizarSesion();
    return;
  }
  progreso();
  feedback.textContent = "";
  srUpdates.textContent = "";
  mostrarPregunta();
  iniciarTimer();
}

/* ===== PROGRESO ===== */
function progreso() {
  progTxt.textContent = `${rondaActual}/${totalRondas}`;
  const pct = Math.round((rondaActual - 1) / totalRondas * 100);
  pbFill.style.width = pct + "%";
}

/* ===== TIMER ===== */
function iniciarTimer() {
  clearInterval(timerId);

  tiempoIni = Date.now();
  timerId = setInterval(() => {
    const t = Date.now() - tiempoIni;
    const pct = Math.min(100, (t / tiempoMax) * 100);
    timerFill.style.width = pct + "%";

    if (pct >= 100) {
      clearInterval(timerId);

      opciones.querySelectorAll(".opcion-btn").forEach((btn) => {
        const correcta = preguntaActual.resultado;
        if (Number(btn.textContent) === correcta) btn.classList.add("ok");
      });

      feedback.textContent = "Tiempo agotado";
      srUpdates.textContent = "Tiempo agotado.";
      setTimeout(siguienteRonda, 900);
    }
  }, 25);
}

/* ===== FINALIZAR SESIÓN ===== */
function finalizarSesion() {
  jugando = false;
  clearInterval(timerId);

  const pct = Math.round((aciertos / totalRondas) * 100);

  enunciado.textContent = `¡Terminaste!`;
  feedback.textContent = `Aciertos: ${aciertos} de ${totalRondas} (${pct}%)`;
  opciones.innerHTML = "";
  timerFill.style.width = "0%";

  renderFinalActions(pct);
}

/* ===== ACCIONES FINALES (BOTONES) ===== */
function renderFinalActions(pct) {
  finalActions.innerHTML = "";

  // ⬅️ Botón principal: continuar / reforzar
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn principal";
  btn.textContent = pct >= 70 ? "Continuar" : "Reforzar este nivel";
  btn.addEventListener("click", () => reiniciar());
  finalActions.appendChild(btn);

  // ⬅️ 🔥 ARREGLO: "Elegir otro juego" ahora es principal (verde)
  const linkOtroJuego = document.createElement("a");
  linkOtroJuego.href = "https://falltem.org/juegos/#games-cards";
  linkOtroJuego.target = "_blank";
  linkOtroJuego.rel = "noopener noreferrer";
  linkOtroJuego.className = "btn principal"; // <--- CAMBIO
  linkOtroJuego.textContent = "Elegir otro juego";
  finalActions.appendChild(linkOtroJuego);

  finalActions.hidden = false;
}

/* ===== REINICIAR ===== */
function reiniciar() {
  rondaActual = 0;
  aciertos = 0;
  finalActions.hidden = true;
  feedback.textContent = "";
  srUpdates.textContent = "";
  iniciarSesion();
}

/* ===== INICIAR SESIÓN ===== */
function iniciarSesion() {
  jugando = true;
  pausa = false;

  operacionElegida = selOperacion.value;
  dificultad = selDificultad.value;
  totalRondas = Number(selRondas.value);

  enunciado.textContent = "";
  pbFill.style.width = "0%";
  aciertosEl.textContent = "0";

  btnPause.hidden = false;
  btnReiniciar.hidden = false;

  rondaActual = 1;
  progreso();
  mostrarPregunta();
  iniciarTimer();
}

/* ===== BOTÓN COMENZAR ===== */
btnComenzar.addEventListener("click", () => iniciarSesion());

/* ===== BOTÓN REINICIAR ===== */
btnReiniciar.addEventListener("click", () => reiniciar());

/* ===== BOTÓN PAUSA ===== */
btnPause.addEventListener("click", () => {
  if (!jugando) return;
  pausa = !pausa;

  if (pausa) {
    clearInterval(timerId);
    btnPause.textContent = "Reanudar";
    feedback.textContent = "Pausa";
  } else {
    btnPause.textContent = "Pausar";
    feedback.textContent = "";
    iniciarTimer();
  }
});

/* ===== VERSION ===== */
$("#versionLabel").textContent = "Versión 1.9.2 — UI unificada";
