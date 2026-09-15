/*
 * Módulo 5 — Transacción: custodia de lotes en una cadena de suministro.
 * Toda la lógica —revisión, bloques, trazabilidad y los tres ataques— vive en
 * suministro.js, que a su vez usa crypto-utils.js y cadena.js. Aquí sólo está
 * la interfaz, y ningún dato se persiste: recargar reinicia.
 */
import { firmar, sha256Hex, verificar } from './crypto-utils.js';
import { ESTADO } from './cadena.js';
import {
  ACCIONES,
  ACTORES,
  ORDEN,
  Suministro,
  crearEvento,
  crearRegistro,
  describir,
  firmarEvento,
  serializar,
} from './suministro.js';
import {
  $,
  ETIQUETA_ESTADO,
  anunciar,
  arrancar,
  boton,
  campo,
  el,
  fecha,
  formato,
  marca,
  pintarDigest,
  pintarJunta,
  plural,
  ponerEstado,
  referencia,
  sacudir,
  segundos,
  vaciarDigest,
} from './ui.js';

const ROLES = {
  proveedor: 'Emite los lotes y firma su salida.',
  almacen: 'Recibe los lotes y firma la recepción.',
  distribuidor: 'Despacha los lotes hacia el punto de venta.',
};

/** Los bloques de ejemplo: cada grupo de eventos se sella en un bloque. */
const EJEMPLO = [
  [{ lote: 'L-001', producto: 'Café tostado en grano, 1 kg', cantidad: 120, actor: 'proveedor' }],
  [
    { lote: 'L-001', producto: 'Café tostado en grano, 1 kg', cantidad: 120, actor: 'almacen' },
    { lote: 'L-002', producto: 'Chocolate amargo 70 %, 100 g', cantidad: 300, actor: 'proveedor' },
  ],
  [
    { lote: 'L-001', producto: 'Café tostado en grano, 1 kg', cantidad: 120, actor: 'distribuidor' },
    { lote: 'L-002', producto: 'Chocolate amargo 70 %, 100 g', cantidad: 300, actor: 'almacen' },
  ],
];

let sistema = null;
let control = null;
let minando = null;
let preparando = false;
let estadosPrevios = [];
let alteracion = null; // { indice, lote, antes, despues, deshacer, reminado }
const detectados = { 1: false, 2: false, 3: false };
const textosIniciales = new Map();

const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// ---------------------------------------------------------------- controles

function actualizarControles() {
  const ocupado = control !== null || preparando;
  $('#sellar').disabled = ocupado || !sistema || sistema.pendientes.length === 0 || !sistema.cadena.ultimo?.minado;
  $('#detener').disabled = control === null;
  $('#ev-enviar').disabled = preparando || !sistema;
  $('#ev-desorden').disabled = preparando || !sistema;
  $('#reiniciar').disabled = preparando;
  $('#ataque-1').disabled = ocupado;
  $('#ataque-2').disabled = ocupado;
  $('#ataque-3').disabled = ocupado;
  $('#ataque-2-reminar').disabled = ocupado || !alteracion || alteracion.reminado;
  $('#ataque-2-deshacer').disabled = ocupado || !alteracion;
}

function progreso(indice) {
  return (p) => ponerEstado($('#mina-estado'), 'minando', `Minando el bloque ${indice}: ${formato.format(p.intentos)} intentos, ${segundos(p.ms)}…`);
}

// ------------------------------------------------------------- 2.1 actores

function pintarActores() {
  $('#actores').replaceChildren(...Object.entries(ACTORES).map(([clave, actor]) => {
    const valor = el('p', 'valor');
    valor.id = `pub-${clave}`;
    pintarDigest(valor, sistema.registro[clave].publicaHex);
    const copiar = boton('Copiar', 'secundario chico');
    copiar.dataset.copiar = `#${valor.id}`;
    return el(
      'div',
      'par',
      el('div', 'par-cabeza', el('h4', null, actor.nombre)),
      el('p', 'nota', ROLES[clave]),
      el('div', 'llave publica', el('div', 'digest-cabeza', el('span', 'rotulo', 'Llave pública'), copiar), valor),
      el('div', 'llave privada', el('span', 'rotulo', 'Llave privada', el('span', 'secreta', 'secreta')), el('p', 'valor', 'En memoria, sin mostrar. No se escribe en ningún lado.')),
    );
  }));
}

// ----------------------------------------------------------- 2.2 formulario

function problemaFormulario() {
  if (!$('#ev-lote').value.trim()) return 'Falta el lote.';
  if (!$('#ev-producto').value.trim()) return 'Falta el producto.';
  if (!/^[1-9]\d{0,8}$/.test($('#ev-cantidad').value.trim())) return 'La cantidad tiene que ser un entero positivo.';
  return null;
}

function leerFormulario(timestamp = Date.now()) {
  return crearEvento({
    lote: $('#ev-lote').value.trim(),
    producto: $('#ev-producto').value.trim(),
    cantidad: $('#ev-cantidad').value.trim(),
    actor: $('#ev-actor').value,
    accion: $('#ev-accion').value,
    timestamp,
  });
}

function pintarCanonico() {
  const salida = $('#ev-canonico');
  if (problemaFormulario()) {
    salida.textContent = problemaFormulario();
    return;
  }
  salida.textContent = `${serializar(leerFormulario())}   (el timestamp se toma al firmar)`;
}

function alinearConActor() {
  const actor = $('#ev-actor').value;
  $('#ev-accion').value = ACTORES[actor].accion;
  $('#ev-llave').value = actor;
  pintarCanonico();
}

/** Deja el formulario listo con el paso que le toca a un lote, o con un lote nuevo. */
function sugerirSiguiente(lote) {
  const toca = ORDEN[sistema.pasos(lote).length];
  if (toca) {
    $('#ev-lote').value = lote;
    $('#ev-actor').value = Object.keys(ACTORES).find((k) => ACTORES[k].accion === toca);
  } else {
    $('#ev-lote').value = sistema.siguienteLote();
    $('#ev-producto').value = 'Harina de trigo, 25 kg';
    $('#ev-cantidad').value = '80';
    $('#ev-actor').value = 'proveedor';
  }
  alinearConActor();
}

async function enviarEvento() {
  const problema = problemaFormulario();
  if (problema) {
    ponerEstado($('#ev-estado'), 'pendiente', problema);
    return;
  }
  const evento = leerFormulario();
  const llave = $('#ev-llave').value;
  const tx = await firmarEvento(evento, sistema.registro[llave].privada);
  const revision = await sistema.enviar(tx);
  const conOtraLlave = llave === evento.actor ? '' : ` Se firmó con la llave privada de ${ACTORES[llave].articulo}.`;
  const texto = revision.aceptada
    ? `Aceptado, en espera del siguiente bloque. ${revision.motivo}`
    : `Rechazado. ${revision.motivo}${conOtraLlave}`;
  ponerEstado($('#ev-estado'), revision.aceptada ? 'valido' : 'invalido', texto);
  anunciar(texto);
  $('#ev-desorden-salida').hidden = true;
  if (revision.aceptada) {
    pintarPendientes();
    await pintarTraza(evento.lote);
    sugerirSiguiente(evento.lote);
  }
}

/** El firmante serializa con otro orden de claves; el verificador, en forma canónica. */
async function firmarDesordenado() {
  const problema = problemaFormulario();
  if (problema) {
    ponerEstado($('#ev-estado'), 'pendiente', problema);
    return;
  }
  const evento = leerFormulario();
  const llaves = sistema.registro[evento.actor];
  const desordenado = JSON.stringify({
    timestamp: evento.timestamp,
    lote: evento.lote,
    actor: evento.actor,
    accion: evento.accion,
    cantidad: evento.cantidad,
    producto: evento.producto,
  });
  const canonico = serializar(evento);
  const firma = await firmar(llaves.privada, desordenado);
  const [conDesorden, conCanonico, digestDesorden, digestCanonico] = await Promise.all([
    verificar(llaves.publica, desordenado, firma),
    verificar(llaves.publica, canonico, firma),
    sha256Hex(desordenado),
    sha256Hex(canonico),
  ]);

  $('#ev-desorden-bytes').replaceChildren(desordenado, el('br'), 'SHA-256 ', referencia(digestDesorden));
  $('#ev-canonico-bytes').replaceChildren(canonico, el('br'), 'SHA-256 ', referencia(digestCanonico));
  $('#ev-desorden-salida').hidden = false;

  const texto = `Nada se agregó a la cadena. ${mayuscula(ACTORES[evento.actor].articulo)} firmó el evento con sus claves en otro orden, con su propia llave. Contra esos bytes la firma ${conDesorden ? 'verifica' : 'no verifica'}; contra la forma canónica que reconstruye el verificador, ${conCanonico ? 'verifica' : 'no verifica'}. Mismo evento, otros bytes, otro digest: el problema no es la firma, es que las dos partes no hashearon lo mismo.`;
  ponerEstado($('#ev-estado'), conCanonico ? 'valido' : 'invalido', texto);
  anunciar(texto);
}

// --------------------------------------------------------- 2.3 en espera

function pintarPendientes() {
  const lista = $('#pendientes');
  if (sistema.pendientes.length === 0) {
    lista.replaceChildren(el('li', null, 'Nada en espera.'));
  } else {
    lista.replaceChildren(...sistema.pendientes.map((tx) => {
      const li = el('li', null, marca(), el('span', null,
        mayuscula(describir(tx.evento)),
        el('span', 'detalle', `Lote ${tx.evento.lote}, firmado ${fecha(tx.evento.timestamp)}. Firma `, referencia(tx.firma, 'firma')),
      ));
      li.dataset.estado = ESTADO.PENDIENTE;
      return li;
    }));
  }
  actualizarControles();
}

async function sellar() {
  if (control || sistema.pendientes.length === 0 || !sistema.cadena.ultimo?.minado) return false;
  const propio = new AbortController();
  control = propio;
  const indice = sistema.cadena.bloques.length;
  minando = indice;
  // sellarBloque agrega el bloque antes de su primer await: ya se puede pintar como «minando».
  const promesa = sistema.sellarBloque({ senal: propio.signal, alProgreso: progreso(indice) });
  ponerEstado($('#mina-estado'), 'minando', `Sellando y minando el bloque ${indice}…`);
  pintarPendientes();
  await pintarCadena();

  const resultado = await promesa;
  if (control !== propio) return false; // se reinició mientras tanto
  control = null;
  minando = null;

  const texto = resultado.encontrado
    ? `Bloque ${indice} sellado ${fecha(resultado.bloque.timestamp)}, con ${plural(resultado.bloque.datos.length, 'transacción', 'transacciones')}, y minado con ${plural(resultado.intentos, 'intento', 'intentos')} en ${segundos(resultado.ms)}.`
    : `Minado del bloque ${indice} detenido. Sus transacciones ya están dentro; termina de minarlo desde la cadena.`;
  ponerEstado($('#mina-estado'), resultado.encontrado ? 'valido' : 'detenido', texto);
  if (!preparando) anunciar(texto);
  await pintarTodo();
  return resultado.encontrado;
}

async function reminarDesde(desde) {
  if (control) return false;
  const pendiente = sistema.cadena.bloques.findIndex((b) => !b.minado);
  const inicio = pendiente >= 0 ? Math.min(desde, pendiente) : desde;
  const propio = new AbortController();
  control = propio;
  minando = inicio;
  actualizarControles();
  await pintarCadena();

  const resultado = await sistema.cadena.reminarDesde(inicio, {
    senal: propio.signal,
    alProgreso: (p) => {
      if (minando !== p.indice) {
        minando = p.indice;
        pintarCadena();
      }
      progreso(p.indice)(p);
    },
  });
  if (control !== propio) return false;
  control = null;
  minando = null;

  const texto = resultado.completado
    ? `Reminados los bloques del ${inicio} al ${resultado.hasta}: ${plural(resultado.intentos, 'intento', 'intentos')} en ${segundos(resultado.ms)}.`
    : `Minado detenido en el bloque ${resultado.hasta}.`;
  ponerEstado($('#mina-estado'), resultado.completado ? 'valido' : 'detenido', texto);
  anunciar(texto);
  await pintarTodo();
  return resultado.completado;
}

// ------------------------------------------------------------- 2.4 cadena

let turnoCadena = 0;

async function pintarCadena({ origen = null } = {}) {
  const mio = ++turnoCadena;
  const validacion = await sistema.validar();
  if (mio !== turnoCadena) return validacion;
  const { valida, informes } = validacion;
  const bloques = sistema.cadena.bloques;
  const articulos = [];

  $('#cadena').replaceChildren(...informes.map((informe, i) => {
    const bloque = bloques[i];
    const estado = minando === i ? 'minando' : informe.estado;

    const junta = el('div');
    pintarJunta(junta, {
      primero: i === 0,
      anterior: i === 0 ? null : bloques[i - 1].hash,
      previo: bloque.hashPrevio,
      deQuien: `el bloque ${i - 1}`,
      aQuien: `el bloque ${i}`,
    });

    const articulo = el('article', 'bloque');
    articulo.dataset.estado = estado;
    articulo.append(
      el('div', 'bloque-cabeza', el('p', 'bloque-nombre', marca(), i === 0 ? 'Bloque 0, génesis' : `Bloque ${i}`), el('span', 'bloque-estado', ETIQUETA_ESTADO[estado])),
      el('p', 'motivo', minando === i ? 'Buscando un nonce que deje 3 ceros al inicio…' : informe.motivo),
    );

    const campos = el('dl', 'campos');
    campo(campos, 'Sellado', fecha(bloque.timestamp));
    campo(campos, 'Nonce', bloque.nonce === null ? '—' : String(bloque.nonce));
    campo(campos, 'Transacciones', String(informe.transacciones.length));
    articulo.append(campos);

    if (informe.transacciones.length) {
      articulo.append(el('ul', 'txs', ...informe.transacciones.map((t) => {
        const notas = [`Lote ${t.evento.lote}, firmado ${fecha(t.evento.timestamp)}. Firma `, referencia(t.firma, 'firma'), t.firmaValida ? ', verifica.' : ', ya no verifica.'];
        if (!t.enTiempo) notas.push(' Su sello cae fuera del intervalo del bloque.');
        const li = el('li', null, marca(), el('span', null, mayuscula(describir(t.evento)), el('span', 'detalle', ...notas)));
        li.dataset.estado = t.estado;
        return li;
      })));
    } else {
      articulo.append(el('p', 'formula', String(bloque.datos)));
    }

    const hash = el('p', 'digest digest-chico');
    if (bloque.hash) pintarDigest(hash, bloque.hash, { marcarCeros: true });
    else vaciarDigest(hash, 'Sin minar.');
    articulo.append(el('span', 'rotulo', 'Hash'), hash);

    if (informe.estado !== ESTADO.VALIDO && minando === null) {
      const reminar = boton(bloque.minado ? 'Reminar desde aquí' : 'Minar desde aquí', 'secundario chico');
      reminar.disabled = control !== null || preparando;
      reminar.addEventListener('click', () => reminarDesde(i));
      articulo.append(el('div', 'botones', reminar));
    }

    articulos.push(articulo);
    return el('li', null, junta, articulo);
  }));

  if (origen !== null) {
    articulos.forEach((articulo, i) => {
      const estado = informes[i].estado;
      if ((estado === ESTADO.INVALIDO || estado === ESTADO.HEREDADO) && estado !== estadosPrevios[i]) {
        sacudir(articulo, Math.max(0, i - origen));
      }
    });
  }
  estadosPrevios = informes.map((inf) => inf.estado);

  const firmas = informes.reduce((n, inf) => n + inf.transacciones.length, 0);
  const primero = informes.find((inf) => inf.estado !== ESTADO.VALIDO);
  const region = $('#cadena-estado');
  if (control) {
    ponerEstado(region, 'minando', `Minando el bloque ${minando}.`);
  } else if (valida) {
    ponerEstado(region, 'valido', `Cadena de custodia válida: ${plural(informes.length, 'bloque', 'bloques')} y ${plural(firmas, 'transacción', 'transacciones')}, todas con firma válida.`);
  } else if (primero.estado === ESTADO.PENDIENTE) {
    ponerEstado(region, 'pendiente', `El bloque ${primero.indice} está sin minar.`);
  } else {
    ponerEstado(region, 'invalido', `Cadena rota desde el bloque ${primero.indice}. ${primero.motivo}`);
  }
  actualizarControles();
  return validacion;
}

// --------------------------------------------------------- 2.5 trazabilidad

let turnoTraza = 0;

async function pintarTraza(lote = null) {
  const selector = $('#traza-lote');
  const lotes = sistema.lotes();
  const elegido = lote ?? selector.value;
  selector.replaceChildren(...lotes.map((l) => {
    const opcion = el('option', null, l);
    opcion.value = l;
    return opcion;
  }));
  if (lotes.includes(elegido)) selector.value = elegido;

  if (lotes.length === 0) {
    ponerEstado($('#traza-estado'), 'pendiente', 'Todavía no hay lotes en la cadena.');
    $('#traza').replaceChildren();
    return;
  }

  const mio = ++turnoTraza;
  const traza = await sistema.trazar(selector.value);
  if (mio !== turnoTraza) return;

  const nombres = (clave) => ACTORES[clave]?.articulo.replace(/^el /, '') ?? clave;
  $('#traza').replaceChildren(...traza.eslabones.map((e, i) => {
    const junta = el('div', i === 0 ? 'junta origen' : 'junta');
    junta.append(i === 0
      ? `Origen del lote ${traza.lote}`
      : `La custodia pasa del ${nombres(traza.eslabones[i - 1].evento.actor)} al ${nombres(e.evento.actor)}`);

    let lectura;
    if (e.estado === ESTADO.PENDIENTE) lectura = 'Aceptado y firmado, en espera de bloque: todavía no forma parte de la historia.';
    else if (!e.firmaValida) lectura = `En el bloque ${e.bloque}. La firma ya no verifica: el evento cambió después de firmarse.`;
    else if (!e.enTiempo) lectura = `En el bloque ${e.bloque}. Su sello cae fuera del intervalo del bloque.`;
    else if (e.estado === ESTADO.HEREDADO) lectura = `En el bloque ${e.bloque}. La firma verifica, pero el bloque cuelga de una historia rota: no se puede confiar en él.`;
    else lectura = `En el bloque ${e.bloque}. Firma válida en un bloque íntegro.`;

    const articulo = el('article', 'bloque');
    articulo.dataset.estado = e.estado;
    articulo.append(
      el('div', 'bloque-cabeza', el('p', 'bloque-nombre', marca(), `Paso ${i + 1}: ${ACCIONES[e.evento.accion]?.infinitivo ?? e.evento.accion}`), el('span', 'bloque-estado', ETIQUETA_ESTADO[e.estado])),
      el('p', 'motivo', `${mayuscula(describir(e.evento))}, ${fecha(e.evento.timestamp)}. ${lectura}`),
    );
    return el('li', null, junta, articulo);
  }));

  const n = traza.eslabones.length;
  const malos = traza.eslabones.filter((e) => e.estado === ESTADO.INVALIDO || e.estado === ESTADO.HEREDADO).length;
  const enEspera = traza.eslabones.filter((e) => e.estado === ESTADO.PENDIENTE).length;
  const pasos = traza.eslabones.map((e) => e.evento.accion);
  const falta = ORDEN.slice(pasos.length);
  const avance = falta.length === 0 ? 'Custodia completa: emitido, recibido y despachado.' : `Falta: ${falta.map((a) => ACCIONES[a].infinitivo).join(' y ')}.`;

  if (traza.comprometida) {
    ponerEstado($('#traza-estado'), 'invalido', `Trazabilidad del lote ${traza.lote} comprometida: ${malos} de ${n} eslabones no se pueden confiar. ${avance}`);
  } else {
    const espera = enEspera ? `, más ${plural(enEspera, 'evento', 'eventos')} en espera de bloque` : '';
    ponerEstado($('#traza-estado'), 'valido', `Trazabilidad del lote ${traza.lote} íntegra: ${plural(n - enEspera, 'eslabón verificado', 'eslabones verificados')}${espera}. ${avance}`);
  }
}

async function pintarTodo(opciones = {}) {
  pintarPendientes();
  const validacion = await pintarCadena(opciones);
  await pintarTraza(opciones.lote ?? null);
  return validacion;
}

// -------------------------------------------------------------- 3 ataques

function pintarResumen() {
  const n = Object.values(detectados).filter(Boolean).length;
  const region = $('#ataques-resumen');
  if (n === 3) ponerEstado(region, 'valido', 'Los tres ataques se ejecutaron y el sistema detectó los tres.');
  else ponerEstado(region, 'pendiente', n === 0 ? 'Ningún ataque ejecutado todavía.' : `${n} de 3 ataques ejecutados y detectados.`);
}

async function ataqueFirmaAjena() {
  const { tx, revision } = await sistema.ataqueFirmaAjena();
  const detectado = !revision.aceptada && revision.falla === 'firma';
  detectados[1] = detectado;
  const texto = detectado
    ? `Rechazado, como debía. El evento dice que ${describir(tx.evento)} (lote ${tx.evento.lote}), y lo firmó la llave privada del almacén. ${revision.motivo}`
    : `El ataque no se detectó como se esperaba. ${revision.motivo}`;
  ponerEstado($('#ataque-1-estado'), 'invalido', texto);
  anunciar(texto);
  pintarResumen();
  if (revision.aceptada) pintarTodo();
}

async function ataqueCantidad() {
  if (control) return;
  if (alteracion) await deshacerAlteracion({ silencioso: true });
  if (!sistema.cadena.bloques.some((b) => Array.isArray(b.datos) && b.datos.length)) {
    ponerEstado($('#ataque-2-estado'), 'pendiente', 'Primero hace falta un bloque con eventos: sella uno en 2.3.');
    return;
  }
  const r = await sistema.ataqueCantidad();
  alteracion = { ...r, reminado: false };

  const { valida, informes } = await pintarTodo({ origen: r.indice, lote: r.lote });
  const traza = await sistema.trazar(r.lote);
  const detectado = !valida && traza.comprometida;
  detectados[2] = detectado;

  const n = informes.length;
  const despues = r.indice + 1 < n
    ? ` El bloque ${r.indice + 1} perdió su enlace${r.indice + 2 < n ? ' y lo que sigue quedó heredado' : ''}.`
    : '';
  const texto = detectado
    ? `Detectado. La cantidad del lote ${r.lote} en el bloque ${r.indice} pasó de ${r.antes} a ${r.despues}. ${informes[r.indice].motivo}${despues} La trazabilidad del lote ${r.lote} quedó marcada como comprometida. Prueba a reminar para ocultarlo.`
    : 'La alteración no se detectó como se esperaba.';
  ponerEstado($('#ataque-2-estado'), 'invalido', texto);
  anunciar(texto);
  pintarResumen();
  actualizarControles();
}

async function reminarAlteracion() {
  if (!alteracion || control) return;
  const { indice, lote } = alteracion;
  if (!(await reminarDesde(indice))) return;
  alteracion.reminado = true;
  const { informes } = await sistema.validar();
  const traza = await sistema.trazar(lote);
  await pintarTraza(lote);
  const actor = ACTORES[informes[indice].transacciones[0].evento.actor].articulo;
  const texto = informes[indice].estado === ESTADO.INVALIDO && traza.comprometida
    ? `Reminado desde el bloque ${indice}: la prueba de trabajo y los enlaces vuelven a cuadrar, y aun así el bloque sigue inválido. ${informes[indice].motivo} Sin la llave privada de ${actor}, reminar no alcanza: la firma protege lo que la prueba de trabajo sola no puede.`
    : 'Tras reminar, la alteración ya no se detecta: algo no funcionó como se esperaba.';
  ponerEstado($('#ataque-2-estado'), 'invalido', texto);
  anunciar(texto);
  actualizarControles();
}

async function deshacerAlteracion({ silencioso = false } = {}) {
  if (!alteracion || control) return;
  const { indice, lote, reminado, deshacer } = alteracion;
  alteracion = null;
  await deshacer();
  // Si se reminó, el nonce ya no es el original: los datos restaurados necesitan minarse otra vez.
  if (reminado) await reminarDesde(indice);
  if (silencioso) return;
  await pintarTodo({ lote });
  const texto = `Alteración deshecha: el lote ${lote} vuelve a su cantidad original${reminado ? ' y la cadena se reminó desde el bloque ' + indice : ''}.`;
  ponerEstado($('#ataque-2-estado'), 'pendiente', texto);
  anunciar(texto);
  actualizarControles();
}

async function ataqueRetroactivo() {
  const { tx, revision } = await sistema.ataqueRetroactivo();
  const detectado = !revision.aceptada && revision.falla === 'tiempo';
  detectados[3] = detectado;
  const ultimo = sistema.cadena.ultimo;
  const texto = detectado
    ? `Rechazado, como debía. ${revision.motivo} La firma sí era auténtica: el proveedor firmó con su propia llave un evento fechado ${fecha(tx.evento.timestamp)}, y el bloque ${ultimo.indice} se selló ${fecha(ultimo.timestamp)}.`
    : `El ataque no se detectó como se esperaba. ${revision.motivo}`;
  ponerEstado($('#ataque-3-estado'), 'invalido', texto);
  anunciar(texto);
  pintarResumen();
  if (revision.aceptada) pintarTodo();
}

// ------------------------------------------------------------------ arranque

async function preparar() {
  preparando = true;
  control?.abort();
  control = null;
  minando = null;
  alteracion = null;
  estadosPrevios = [];
  for (const k of Object.keys(detectados)) detectados[k] = false;
  for (const [id, texto] of textosIniciales) ponerEstado($(id), 'pendiente', texto);
  $('#ev-desorden-salida').hidden = true;
  actualizarControles();

  sistema = new Suministro({ registro: await crearRegistro(), dificultad: 3 });
  pintarActores();

  sistema.cadena.crearGenesis('Génesis del registro de custodia');
  const propio = new AbortController();
  control = propio;
  minando = 0;
  ponerEstado($('#mina-estado'), 'minando', 'Minando el bloque génesis…');
  const promesa = sistema.cadena.minar(0, { senal: propio.signal, alProgreso: progreso(0) });
  await pintarTodo();
  const genesis = await promesa;
  control = null;
  minando = null;

  if (genesis.encontrado) {
    for (const grupo of EJEMPLO) {
      for (const d of grupo) {
        const evento = crearEvento({ ...d, accion: ACTORES[d.actor].accion, timestamp: Date.now() });
        await sistema.enviar(await firmarEvento(evento, sistema.registro[d.actor].privada));
      }
      if (!(await sellar())) break;
    }
  }

  preparando = false;
  await pintarTodo({ lote: 'L-002' });
  sugerirSiguiente('L-002');
  ponerEstado($('#ev-estado'), 'pendiente', 'El formulario ya tiene el paso que le toca al lote L-002: su despacho. Fírmalo y envíalo, o cambia la llave para ver un rechazo.');
  actualizarControles();
}

arrancar(async () => {
  for (const id of ['#ataque-1-estado', '#ataque-2-estado', '#ataque-3-estado']) {
    textosIniciales.set(id, $(id).querySelector('.estado-texto').textContent);
  }

  $('#ev-actor').addEventListener('change', alinearConActor);
  for (const id of ['#ev-accion', '#ev-llave']) $(id).addEventListener('change', pintarCanonico);
  for (const id of ['#ev-lote', '#ev-producto', '#ev-cantidad']) $(id).addEventListener('input', pintarCanonico);
  $('#ev-enviar').addEventListener('click', enviarEvento);
  $('#ev-desorden').addEventListener('click', firmarDesordenado);

  $('#sellar').addEventListener('click', sellar);
  $('#detener').addEventListener('click', () => control?.abort());
  $('#reiniciar').addEventListener('click', async () => {
    await preparar();
    pintarResumen();
    anunciar('Laboratorio reiniciado con llaves nuevas.');
  });
  $('#traza-lote').addEventListener('change', () => pintarTraza());

  $('#ataque-1').addEventListener('click', ataqueFirmaAjena);
  $('#ataque-2').addEventListener('click', ataqueCantidad);
  $('#ataque-2-reminar').addEventListener('click', reminarAlteracion);
  $('#ataque-2-deshacer').addEventListener('click', () => deshacerAlteracion());
  $('#ataque-3').addEventListener('click', ataqueRetroactivo);

  pintarCanonico();
  await preparar();
});
