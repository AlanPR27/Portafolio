/*
 * Módulo 6 — Minería competitiva entre los tres actores.
 * La carrera y las clases residuales viven en carrera.js; la custodia y las
 * firmas, en suministro.js. Aquí sólo está la interfaz.
 */
import { Bloque, ESTADO } from './cadena.js';
import {
  ACCIONES,
  ACTORES,
  ORDEN,
  Suministro,
  crearEvento,
  crearRegistro,
  describir,
  firmarEvento,
} from './suministro.js';
import {
  CLAVES,
  LOTE_BASE,
  MINEROS,
  articuloMinero,
  correrCarrera,
  nombreMinero,
  revelarObjetivos,
  sellarCon,
  torneo,
} from './carrera.js';
import {
  $,
  ETIQUETA_ESTADO,
  anunciar,
  arrancar,
  campo,
  el,
  fecha,
  formato,
  marca,
  pintarDigest,
  plural,
  ponerEstado,
  referencia,
  segundos,
} from './ui.js';

const suministro = new Suministro({ registro: null, dificultad: 3 });
const carriles = new Map(); // clave del actor → nodos de su carril
let control = null; // AbortController de la carrera en curso
let ultimoCandidato = null; // el último bloque minado, para repetir su carrera
let ocupado = false;

const dificultad = () => Number($('#dificultad').value);
const rondas = () => Number($('#rondas').value);

/** El lote de cada actor: es la unidad de velocidad relativa de buscarNonce. */
function velocidades() {
  const mapa = {};
  for (const clave of CLAVES) mapa[clave] = LOTE_BASE * Number($(`#vel-${clave}`).value);
  return mapa;
}

function bloquear(si) {
  ocupado = si;
  for (const id of ['correr', 'repetir', 'evento', 'revelar', 'torneo']) $(`#${id}`).disabled = si;
  $('#detener').disabled = !si;
  if (!si) {
    $('#repetir').disabled = ultimoCandidato === null;
    $('#revelar').disabled = ultimoCandidato === null;
  }
}

// ------------------------------------------------------------------ carriles

function crearCarriles() {
  const lista = $('#carriles');
  lista.replaceChildren(
    ...MINEROS.map(({ clave, residuo }) => {
      const nombre = el('p', 'carril-nombre', marca(), nombreMinero(clave));
      nombre.id = `carril-${clave}-nombre`;
      const clase = el('p', 'carril-clase', `n ≡ ${residuo} (mod 3)`);
      const posicion = el('p', 'carril-posicion', '—');
      const digest = el('p', 'digest digest-chico', '—');
      const campos = el('dl', 'campos');
      const dd = {
        intentos: campo(campos, 'Intentos'),
        mejor: campo(campos, 'Mejor intento'),
        tasa: campo(campos, 'Velocidad'),
      };
      const articulo = el('article', 'carril');
      articulo.dataset.actor = clave;
      articulo.dataset.estado = 'pendiente';
      articulo.setAttribute('aria-labelledby', nombre.id);
      articulo.append(
        el('div', 'carril-cabeza', nombre, clase),
        el('span', 'rotulo', 'Nonce en curso'),
        posicion,
        digest,
        campos,
      );
      carriles.set(clave, { articulo, posicion, digest, dd });
      return el('li', null, articulo);
    }),
  );
  for (const clave of CLAVES) reiniciarCarril(clave);
}

function reiniciarCarril(clave) {
  const c = carriles.get(clave);
  c.articulo.dataset.estado = 'pendiente';
  c.posicion.textContent = '—';
  c.digest.replaceChildren('—');
  c.dd.intentos.textContent = '0';
  c.dd.mejor.textContent = '—';
  c.dd.tasa.textContent = '—';
}

/** Un corredor avanzó: se repinta sólo su carril. */
function pintarCarril(estado) {
  const c = carriles.get(estado.clave);
  if (!c) return;
  if (c.articulo.dataset.estado === 'pendiente') c.articulo.dataset.estado = 'minando';
  if (estado.ultimo) {
    c.posicion.textContent = formato.format(estado.ultimo.nonce);
    pintarDigest(c.digest, estado.ultimo.digest, { marcarCeros: true });
  }
  c.dd.intentos.textContent = formato.format(estado.intentos);
  if (estado.mejor.ceros >= 0) {
    c.dd.mejor.textContent = `${plural(estado.mejor.ceros, 'cero', 'ceros')} · n=${formato.format(estado.mejor.nonce)}`;
  }
  if (estado.ms > 0) {
    c.dd.tasa.textContent = `${formato.format(Math.round(estado.intentos / (estado.ms / 1000)))} h/s`;
  }
}

function cerrarCarriles(resultado) {
  for (const estado of resultado.corredores) {
    pintarCarril(estado);
    const c = carriles.get(estado.clave);
    const gano = estado.clave === resultado.ganador;
    c.articulo.dataset.estado = gano ? 'valido' : 'detenido';
    if (gano) {
      c.posicion.textContent = formato.format(estado.nonce);
      pintarDigest(c.digest, estado.hash, { marcarCeros: true });
    }
  }
}

// -------------------------------------------------------------------- cadena

async function pintarCadena() {
  const { informes } = await suministro.validar();
  const bloques = suministro.cadena.bloques;

  $('#cadena').replaceChildren(
    ...informes.map((informe) => {
      const bloque = bloques[informe.indice];
      const nombre = el('p', 'bloque-nombre', marca(), `Bloque ${informe.indice}`);
      nombre.id = `min-bloque-${informe.indice}`;
      const articulo = el('article', 'bloque');
      articulo.dataset.estado = informe.estado;
      articulo.setAttribute('aria-labelledby', nombre.id);

      const campos = el('dl', 'campos');
      const quien = bloque.minero
        ? el('span', 'sello-minero', el('span', 'sello-marca'), nombreMinero(bloque.minero))
        : 'génesis, sin carrera';
      campos.dataset.minero = bloque.minero ?? '';
      campo(campos, 'Minado por', quien);
      campo(campos, 'Nonce', bloque.nonce === null ? '—' : formato.format(bloque.nonce));
      campo(campos, 'Clase', bloque.minero === undefined || bloque.nonce === null
        ? '—'
        : `n ≡ ${bloque.nonce % 3} (mod 3)`);
      campo(campos, 'Sello', fecha(bloque.timestamp));

      const txs = Array.isArray(bloque.datos)
        ? el(
            'ul',
            'txs',
            ...bloque.datos.map((tx) =>
              el('li', null, el('span', null, `${tx.evento.lote} · ${describir(tx.evento)}`)),
            ),
          )
        : el('p', 'nota', String(bloque.datos));

      const hash = el('p', 'digest digest-chico');
      if (bloque.hash) pintarDigest(hash, bloque.hash, { marcarCeros: true });
      else hash.replaceChildren('sin minar');

      articulo.append(
        el('div', 'bloque-cabeza', nombre, el('span', 'bloque-estado', ETIQUETA_ESTADO[informe.estado])),
        campos,
        txs,
        el('span', 'rotulo', 'Hash'),
        hash,
      );
      return el('li', null, articulo);
    }),
  );

  $('#n-bloques').textContent = formato.format(bloques.length);
  $('#n-pendientes').textContent = formato.format(suministro.pendientes.length);
  const porActor = CLAVES.map((c) => `${nombreMinero(c)} ${bloques.filter((b) => b.minero === c).length}`);
  $('#reparto').textContent = porActor.join(' · ');
}

function pintarPendientes() {
  const lista = $('#pendientes');
  if (!suministro.pendientes.length) {
    lista.replaceChildren(el('li', 'nota', 'No hay eventos en espera. El bloque saldría vacío.'));
    return;
  }
  lista.replaceChildren(
    ...suministro.pendientes.map((tx) =>
      el('li', null, `${tx.evento.lote} · ${describir(tx.evento)}`),
    ),
  );
}

// ------------------------------------------------------------------ acciones

/** El siguiente paso de custodia que toque, firmado por quien le corresponde. */
async function agregarEvento() {
  const lotes = suministro.lotes();
  let lote = lotes.at(-1);
  if (!lote || suministro.pasos(lote).length >= ORDEN.length) lote = suministro.siguienteLote();

  const accion = ORDEN[suministro.pasos(lote).length];
  const actor = Object.keys(ACTORES).find((c) => ACTORES[c].accion === accion);
  const evento = crearEvento({
    lote,
    producto: 'Café verde, saco 60 kg',
    cantidad: 120,
    actor,
    accion,
    timestamp: Date.now(),
  });
  const tx = await firmarEvento(evento, suministro.registro[actor].privada);
  const revision = await suministro.enviar(tx);

  ponerEstado(
    $('#pool-estado'),
    revision.aceptada ? 'valido' : 'invalido',
    revision.aceptada
      ? `Aceptado: ${articuloMinero(actor)} ${ACCIONES[accion].verbo} el lote ${lote}.`
      : revision.motivo,
  );
  pintarPendientes();
  await pintarCadena();
}

async function correrNueva() {
  if (ocupado) return;
  if (!suministro.pendientes.length) await agregarEvento();

  bloquear(true);
  for (const clave of CLAVES) reiniciarCarril(clave);
  $('#objetivos').replaceChildren();
  suministro.cadena.dificultad = dificultad();

  const bloque = suministro.cadena.agregar(
    suministro.pendientes.map(({ evento, firma }) => ({ evento, firma })),
  );
  suministro.pendientes = [];
  pintarPendientes();
  ponerEstado($('#carrera-estado'), 'minando', `Los tres buscan el nonce del bloque ${bloque.indice}…`);

  control = new AbortController();
  const resultado = await correrCarrera(bloque, {
    velocidades: velocidades(),
    senal: control.signal,
    alProgreso: pintarCarril,
  });
  control = null;

  if (resultado.encontrado) {
    sellarCon(bloque, resultado);
    ultimoCandidato = bloque;
    cerrarCarriles(resultado);
    const ganador = resultado.corredores.find((c) => c.clave === resultado.ganador);
    ponerEstado(
      $('#carrera-estado'),
      'valido',
      `Ganó ${articuloMinero(resultado.ganador)} con el nonce ${formato.format(resultado.nonce)}, ` +
        `de su clase n ≡ ${resultado.nonce % 3} (mod 3), tras ${plural(ganador.intentos, 'intento', 'intentos')} ` +
        `en ${segundos(resultado.ms)}.`,
    );
    anunciar(`Ganó ${nombreMinero(resultado.ganador)}.`);
  } else {
    // Se detuvo a mano: el bloque queda sin minar y se deshace para no dejar la cadena a medias.
    suministro.cadena.bloques.pop();
    suministro.pendientes = bloque.datos;
    pintarPendientes();
    for (const clave of CLAVES) carriles.get(clave).articulo.dataset.estado = 'detenido';
    ponerEstado($('#carrera-estado'), 'detenido', 'Carrera detenida. Los eventos vuelven a la espera.');
  }

  await pintarCadena();
  bloquear(false);
}

/** Vuelve a correr la carrera sobre una copia suelta del último candidato. */
async function repetir() {
  if (ocupado || !ultimoCandidato) return;
  bloquear(true);
  for (const clave of CLAVES) reiniciarCarril(clave);
  ponerEstado($('#carrera-estado'), 'minando', 'Misma carrera, otra vez…');

  const copia = new Bloque({
    indice: ultimoCandidato.indice,
    timestamp: ultimoCandidato.timestamp,
    dificultad: ultimoCandidato.dificultad,
    datos: ultimoCandidato.datos,
    hashPrevio: ultimoCandidato.hashPrevio,
  });

  control = new AbortController();
  const resultado = await correrCarrera(copia, {
    velocidades: velocidades(),
    senal: control.signal,
    alProgreso: pintarCarril,
  });
  control = null;

  if (resultado.encontrado) {
    cerrarCarriles(resultado);
    const igual = resultado.nonce === ultimoCandidato.nonce;
    ponerEstado(
      $('#carrera-estado'),
      igual ? 'valido' : 'heredado',
      igual
        ? `Mismo ganador y mismo nonce: ${nombreMinero(resultado.ganador)}, ${formato.format(resultado.nonce)}. ` +
          'El bloque no cambió, así que su nonce mínimo tampoco.'
        : `Cambió el ganador: ahora ${articuloMinero(resultado.ganador)} con el nonce ${formato.format(resultado.nonce)}. ` +
          'Eso sólo pasa si moviste las velocidades: alguien alcanzó su objetivo antes que el otro al suyo.',
    );
  } else {
    ponerEstado($('#carrera-estado'), 'detenido', 'Repetición detenida.');
  }
  bloquear(false);
}

/** Para cada actor, el primer nonce válido de su propia clase. */
async function revelar() {
  if (ocupado || !ultimoCandidato) return;
  bloquear(true);
  ponerEstado($('#carrera-estado'), 'minando', 'Buscando el objetivo de cada actor…');

  control = new AbortController();
  const { metas } = await revelarObjetivos(ultimoCandidato, { senal: control.signal });
  control = null;

  const completos = metas.filter((m) => m.encontrado);
  if (!completos.length) {
    ponerEstado($('#carrera-estado'), 'detenido', 'Búsqueda de objetivos detenida.');
    bloquear(false);
    return;
  }

  const lider = completos[0];
  $('#objetivos').replaceChildren(
    el('p', 'banco-intro', 'El primer nonce válido dentro de la clase de cada actor. Son metas fijas, ' +
      'asignadas por el bloque antes de que nadie empiece a buscar.'),
    el(
      'ol',
      'metas',
      ...completos.map((m) => {
        const razon = m.nonce / lider.nonce;
        const fila = el('li', null,
          el('span', 'meta-actor', nombreMinero(m.clave)),
          el('span', 'meta-nonce', `n = ${formato.format(m.nonce)}`),
          el('span', 'meta-nota', m.clave === lider.clave
            ? 'la meta más cercana: gana a igual velocidad'
            : `necesita más de ${razon.toFixed(2)}× la velocidad de ${nombreMinero(lider.clave)} para adelantarlo`),
        );
        fila.dataset.actor = m.clave;
        return fila;
      }),
    ),
  );
  ponerEstado(
    $('#carrera-estado'),
    'valido',
    `A igual velocidad gana ${articuloMinero(lider.clave)}: su objetivo es el más cercano de los tres.`,
  );
  bloquear(false);
}

async function correrTorneo() {
  if (ocupado) return;
  bloquear(true);
  const total = rondas();
  const barra = $('#torneo-resultado');
  ponerEstado($('#torneo-estado'), 'minando', `Minando ${plural(total, 'candidato', 'candidatos')}…`);

  control = new AbortController();
  const resultado = await torneo(total, {
    dificultad: dificultad(),
    velocidades: velocidades(),
    senal: control.signal,
    alTerminarRonda: ({ ronda, victorias }) => {
      ponerEstado($('#torneo-estado'), 'minando', `Ronda ${ronda} de ${total}…`);
      pintarTorneo(barra, victorias, ronda);
    },
  });
  control = null;

  pintarTorneo(barra, resultado.victorias, resultado.total);
  ponerEstado(
    $('#torneo-estado'),
    'valido',
    `${plural(resultado.total, 'ronda corrida', 'rondas corridas')}. ` +
      CLAVES.map((c) => `${nombreMinero(c)} ${(resultado.proporciones[c] * 100).toFixed(0)} %`).join(' · ') +
      '. Cada bloque estaba decidido de antemano; el reparto entre bloques no.',
  );
  bloquear(false);
}

function pintarTorneo(contenedor, victorias, total) {
  contenedor.replaceChildren(
    ...CLAVES.map((clave) => {
      const n = victorias[clave] ?? 0;
      const parte = total ? n / total : 0;
      const fila = el('div', 'tally');
      fila.dataset.actor = clave;
      fila.style.setProperty('--parte', String(parte));
      fila.append(
        el('span', 'tally-actor', nombreMinero(clave)),
        el('span', 'tally-barra'),
        el('span', 'tally-cifra', `${n} · ${(parte * 100).toFixed(0)} %`),
      );
      return fila;
    }),
  );
}

// ------------------------------------------------------------------ arranque

arrancar(async () => {
  crearCarriles();
  pintarTorneo($('#torneo-resultado'), Object.fromEntries(CLAVES.map((c) => [c, 0])), 0);

  $('#dificultad').addEventListener('input', () => {
    $('#dificultad-valor').textContent = dificultad();
    $('#esperados').textContent = formato.format(16 ** dificultad());
  });
  $('#rondas').addEventListener('input', () => {
    $('#rondas-valor').textContent = rondas();
  });
  $('#correr').addEventListener('click', correrNueva);
  $('#repetir').addEventListener('click', repetir);
  $('#revelar').addEventListener('click', revelar);
  $('#evento').addEventListener('click', agregarEvento);
  $('#torneo').addEventListener('click', correrTorneo);
  $('#detener').addEventListener('click', () => control?.abort());

  suministro.registro = await crearRegistro();
  await suministro.iniciar();
  await agregarEvento();
  ponerEstado($('#carrera-estado'), 'pendiente', 'Listo. Corre la primera carrera.');
  bloquear(false);
  $('#detener').disabled = true;
});
