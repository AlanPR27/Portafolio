/*
 * Utilidades de interfaz compartidas por los cinco módulos: formato, anuncios
 * para lectores de pantalla, marcas de estado, digests y copiado.
 *
 * La criptografía no vive aquí sino en crypto-utils.js. Este archivo sólo
 * existe en el navegador; lo que se prueba con Node está en los otros.
 */
import { cerosIniciales, hayCriptoSegura, truncar } from './crypto-utils.js';

export const $ = (selector, raiz = document) => raiz.querySelector(selector);

export const formato = new Intl.NumberFormat('es-MX');
export const formatoDecimal = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
});

export const plural = (n, uno, varios) => `${formato.format(n)} ${n === 1 ? uno : varios}`;
export const ceros = (n) => plural(n, 'cero', 'ceros');

/** Fecha legible con milisegundos: los sellos de un mismo segundo también se ordenan. */
export const fecha = (ms) => formatoFecha.format(ms);

export const segundos = (ms) => `${formatoDecimal.format(ms / 1000)} s`;

export function azar(n) {
  return Math.floor(Math.random() * n);
}

// ------------------------------------------------------------------ anuncios

export function anunciar(texto) {
  const region = $('#anuncio');
  if (!region) return;
  region.textContent = '';
  // Un cuadro después, para que el lector de pantalla registre el cambio.
  requestAnimationFrame(() => {
    region.textContent = texto;
  });
}

export function ponerEstado(elemento, estado, texto) {
  elemento.dataset.estado = estado;
  elemento.querySelector('.estado-texto').textContent = texto;
}

// ------------------------------------------------------------------- digests

/**
 * Pinta un valor hexadecimal en palabras de 8. Invierte los dígitos que difieren
 * de `otro` y subraya los ceros iniciales si se pide: forma y contraste, no sólo
 * color. Deja el valor completo en data-completo para el botón de copiar.
 */
export function pintarDigest(elemento, digest, { otro = null, marcarCeros = false } = {}) {
  const cerosAlInicio = marcarCeros ? cerosIniciales(digest) : 0;
  const fragmento = document.createDocumentFragment();
  for (let i = 0; i < digest.length; i++) {
    if (i > 0 && i % 8 === 0) fragmento.append(' ');
    const caracter = digest[i];
    let clase = null;
    if (i < cerosAlInicio) clase = 'cero';
    else if (otro && otro[i] !== caracter) clase = 'dif';
    if (clase) {
      const marca = document.createElement('b');
      marca.className = clase;
      marca.textContent = caracter;
      fragmento.append(marca);
    } else {
      fragmento.append(caracter);
    }
  }
  elemento.replaceChildren(fragmento);
  elemento.dataset.completo = digest;
}

export function vaciarDigest(elemento, texto = '') {
  elemento.replaceChildren(texto);
  delete elemento.dataset.completo;
}

/**
 * Referencia a un digest: se lee truncada (8…8, la estrategia única del
 * laboratorio) y al pulsarla copia el valor completo.
 */
export function referencia(valor, que = 'digest') {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'ref';
  actualizarReferencia(boton, valor, que);
  return boton;
}

export function actualizarReferencia(boton, valor, que = 'digest') {
  boton.dataset.valor = valor;
  boton.textContent = truncar(valor);
  boton.title = `Copiar ${que} completo`;
  boton.setAttribute('aria-label', `${que} ${truncar(valor)}. Pulsa para copiar el valor completo.`);
}

// ----------------------------------------------------------- construcción

export const ETIQUETA_ESTADO = Object.freeze({
  valido: 'válido',
  invalido: 'inválido',
  heredado: 'heredado',
  pendiente: 'pendiente',
  minando: 'minando',
  detenido: 'detenido',
});

/** Crea un elemento con clase opcional e hijos (nodos o texto). */
export function el(etiqueta, clase = null, ...hijos) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  elemento.append(...hijos);
  return elemento;
}

export function marca() {
  const m = el('span', 'marca');
  m.setAttribute('aria-hidden', 'true');
  return m;
}

export function boton(texto, clase = null) {
  const b = el('button', clase, texto);
  b.type = 'button';
  return b;
}

/** Agrega un par dt/dd a una lista de campos. */
export function campo(lista, rotulo, ...valor) {
  const dd = el('dd', null, ...valor);
  lista.append(el('div', null, el('dt', null, rotulo), dd));
  return dd;
}

export const elegido = (nombre) => document.querySelector(`input[name="${nombre}"]:checked`);

/**
 * La junta entre dos eslabones de una cadena: el hash del anterior junto al
 * hashPrevio del actual. Si no coinciden, la línea del margen se disloca (CSS).
 * En el primero, el hashPrevio tiene que ser 64 ceros.
 */
export function pintarJunta(elemento, { primero = false, anterior = null, previo, deQuien, aQuien }) {
  elemento.className = primero ? 'junta origen' : 'junta';
  if (primero) {
    const ok = /^0{64}$/.test(previo);
    elemento.dataset.enlace = ok ? 'ok' : 'roto';
    elemento.replaceChildren(
      el('span', null, `hashPrevio de ${aQuien}`),
      referencia(previo, 'hashPrevio'),
      el('span', null, ok ? '64 ceros, por convención' : 'debería ser 64 ceros'),
    );
    return ok;
  }
  const ok = anterior !== null && anterior === previo;
  elemento.dataset.enlace = ok ? 'ok' : 'roto';
  const igual = el('span', 'igual', ok ? '=' : '≠');
  igual.setAttribute('aria-hidden', 'true');
  elemento.replaceChildren(
    el('span', null, `hash de ${deQuien}`),
    anterior === null ? el('span', null, 'sin minar') : referencia(anterior),
    igual,
    el('span', 'sr', ok ? 'coincide con el' : 'no coincide con el'),
    el('span', null, `hashPrevio de ${aQuien}`),
    referencia(previo, 'hashPrevio'),
  );
  return ok;
}

/** Sacude un eslabón que acaba de caer, con retraso proporcional a su distancia del origen. */
export function sacudir(elemento, distancia = 0) {
  elemento.style.setProperty('--k', String(distancia));
  elemento.classList.remove('golpe');
  void elemento.offsetWidth; // fuerza a que la animación vuelva a empezar
  elemento.classList.add('golpe');
  elemento.addEventListener('animationend', () => elemento.classList.remove('golpe'), { once: true });
}

// ------------------------------------------------------------------- copiado

function activarCopiado() {
  document.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-copiar], button.ref');
    if (!boton) return;
    const valor = boton.dataset.valor ?? document.querySelector(boton.dataset.copiar)?.dataset.completo;
    if (!valor) return;

    let exito = true;
    try {
      await navigator.clipboard.writeText(valor);
      anunciar('Valor completo copiado.');
    } catch {
      exito = false;
    }

    if (boton.classList.contains('ref')) {
      // La referencia no cambia de texto: se le cuelga una marca para no mover la línea.
      boton.dataset.aviso = exito ? 'copiado' : 'no se pudo copiar';
      setTimeout(() => delete boton.dataset.aviso, 1500);
      return;
    }
    boton.dataset.etiqueta ??= boton.textContent;
    boton.textContent = exito ? 'Copiado' : 'No se pudo copiar';
    setTimeout(() => {
      boton.textContent = boton.dataset.etiqueta;
    }, 1500);
  });
}

// ------------------------------------------------------------------ arranque

/**
 * Arranca un módulo sólo si hay Web Crypto. Si no la hay, el aviso del <head>
 * ya está visible y aquí se desactivan los controles para no fallar en silencio.
 */
export function arrancar(iniciar) {
  if (!hayCriptoSegura()) {
    for (const elemento of document.querySelectorAll('main input, main textarea, main button, main select')) {
      elemento.disabled = true;
    }
    return;
  }
  activarCopiado();
  Promise.resolve()
    .then(iniciar)
    .catch((error) => {
      console.error(error);
      anunciar('Algo falló al preparar el laboratorio. Recarga la página.');
    });
}
