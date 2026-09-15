/*
 * Módulo 3 — Sellado de tiempo.
 * Hash de un documento (texto o archivo), recibos encadenados, sello retroactivo,
 * publicación del último hash y el ejercicio de encontrar la primera falla.
 * La lógica de los recibos vive en sellos.js; aquí sólo está la interfaz.
 */
import { sha256Hex, utf8 } from './crypto-utils.js';
import {
  ALTERACIONES,
  contenidoRecibo,
  generarReto,
  insertarRetroactivo,
  reencadenar,
  sellar,
  validarSellos,
} from './sellos.js';
import {
  $,
  ETIQUETA_ESTADO,
  anunciar,
  arrancar,
  boton,
  campo,
  el,
  elegido,
  fecha,
  formato,
  marca,
  pintarDigest,
  pintarJunta,
  plural,
  ponerEstado,
  referencia,
  sacudir,
  vaciarDigest,
} from './ui.js';

let recibos = [];
let publicado = null;
let documento = null; // { hash, bytes, origen }
let estadosPrevios = [];
let reto = null;

// ------------------------------------------------------------ vista de recibo

/**
 * Un recibo como eslabón: la junta con el anterior y el propio recibo.
 * Sin informe, se pinta neutro: sin estado y sin decir si la junta coincide.
 */
function vistaRecibo(recibo, i, { anterior, informe = null, extra = [] }) {
  const junta = el('div');
  pintarJunta(junta, {
    primero: i === 0,
    anterior: anterior ? anterior.hashRecibo : null,
    previo: recibo.hashPrevio,
    deQuien: `el recibo ${i - 1}`,
    aQuien: `el recibo ${i}`,
  });
  if (!informe) {
    junta.className = i === 0 ? 'junta origen' : 'junta';
    delete junta.dataset.enlace;
    junta.querySelector('.igual')?.replaceChildren('‖');
    junta.querySelector('.sr')?.replaceChildren('y el');
  }

  const articulo = el('article', 'bloque');
  const cabeza = el('div', 'bloque-cabeza', el('p', 'bloque-nombre', marca(), `Recibo ${i}`));
  articulo.append(cabeza);
  if (informe) {
    articulo.dataset.estado = informe.estado;
    cabeza.append(el('span', 'bloque-estado', ETIQUETA_ESTADO[informe.estado]));
    articulo.append(el('p', 'motivo', informe.motivo));
  }

  const campos = el('dl', 'campos');
  campo(campos, 'Fecha', fecha(recibo.timestamp));
  campo(campos, 'timestamp, en ms', String(recibo.timestamp));
  campo(campos, 'hashDocumento', referencia(recibo.hashDocumento, 'hash del documento'));
  campo(campos, 'hashRecibo', referencia(recibo.hashRecibo, 'hashRecibo'));
  articulo.append(campos, ...extra);

  return { li: el('li', null, junta, articulo), articulo };
}

// ---------------------------------------------------------- 2.1 documento

function leerArchivo(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(new Uint8Array(lector.result));
    lector.onerror = () => rechazar(lector.error);
    lector.readAsArrayBuffer(archivo);
  });
}

let turnoDocumento = 0;

async function leerDocumento() {
  const mio = ++turnoDocumento;
  const modo = elegido('origen').value;
  $('#origen-texto').hidden = modo !== 'texto';
  $('#origen-archivo').hidden = modo !== 'archivo';

  let bytes;
  let origen;
  if (modo === 'texto') {
    bytes = utf8($('#doc-texto').value);
    origen = 'texto escrito aquí';
  } else {
    const archivo = $('#doc-archivo').files[0];
    if (!archivo) {
      documento = null;
      vaciarDigest($('#doc-digest'), 'Elige un archivo.');
      $('#doc-bytes').textContent = '—';
      $('#doc-origen').textContent = 'ningún archivo elegido';
      actualizarBotones();
      buscarDocumento();
      return;
    }
    try {
      bytes = await leerArchivo(archivo);
    } catch {
      if (mio !== turnoDocumento) return;
      documento = null;
      vaciarDigest($('#doc-digest'), 'No se pudo leer el archivo.');
      actualizarBotones();
      return;
    }
    origen = archivo.name;
  }

  const hash = await sha256Hex(bytes);
  if (mio !== turnoDocumento) return;
  documento = { hash, bytes: bytes.length, origen };
  pintarDigest($('#doc-digest'), hash);
  $('#doc-bytes').textContent = formato.format(bytes.length);
  $('#doc-origen').textContent = origen;
  actualizarBotones();
  buscarDocumento();
}

// --------------------------------------------------------- 2.2 los sellos

let reparable = false;

function actualizarBotones() {
  $('#sellar').disabled = !documento;
  $('#retroactivo').disabled = !documento || recibos.length < 2;
  $('#reencadenar').disabled = !reparable;
  $('#publicar').disabled = recibos.length === 0;
  $('#reiniciar').disabled = recibos.length === 0;
}

async function pintarSellos({ origen = null } = {}) {
  const { consistente, primeraFalla, informes } = await validarSellos(recibos, { publicado });

  const vistas = recibos.map((recibo, i) => vistaRecibo(recibo, i, { anterior: recibos[i - 1], informe: informes[i] }));
  $('#sellos').replaceChildren(...vistas.map((v) => v.li));
  if (origen !== null) {
    vistas.forEach((v, i) => {
      const estado = informes[i].estado;
      if (estado !== 'valido' && estado !== estadosPrevios[i]) sacudir(v.articulo, Math.max(0, i - origen));
    });
  }
  estadosPrevios = informes.map((inf) => inf.estado);

  // Recalcular arregla hashes, enlaces e índices; no arregla un hash ya publicado ni una fecha.
  reparable = informes.some((inf) => !inf.hashCoincide || !inf.enlaceCorrecto || !inf.indiceCorrecto);

  const estado = $('#sellos-estado');
  let texto;
  if (recibos.length === 0) {
    texto = 'No hay sellos. Sella el documento de 2.1.';
    ponerEstado(estado, 'pendiente', texto);
  } else if (consistente) {
    texto = `${plural(recibos.length, 'recibo consistente', 'recibos consistentes')}: cada uno engancha con el anterior.`;
    ponerEstado(estado, 'valido', texto);
  } else {
    texto = `La cadena de sellos deja de ser consistente en el recibo ${primeraFalla}. ${informes[primeraFalla].motivo}`;
    ponerEstado(estado, 'invalido', texto);
  }

  actualizarBotones();
  buscarDocumento();
  return texto;
}

async function sellarDocumento() {
  const recibo = await sellar(recibos, documento.hash, Date.now());
  const texto = await pintarSellos();
  anunciar(`Documento sellado en el recibo ${recibo.indice}. ${texto}`);
}

async function colarRetroactivo() {
  const recibo = await insertarRetroactivo(recibos, documento.hash);
  const texto = await pintarSellos({ origen: recibo.indice });
  anunciar(`Sello retroactivo insertado como recibo ${recibo.indice}, con fecha ${fecha(recibo.timestamp)}. ${texto}`);
}

async function recalcularPosterior() {
  const { informes } = await validarSellos(recibos, { publicado });
  const desde = informes.findIndex((inf) => !inf.hashCoincide || !inf.enlaceCorrecto || !inf.indiceCorrecto);
  if (desde < 0) return;
  await reencadenar(recibos, desde);
  const texto = await pintarSellos({ origen: desde });
  anunciar(`Recalculados los recibos del ${desde} en adelante. ${texto}`);
}

function publicarUltimo() {
  const ultimo = recibos.at(-1);
  publicado = { indice: recibos.length - 1, hashRecibo: ultimo.hashRecibo };
  $('#publicado-nota').replaceChildren(
    `Publicado el hashRecibo del recibo ${publicado.indice}: `,
    referencia(publicado.hashRecibo, 'hash publicado'),
    `. Desde ahora, el recibo en esa posición tiene que seguir teniendo exactamente ese hash.`,
  );
  pintarSellos();
  anunciar(`Publicado el hash del recibo ${publicado.indice}.`);
}

function vaciar() {
  recibos = [];
  publicado = null;
  estadosPrevios = [];
  $('#publicado-nota').textContent = 'Nada publicado todavía.';
  pintarSellos();
  anunciar('Lista de sellos vaciada.');
}

// ------------------------------------------------------ 2.3 comprobar documento

let turnoBusqueda = 0;

async function buscarDocumento() {
  const mio = ++turnoBusqueda;
  const estado = $('#busqueda-estado');
  if (!documento) {
    ponerEstado(estado, 'pendiente', 'Carga un documento en 2.1.');
    return;
  }
  const { informes } = await validarSellos(recibos, { publicado });
  if (mio !== turnoBusqueda) return;

  const posiciones = recibos.map((r, i) => (r.hashDocumento === documento.hash ? i : -1)).filter((i) => i >= 0);
  if (posiciones.length === 0) {
    ponerEstado(estado, 'pendiente', 'Ningún recibo sella este documento. Si alguien afirma que ya existía, en esta cadena no hay nada que lo pruebe; basta con cambiar un carácter para que deje de aparecer.');
    return;
  }
  const i = posiciones[0];
  const informe = informes[i];
  const varios = posiciones.length > 1 ? ` Aparece en ${posiciones.length} recibos; el primero es el que cuenta.` : '';
  if (informe.estado === 'valido') {
    ponerEstado(estado, 'valido', `Este documento está sellado en el recibo ${i}, con fecha ${fecha(recibos[i].timestamp)}, y ese recibo es consistente con todo lo anterior.${varios}`);
  } else {
    ponerEstado(estado, 'invalido', `Este documento aparece en el recibo ${i}, con fecha ${fecha(recibos[i].timestamp)}, pero ese recibo está ${ETIQUETA_ESTADO[informe.estado]}: ${informe.motivo} Mientras la cadena no sea consistente, el sello no prueba nada.${varios}`);
  }
}

// ------------------------------------------------------------- 3 ejercicio

function pintarReto(informes = null, elegida = null) {
  const vistas = reto.recibos.map((recibo, i) => {
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'reto-sello';
    radio.value = String(i);
    radio.checked = elegida === i;
    radio.disabled = Boolean(informes);
    const opcion = el('label', 'opcion', radio, ' Aquí deja de ser consistente');

    const salida = el('p', 'digest digest-chico');
    const rotulo = el('span', 'rotulo', 'Hash recalculado. Los dígitos invertidos difieren del hashRecibo guardado.');
    salida.hidden = true;
    rotulo.hidden = true;
    const recalcular = boton('Recalcular su hash', 'secundario chico');
    recalcular.addEventListener('click', async () => {
      const hash = await sha256Hex(contenidoRecibo(recibo));
      pintarDigest(salida, hash, { otro: recibo.hashRecibo });
      salida.hidden = false;
      rotulo.hidden = false;
      anunciar(hash === recibo.hashRecibo
        ? `El hash recalculado del recibo ${i} coincide con el guardado.`
        : `El hash recalculado del recibo ${i} no coincide con el guardado.`);
    });

    return vistaRecibo(recibo, i, {
      anterior: reto.recibos[i - 1],
      informe: informes ? informes[i] : null,
      extra: [el('div', 'respuesta', opcion, recalcular), rotulo, salida],
    });
  });
  $('#reto-sellos').replaceChildren(...vistas.map((v) => v.li));
  return vistas;
}

async function nuevoReto() {
  $('#reto-nuevo').disabled = true;
  $('#reto-comprobar').disabled = true;
  reto = await generarReto();
  pintarReto();
  ponerEstado($('#reto-estado'), 'pendiente', 'Marca el primer recibo inconsistente y comprueba.');
  $('#reto-nuevo').disabled = false;
  $('#reto-comprobar').disabled = false;
}

async function comprobarReto() {
  const opcion = elegido('reto-sello');
  const estado = $('#reto-estado');
  if (!opcion) {
    ponerEstado(estado, 'pendiente', 'Primero marca un recibo.');
    return;
  }
  const n = Number(opcion.value);
  const { informes } = await validarSellos(reto.recibos);
  const k = reto.primeraFalla;
  const vistas = pintarReto(informes, n);
  vistas.forEach((v, i) => {
    if (informes[i].estado !== 'valido') sacudir(v.articulo, i - k);
  });

  const explicacion = reto.tipo === 'documento'
    ? `Se alteró el recibo ${reto.alterado}: ${ALTERACIONES.documento.charAt(0).toLowerCase()}${ALTERACIONES.documento.slice(1)} Por eso ese recibo sigue siendo consistente consigo mismo, y la falla aparece en el ${k}, cuyo hashPrevio apunta al hash de antes.`
    : `Se alteró el recibo ${reto.alterado}: ${ALTERACIONES[reto.tipo].charAt(0).toLowerCase()}${ALTERACIONES[reto.tipo].slice(1)} ${informes[k].motivo}`;

  let texto;
  if (n === k) texto = `Correcto: el recibo ${k} es el primero que no pasa. ${explicacion}`;
  else if (n < k) texto = `No: el recibo ${n} es consistente con todo lo anterior. El primero que falla es el ${k}. ${explicacion}`;
  else texto = `No: antes del recibo ${n} ya hay uno que falla, el ${k}. ${explicacion}`;
  ponerEstado(estado, n === k ? 'valido' : 'invalido', texto);
  anunciar(texto);
  $('#reto-comprobar').disabled = true;
}

// ------------------------------------------------------------------ arranque

arrancar(async () => {
  for (const radio of document.querySelectorAll('input[name="origen"]')) radio.addEventListener('change', leerDocumento);
  $('#doc-texto').addEventListener('input', leerDocumento);
  $('#doc-archivo').addEventListener('change', leerDocumento);

  $('#sellar').addEventListener('click', sellarDocumento);
  $('#publicar').addEventListener('click', publicarUltimo);
  $('#reiniciar').addEventListener('click', vaciar);
  $('#retroactivo').addEventListener('click', colarRetroactivo);
  $('#reencadenar').addEventListener('click', recalcularPosterior);
  $('#reto-comprobar').addEventListener('click', comprobarReto);
  $('#reto-nuevo').addEventListener('click', nuevoReto);

  // Dos recibos de partida, para que haya algo que romper desde el principio.
  const ahora = Date.now();
  await sellar(recibos, await sha256Hex('Borrador del contrato de arrendamiento'), ahora - 120000);
  await sellar(recibos, await sha256Hex('Inventario de entrega del departamento'), ahora - 60000);

  await leerDocumento();
  await pintarSellos();
  await nuevoReto();
});
