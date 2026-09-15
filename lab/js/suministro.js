/*
 * Custodia de lotes en una cadena de suministro. Lo usa el módulo 5, y no
 * reimplementa nada: firma con crypto-utils.js y encadena con cadena.js.
 * No toca el DOM, así que los tres ataques se ejercitan con Node.
 *
 * Un evento es { lote, producto, cantidad, actor, accion, timestamp }. Una
 * transacción es { evento, firma }, donde la firma es ECDSA P-256 sobre la
 * serialización canónica del evento. Los datos de cada bloque son un arreglo de
 * transacciones.
 */
import { canonico, exportarPublica, firmar, generarPar, verificar } from './crypto-utils.js';
import { Cadena, ESTADO } from './cadena.js';

export const ACTORES = Object.freeze({
  proveedor: { nombre: 'Proveedor', articulo: 'el proveedor', accion: 'emitir' },
  almacen: { nombre: 'Almacén', articulo: 'el almacén', accion: 'recibir' },
  distribuidor: { nombre: 'Distribuidor', articulo: 'el distribuidor', accion: 'despachar' },
});

export const ACCIONES = Object.freeze({
  emitir: { verbo: 'emite', infinitivo: 'emitir' },
  recibir: { verbo: 'recibe', infinitivo: 'recibir' },
  despachar: { verbo: 'despacha', infinitivo: 'despachar' },
});

/** El orden de custodia de todo lote. */
export const ORDEN = Object.freeze(['emitir', 'recibir', 'despachar']);

const HORA = 3600 * 1000;

/** Un par de llaves por actor. Las privadas nunca salen de este objeto en memoria. */
export async function crearRegistro() {
  const registro = {};
  for (const clave of Object.keys(ACTORES)) {
    const { privateKey, publicKey } = await generarPar();
    registro[clave] = { privada: privateKey, publica: publicKey, publicaHex: await exportarPublica(publicKey) };
  }
  return registro;
}

export function crearEvento({ lote, producto, cantidad, actor, accion, timestamp }) {
  return { lote, producto, cantidad: Number(cantidad), actor, accion, timestamp };
}

/** Lo que se firma: el evento serializado con las claves siempre en el mismo orden. */
export const serializar = (evento) => canonico(evento);

export async function firmarEvento(evento, privada) {
  return { evento, firma: await firmar(privada, serializar(evento)) };
}

export function describir(evento) {
  const actor = ACTORES[evento.actor];
  const accion = ACCIONES[evento.accion];
  const quien = actor ? actor.articulo : `«${evento.actor}»`;
  const hace = accion ? accion.verbo : `«${evento.accion}»`;
  return `${quien} ${hace} ${evento.cantidad} de ${evento.producto}`;
}

export class Suministro {
  constructor({ registro, dificultad = 3, reloj = () => Date.now() }) {
    this.registro = registro;
    this.reloj = reloj;
    this.cadena = new Cadena({ dificultad, reloj });
    this.pendientes = [];
  }

  iniciar(opciones) {
    return this.cadena.iniciar('Génesis del registro de custodia', opciones);
  }

  /** Transacciones de los bloques, en orden, con el índice del bloque que las contiene. */
  *transacciones() {
    for (const bloque of this.cadena.bloques) {
      if (!Array.isArray(bloque.datos)) continue;
      for (const tx of bloque.datos) yield { ...tx, bloque: bloque.indice };
    }
  }

  lotes() {
    const vistos = new Set();
    for (const tx of this.transacciones()) vistos.add(tx.evento.lote);
    for (const tx of this.pendientes) vistos.add(tx.evento.lote);
    return [...vistos];
  }

  siguienteLote() {
    const numeros = this.lotes().map((l) => Number.parseInt(l.replace(/\D/g, ''), 10)).filter(Number.isFinite);
    return `L-${String((numeros.length ? Math.max(...numeros) : 0) + 1).padStart(3, '0')}`;
  }

  /** Pasos de custodia ya aceptados para un lote: los de la cadena y los que esperan bloque. */
  pasos(lote) {
    return [...this.transacciones(), ...this.pendientes]
      .filter((tx) => tx.evento.lote === lote)
      .map((tx) => tx.evento.accion);
  }

  /**
   * Revisa una transacción antes de aceptarla, en orden: la firma contra la llave
   * pública registrada del actor que dice originarla, que ese actor pueda hacer
   * esa acción, que su sello no sea anterior al último bloque, y que sea el paso
   * de custodia que le toca al lote. Dice cuál falló y por qué.
   */
  async revisar({ evento, firma }) {
    const actor = ACTORES[evento.actor];
    const llaves = this.registro[evento.actor];
    if (!actor || !llaves) {
      return { aceptada: false, falla: 'actor', motivo: `No hay ningún actor «${evento.actor}» en el registro de llaves.` };
    }

    if (!(await verificar(llaves.publica, serializar(evento), firma))) {
      return {
        aceptada: false,
        falla: 'firma',
        motivo: `La firma no verifica con la llave pública de ${actor.articulo}. Quien la produjo no tenía su llave privada, o el evento cambió después de firmarse.`,
      };
    }

    if (actor.accion !== evento.accion) {
      const accion = ACCIONES[evento.accion];
      const quien = Object.values(ACTORES).find((a) => a.accion === evento.accion);
      return {
        aceptada: false,
        falla: 'rol',
        motivo: accion && quien
          ? `La firma es auténtica, pero ${actor.articulo} no puede ${accion.infinitivo}: eso sólo lo hace ${quien.articulo}.`
          : `La acción «${evento.accion}» no existe.`,
      };
    }

    const ultimo = this.cadena.ultimo;
    if (ultimo && evento.timestamp < ultimo.timestamp) {
      return {
        aceptada: false,
        falla: 'tiempo',
        motivo: `La firma es auténtica, pero el sello del evento es anterior al del bloque ${ultimo.indice}, el último de la cadena. Nada puede entrar en la historia antes de algo que ya se selló.`,
      };
    }

    const hechos = this.pasos(evento.lote);
    const toca = ORDEN[hechos.length];
    if (evento.accion !== toca) {
      return {
        aceptada: false,
        falla: 'secuencia',
        motivo: toca
          ? `El lote ${evento.lote} está esperando que alguien lo vaya a ${ACCIONES[toca].infinitivo}, no a ${ACCIONES[evento.accion].infinitivo}.`
          : `El lote ${evento.lote} ya completó su custodia: se emitió, se recibió y se despachó.`,
      };
    }

    return {
      aceptada: true,
      falla: null,
      motivo: `Firma válida de ${actor.articulo}, acción que le corresponde, sello posterior al último bloque y paso de custodia correcto.`,
    };
  }

  async enviar(tx) {
    const revision = await this.revisar(tx);
    if (revision.aceptada) this.pendientes.push(tx);
    return revision;
  }

  /** Agrupa las transacciones en espera en un bloque sellado con la hora, y lo mina. */
  async sellarBloque(opciones = {}) {
    if (this.pendientes.length === 0) throw new Error('No hay transacciones en espera.');
    const bloque = this.cadena.agregar(this.pendientes.map(({ evento, firma }) => ({ evento, firma })));
    this.pendientes = [];
    const resultado = await this.cadena.minar(bloque.indice, opciones);
    return { bloque, ...resultado };
  }

  /**
   * La validación de cadena.js más lo que sólo sabe este módulo: que cada firma
   * siga verificando y que cada evento caiga entre el sello del bloque anterior y
   * el de su propio bloque. Un bloque con una transacción rota es INVALIDO, y todo
   * lo que cuelga de él, HEREDADO.
   */
  async validar() {
    const base = await this.cadena.validar();
    const bloques = this.cadena.bloques;
    const informes = [];
    let sana = true;

    for (const inf of base.informes) {
      const bloque = bloques[inf.indice];
      const previo = bloques[inf.indice - 1];
      const txs = Array.isArray(bloque.datos) ? bloque.datos : [];

      const transacciones = await Promise.all(txs.map(async (tx, posicion) => {
        const llaves = this.registro[tx.evento.actor];
        const firmaValida = Boolean(llaves) && (await verificar(llaves.publica, serializar(tx.evento), tx.firma));
        const enTiempo = (!previo || tx.evento.timestamp >= previo.timestamp) && tx.evento.timestamp <= bloque.timestamp;
        return { ...tx, bloque: inf.indice, posicion, firmaValida, enTiempo };
      }));

      let estado = inf.estado;
      let motivo = inf.motivo;
      const propioBien = inf.estado === ESTADO.VALIDO || inf.estado === ESTADO.HEREDADO;
      if (propioBien) {
        const malaFirma = transacciones.find((t) => !t.firmaValida);
        const fueraDeTiempo = transacciones.find((t) => !t.enTiempo);
        if (malaFirma) {
          estado = ESTADO.INVALIDO;
          motivo = `La firma de la transacción ${malaFirma.posicion + 1} (lote ${malaFirma.evento.lote}) ya no verifica: el evento cambió después de que ${ACTORES[malaFirma.evento.actor]?.articulo ?? 'su actor'} lo firmara.`;
        } else if (fueraDeTiempo) {
          estado = ESTADO.INVALIDO;
          motivo = `La transacción ${fueraDeTiempo.posicion + 1} tiene un sello fuera del intervalo de este bloque.`;
        } else if (sana) {
          estado = ESTADO.VALIDO;
          motivo = txs.length ? 'Íntegro, minado, enlazado y con todas sus firmas válidas.' : inf.motivo;
        } else {
          estado = ESTADO.HEREDADO;
          motivo = 'Está bien formado y sus firmas verifican, pero cuelga de una historia que ya no es válida.';
        }
      }
      if (estado !== ESTADO.VALIDO) sana = false;

      for (const t of transacciones) {
        if (estado === ESTADO.PENDIENTE) t.estado = ESTADO.PENDIENTE;
        else if (!t.firmaValida || !t.enTiempo) t.estado = ESTADO.INVALIDO;
        else t.estado = estado === ESTADO.VALIDO ? ESTADO.VALIDO : ESTADO.HEREDADO;
      }
      informes.push({ ...inf, estado, motivo, transacciones });
    }

    return { valida: informes.every((inf) => inf.estado === ESTADO.VALIDO), informes };
  }

  /** Historial de custodia de un lote leyendo la cadena, con el estado de cada eslabón. */
  async trazar(lote) {
    const { informes } = await this.validar();
    const eslabones = [];
    for (const inf of informes) {
      for (const t of inf.transacciones) {
        if (t.evento.lote === lote) eslabones.push(t);
      }
    }
    for (const tx of this.pendientes) {
      if (tx.evento.lote === lote) eslabones.push({ ...tx, bloque: null, firmaValida: true, enTiempo: true, estado: ESTADO.PENDIENTE });
    }
    const comprometida = eslabones.some((e) => e.estado === ESTADO.INVALIDO || e.estado === ESTADO.HEREDADO);
    return { lote, eslabones, comprometida };
  }

  // ------------------------------------------------------------ los ataques

  /** Ataque 1: el almacén fabrica un evento del proveedor firmándolo con su propia llave. */
  async ataqueFirmaAjena() {
    const evento = crearEvento({
      lote: this.siguienteLote(),
      producto: 'Lote fantasma',
      cantidad: 500,
      actor: 'proveedor',
      accion: 'emitir',
      timestamp: this.reloj(),
    });
    const tx = await firmarEvento(evento, this.registro.almacen.privada);
    return { tx, revision: await this.enviar(tx) };
  }

  /**
   * Ataque 2: alguien con acceso al almacenamiento cambia la cantidad de un evento
   * ya incluido en un bloque, sin la llave de nadie. Devuelve cómo deshacerlo.
   */
  async ataqueCantidad() {
    const bloque = this.cadena.bloques.find((b) => Array.isArray(b.datos) && b.datos.length > 0);
    if (!bloque) throw new Error('Todavía no hay ningún bloque con transacciones.');
    const original = bloque.datos;
    const alterados = structuredClone(original);
    const tx = alterados[0];
    const antes = tx.evento.cantidad;
    tx.evento.cantidad = antes > 10 ? antes - 10 : antes + 10;
    await this.cadena.editar(bloque.indice, alterados);
    return {
      indice: bloque.indice,
      lote: tx.evento.lote,
      antes,
      despues: tx.evento.cantidad,
      deshacer: () => this.cadena.editar(bloque.indice, original),
    };
  }

  /**
   * Ataque 3: el actor correcto firma, con su propia llave, un evento fechado una
   * hora antes del último bloque. La firma es auténtica; la fecha no cabe.
   */
  async ataqueRetroactivo() {
    const ultimo = this.cadena.ultimo;
    const evento = crearEvento({
      lote: this.siguienteLote(),
      producto: 'Lote con fecha retroactiva',
      cantidad: 40,
      actor: 'proveedor',
      accion: 'emitir',
      timestamp: (ultimo ? ultimo.timestamp : this.reloj()) - HORA,
    });
    const tx = await firmarEvento(evento, this.registro.proveedor.privada);
    return { tx, revision: await this.enviar(tx) };
  }
}
