/*
 * Recibos de sellado de tiempo encadenados, al estilo Haber–Stornetta. Lo usa el
 * módulo 3. No toca el DOM, así que se ejercita con Node.
 *
 * Un recibo es { indice, hashDocumento, timestamp, hashPrevio, hashRecibo }, y
 *
 *   hashRecibo = SHA-256( canónico{ hashDocumento, hashPrevio, indice, timestamp } )
 *
 * Como hashPrevio es el hashRecibo del anterior, cada recibo depende de todos los
 * que vinieron antes: h_n = H(documento_n ‖ t_n ‖ h_(n−1)).
 */
import { CEROS_64, canonico, sha256Hex } from './crypto-utils.js';
import { ESTADO } from './cadena.js';

export function contenidoRecibo({ indice, hashDocumento, timestamp, hashPrevio }) {
  return canonico({ hashDocumento, hashPrevio, indice, timestamp });
}

export async function crearRecibo({ indice, hashDocumento, timestamp, hashPrevio }) {
  const base = { indice, hashDocumento, timestamp, hashPrevio };
  return { ...base, hashRecibo: await sha256Hex(contenidoRecibo(base)) };
}

/** Sella un documento al final de la lista, enganchado al último recibo. */
export async function sellar(recibos, hashDocumento, timestamp = Date.now()) {
  const previo = recibos.at(-1);
  const recibo = await crearRecibo({
    indice: recibos.length,
    hashDocumento,
    timestamp,
    hashPrevio: previo ? previo.hashRecibo : CEROS_64,
  });
  recibos.push(recibo);
  return recibo;
}

/**
 * Mete un sello con fecha retroactiva justo antes del último recibo. Él mismo
 * queda bien formado y bien enganchado a su anterior; lo que se rompe es el
 * recibo que ya existía después, que sigue apuntando a otro hash.
 */
export async function insertarRetroactivo(recibos, hashDocumento) {
  if (recibos.length < 2) throw new Error('Hacen falta al menos dos recibos.');
  const posicion = recibos.length - 1;
  const antes = recibos[posicion - 1];
  const despues = recibos[posicion];
  const recibo = await crearRecibo({
    indice: posicion,
    hashDocumento,
    timestamp: Math.floor((antes.timestamp + despues.timestamp) / 2),
    hashPrevio: antes.hashRecibo,
  });
  recibos.splice(posicion, 0, recibo);
  return recibo;
}

/** Rehace índices y hashes desde `desde`: exactamente el trabajo de reescribir lo posterior. */
export async function reencadenar(recibos, desde = 0) {
  for (let i = Math.max(0, desde); i < recibos.length; i++) {
    recibos[i] = await crearRecibo({
      ...recibos[i],
      indice: i,
      hashPrevio: i === 0 ? CEROS_64 : recibos[i - 1].hashRecibo,
    });
  }
}

/**
 * Revisa la lista recibo por recibo. `publicado`, si existe, es un hash que salió
 * de la página en algún momento —el aviso en el periódico de Haber y Stornetta—
 * y el recibo en esa posición tiene que seguir coincidiendo con él.
 */
export async function validarSellos(recibos, { publicado = null } = {}) {
  const recalculados = await Promise.all(recibos.map((r) => sha256Hex(contenidoRecibo(r))));
  const informes = [];
  let sana = true;

  recibos.forEach((recibo, i) => {
    const previo = recibos[i - 1];
    const comprobaciones = {
      hashCoincide: recalculados[i] === recibo.hashRecibo,
      enlaceCorrecto: recibo.hashPrevio === (previo ? previo.hashRecibo : CEROS_64),
      ordenTemporal: !previo || recibo.timestamp >= previo.timestamp,
      indiceCorrecto: recibo.indice === i,
      coincidePublicado: !publicado || publicado.indice !== i || publicado.hashRecibo === recibo.hashRecibo,
    };

    let estado = ESTADO.INVALIDO;
    let motivo;
    if (!comprobaciones.hashCoincide) {
      motivo = 'Su hashRecibo no corresponde a su contenido: algo del recibo cambió después de sellarlo.';
    } else if (!comprobaciones.enlaceCorrecto) {
      motivo = i === 0
        ? 'El primer recibo tiene que apuntar a 64 ceros.'
        : `Su hashPrevio ya no coincide con el hashRecibo del recibo ${i - 1}.`;
    } else if (!comprobaciones.ordenTemporal) {
      motivo = `Su sello de tiempo es anterior al del recibo ${i - 1}: fecha retroactiva.`;
    } else if (!comprobaciones.indiceCorrecto) {
      motivo = `Dice ser el recibo ${recibo.indice}, pero ocupa la posición ${i}.`;
    } else if (!comprobaciones.coincidePublicado) {
      motivo = 'Es consistente con sus vecinos, pero no coincide con el hash que se publicó: la historia se reescribió.';
    } else if (!sana) {
      estado = ESTADO.HEREDADO;
      motivo = 'Está bien formado, pero cuelga de un recibo que ya no es consistente.';
    } else {
      estado = ESTADO.VALIDO;
      motivo = 'Íntegro y enganchado al anterior.';
    }

    if (estado !== ESTADO.VALIDO) sana = false;
    informes.push({ indice: i, estado, motivo, recalculado: recalculados[i], ...comprobaciones });
  });

  const primera = informes.find((inf) => inf.estado !== ESTADO.VALIDO);
  return { consistente: !primera, primeraFalla: primera ? primera.indice : null, informes };
}

// ------------------------------------------------------------------ ejercicio

const DOCUMENTOS_RETO = [
  'Acta de la sesión de consejo del lunes',
  'Contrato de arrendamiento, versión firmada',
  'Lista de asistencia del laboratorio 3',
  'Resultados de la auditoría de inventario',
  'Minuta de la junta con proveedores',
  'Declaración de entrega del lote de septiembre',
];

export const ALTERACIONES = Object.freeze({
  fecha: 'Se cambió la fecha del recibo sin recalcular su hash.',
  documento: 'Se cambió el hash del documento y se recalculó el hashRecibo de ese recibo, pero no los siguientes.',
  retroactivo: 'Se le puso una fecha anterior a la del recibo previo y se recalculó su hash, pero no los siguientes.',
});

/**
 * Seis recibos con uno alterado. Devuelve la lista, qué se alteró y dónde, y la
 * respuesta correcta: el primer recibo que deja de pasar la verificación.
 */
export async function generarReto({ ahora = Date.now(), azar = Math.random } = {}) {
  const elegir = (n) => Math.floor(azar() * n);
  const dia = 24 * 3600 * 1000;
  const recibos = [];
  let t = ahora - 7 * dia;
  for (const documento of DOCUMENTOS_RETO) {
    t += dia + elegir(6 * 3600 * 1000);
    await sellar(recibos, await sha256Hex(documento), t);
  }

  const tipos = Object.keys(ALTERACIONES);
  const tipo = tipos[elegir(tipos.length)];
  let alterado;

  if (tipo === 'fecha') {
    alterado = 1 + elegir(recibos.length - 1);
    recibos[alterado] = { ...recibos[alterado], timestamp: recibos[alterado].timestamp + 3 * 3600 * 1000 };
  } else if (tipo === 'documento') {
    // Nunca el último: si no hay nada después, el cambio no deja rastro.
    alterado = 1 + elegir(recibos.length - 2);
    const falso = await sha256Hex(`${DOCUMENTOS_RETO[alterado]} (versión modificada)`);
    recibos[alterado] = await crearRecibo({ ...recibos[alterado], hashDocumento: falso });
  } else {
    alterado = 1 + elegir(recibos.length - 1);
    const timestamp = recibos[alterado - 1].timestamp - 2 * dia;
    recibos[alterado] = await crearRecibo({ ...recibos[alterado], timestamp });
  }

  const { primeraFalla } = await validarSellos(recibos);
  return { recibos, documentos: DOCUMENTOS_RETO.slice(), tipo, alterado, primeraFalla };
}
