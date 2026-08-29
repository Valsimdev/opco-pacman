# SPEC 01 — Cuatro fantasmas con comportamientos distintos

> **Estado:** Approved
> **Depende de:** Ninguna
> **Fecha:** 2026-08-29
> **Objetivo:** Ampliar el juego a 4 fantasmas, cada uno con su propio comportamiento de actualización y liberación escalonada desde el pen, donde uno persigue agresivamente a Pac-Man.

## Scope

**In:**

- Ampliar `GHOST_STARTS` (`src/js/maze.js`) de 2 a 4 fantasmas con kinds distintos: `hunter`, `random`, `ambush`, `patrol`.
- Implementar 4 comportamientos distintos en `decideGhost` (`src/js/game.js`):
  - `hunter`: persigue agresivamente la celda exacta de Pac-Man (selección voraz por distancia Manhattan). Ya existe; se conserva.
  - `random`: elige dirección aleatoria entre las válidas. Ya existe; se conserva.
  - `ambush`: apunta a la celda 4 posiciones adelante de Pac-Man según su dirección actual.
  - `patrol`: cicla las 4 esquinas del laberinto en sentido horario y se mueve vorazmente hacia la esquina objetivo actual.
- Liberación escalonada desde el pen: los fantasmas salen uno a uno en los frames 0, 120, 240 y 360.
  - Mientras esperan su turno, el fantasma rebota verticalmente 1 celda dentro del pen (entre filas 13 y 15).
  - Al liberarse, sale vorazmente hacia la celda de salida `(13,11)` (arriba de la puerta); al alcanzar `Math.round(g.y) <= 11`, cambia a su comportamiento propio.
- Al perder una vida, `resetPositions()` devuelve los 4 fantasmas al pen y reinicia el temporizador de liberación (0, 120, 240, 360 desde el frame del reset).
- Mapeo fijo color ↔ kind usando los 4 colores ya existentes en `GHOST_COLORS` (`src/js/render.js`): rojo=`hunter`, cian=`random`, rosa=`ambush`, naranja=`patrol`.

**Out of scope (for future specs):**

- Power pellets, modo asustado (fantasmas azules) y comer fantasmas.
- Ciclo global scatter/chase con temporizador.
- Velocidad distinta por fantasma (todos van a 0.1).
- Animación de ojos volviendo al pen al ser comidos (requiere modo asustado).
- Selección de nivel / dificultad.

## Data model

```js
// src/js/maze.js  —  GHOST_STARTS pasa de 2 a 4 entradas
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter'  }, // rojo    — lib. frame 0
  { x: 14, y: 14, kind: 'random'  }, // cian    — lib. frame 120
  { x: 12, y: 14, kind: 'ambush'  }, // rosa    — lib. frame 240
  { x: 15, y: 14, kind: 'patrol'  }, // naranja — lib. frame 360
];

// src/js/game.js  —  cada ghost gana estado de liberación
const ghost = {
  x, y, dir: 'up', speed: 0.1, kind,
  releaseAt: number,  // frame en que se libera (0,120,240,360)
  inPen: true,         // true mientras esté dentro del pen
  bobDir: 1,           // +1/-1 para el rebote vertical mientras espera
  corner: 0,           // índice de esquina actual (solo 'patrol')
};

// Esquinas para 'patrol' (horario): TL, TR, BR, BL
const CORNERS = [
  { x: 1, y: 1 }, { x: 26, y: 1 }, { x: 26, y: 29 }, { x: 1, y: 29 },
];

// Celda de salida del pen (arriba de la puerta)
const PEN_EXIT = { x: 13, y: 11 };
```

Convenciones:

- Coordenadas: celda (x,y), origen arriba-izquierda (igual que el repo).
- Velocidades en celdas/frame: `GHOST_SPEED = 0.1` para los 4 (sin cambios).
- `inPen` se pone `false` cuando `Math.round(g.y) <= 11`.

## Implementation plan

1. **`maze.js`**: ampliar `GHOST_STARTS` a las 4 entradas de arriba. Manual: abrir `index.html`, sin errores en consola (aún se ven 2 comportamientos porque `game.js` no usa los nuevos kinds).
2. **`game.js`**: añadir constantes `CORNERS` y `PEN_EXIT`. En `createGame`, construir cada ghost con `releaseAt: i * 120`, `inPen: true`, `bobDir: 1`, `corner: 0`. Manual: recargar; los 4 fantasmas aparecen en el pen con sus colores, sin salir aún.
3. **`game.js`**: rutina de pen (espera + salida) en `moveGhost`, antes de `decideGhost`:
   - `frame < g.releaseAt` → rebote vertical entre y=13 y y=15 (sin salir).
   - `frame >= g.releaseAt && g.inPen` → decisión voraz hacia `PEN_EXIT`; al alcanzar `Math.round(g.y) <= 11`, `g.inPen = false`.
   - `!g.inPen` → `decideGhost` normal.
   Manual: los fantasmas salen uno a uno cada ~2 s por la puerta.
4. **`game.js`**: ampliar `decideGhost` con los 4 kinds. `hunter` y `random` ya existen (conservar). Añadir `ambush` (objetivo = `pacman` + 4·`DIRS[pacman.dir]`) y `patrol` (objetivo = `CORNERS[g.corner]`; al estar a ≤1 celda, `g.corner = (g.corner + 1) % 4`). Ambos usan selección voraz por Manhattan como `hunter`. Manual: rojo persigue, rosa corta el paso, naranja recorre esquinas, cian deambula.
5. **`game.js`**: actualizar `resetPositions` para reiniciar `inPen=true`, `releaseAt = game.resetFrame + i*120`, `bobDir=1`, `corner=0` y devolver cada ghost a `GHOST_STARTS[i]`. Registrar `game.resetFrame = frameActual` al perder la vida. Manual: perder una vida devuelve los 4 al pen y vuelven a salir escalonados.
6. **`render.js`**: sin cambios funcionales. Verificar que el orden de `GHOST_STARTS` hace que `GHOST_COLORS[i]` ya alinee color↔kind. Opcional: mapear por `kind` en `draw` para robustez.

## Acceptance criteria

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] Se ven 4 fantasmas al iniciar, en colores rojo, cian, rosa y naranja.
- [ ] Los 4 empiezan dentro del pen y salen uno a uno cada ~120 frames (~2 s), en orden rojo, cian, rosa, naranja.
- [ ] Mientras un fantasma espera su turno, rebota verticalmente dentro del pen.
- [ ] El rojo (`hunter`) persigue agresivamente la celda de Pac-Man, reduciendo la distancia Manhattan en cada decisión.
- [ ] El rosa (`ambush`) se dirige hacia la celda 4 posiciones adelante de Pac-Man según su dirección actual.
- [ ] El naranja (`patrol`) recorre las 4 esquinas del laberinto en sentido horario, cambiando de esquina al acercarse a la actual.
- [ ] El cian (`random`) cambia de dirección aleatoriamente entre las opciones válidas.
- [ ] Los 4 fantasmas se mueven a la misma velocidad (0.1 celdas/frame).
- [ ] Al perder una vida, los 4 vuelven al pen y se re-liberan escalonadamente (0,120,240,360 desde el reset).
- [ ] `MAZE` (pristino) no se muta; los resets restauran el nivel correctamente.

## Decisions

- **Yes:** Conjunto "simple personalizado" (hunter/random/ambush/patrol) en vez del clásico Blinky/Pinky/Inky/Clyde. Más fácil de leer y mantener; elegido por el usuario.
- **Yes:** Liberación escalonada cada 120 frames (0,120,240,360). Da respiro y deja observar cada comportamiento.
- **Yes:** Misma velocidad (0.1) para los 4. La agresividad del cazador viene del comportamiento, no de la velocidad.
- **Yes:** Rebote vertical mientras esperan en el pen. Se ve vivo sin complicar la lógica de salida.
- **Yes:** `patrol` cicla las 4 esquinas en horario. Predecible y claramente distinto a perseguir.
- **Yes:** Al perder una vida, los fantasmas vuelven al pen y se re-liberan. Justo y consistente con el inicio.
- **Yes:** Mapeo fijo color↔kind por orden de `GHOST_STARTS` (rojo=hunter, cian=random, rosa=ambush, naranja=patrol). Aprovecha los 4 colores ya en `render.js`.
- **No:** Power pellets / modo asustado / comer fantasmas. Va en otro spec; confirmado fuera de alcance.
- **No:** Ciclo global scatter/chase. Va en otro spec.
- **No:** Fantasma cazador más rápido. La agresividad es por comportamiento, no por velocidad.

## Risks

| Risk | Mitigation |
|------|------------|
| La salida voraz hacia `PEN_EXIT` podría apuntar a un muro | `PEN_EXIT=(13,11)` es transitable (tile 2); la decisión voraz solo elige entre `canMove` válidas, nunca hacia un muro. |
| 4 fantasmas persiguiendo desde el frame 1 harían el juego injugable | La liberación escalonada regula la presión; el cazador sale primero y los demás se suman de a uno. |
| `releaseAt` absoluto vs frame actual al resetear | Guardar `game.resetFrame` y calcular `releaseAt = game.resetFrame + i*120` para que el escalado sea relativo al reset. |
| `ambush` con `pacman.dir` apuntando a un muro da un objetivo dentro de una pared | El objetivo es solo referencia para la métrica Manhattan; la decisión real se toma entre `canMove` válidas, así que un objetivo "inválido" no rompe el movimiento. |

## What is **not** in this spec

- Power pellets, modo asustado y comer fantasmas (otro spec).
- Ciclo global scatter/chase (otro spec).
- Velocidades distintas por fantasma.
- Animación de ojos regresando al pen.
- Selección de nivel o dificultad.

Cada uno de esos, si llega, va en su propio spec.
