/*
 * Módulo 2 — Firma digital.
 * Dos pares de llaves ECDSA P-256, firma, verificación que explica por qué falla,
 * los tres experimentos y el reto de identificar al firmante.
 */
import {
  base64,
  desdeHex,
  diferenciaBits,
  exportarPrivada,
  exportarPublica,
  firmar,
  generarPar,
  importarPublica,
  sha256Hex,
  verificar,
} from './crypto-utils.js';
import { $, anunciar, arrancar, azar, pintarDigest, ponerEstado } from './ui.js';

const pares = { A: null, B: null };

/** Cada firma hecha en la página y con qué se hizo: permite explicar una verificación fallida. */
const firmas = new Map();
let ultimaFirma = null;
let reto = null;

const MENSAJES_RETO = [
  'Pagar 1,200 a la cuenta 0042',
  'El lote L-017 salió completo del almacén',
  'Autorizo la entrega del jueves a las 9:00',
  'Acepto los términos de la versión 3 del contrato',
  'Alice envía 20 a Carol',
];

const limpiarHex = (texto) => texto.replace(/\s+/g, '').toLowerCase();
const elegido = (nombre) => document.querySelector(`input[name="${nombre}"]:checked`);

// -------------------------------------------------------------- 2.1 llaves

async function generar(nombre, { avisar = false } = {}) {
  const boton = $(`#generar-${nombre}`);
  boton.disabled = true;
  const { privateKey, publicKey } = await generarPar();
  const [publicaHex, privadaHex] = await Promise.all([exportarPublica(publicKey), exportarPrivada(privateKey)]);
  pares[nombre] = { privada: privateKey, publica: publicKey, publicaHex };
  pintarDigest($(`#pub-${nombre}`), publicaHex);
  pintarDigest($(`#priv-${nombre}`), privadaHex);
  boton.disabled = false;
  if (avisar) anunciar(`Par ${nombre} generado de nuevo. Sus firmas anteriores ya no verifican con la pública nueva.`);
}

// --------------------------------------------------------------- 2.2 firmar

let turnoDigest = 0;

async function pintarDigestMensaje() {
  const mio = ++turnoDigest;
  const digest = await sha256Hex($('#msg').value);
  if (mio === turnoDigest) pintarDigest($('#msg-digest'), digest);
}

async function firmarMensaje() {
  const nombre = elegido('firmante').value;
  const par = pares[nombre];
  const mensaje = $('#msg').value;
  const firmaHex = await firmar(par.privada, mensaje);

  const anterior = ultimaFirma;
  const repetida = anterior && anterior.mensaje === mensaje && anterior.publicaHex === par.publicaHex;
  ultimaFirma = { mensaje, firmaHex, publicaHex: par.publicaHex, nombre };
  firmas.set(firmaHex, ultimaFirma);

  pintarDigest($('#firma-hex'), firmaHex, { otro: repetida ? anterior.firmaHex : null });
  $('#firma-b64').textContent = base64(desdeHex(firmaHex));
  const lectura = repetida
    ? 'Mismo mensaje, misma llave, y otra firma. Los dígitos invertidos son los que cambiaron respecto a la anterior; las dos verifican.'
    : `Firmado con la llave privada del par ${nombre}.`;
  $('#firma-lectura').textContent = lectura;
  $('#llevar').disabled = false;
  anunciar(lectura);
  return ultimaFirma;
}

// ------------------------------------------------------------ 2.3 verificar

function llenarVerificador({ mensaje, firmaHex, publicaHex }) {
  $('#v-msg').value = mensaje;
  $('#v-firma').value = firmaHex;
  $('#v-pub').value = publicaHex;
}

/** Verifica y, si falla, explica por qué con lo que la página sabe de sus propias firmas. */
async function diagnosticar({ mensaje, firmaHex, publicaHex }) {
  const invalida = (texto) => ({ valida: false, estado: 'invalido', texto });

  if (!/^[0-9a-f]{128}$/.test(firmaHex)) {
    return invalida('No se puede verificar: una firma P-256 mide 64 bytes, que son 128 dígitos hexadecimales.');
  }
  let publica;
  try {
    publica = await importarPublica(publicaHex);
  } catch {
    return invalida('No se puede verificar: la llave pública tiene que ser un punto de la curva P-256 en formato raw, 65 bytes (130 dígitos hex) que empiezan con 04.');
  }

  if (await verificar(publica, mensaje, firmaHex)) {
    return {
      valida: true,
      estado: 'valido',
      texto: 'Firma válida. Este mensaje, bit por bit, lo firmó la llave privada que corresponde a esta llave pública.',
    };
  }

  if (reto && firmaHex === reto.firmaHex) {
    return invalida('Firma inválida: con esta llave pública, esta firma no verifica para este mensaje.');
  }

  const origen = firmas.get(firmaHex);
  if (!origen) {
    return invalida('Firma inválida. Esta firma no salió de esta página o se alteró, y la verificación sólo responde sí o no: no dice qué parte no cuadra.');
  }

  const causas = [];
  if (mensaje !== origen.mensaje) {
    const [actual, firmado] = await Promise.all([sha256Hex(mensaje), sha256Hex(origen.mensaje)]);
    const { distintos } = diferenciaBits(actual, firmado);
    causas.push(`el mensaje no es el que se firmó, y su SHA-256 difiere del firmado en ${distintos} de 256 bits`);
  }
  if (publicaHex !== origen.publicaHex) {
    causas.push(`la firma la produjo la privada del par ${origen.nombre}, y esta llave pública no es la suya`);
  }
  if (causas.length === 0) return invalida('Firma inválida.');
  return invalida(`Firma inválida: ${causas.join('; además, ')}. La verificación sólo dijo «no»; el porqué lo reconstruye la página comparando con lo que firmó.`);
}

async function verificarCampos() {
  const resultado = await diagnosticar({
    mensaje: $('#v-msg').value,
    firmaHex: limpiarHex($('#v-firma').value),
    publicaHex: limpiarHex($('#v-pub').value),
  });
  ponerEstado($('#v-estado'), resultado.estado, resultado.texto);
  anunciar(resultado.texto);
  return resultado;
}

/** Cambia un solo carácter por su vecino, para que se note cuál fue. */
function alterarUnCaracter(texto) {
  const caracteres = [...texto];
  const posiciones = caracteres.map((c, i) => (c.trim() ? i : -1)).filter((i) => i >= 0);
  if (posiciones.length === 0) return { texto: `${texto}a`, posicion: caracteres.length, antes: '', despues: 'a' };
  const i = posiciones[azar(posiciones.length)];
  const antes = caracteres[i];
  let despues;
  if (/\d/.test(antes)) despues = String((Number(antes) + 1) % 10);
  else if (/[a-yA-Y]/.test(antes)) despues = String.fromCharCode(antes.charCodeAt(0) + 1);
  else if (antes === 'z' || antes === 'Z') despues = antes === 'z' ? 'a' : 'A';
  else despues = antes === 'x' ? 'y' : 'x';
  caracteres[i] = despues;
  return { texto: caracteres.join(''), posicion: i, antes, despues };
}

async function experimento(n) {
  const base = ultimaFirma ?? (await firmarMensaje());
  const campos = { mensaje: base.mensaje, firmaHex: base.firmaHex, publicaHex: base.publicaHex };
  let descripcion;

  if (n === 1) {
    descripcion = `1. Mensaje original, su firma y la pública del par ${base.nombre}.`;
  } else if (n === 2) {
    const cambio = alterarUnCaracter(base.mensaje);
    campos.mensaje = cambio.texto;
    descripcion = cambio.antes
      ? `2. Se cambió el carácter ${cambio.posicion + 1}, «${cambio.antes}» por «${cambio.despues}», y se dejó la firma.`
      : '2. Se agregó un carácter al mensaje y se dejó la firma.';
  } else {
    const otro = base.nombre === 'A' ? 'B' : 'A';
    campos.publicaHex = pares[otro].publicaHex;
    descripcion = `3. El mensaje y la firma del par ${base.nombre}, verificados con la pública del par ${otro}.`;
  }

  llenarVerificador(campos);
  const { valida } = await verificarCampos();
  const esperada = n === 1;
  ponerEstado(
    $(`#exp-${n}`),
    valida ? 'valido' : 'invalido',
    `${descripcion} Resultado: ${valida ? 'válida' : 'inválida'}${valida === esperada ? ', como se esperaba.' : '. No es lo que se esperaba: revisa si cambiaste algo a mano.'}`,
  );
}

// ------------------------------------------------------------ 3 ejercicio

async function nuevoReto() {
  for (const id of ['#reto-nuevo', '#reto-comprobar', '#reto-llevar-1', '#reto-llevar-2']) $(id).disabled = true;
  const [uno, dos] = await Promise.all([generarPar(), generarPar()]);
  const mensaje = MENSAJES_RETO[azar(MENSAJES_RETO.length)];
  const firmante = azar(2) === 0 ? uno : dos;
  const [firmaHex, llave1, llave2] = await Promise.all([
    firmar(firmante.privateKey, mensaje),
    exportarPublica(uno.publicKey),
    exportarPublica(dos.publicKey),
  ]);

  // Quién firmó no se guarda: al comprobar, la página también tiene que verificar.
  reto = { mensaje, firmaHex, llaves: [llave1, llave2] };

  $('#reto-mensaje').textContent = mensaje;
  pintarDigest($('#reto-firma'), firmaHex);
  pintarDigest($('#reto-llave-1'), llave1);
  pintarDigest($('#reto-llave-2'), llave2);
  for (const radio of document.querySelectorAll('input[name="reto-llave"]')) radio.checked = false;
  ponerEstado($('#reto-estado'), 'pendiente', 'Verifica con cada llave, elige una y comprueba.');
  for (const id of ['#reto-nuevo', '#reto-comprobar', '#reto-llevar-1', '#reto-llevar-2']) $(id).disabled = false;
}

async function comprobarReto() {
  const opcion = elegido('reto-llave');
  const estado = $('#reto-estado');
  if (!opcion) {
    ponerEstado(estado, 'pendiente', 'Primero elige la llave 1 o la llave 2.');
    return;
  }
  const n = Number(opcion.value);
  const verifica = await Promise.all(
    reto.llaves.map(async (h) => verificar(await importarPublica(h), reto.mensaje, reto.firmaHex)),
  );
  const correcta = verifica.indexOf(true);
  const texto = n === correcta
    ? `Correcto. La firma verifica con la llave ${n + 1} y no con la ${2 - n}: sólo la privada de la llave ${n + 1} pudo producirla.`
    : `No. Con la llave ${n + 1} esta firma no verifica, y con la llave ${correcta + 1} sí. Compruébalo en el verificador.`;
  ponerEstado(estado, n === correcta ? 'valido' : 'invalido', texto);
  anunciar(texto);
}

function llevarReto(i) {
  llenarVerificador({ mensaje: reto.mensaje, firmaHex: reto.firmaHex, publicaHex: reto.llaves[i] });
  ponerEstado($('#v-estado'), 'pendiente', `Campos del reto cargados con la llave ${i + 1}. Pulsa Verificar.`);
  $('#v-verificar').focus();
  anunciar(`Mensaje, firma y llave ${i + 1} del reto copiados al verificador.`);
}

// ------------------------------------------------------------------ arranque

arrancar(async () => {
  $('#generar-A').addEventListener('click', () => generar('A', { avisar: true }));
  $('#generar-B').addEventListener('click', () => generar('B', { avisar: true }));

  $('#msg').addEventListener('input', pintarDigestMensaje);
  $('#firmar').addEventListener('click', firmarMensaje);
  $('#llevar').addEventListener('click', () => {
    llenarVerificador(ultimaFirma);
    ponerEstado($('#v-estado'), 'pendiente', 'Campos cargados con la última firma. Pulsa Verificar.');
    $('#v-verificar').focus();
  });

  $('#v-poner-A').addEventListener('click', () => { $('#v-pub').value = pares.A.publicaHex; });
  $('#v-poner-B').addEventListener('click', () => { $('#v-pub').value = pares.B.publicaHex; });
  $('#v-verificar').addEventListener('click', verificarCampos);
  for (const n of [1, 2, 3]) $(`#exp-btn-${n}`).addEventListener('click', () => experimento(n));

  $('#reto-llevar-1').addEventListener('click', () => llevarReto(0));
  $('#reto-llevar-2').addEventListener('click', () => llevarReto(1));
  $('#reto-comprobar').addEventListener('click', comprobarReto);
  $('#reto-nuevo').addEventListener('click', nuevoReto);

  pintarDigestMensaje();
  await Promise.all([generar('A'), generar('B')]);
  for (const id of ['#firmar', '#v-poner-A', '#v-poner-B', '#exp-btn-1', '#exp-btn-2', '#exp-btn-3']) $(id).disabled = false;
  await nuevoReto();
});
