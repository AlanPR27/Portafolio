/*
 * Carrera de minería entre los tres actores de la cadena de suministro. La usa
 * el módulo 6, y no reimplementa nada: los bloques son los de cadena.js, los
 * actores los de suministro.js y la búsqueda de nonce la de crypto-utils.js.
 * No toca el DOM, así que la carrera se ejercita con Node.
 *
 * Los tres cubren clases residuales módulo 3 del espacio de nonces:
 *
 *   proveedor     n ≡ 0 (mod 3)   0, 3, 6, 9, …
 *   almacén       n ≡ 1 (mod 3)   1, 4, 7, 10, …
 *   distribuidor  n ≡ 2 (mod 3)   2, 5, 8, 11, …
 *
 * Las particiones son disjuntas y su unión es todo ℕ: ningún nonce se prueba dos
 * veces y ninguno queda sin probar. Eso elimina el trabajo duplicado —y con él,
 * como se ve en el módulo, la competencia real.
 *
 * El minero NO entra en Bloque.contenido(), así que no altera el hash ni la
 * validación: es metadato posterior. Por eso los tres minan el mismo candidato y
 * cada uno tiene un objetivo fijo dentro de su propia clase.
 */
import { Bloque } from './cadena.js';
import { ACTORES } from './suministro.js';
import { buscarNonce, cerosIniciales } from './crypto-utils.js';

export const MODULO = 3;

/** Cada actor con la clase residual que le toca. El orden es el de la custodia. */
export const MINEROS = Object.freeze([
  Object.freeze({ clave: 'proveedor', residuo: 0 }),
  Object.freeze({ clave: 'almacen', residuo: 1 }),
  Object.freeze({ clave: 'distribuidor', residuo: 2 }),
]);

export const CLAVES = Object.freeze(MINEROS.map((m) => m.clave));

/** Lote por omisión de buscarNonce: es también la unidad de velocidad relativa. */
export const LOTE_BASE = 128;

export const nombreMinero = (clave) => ACTORES[clave]?.nombre ?? clave;
export const articuloMinero = (clave) => ACTORES[clave]?.articulo ?? `«${clave}»`;

/** A qué actor le corresponde un nonce, por su clase módulo 3. */
export function mineroDeNonce(nonce) {
  const clase = ((nonce % MODULO) + MODULO) % MODULO;
  return MINEROS[clase].clave;
}

const prefijoDe = (bloque) => '0'.repeat(bloque.dificultad);

/**
 * Un corredor: busca dentro de su clase y va dejando constancia de por dónde va.
 *
 * buscarNonce llama a `cumple` una vez por digest y en orden, así que la llamada
 * k-ésima corresponde exactamente al nonce `residuo + k·3`. De ahí salen el
 * último nonce probado y el mejor intento —el digest con más ceros iniciales que
 * ha visto— sin tener que tocar buscarNonce más allá del parámetro `paso`.
 */
function correr(bloque, { clave, residuo }, { lote, senal, alProgreso }) {
  const prefijo = prefijoDe(bloque);
  const estado = {
    clave,
    residuo,
    lote,
    intentos: 0,
    ms: 0,
    ultimo: null, // { nonce, digest } más reciente
    mejor: { ceros: -1, nonce: null, digest: null },
    encontrado: false,
    nonce: null,
    hash: null,
  };

  let k = 0;
  const promesa = buscarNonce({
    construir: (n) => bloque.contenido(n),
    cumple: (digest) => {
      const nonce = residuo + k * MODULO;
      k += 1;
      estado.ultimo = { nonce, digest };
      const cuantos = cerosIniciales(digest);
      if (cuantos > estado.mejor.ceros) estado.mejor = { ceros: cuantos, nonce, digest };
      return digest.startsWith(prefijo);
    },
    desde: residuo,
    paso: MODULO,
    lote,
    senal,
    alProgreso: (p) => {
      estado.intentos = p.intentos;
      estado.ms = p.ms;
      alProgreso?.(estado);
    },
  }).then((resultado) => {
    estado.intentos = resultado.intentos;
    estado.ms = resultado.ms;
    estado.encontrado = resultado.encontrado;
    estado.nonce = resultado.nonce;
    estado.hash = resultado.digest;
    return estado;
  });

  return { estado, promesa };
}

/**
 * Los tres compiten por el mismo bloque candidato. Corren de verdad en paralelo:
 * buscarNonce cede el hilo cada ~12 ms, así que las tres búsquedas se intercalan
 * en el bucle de eventos sin necesidad de workers.
 *
 * `velocidades` da el lote de cada actor. Un lote mayor son más intentos por
 * turno: es el control de velocidad relativa, y no hace falta ningún mecanismo
 * aparte porque buscarNonce ya lo tiene.
 *
 * @returns {Promise<{encontrado: boolean, ganador: string|null, nonce: number|null,
 *   hash: string|null, ms: number, corredores: object[]}>}
 */
export async function correrCarrera(bloque, { velocidades = {}, senal, alProgreso } = {}) {
  const control = new AbortController();
  if (senal) {
    if (senal.aborted) control.abort();
    else senal.addEventListener('abort', () => control.abort(), { once: true });
  }

  const inicio = performance.now();
  const corredores = MINEROS.map((minero) =>
    correr(bloque, minero, {
      lote: velocidades[minero.clave] ?? LOTE_BASE,
      senal: control.signal,
      alProgreso,
    }),
  );

  // El primero en resolver es el que encontró: los demás siguen buscando.
  const primero = await Promise.race(corredores.map((c) => c.promesa));
  control.abort();
  const finales = await Promise.all(corredores.map((c) => c.promesa));

  // Tras el abort puede quedar un lote en vuelo que también acierte; el ganador
  // es el que resolvió primero, no el que aparezca primero en la lista.
  const ganador = primero.encontrado ? primero : (finales.find((e) => e.encontrado) ?? null);

  return {
    encontrado: Boolean(ganador),
    ganador: ganador?.clave ?? null,
    nonce: ganador?.nonce ?? null,
    hash: ganador?.hash ?? null,
    ms: performance.now() - inicio,
    corredores: finales,
  };
}

/** Escribe en el bloque el nonce ganador y quién lo encontró. */
export function sellarCon(bloque, resultado) {
  if (!resultado.encontrado) return bloque;
  bloque.nonce = resultado.nonce;
  bloque.hash = resultado.hash;
  bloque.minero = resultado.ganador;
  return bloque;
}

/**
 * El objetivo de cada actor: el primer nonce válido dentro de su propia clase.
 * Los tres se calculan hasta el final, sin abortar a nadie.
 *
 * Es lo que revela la mecánica del módulo. Cada actor tiene una meta fija
 * asignada de antemano por el bloque; nadie compite por la misma. A igual
 * velocidad gana el que tiene la meta más cercana, siempre, y repetir la carrera
 * da el mismo resultado. El cociente entre dos objetivos dice exactamente cuánta
 * ventaja de velocidad necesitaría el de atrás para adelantarlo.
 */
export async function revelarObjetivos(bloque, { senal } = {}) {
  const prefijo = prefijoDe(bloque);
  const metas = await Promise.all(
    MINEROS.map(async ({ clave, residuo }) => {
      const r = await buscarNonce({
        construir: (n) => bloque.contenido(n),
        cumple: (digest) => digest.startsWith(prefijo),
        desde: residuo,
        paso: MODULO,
        senal,
      });
      return { clave, residuo, nonce: r.nonce, hash: r.digest, intentos: r.intentos, encontrado: r.encontrado };
    }),
  );

  const completos = metas.filter((m) => m.encontrado);
  const minimo = completos.length ? Math.min(...completos.map((m) => m.nonce)) : null;
  return {
    metas: metas.sort((a, b) => (a.nonce ?? Infinity) - (b.nonce ?? Infinity)),
    nonceMinimo: minimo,
    favorito: minimo === null ? null : mineroDeNonce(minimo),
  };
}

/**
 * Torneo: corre la carrera sobre N candidatos distintos y cuenta las victorias.
 * Los bloques son de mentira —no se enganchan a ninguna cadena— porque lo único
 * que interesa es la clase del primer nonce válido de cada uno.
 *
 * Bloque a bloque el resultado está determinado; entre bloques, no. Con
 * suficientes rondas las tres proporciones se acercan a 1/3.
 */
export async function torneo(rondas, { dificultad = 3, velocidades = {}, senal, alTerminarRonda } = {}) {
  const victorias = Object.fromEntries(CLAVES.map((c) => [c, 0]));
  const historial = [];

  for (let i = 0; i < rondas; i++) {
    if (senal?.aborted) break;
    const candidato = new Bloque({
      indice: i,
      timestamp: 1_700_000_000_000 + i * 1000,
      dificultad,
      datos: `Ronda ${i + 1} del torneo`,
      hashPrevio: '0'.repeat(64),
    });
    const resultado = await correrCarrera(candidato, { velocidades, senal });
    if (!resultado.encontrado) break;
    victorias[resultado.ganador] += 1;
    historial.push({ ronda: i + 1, ganador: resultado.ganador, nonce: resultado.nonce });
    alTerminarRonda?.({ ronda: i + 1, rondas, victorias, resultado });
  }

  const total = historial.length;
  return {
    total,
    victorias,
    proporciones: Object.fromEntries(CLAVES.map((c) => [c, total ? victorias[c] / total : 0])),
    historial,
  };
}
