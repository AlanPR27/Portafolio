/*
 * Módulo 1 — Función hash.
 * Laboratorio en vivo (digest y avalancha) y ejercicio de prueba de trabajo en
 * miniatura. La criptografía sale de crypto-utils.js y la interfaz común de ui.js.
 */
import {
  buscarNonce,
  cerosIniciales,
  diferenciaBits,
  hammingBytes,
  sha256Hex,
  utf8,
} from './crypto-utils.js';
import {
  $,
  anunciar,
  arrancar,
  ceros,
  formato,
  formatoDecimal,
  pintarDigest,
  plural,
  ponerEstado,
  vaciarDigest,
} from './ui.js';

const BITS = 256;
const MEDIA = BITS / 2; // 128: cada bit de salida cambia con probabilidad ½
const DESVIACION = Math.sqrt(BITS) / 2; // 8: la de una binomial Bin(256, ½)
const MAX_REGISTRO = 24;
const ALFABETO = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ---------------------------------------------------- 2.1 digest en vivo

function laboratorioDigest() {
  const entrada = $('#entrada');
  let turno = 0;

  async function actualizar() {
    const mio = ++turno;
    const texto = entrada.value;
    const digest = await sha256Hex(texto);
    if (mio !== turno) return; // ya llegó una tecla más reciente
    pintarDigest($('#digest'), digest);
    $('#n-caracteres').textContent = formato.format([...texto].length);
    $('#n-bytes').textContent = formato.format(utf8(texto).length);
  }

  entrada.addEventListener('input', actualizar);
  actualizar();
}

// ------------------------------------------------------- 2.2 avalancha

function cambiarUnCaracter(texto) {
  const caracteres = [...texto];
  if (caracteres.length === 0) return 'a';
  const i = Math.floor(Math.random() * caracteres.length);
  let nuevo;
  do {
    nuevo = ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  } while (nuevo === caracteres[i]);
  caracteres[i] = nuevo;
  return caracteres.join('');
}

function laboratorioAvalancha() {
  const a = $('#aval-a');
  const b = $('#aval-b');
  const rejilla = $('#rejilla');
  const anotar = $('#aval-anotar');
  const limpiar = $('#registro-limpiar');

  const celdas = Array.from({ length: BITS }, () => {
    const celda = document.createElement('span');
    rejilla.append(celda);
    return celda;
  });

  const registro = [];
  let ultima = null; // bits de la medición en pantalla, o null si A = B
  let turno = 0;
  let esperaAnuncio = 0;

  async function medir() {
    const mio = ++turno;
    const [digestA, digestB] = await Promise.all([sha256Hex(a.value), sha256Hex(b.value)]);
    if (mio !== turno) return undefined;

    const { distintos, mapa } = diferenciaBits(digestA, digestB);
    mapa.forEach((bit, i) => celdas[i].classList.toggle('on', bit === 1));
    pintarDigest($('#hex-a'), digestA, { otro: digestB });
    pintarDigest($('#hex-b'), digestB, { otro: digestA });

    $('#bits-cambiados').textContent = formato.format(distintos);
    $('#porcentaje').textContent = `${formatoDecimal.format((100 * distintos) / BITS)} %`;

    const bytesA = utf8(a.value);
    const bytesB = utf8(b.value);
    const bitsEntrada = hammingBytes(bytesA, bytesB);
    $('#dif-entrada').textContent = bitsEntrada === null
      ? `longitudes distintas: ${bytesA.length} y ${bytesB.length} bytes`
      : plural(bitsEntrada, 'bit', 'bits');

    let lectura;
    if (a.value === b.value) {
      lectura = 'Entradas idénticas, digests idénticos: 0 bits distintos. Eso es el determinismo.';
      ultima = null;
    } else {
      const z = Math.abs(distintos - MEDIA) / DESVIACION;
      const verbo = distintos === 1 ? 'cambió' : 'cambiaron';
      const juicio = z <= 2
        ? 'Dentro de lo esperado para una función ideal, que es 128 ± 16.'
        : 'Fuera de 128 ± 16: poco común, pero pasa en cerca del 5 % de las mediciones.';
      lectura = `${formato.format(distintos)} de 256 bits ${verbo}, a ${formatoDecimal.format(z)} desviaciones de los 128 esperados. ${juicio}`;
      ultima = distintos;
    }
    $('#aval-lectura').textContent = lectura;
    anotar.disabled = ultima === null;

    clearTimeout(esperaAnuncio);
    esperaAnuncio = setTimeout(() => anunciar(lectura), 700);
    return ultima;
  }

  function pintarRegistro() {
    $('#registro').replaceChildren(
      ...registro.map((bits) => {
        const barra = document.createElement('span');
        barra.style.setProperty('--v', String(bits / BITS));
        barra.title = `${bits} bits`;
        return barra;
      }),
    );
    const texto = $('#registro-texto');
    limpiar.disabled = registro.length === 0;
    if (registro.length === 0) {
      texto.textContent = 'Sin mediciones todavía.';
      return;
    }
    const media = registro.reduce((suma, x) => suma + x, 0) / registro.length;
    texto.textContent = `${plural(registro.length, 'medición', 'mediciones')}: media de ${formatoDecimal.format(media)} bits, mínimo ${Math.min(...registro)}, máximo ${Math.max(...registro)}.`;
  }

  function guardar(bits) {
    registro.push(bits);
    if (registro.length > MAX_REGISTRO) registro.shift();
    pintarRegistro();
  }

  a.addEventListener('input', medir);
  b.addEventListener('input', medir);

  $('#aval-azar').addEventListener('click', async () => {
    b.value = cambiarUnCaracter(a.value);
    const bits = await medir();
    if (typeof bits === 'number') guardar(bits);
  });

  $('#aval-igualar').addEventListener('click', () => {
    b.value = a.value;
    medir();
  });

  anotar.addEventListener('click', () => {
    if (ultima !== null) guardar(ultima);
  });

  limpiar.addEventListener('click', () => {
    registro.length = 0;
    pintarRegistro();
  });

  b.value = a.value; // B empieza igual a A, aunque el navegador restaure otro valor
  pintarRegistro();
  medir();
}

// ------------------------------------------- 3 ejercicio: prueba de trabajo

function ejercicioPrueba() {
  const texto = $('#pow-texto');
  const dificultad = $('#pow-n');
  const buscar = $('#pow-buscar');
  const detener = $('#pow-detener');
  const estado = $('#pow-estado');
  const manual = $('#pow-manual');
  let control = null;
  let turnoManual = 0;

  function pintarDificultad() {
    const n = Number(dificultad.value);
    $('#pow-n-valor').textContent = n;
    $('#pow-esperados').textContent = formato.format(16 ** n);
    $('#pow-prefijo').textContent = '0'.repeat(n);
  }

  function pintarProgreso({ intentos, ms }) {
    $('#pow-intentos').textContent = formato.format(intentos);
    $('#pow-tiempo').textContent = `${formatoDecimal.format(ms / 1000)} s`;
    const tasa = ms > 0 ? intentos / (ms / 1000) : 0;
    $('#pow-tasa').textContent = tasa > 0 ? `${formato.format(Math.round(tasa))} /s` : '—';
    return tasa;
  }

  function pintarExtrapolacion(tasa) {
    const salida = $('#pow-extrapolacion');
    if (!(tasa > 0)) {
      salida.replaceChildren();
      return;
    }
    // Invertir un digest completo es fijar sus 64 dígitos: unos 16^64 = 2^256 intentos.
    const segundosPorAnio = 365.25 * 24 * 3600;
    const log10Anios = 64 * Math.log10(16) - Math.log10(tasa) - Math.log10(segundosPorAnio);
    const exponente = document.createElement('sup');
    exponente.textContent = String(Math.round(log10Anios));
    salida.replaceChildren(
      `A ${formato.format(Math.round(tasa))} digests por segundo, fijar los 64 dígitos —invertir un digest completo— pediría del orden de 16⁶⁴ intentos: unos 10`,
      exponente,
      ' años. Eso es la resistencia a preimagen.',
    );
  }

  async function verificarManual() {
    const mio = ++turnoManual;
    const n = Number(dificultad.value);
    const bruto = manual.value.trim();
    const veredicto = $('#pow-veredicto');
    const salida = $('#pow-digest-manual');

    if (!/^\d+$/.test(bruto)) {
      $('#pow-cadena').textContent = `SHA-256(${JSON.stringify(texto.value)} ‖ nonce)`;
      vaciarDigest(salida);
      ponerEstado(veredicto, 'pendiente', 'Escribe un nonce: un entero sin signo, como 0, 1 o 2.');
      return;
    }

    $('#pow-cadena').textContent = `SHA-256(${JSON.stringify(texto.value)} ‖ ${JSON.stringify(bruto)})`;
    const digest = await sha256Hex(texto.value + bruto);
    if (mio !== turnoManual) return;

    pintarDigest(salida, digest, { marcarCeros: true });
    const k = cerosIniciales(digest);
    if (k >= n) {
      ponerEstado(veredicto, 'valido', `Lo lograste: el digest empieza con ${ceros(k)} y hacían falta ${n}.`);
    } else {
      ponerEstado(
        veredicto,
        'invalido',
        `Todavía no: el digest empieza con ${ceros(k)} y hacen falta ${n}. Cada nonce acierta con probabilidad 1 entre ${formato.format(16 ** n)}, así que a mano casi nunca sale.`,
      );
    }
  }

  function alCambiar() {
    pintarDificultad();
    control?.abort();
    verificarManual();
  }

  buscar.addEventListener('click', async () => {
    control?.abort();
    const propio = new AbortController();
    control = propio;

    const n = Number(dificultad.value);
    const prefijo = '0'.repeat(n);
    const base = texto.value;

    buscar.disabled = true;
    detener.disabled = false;
    $('#pow-resultado').hidden = true;
    ponerEstado(estado, 'minando', `Buscando un nonce que deje ${ceros(n)} al inicio…`);

    const resultado = await buscarNonce({
      construir: (nonce) => base + nonce,
      cumple: (digest) => digest.startsWith(prefijo),
      senal: propio.signal,
      alProgreso: pintarProgreso,
    });

    const tasa = pintarProgreso(resultado);
    if (control === propio) {
      control = null;
      buscar.disabled = false;
      detener.disabled = true;
    }

    if (resultado.encontrado) {
      $('#pow-nonce-encontrado').textContent = String(resultado.nonce);
      pintarDigest($('#pow-digest'), resultado.digest, { marcarCeros: true });
      $('#pow-resultado').hidden = false;
      pintarExtrapolacion(tasa);
      ponerEstado(
        estado,
        'valido',
        `Encontrado: el nonce ${resultado.nonce} deja ${ceros(cerosIniciales(resultado.digest))} al inicio, tras ${plural(resultado.intentos, 'intento', 'intentos')}. Se esperaban unos ${formato.format(16 ** n)}.`,
      );
      manual.value = String(resultado.nonce);
      verificarManual();
    } else {
      ponerEstado(
        estado,
        'detenido',
        `Búsqueda detenida tras ${plural(resultado.intentos, 'intento', 'intentos')}, sin encontrar un nonce.`,
      );
    }
  });

  detener.addEventListener('click', () => control?.abort());
  texto.addEventListener('input', alCambiar);
  dificultad.addEventListener('input', alCambiar);
  manual.addEventListener('input', verificarManual);
  $('#pow-verificar').addEventListener('click', verificarManual);

  pintarDificultad();
  verificarManual();
}

// ------------------------------------------------------------------ arranque

arrancar(() => {
  laboratorioDigest();
  laboratorioAvalancha();
  ejercicioPrueba();
});
