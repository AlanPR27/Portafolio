/*
 * Utilidades compartidas por los cinco módulos del laboratorio.
 *
 * Todo sale de Web Crypto (crypto.subtle), nativa del navegador. No hay una sola
 * librería de terceros, y no debe haberla: si algo parece necesitar una, se
 * pregunta antes (CLAUDE-lab.md, sección 2).
 *
 * Funciona igual en el navegador y en Node, lo que permite ejercitar la lógica
 * con un script de un solo tiro sin levantar ningún servidor.
 */

const codificador = new TextEncoder();

/** hashPrevio del bloque génesis: 64 ceros hexadecimales. */
export const CEROS_64 = '0'.repeat(64);

/** crypto.subtle sólo existe en contexto seguro: HTTPS o localhost. */
export function hayCriptoSegura() {
  return globalThis.isSecureContext !== false && Boolean(globalThis.crypto?.subtle);
}

// ------------------------------------------------------------------- bytes

export function utf8(texto) {
  return codificador.encode(texto);
}

export function hex(datos) {
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  let salida = '';
  for (const b of bytes) salida += b.toString(16).padStart(2, '0');
  return salida;
}

export function desdeHex(cadena) {
  if (cadena.length % 2 !== 0 || /[^0-9a-f]/i.test(cadena)) {
    throw new TypeError('La cadena no es hexadecimal válida.');
  }
  const bytes = new Uint8Array(cadena.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(cadena.slice(2 * i, 2 * i + 2), 16);
  }
  return bytes;
}

export function base64(datos) {
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

/** base64url, el alfabeto de los campos de un JWK, a bytes. */
export function desdeBase64url(texto) {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

// -------------------------------------------------------------------- hash

export async function sha256(datos) {
  const bytes = typeof datos === 'string' ? utf8(datos) : datos;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function sha256Hex(datos) {
  return hex(await sha256(datos));
}

/** Cuántos ceros hexadecimales iniciales tiene un digest. */
export function cerosIniciales(digest) {
  return digest.match(/^0*/)[0].length;
}

/**
 * Distancia de Hamming entre dos digests en hex, con el mapa bit a bit.
 * El bit más significativo de cada byte va primero, igual que se lee el hex.
 */
export function diferenciaBits(hexA, hexB) {
  const a = desdeHex(hexA);
  const b = desdeHex(hexB);
  if (a.length !== b.length) throw new RangeError('Los digests tienen longitudes distintas.');
  const mapa = new Uint8Array(a.length * 8);
  let distintos = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ^ b[i];
    for (let j = 0; j < 8; j++) {
      const bit = (x >> (7 - j)) & 1;
      mapa[8 * i + j] = bit;
      distintos += bit;
    }
  }
  return { distintos, total: mapa.length, mapa };
}

/** Distancia de Hamming entre dos cadenas de bytes, o null si miden distinto. */
export function hammingBytes(a, b) {
  if (a.length !== b.length) return null;
  let distancia = 0;
  for (let i = 0; i < a.length; i++) {
    let x = a[i] ^ b[i];
    while (x) {
      distancia += x & 1;
      x >>= 1;
    }
  }
  return distancia;
}

// ------------------------------------------------------------- presentación

/**
 * Estrategia única de truncado en todo el laboratorio: los 8 primeros y los 8
 * últimos caracteres. Se usa cuando un digest es una referencia (hashPrevio,
 * listas, recibos). Cuando el digest ES la lectura, se muestra completo.
 * El valor completo siempre queda disponible para copiar.
 */
export function truncar(valor, n = 8) {
  return valor.length <= 2 * n + 1 ? valor : `${valor.slice(0, n)}…${valor.slice(-n)}`;
}

/** Agrupa en palabras de 8 caracteres, como se escriben los digests en los apuntes. */
export function agrupar(valor, n = 8) {
  const grupos = [];
  for (let i = 0; i < valor.length; i += n) grupos.push(valor.slice(i, i + n));
  return grupos.join(' ');
}

// ------------------------------------------------------------ serialización

/**
 * JSON canónico: claves ordenadas en todos los niveles, sin espacios.
 * Hashear o firmar un objeto exige una serialización única. Si el orden de las
 * claves variara, la misma transacción tendría dos digests y la firma no
 * verificaría.
 */
export function canonico(valor) {
  if (valor === undefined || typeof valor === 'function' || typeof valor === 'symbol') {
    throw new TypeError('Valor no serializable.');
  }
  if (typeof valor === 'number' && !Number.isFinite(valor)) {
    throw new TypeError('Número no finito.');
  }
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  const claves = Object.keys(valor).filter((k) => valor[k] !== undefined).sort();
  return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`).join(',')}}`;
}

// -------------------------------------------------- búsqueda sin congelar

/** Devuelve el control al navegador para que pinte y atienda eventos. */
export function ceder() {
  return new Promise((resolver) => setTimeout(resolver, 0));
}

/**
 * Busca, en orden, el primer nonce cuyo digest cumpla una condición.
 * Evalúa lotes en paralelo y cede el hilo cada ~12 ms, así que ni la dificultad
 * más alta congela la pestaña. Se detiene con un AbortSignal.
 *
 * @param {object} o
 * @param {(n: number) => string | Uint8Array} o.construir  lo que se hashea para el nonce n
 * @param {(digest: string) => boolean} o.cumple            la condición buscada
 * @param {number} [o.desde=0]
 * @param {number} [o.lote=128]
 * @param {AbortSignal} [o.senal]
 * @param {(p: {intentos: number, ms: number}) => void} [o.alProgreso]
 */
export async function buscarNonce({ construir, cumple, desde = 0, lote = 128, senal, alProgreso }) {
  const inicio = performance.now();
  let siguiente = desde;
  let intentos = 0;
  let ultimoAviso = inicio;

  for (;;) {
    const corte = performance.now() + 12;
    do {
      if (senal?.aborted) {
        return { encontrado: false, nonce: null, digest: null, intentos, ms: performance.now() - inicio };
      }
      const nonces = Array.from({ length: lote }, (_, i) => siguiente + i);
      const digests = await Promise.all(nonces.map((n) => sha256Hex(construir(n))));
      for (let i = 0; i < lote; i++) {
        if (cumple(digests[i])) {
          intentos += i + 1;
          return {
            encontrado: true,
            nonce: nonces[i],
            digest: digests[i],
            intentos,
            ms: performance.now() - inicio,
          };
        }
      }
      intentos += lote;
      siguiente += lote;
    } while (performance.now() < corte);

    const ahora = performance.now();
    if (alProgreso && ahora - ultimoAviso >= 100) {
      ultimoAviso = ahora;
      alProgreso({ intentos, ms: ahora - inicio });
    }
    await ceder();
  }
}

// -------------------------------------------------------------- firma ECDSA

const CURVA = { name: 'ECDSA', namedCurve: 'P-256' };
const ALGORITMO_FIRMA = { name: 'ECDSA', hash: 'SHA-256' };

/** Par de llaves ECDSA P-256. Extraíble sólo para poder mostrarlo en pantalla. */
export function generarPar() {
  return crypto.subtle.generateKey(CURVA, true, ['sign', 'verify']);
}

/** Llave pública en formato raw: 65 bytes, 0x04 ‖ x ‖ y. */
export async function exportarPublica(llave) {
  return hex(await crypto.subtle.exportKey('raw', llave));
}

export function exportarJWK(llave) {
  return crypto.subtle.exportKey('jwk', llave);
}

/**
 * Llave privada como el escalar d de 32 bytes, en hex. Sólo se puede porque el
 * par se generó extraíble, y sólo se hace para mostrarla en pantalla.
 */
export async function exportarPrivada(llave) {
  const { d } = await crypto.subtle.exportKey('jwk', llave);
  return hex(desdeBase64url(d));
}

export function importarPublica(hexRaw) {
  return crypto.subtle.importKey('raw', desdeHex(hexRaw), CURVA, true, ['verify']);
}

/**
 * Firma el mensaje. Web Crypto hashea con SHA-256 internamente y devuelve la
 * firma como r ‖ s (64 bytes, formato IEEE P1363), no en DER.
 */
export async function firmar(privada, mensaje) {
  const datos = typeof mensaje === 'string' ? utf8(mensaje) : mensaje;
  return hex(await crypto.subtle.sign(ALGORITMO_FIRMA, privada, datos));
}

/** true sólo si la firma es válida; cualquier dato malformado cuenta como inválida. */
export async function verificar(publica, mensaje, firmaHex) {
  try {
    const datos = typeof mensaje === 'string' ? utf8(mensaje) : mensaje;
    return await crypto.subtle.verify(ALGORITMO_FIRMA, publica, desdeHex(firmaHex), datos);
  } catch {
    return false;
  }
}
