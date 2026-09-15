/*
 * Bloques y cadena del laboratorio. La usan los módulos 4 y 5: no se duplica.
 *
 * Un bloque es { indice, timestamp, dificultad, datos, hashPrevio, nonce, hash }.
 *
 * La dificultad va dentro del bloque —y dentro de lo que se hashea— para que
 * mover el control de dificultad afecte a los bloques que se minen después y no
 * invalide en retroactiva los ya minados. Es lo que hace el encabezado de un
 * bloque de Bitcoin con su objetivo.
 */
import { CEROS_64, buscarNonce, canonico, sha256Hex } from './crypto-utils.js';

export const ESTADO = Object.freeze({
  VALIDO: 'valido',
  INVALIDO: 'invalido', // falla por sí mismo
  HEREDADO: 'heredado', // él está bien formado, pero cuelga de un bloque que no
  PENDIENTE: 'pendiente', // todavía sin minar
});

const ceros = (n) => (n === 1 ? '1 cero' : `${n} ceros`);

export class Bloque {
  constructor({ indice, timestamp, dificultad, datos, hashPrevio, nonce = null, hash = null }) {
    this.indice = indice;
    this.timestamp = timestamp;
    this.dificultad = dificultad;
    this.datos = datos;
    this.hashPrevio = hashPrevio;
    this.nonce = nonce;
    this.hash = hash;
  }

  get minado() {
    return this.hash !== null;
  }

  /** Exactamente lo que se hashea: serialización canónica, sin el propio hash. */
  contenido(nonce = this.nonce) {
    return canonico({
      datos: this.datos,
      dificultad: this.dificultad,
      hashPrevio: this.hashPrevio,
      indice: this.indice,
      nonce,
      timestamp: this.timestamp,
    });
  }

  calcularHash(nonce = this.nonce) {
    return sha256Hex(this.contenido(nonce));
  }

  /** Busca el nonce que deja el hash con `dificultad` ceros hexadecimales al inicio. */
  async minar(opciones = {}) {
    const prefijo = '0'.repeat(this.dificultad);
    const resultado = await buscarNonce({
      ...opciones,
      construir: (n) => this.contenido(n),
      cumple: (digest) => digest.startsWith(prefijo),
    });
    if (resultado.encontrado) {
      this.nonce = resultado.nonce;
      this.hash = resultado.digest;
    }
    return resultado;
  }
}

export class Cadena {
  #versiones = new WeakMap();

  constructor({ dificultad = 3, reloj = () => Date.now() } = {}) {
    this.dificultad = dificultad;
    this.reloj = reloj;
    this.bloques = [];
  }

  get ultimo() {
    return this.bloques.at(-1) ?? null;
  }

  /** Crea el bloque génesis, cuyo hashPrevio son 64 ceros, sin minarlo todavía. */
  crearGenesis(datos = 'Bloque génesis') {
    if (this.bloques.length) throw new Error('La cadena ya tiene bloque génesis.');
    const genesis = new Bloque({
      indice: 0,
      timestamp: this.reloj(),
      dificultad: this.dificultad,
      datos,
      hashPrevio: CEROS_64,
    });
    this.bloques.push(genesis);
    return genesis;
  }

  /** Crea y mina el bloque génesis. */
  async iniciar(datos = 'Bloque génesis', opciones = {}) {
    return this.crearGenesis(datos).minar(opciones);
  }

  /** Agrega un bloque sin minar. Sólo puede colgar de un bloque ya minado. */
  agregar(datos, { timestamp } = {}) {
    const previo = this.ultimo;
    if (!previo) throw new Error('Primero hay que crear el bloque génesis.');
    if (!previo.minado) throw new Error('El último bloque todavía no está minado.');
    const bloque = new Bloque({
      indice: this.bloques.length,
      timestamp: timestamp ?? this.reloj(),
      dificultad: this.dificultad,
      datos,
      hashPrevio: previo.hash,
    });
    this.bloques.push(bloque);
    return bloque;
  }

  /**
   * Mina un bloque. Antes lo vuelve a enganchar al hash actual de su anterior,
   * que es justo lo que hace falta al reescribir la historia desde un punto.
   */
  async minar(indice, opciones = {}) {
    const bloque = this.bloques[indice];
    if (!bloque) throw new RangeError(`No existe el bloque ${indice}.`);
    if (indice > 0) {
      const previo = this.bloques[indice - 1];
      if (!previo.minado) throw new Error(`El bloque ${indice - 1} todavía no está minado.`);
      bloque.hashPrevio = previo.hash;
    }
    bloque.dificultad = this.dificultad;
    return bloque.minar(opciones);
  }

  /**
   * Cambia los datos de un bloque. Si ya estaba minado, su hash se recalcula en
   * el acto con el mismo nonce: deja de cumplir la dificultad y deja de coincidir
   * con el hashPrevio del siguiente. La cascada sale sola de validar().
   */
  async editar(indice, datos) {
    const bloque = this.bloques[indice];
    if (!bloque) throw new RangeError(`No existe el bloque ${indice}.`);
    bloque.datos = datos;
    if (!bloque.minado) return;
    // Si llegan varias ediciones seguidas, sólo cuenta el hash de la última.
    const version = (this.#versiones.get(bloque) ?? 0) + 1;
    this.#versiones.set(bloque, version);
    const hash = await bloque.calcularHash();
    if (this.#versiones.get(bloque) === version) bloque.hash = hash;
  }

  /** Reescribe la historia desde `indice`: remina ése y todos los siguientes. */
  async reminarDesde(indice, { senal, alProgreso } = {}) {
    let intentos = 0;
    let ms = 0;
    for (let i = indice; i < this.bloques.length; i++) {
      const acumulado = intentos;
      const resultado = await this.minar(i, {
        senal,
        alProgreso: alProgreso && ((p) => alProgreso({ indice: i, intentos: acumulado + p.intentos, ms: ms + p.ms })),
      });
      intentos += resultado.intentos;
      ms += resultado.ms;
      if (!resultado.encontrado) return { completado: false, hasta: i, intentos, ms };
    }
    return { completado: true, hasta: this.bloques.length - 1, intentos, ms };
  }

  /**
   * Revisa la cadena bloque por bloque. Cada informe dice qué comprobación falló,
   * no sólo si falló: el hash contra el contenido, la dificultad, el enlace con el
   * anterior y el orden temporal. Un bloque bien formado que cuelga de una historia
   * inválida queda como HEREDADO, distinto de INVALIDO.
   */
  async validar() {
    const recalculados = await Promise.all(
      this.bloques.map((b) => (b.minado ? b.calcularHash() : null)),
    );
    const informes = [];
    let historiaSana = true;

    this.bloques.forEach((bloque, i) => {
      const previo = this.bloques[i - 1];
      const comprobaciones = {
        hashCoincide: bloque.minado && recalculados[i] === bloque.hash,
        cumpleDificultad: bloque.minado && bloque.hash.startsWith('0'.repeat(bloque.dificultad)),
        enlaceCorrecto: i === 0 ? bloque.hashPrevio === CEROS_64 : bloque.hashPrevio === previo.hash,
        ordenTemporal: i === 0 || bloque.timestamp >= previo.timestamp,
      };

      let estado;
      let motivo;
      if (!bloque.minado) {
        estado = ESTADO.PENDIENTE;
        motivo = 'Todavía no se ha minado.';
      } else if (!comprobaciones.hashCoincide) {
        estado = ESTADO.INVALIDO;
        motivo = 'El hash guardado no corresponde a su contenido.';
      } else if (!comprobaciones.cumpleDificultad) {
        estado = ESTADO.INVALIDO;
        motivo = `Su hash ya no empieza con ${ceros(bloque.dificultad)}: el contenido cambió después de minarlo.`;
      } else if (!comprobaciones.enlaceCorrecto) {
        estado = ESTADO.INVALIDO;
        motivo = i === 0
          ? 'El bloque génesis tiene que apuntar a 64 ceros.'
          : `Su hashPrevio ya no coincide con el hash del bloque ${i - 1}.`;
      } else if (!comprobaciones.ordenTemporal) {
        estado = ESTADO.INVALIDO;
        motivo = `Su sello de tiempo es anterior al del bloque ${i - 1}.`;
      } else if (!historiaSana) {
        estado = ESTADO.HEREDADO;
        motivo = 'Está bien formado, pero cuelga de una historia que ya no es válida.';
      } else {
        estado = ESTADO.VALIDO;
        motivo = 'Íntegro, minado y enlazado con el anterior.';
      }

      if (estado !== ESTADO.VALIDO) historiaSana = false;
      informes.push({ indice: i, estado, motivo, ...comprobaciones });
    });

    return { valida: informes.every((inf) => inf.estado === ESTADO.VALIDO), informes };
  }
}
