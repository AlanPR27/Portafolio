# Apuntes — Álgebra Lineal Avanzada y Blockchain

Sitio estático de apuntes universitarios de dos materias.
Alan Placeres · Universidad Anáhuac México, Facultad de Ingeniería.

**Publicado en:** <https://alanpr27.github.io/Portafolio/>

Cada tema tiene un resumen escrito por mí y, al final, los apuntes originales
adjuntos como descarga. El material original es del **Dr. José de Jesús Ángel
Ángel**; la excepción es el ejercicio de compresión de imágenes del tema 09 de
Álgebra, cuyo código es propio.

---

## Estructura

```
/
├── index.html                  portada: los dos accesos
├── css/portada.css
├── .nojekyll                   obligatorio: sin él Pages ignora las carpetas con _
├── algebra/
│   ├── index.html              índice de la materia
│   ├── css/algebra.css         hoja propia, no compartida
│   ├── temas/01..09-*.html
│   └── assets/{pdf,wolfram,img}
└── blockchain/
    ├── index.html
    ├── css/blockchain.css      hoja propia, no compartida
    ├── temas/01..07-*.html
    └── assets/pdf
```

Cada materia tiene su propia hoja de estilos, sin CSS común ni variables
compartidas: son dos identidades visuales independientes que conviven en el
mismo repositorio.

## Las dos identidades

Las hojas de estilo no comparten nada, a propósito. Si se pudieran intercambiar,
el diseño habría fallado.

| | Álgebra | Blockchain |
|---|---|---|
| Voz | Source Serif 4, mono restringida a bits y código | JetBrains Mono como única familia |
| Papel | frío, con cast azul | gris neutro de máquina |
| Acento | azul `#2338c9` | ámbar `#8a4b0a`, más carmesí para lo roto |
| Estructura | la retícula: columnas visibles, contenido indexado por posición | la cadena: una línea que recorre el documento sin romperse |
| Separadores | trazos diagonales que se acortan al descender, σ₁ ≥ σ₂ ≥ … | ninguno: la continuidad es el punto |
| Índice de sección | número ordinal | los primeros 6 hex del SHA-256 del título |

Los identificadores hexadecimales de Blockchain se calculan en el generador y
son reales: `sha256("El adversario cuántico")` empieza por `24c2db`. Si se
cambia un título hay que recalcular el suyo.

## Laboratorio Blockchain 0.0

**En <https://alanpr27.github.io/Portafolio/lab/>.** Tercera sección, de
naturaleza distinta a las otras dos: no es un apunte que se lee sino un
laboratorio que se opera. Cinco módulos encadenados, cada uno con explicación,
banco de trabajo en vivo, ejercicio que la página verifica sola y una nota de
qué se simplificó.

| Módulo | Qué se opera | Ejercicio |
|---|---|---|
| 01 Función hash | SHA-256 tecla a tecla, avalancha medida en 256 bits | prueba de trabajo en miniatura |
| 02 Firma digital | dos pares ECDSA P-256, firma y verificación con diagnóstico | identificar al firmante |
| 03 Sellado de tiempo | recibos encadenados, sello retroactivo, publicación del hash | encontrar el primer recibo inconsistente |
| 04 Blockchain 0.0 | cadena editable con prueba de trabajo y cascada de invalidación | predecir la cascada |
| 05 Transacción | custodia de lotes con tres actores que firman, trazabilidad | los tres ataques, uno por botón |

```
lab/
├── index.html
├── css/lab.css            tercera identidad visual, no comparte nada
├── js/
│   ├── crypto-utils.js    Web Crypto: SHA-256, ECDSA, JSON canónico, búsqueda de nonce
│   ├── cadena.js          Bloque y Cadena, usados por los módulos 4 y 5
│   ├── sellos.js          recibos encadenados del módulo 3
│   ├── suministro.js      revisión, bloques, trazabilidad y ataques del módulo 5
│   ├── ui.js              interfaz común: estados, digests, juntas, copiado
│   └── hash.js, firma.js, timestamp.js, bloques.js, transaccion.js
└── modulos/01..05-*.html
```

Aquí sí hay JavaScript: módulos ES sin transpilar y **Web Crypto** nativa del
navegador, sin una sola librería de terceros. `crypto.subtle` sólo existe en
contexto seguro, así que el laboratorio no funciona abierto con doble clic; cada
página muestra un aviso visible por defecto que se oculta sólo cuando la
comprobación pasa. Los archivos de lógica (`crypto-utils.js`, `cadena.js`,
`sellos.js`, `suministro.js`) no tocan el DOM y se pueden ejercitar con Node.

Nada se persiste: recargar reinicia cadenas y llaves, y las privadas no se
escriben en ningún lado.

## Stack

HTML5 semántico y CSS3, sin framework, sin bundler, sin paso de compilación.
Las dos únicas dependencias externas son tipografías de Google Fonts y
**KaTeX 0.16.9 por CDN**, este último sólo en Álgebra, donde las fórmulas lo
justifican. Hay un único `<script>` en los apuntes: cierra el menú del temario
con Escape o al pulsar fuera. El laboratorio es la excepción, descrita arriba.

**Todas las rutas son relativas.** El sitio vive en la subcarpeta `/Portafolio/`,
así que una ruta absoluta como `/css/algebra.css` resolvería a la raíz del
dominio y daría 404. Antes de cada commit:

```bash
grep -rn 'href="/\|src="/' --include=*.html .   # no debe devolver nada
```

## Prueba local

Abrir los archivos con `file://` no reproduce el comportamiento real. Hay que
levantar un servidor:

```bash
python -m http.server 8000
# abrir http://localhost:8000
```

## Publicación

En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.
El primer despliegue tarda alrededor de un minuto; cada push posterior
republica solo.

---

## Mapeo de archivos originales

Los nombres originales traían espacios, paréntesis, mayúsculas inconsistentes y
unicode mal codificado, que en una URL se convierten en `%20`, `%28` y basura
ilegible. Los nuevos son ASCII puro, minúsculas y `kebab-case`, y describen el
contenido en lugar de repetir el nombre con el que venía el archivo.

Los prefijos numéricos se usan en los HTML de tema de ambas materias —los dos
cursos tienen un orden real— y en ningún archivo de `assets/`, para que un PDF
no quede atado a una posición del temario que puede moverse.

### Álgebra Lineal Avanzada

| Original | Nuevo | Carpeta |
|---|---|---|
| `campos_finitos.pdf` | `campos-finitos.pdf` | `assets/pdf/` |
| `Teorema Fundamental del Algebra Lineal.pdf` | `cuatro-subespacios-fundamentales.pdf` | `assets/pdf/` |
| `SVD.pdf` | `svd-motivacion-netflix.pdf` | `assets/pdf/` |
| `SVD_metodo_Linea.pdf` | `svd-metodo-general.pdf` | `assets/pdf/` |
| `svd-valores-singulares-enteros.pdf` | `svd-valores-singulares-enteros.pdf` | `assets/pdf/` |
| `svd-aplicaciones.pdf` | `svd-aplicaciones.pdf` | `assets/pdf/` |
| `Subespacios 4.nb` | `cuatro-subespacios.nb` | `assets/wolfram/` |
| `ValoresVectoresPropios (1).nb` | `valores-vectores-propios.nb` | `assets/wolfram/` |
| `QR Descomposition.nb` | `qr-gram-schmidt.nb` | `assets/wolfram/` |
| `Cholesky.nb` | `cholesky.nb` | `assets/wolfram/` |
| `SVD2.nb` | `svd-por-eigenvectores.nb` | `assets/wolfram/` |
| `USV2x2.nb` | `svd-caso-2x2.nb` | `assets/wolfram/` |
| `PseudoInversa.nb` | `pseudoinversa-moore-penrose.nb` | `assets/wolfram/` |
| `FotoSVD_propia_expandido.wl` | `compresion-imagen-svd-comentado.wl` | `assets/wolfram/` |
| `FotoSVDAlan_Placeres.wl` | `compresion-imagen-svd.wl` | `assets/wolfram/` |
| `mono_42.png` | `compresion-imagen-original.png` | `assets/img/` |
| `SVD.jpg` | `compresion-imagen-reconstrucciones.jpg` | `assets/img/` |

### Blockchain

| Original | Nuevo | Carpeta |
|---|---|---|
| `Funciones Hash · Laboratorio · Curso BlockChain.pdf` | `laboratorio-funciones-hash.pdf` | `assets/pdf/` |
| `hash_aplicaciones.pdf` | `hash-aplicaciones.pdf` | `assets/pdf/` |
| `tarea_hash_1.pdf` | `tarea-hash-artesanal.pdf` | `assets/pdf/` |
| `time_stamping.pdf` | `sellado-de-tiempo.pdf` | `assets/pdf/` |
| `compromisos.pdf` | `esquemas-de-compromiso.pdf` | `assets/pdf/` |
| `blockchain_artesanal.pdf` | `blockchain-artesanal.pdf` | `assets/pdf/` |
| `blockchain-aplicaciones.pdf` | `blockchain-aplicaciones.pdf` | `assets/pdf/` |

Los tres últimos conservan su nombre porque ya cumplían el criterio; aparecen
en la tabla para que el mapeo quede completo.

### Notas sobre el material de origen

Tres cosas que no coinciden con lo que sugieren los nombres de archivo:

- **`SVD.jpg` no es un insumo del ejercicio de compresión**: es una captura de
  pantalla del cuaderno con las reconstrucciones a distintos rangos. El insumo
  real es sólo `mono_42.png`.
- **Los dos `.wl` son el mismo código.** `FotoSVD_propia_expandido.wl` es
  idéntico a `FotoSVDAlan_Placeres.wl` salvo por cinco encabezados de comentario.
  Se publican los dos; el comentado es el que se usa en la página.
- **`Funciones Hash · Laboratorio · Curso BlockChain.pdf` es un laboratorio
  interactivo completo**, no un documento corto: ocho semanas o módulos, una
  síntesis transversal, ocho retos y un anexo sobre el estado del arte. Es la
  fuente principal de la materia de Blockchain.
