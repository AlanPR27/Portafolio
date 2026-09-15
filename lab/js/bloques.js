/*
 * Módulo 4 — Blockchain 0.0.
 * La cadena editable con prueba de trabajo, la cascada de invalidación, el costo
 * de reminar y el ejercicio de predecir la cascada. Los bloques y su validación
 * viven en cadena.js; aquí sólo está la interfaz.
 */
import { Bloque, Cadena, ESTADO } from './cadena.js';
import {
  $,
  ETIQUETA_ESTADO,
  anunciar,
  arrancar,
  azar,
  boton,
  campo,
  ceros,
  el,
  fecha,
  formato,
  marca,
  pintarDigest,
  pintarJunta,
  plural,
  ponerEstado,
  sacudir,
  segundos,
  vaciarDigest,
} from './ui.js';

const INICIALES = ['Bloque génesis', 'Bob envía 50 a Alice', 'Alice envía 20 a Carol', 'Carol envía 5 a Dave'];

const cadena = new Cadena({ dificultad: 3 });
const vistas = [];
const trabajo = new WeakMap(); // bloque → intentos que costó su nonce actual
let control = null; // AbortController del minado en curso
let minando = null; // índice del bloque que se está minando
let estadosPrevios = [];
let turno = 0;
let esperaAnuncio = 0;

// ------------------------------------------------------------- 2.1 minar

function pintarDificultad() {
  const n = Number($('#dificultad').value);
  cadena.dificultad = n;
  $('#dificultad-valor').textContent = n;
  $('#esperados').textContent = formato.format(16 ** n);
}

function pintarProgreso({ indice, intentos, ms }) {
  $('#mina-bloque').textContent = String(indice);
  $('#mina-intentos').textContent = formato.format(intentos);
  $('#mina-tiempo').textContent = segundos(ms);
  $('#mina-tasa').textContent = ms > 0 ? `${formato.format(Math.round(intentos / (ms / 1000)))} /s` : '—';
}

/** Mina desde `desde` hasta el final, bloque por bloque y sin congelar la pestaña. */
async function minarDesde(desde, { agregado = false } = {}) {
  if (control) return false;
  // No se puede minar un bloque cuyo anterior no está minado: se empieza por el primero pendiente.
  const pendiente = cadena.bloques.findIndex((b) => !b.minado);
  const inicio = pendiente >= 0 ? Math.min(desde, pendiente) : desde;

  const propio = new AbortController();
  control = propio;
  $('#detener').disabled = false;
  const t0 = performance.now();
  let intentos = 0;
  let minados = 0;
  let completado = true;

  for (let i = inicio; i < cadena.bloques.length; i++) {
    minando = i;
    ponerEstado($('#mina-estado'), 'minando', `Minando el bloque ${i}: buscando un nonce que deje ${ceros(cadena.dificultad)} al inicio…`);
    await pintar();
    const acumulado = intentos;
    const resultado = await cadena.minar(i, {
      senal: propio.signal,
      alProgreso: (p) => pintarProgreso({ indice: i, intentos: acumulado + p.intentos, ms: performance.now() - t0 }),
    });
    intentos += resultado.intentos;
    pintarProgreso({ indice: i, intentos, ms: performance.now() - t0 });
    if (!resultado.encontrado) {
      completado = false;
      break;
    }
    trabajo.set(cadena.bloques[i], resultado.intentos);
    minados++;
  }

  const ms = performance.now() - t0;
  const detenidoEn = minando;
  minando = null;
  control = null;
  $('#detener').disabled = true;
  await pintar();

  let texto;
  if (!completado) {
    texto = `Minado detenido en el bloque ${detenidoEn} tras ${plural(intentos, 'intento', 'intentos')}. Ese bloque y los siguientes quedan sin arreglar.`;
    ponerEstado($('#mina-estado'), 'detenido', texto);
  } else if (agregado) {
    texto = `Bloque ${cadena.bloques.length - 1} minado con ${plural(intentos, 'intento', 'intentos')} en ${segundos(ms)}.`;
    ponerEstado($('#mina-estado'), 'valido', texto);
  } else {
    texto = `Reescritos ${plural(minados, 'bloque', 'bloques')} desde el ${inicio}: ${plural(intentos, 'intento', 'intentos')} en ${segundos(ms)}. Eso cuesta cambiar la historia a partir de ese punto.`;
    ponerEstado($('#mina-estado'), 'valido', texto);
  }
  anunciar(texto);
  return completado;
}

async function agregarBloque(datos) {
  if (control || !cadena.ultimo?.minado) return false;
  const bloque = cadena.agregar(datos);
  crearVista(bloque.indice);
  return minarDesde(bloque.indice, { agregado: true });
}

// ------------------------------------------------------------ 2.2 la cadena

function crearVista(i) {
  const bloque = cadena.bloques[i];
  const junta = el('div', 'junta');
  const articulo = el('article', 'bloque');
  const nombre = el('p', 'bloque-nombre', marca(), `Bloque ${i}`);
  nombre.id = `bloque-${i}-nombre`;
  articulo.setAttribute('aria-labelledby', nombre.id);
  const estado = el('span', 'bloque-estado');
  const motivo = el('p', 'motivo');

  const campos = el('dl', 'campos');
  const dd = {
    timestamp: campo(campos, 'Sello de tiempo'),
    dificultad: campo(campos, 'Dificultad'),
    nonce: campo(campos, 'Nonce'),
    trabajo: campo(campos, 'Intentos que costó'),
  };

  const datos = el('textarea');
  datos.id = `datos-${i}`;
  datos.rows = 2;
  datos.spellcheck = false;
  datos.value = bloque.datos;
  const etiqueta = el('label', null, 'Datos');
  etiqueta.htmlFor = datos.id;

  const hash = el('p', 'digest');
  const reminar = boton('Reminar desde aquí', 'secundario chico');

  articulo.append(
    el('div', 'bloque-cabeza', nombre, estado),
    motivo,
    campos,
    etiqueta,
    datos,
    el('span', 'rotulo', 'Hash'),
    hash,
    el('div', 'botones', reminar),
  );
  $('#cadena').append(el('li', null, junta, articulo));

  datos.addEventListener('input', async () => {
    if (control) return;
    await cadena.editar(i, datos.value);
    pintar({ origen: i });
  });
  reminar.addEventListener('click', () => minarDesde(i));

  vistas[i] = { junta, articulo, estado, motivo, dd, datos, hash, reminar };
}

async function pintar({ origen = null } = {}) {
  const mio = ++turno;
  const { valida, informes } = await cadena.validar();
  if (mio !== turno) return;

  let invalidos = 0;
  let heredados = 0;
  let intentosTotales = 0;

  informes.forEach((informe, i) => {
    const bloque = cadena.bloques[i];
    const v = vistas[i];
    const estado = minando === i ? 'minando' : informe.estado;
    if (informe.estado === ESTADO.INVALIDO) invalidos++;
    if (informe.estado === ESTADO.HEREDADO) heredados++;
    intentosTotales += trabajo.get(bloque) ?? 0;

    pintarJunta(v.junta, {
      primero: i === 0,
      anterior: i === 0 ? null : cadena.bloques[i - 1].hash,
      previo: bloque.hashPrevio,
      deQuien: `el bloque ${i - 1}`,
      aQuien: `el bloque ${i}`,
    });

    v.articulo.dataset.estado = estado;
    if (origen !== null && estado !== estadosPrevios[i] && (estado === ESTADO.INVALIDO || estado === ESTADO.HEREDADO)) {
      sacudir(v.articulo, Math.max(0, i - origen));
    }
    v.estado.textContent = ETIQUETA_ESTADO[estado];
    v.motivo.textContent = minando === i ? `Buscando un nonce que deje ${ceros(cadena.dificultad)} al inicio…` : informe.motivo;

    v.dd.timestamp.textContent = fecha(bloque.timestamp);
    v.dd.dificultad.textContent = ceros(bloque.dificultad);
    v.dd.nonce.textContent = bloque.nonce === null ? '—' : String(bloque.nonce);
    v.dd.trabajo.textContent = trabajo.has(bloque) ? formato.format(trabajo.get(bloque)) : '—';

    if (bloque.hash) pintarDigest(v.hash, bloque.hash, { marcarCeros: true });
    else vaciarDigest(v.hash, 'Sin minar.');

    v.reminar.textContent = bloque.minado ? 'Reminar desde aquí' : 'Minar desde aquí';
    v.reminar.disabled = control !== null || informe.estado === ESTADO.VALIDO;
    v.datos.readOnly = control !== null;
    if (document.activeElement !== v.datos && v.datos.value !== bloque.datos) v.datos.value = bloque.datos;
  });
  estadosPrevios = informes.map((inf, i) => (minando === i ? 'minando' : inf.estado));

  $('#n-bloques').textContent = formato.format(informes.length);
  $('#n-invalidos').textContent = formato.format(invalidos);
  $('#n-heredados').textContent = formato.format(heredados);
  $('#trabajo').textContent = formato.format(intentosTotales);

  const primero = informes.find((inf) => inf.estado !== ESTADO.VALIDO);
  let estado;
  let texto;
  if (control) {
    estado = 'minando';
    texto = `Minando el bloque ${minando}.`;
  } else if (valida) {
    estado = 'valido';
    texto = `Cadena válida: ${plural(informes.length, 'bloque íntegro', 'bloques íntegros')}, minados y enlazados.`;
  } else if (invalidos === 0 && heredados === 0) {
    estado = 'pendiente';
    texto = `Hay bloques sin minar, a partir del ${primero.indice}.`;
  } else {
    estado = 'invalido';
    texto = `Cadena rota desde el bloque ${primero.indice}: ${plural(invalidos, 'bloque inválido', 'bloques inválidos')} y ${plural(heredados, 'heredado', 'heredados')}.`;
  }
  const region = $('#cadena-estado');
  const cambio = region.querySelector('.estado-texto').textContent !== texto;
  ponerEstado(region, estado, texto);
  if (cambio && !control && origen !== null) {
    clearTimeout(esperaAnuncio);
    esperaAnuncio = setTimeout(() => anunciar(texto), 700);
  }

  $('#reminar-roto').disabled = control !== null || valida;
  $('#agregar').disabled = control !== null || !cadena.ultimo?.minado;
}

// ------------------------------------------------------ 3 ejercicio: predecir

const DATOS_RETO = [
  'Génesis: 100 monedas para Bob',
  'Bob envía 50 a Alice',
  'Alice envía 20 a Carol',
  'Carol envía 5 a Dave',
  'Dave envía 2 a Erin',
];

const reto = new Cadena({ dificultad: 2 });
let cambio = null; // { indice, alterado, antes, despues }

async function prepararReto() {
  reto.crearGenesis(DATOS_RETO[0]);
  await reto.minar(0);
  for (let i = 1; i < DATOS_RETO.length; i++) {
    reto.agregar(DATOS_RETO[i]);
    await reto.minar(i);
  }
}

function pintarReto(informes = null, predicciones = []) {
  const articulos = [];
  $('#pred-cadena').replaceChildren(...reto.bloques.map((bloque, i) => {
    const junta = el('div');
    pintarJunta(junta, {
      primero: i === 0,
      anterior: i === 0 ? null : reto.bloques[i - 1].hash,
      previo: bloque.hashPrevio,
      deQuien: `el bloque ${i - 1}`,
      aQuien: `el bloque ${i}`,
    });

    const estado = informes ? informes[i].estado : ESTADO.VALIDO;
    const articulo = el('article', 'bloque');
    articulo.dataset.estado = estado;
    articulo.append(el('div', 'bloque-cabeza', el('p', 'bloque-nombre', marca(), `Bloque ${i}`), el('span', 'bloque-estado', ETIQUETA_ESTADO[estado])));
    if (informes) articulo.append(el('p', 'motivo', informes[i].motivo));
    articulo.append(el('p', 'formula', bloque.datos));
    const hash = el('p', 'digest digest-chico');
    pintarDigest(hash, bloque.hash, { marcarCeros: true });
    articulo.append(hash);

    const selector = el('select');
    selector.id = `pred-${i}`;
    for (const [valor, texto] of [['', 'Elige…'], ['valido', 'Válido'], ['invalido', 'Inválido'], ['heredado', 'Heredado']]) {
      const opcion = el('option', null, texto);
      opcion.value = valor;
      selector.append(opcion);
    }
    selector.value = predicciones[i] ?? '';
    selector.disabled = Boolean(informes);
    const etiqueta = el('label', null, `Tu predicción para el bloque ${i}`);
    etiqueta.htmlFor = selector.id;
    const respuesta = el('div', 'respuesta', etiqueta, selector);
    if (informes) {
      const acierto = predicciones[i] === informes[i].estado;
      const veredicto = el('span', 'veredicto', acierto ? 'Acertaste.' : `No: queda ${ETIQUETA_ESTADO[informes[i].estado]}.`);
      veredicto.dataset.acierto = acierto ? 'si' : 'no';
      respuesta.append(veredicto);
    }
    articulo.append(respuesta);
    articulos.push(articulo);
    return el('li', null, junta, articulo);
  }));
  return articulos;
}

async function nuevoReto() {
  $('#pred-nuevo').disabled = true;
  // Restaurar los datos originales devuelve el hash original: el nonce no se tocó.
  if (cambio) await reto.editar(cambio.indice, DATOS_RETO[cambio.indice]);

  const indice = azar(reto.bloques.length - 1);
  const original = DATOS_RETO[indice];
  const antes = original.match(/\d+/)[0];
  const bloque = reto.bloques[indice];
  let factor = 10;
  let despues;
  let alterado;
  // Se descarta el cambio improbable (1 en 256) cuyo hash nuevo aún cumpliera la dificultad.
  do {
    despues = String(Number(antes) * factor);
    alterado = original.replace(antes, despues);
    factor *= 10;
  } while ((await new Bloque({ ...bloque, datos: alterado }).calcularHash()).startsWith('0'.repeat(bloque.dificultad)));

  cambio = { indice, alterado, antes, despues };
  $('#pred-cambio').textContent = `En el bloque ${indice} se va a cambiar «${antes}» por «${despues}»: «${original}» pasará a decir «${alterado}».`;
  pintarReto();
  ponerEstado($('#pred-estado'), 'pendiente', 'Elige un estado para cada bloque y aplica el cambio.');
  $('#pred-comprobar').disabled = false;
  $('#pred-nuevo').disabled = false;
}

async function comprobarReto() {
  const predicciones = reto.bloques.map((_, i) => $(`#pred-${i}`).value);
  if (predicciones.some((p) => !p)) {
    ponerEstado($('#pred-estado'), 'pendiente', 'Falta elegir el estado de algún bloque.');
    return;
  }

  await reto.editar(cambio.indice, cambio.alterado);
  const { informes } = await reto.validar();
  const articulos = pintarReto(informes, predicciones);
  const k = cambio.indice;
  articulos.forEach((articulo, i) => {
    if (informes[i].estado !== ESTADO.VALIDO) sacudir(articulo, i - k);
  });

  const n = reto.bloques.length;
  const partes = [`El bloque ${k} es inválido porque su hash ya no empieza con ${ceros(reto.bloques[k].dificultad)}.`];
  if (k + 1 < n) partes.push(`El ${k + 1} también es inválido, pero por otra razón: su hashPrevio ya no coincide con el hash nuevo del ${k}.`);
  if (k + 2 < n) partes.push(`Del ${k + 2} en adelante los bloques están bien formados, pero cuelgan de una historia rota: heredados.`);
  if (k === 1) partes.push('El bloque 0 no se entera: ningún bloque apunta hacia adelante.');
  if (k > 1) partes.push(`Los bloques 0 a ${k - 1} no se enteran: ningún bloque apunta hacia adelante.`);

  const aciertos = predicciones.filter((p, i) => p === informes[i].estado).length;
  const texto = aciertos === n
    ? `Todo correcto, ${aciertos} de ${n}. ${partes.join(' ')}`
    : `${aciertos} de ${n} correctos. ${partes.join(' ')}`;
  ponerEstado($('#pred-estado'), aciertos === n ? 'valido' : 'invalido', texto);
  anunciar(texto);
  $('#pred-comprobar').disabled = true;
}

// ------------------------------------------------------------------ arranque

arrancar(async () => {
  $('#dificultad').addEventListener('input', pintarDificultad);
  $('#agregar').addEventListener('click', () => agregarBloque($('#nuevo-datos').value));
  $('#detener').addEventListener('click', () => control?.abort());
  $('#reminar-roto').addEventListener('click', async () => {
    const { informes } = await cadena.validar();
    const roto = informes.find((inf) => inf.estado !== ESTADO.VALIDO);
    if (roto) minarDesde(roto.indice);
  });
  $('#pred-comprobar').addEventListener('click', comprobarReto);
  $('#pred-nuevo').addEventListener('click', nuevoReto);

  pintarDificultad();

  // La cadena del ejercicio se mina en paralelo: es pequeña y de dificultad 2.
  const ejercicio = prepararReto().then(nuevoReto);

  cadena.crearGenesis(INICIALES[0]);
  crearVista(0);
  if (await minarDesde(0, { agregado: true })) {
    for (const datos of INICIALES.slice(1)) {
      if (!(await agregarBloque(datos))) break;
    }
  }
  await ejercicio;
});
