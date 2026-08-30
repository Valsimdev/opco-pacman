# SPEC 03 — Power Pellets y modo asustado: Pac-Man caza fantasmas

> **Estado:** Approved
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-29
> **Objetivo:** Añadir 4 Power Pellets en las esquinas del laberinto que, al ser comidos, asustan a los fantasmas (huyen más lento) y permiten a Pac-Man comerlos por puntos crecientes.

## Scope

**In:**

- Añadir un nuevo tile **4 = Power Pellet** en `src/js/maze.js` con char `'o'` en `parseTile`, colocando 4 pellets en las esquinas clásicas `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` (reemplazando el dot existente).
- Contar los Power Pellets en `dotsRemaining` (junto a los dots) y decrementar al comerlos, de modo que la victoria requiera comer también los 4 pellets.
- Comer un Power Pellet otorga **50 puntos** e inicia el **modo asustado** durante **420 frames (~7 s)**.
- Modo asustado: los fantasmas **fuera del pen** (`inPen=false`) se vuelven `frightened`, cambian a velocidad **0.05** (mitad) y **huyen de Pac-Man** (selección voraz que **maximiza** la distancia Manhattan).
- Comer un fantasma asustado da **200, 400, 800, 1600** puntos sucesivos (combo por sesión), y el fantasma **teletransportado** a su celda del pen con `inPen=true` se **re-libera escalonadamente** (`releaseAt = frame + i*120`).
- Comer un segundo Power Pellet reinicia el temporizador a 420 y el combo a 200.
- Parpadeo azul/blanco en los **últimos 120 frames** del modo como aviso visual.
- Render: Power Pellet como círculo grande; fantasma asustado con cuerpo azul y cara asustada (ojos pequeños + boca ondulada blanca), parpadeando al final.
- Al perder una vida se cancela el modo asustado (`frightTimer=0`, `frightened=false`, velocidades restauradas).

**Out of scope (for future specs):**

- Animación de ojos volviendo al pen caminando (requeriría actor `'ghost-return'` que cruce la puerta de SPEC 02).
- Forzar reversa de dirección al iniciar el modo asustado (comportamiento clásico).
- Ciclo global scatter/chase con temporizador.
- Niveles/dificultad con duración variable del modo asustado.
- Power Pellets que reaparecen/resetean entre vidas.

## Data model

```js
// src/js/maze.js  —  parseTile gana 'o' → 4
function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === 'o' ) return 4; // power pellet
  return 0;
}
// MAZE_STR: sustituir '.' por 'o' en (1,3),(26,3),(1,23),(26,23).

// src/js/game.js  —  constantes nuevas
const POWER_PELLET = 4;
const FRIGHT_DURATION = 420;    // frames (~7 s a 60fps)
const FRIGHT_FLASH_FRAMES = 120; // últimos 120 frames → parpadeo
const FRIGHT_SPEED = 0.05;      // mitad de GHOST_SPEED
const POWER_PELLET_SCORE = 50;
const GHOST_EAT_SCORE = [ 200, 400, 800, 1600 ];

// Estado de partida (createGame) añade:
//   frightTimer: 0,    // frames restantes del modo asustado
//   frightCombo: 0     // índice en GHOST_EAT_SCORE; resetea al comer pellet

// Cada ghost añade:
//   g.frightened: false  // true solo si !inPen y frightTimer > 0
```

Convenciones:

- Tile 4 es transitable como dot (no es muro); Pac-Man y `ghost-out` lo pisan sin bloqueo.
- `frightTimer` es una cuenta regresiente: se decrementa cada frame en `update`; modo activo mientras `> 0`.
- `frightCombo` se reinicia a 0 al comer un Power Pellet y cuando `frightTimer` llega a 0.

## Implementation plan

1. **`maze.js` + `render.js` (data + dibujo del pellet):** añadir `'o'→4` en `parseTile`, sustituir los 4 `.` por `o` en las esquinas, y en `drawDots` dibujar el tile 4 como círculo grande (radio ~6, `DOT_COLOR`, leve pulso por `frame`). Manual: abrir `index.html`, se ven 4 pellets grandes en las esquinas, sin errores.
2. **`game.js` (comer pellet + victoria):** en `createGame`, contar tiles 2 **y 4** en `dotsRemaining`. En `movePacman`, al pisar tile 4 → `grid=0`, `score+=50`, `dotsRemaining--`. Manual: comer un pellet lo elimina y suma 50; comer todo permite ganar.
3. **`game.js` + `render.js` (estado asustado + visual):** añadir `frightTimer`/`frightCombo` al juego y `g.frightened` a cada ghost. Al comer pellet: `frightTimer=420`, `frightCombo=0`, `frightened=true` y `speed=0.05` en los ghosts con `inPen===false`. En `update`: decrementar `frightTimer`; al llegar a 0, `frightened=false` y `speed=GHOST_SPEED`. En `drawGhost`: si `frightened`, cuerpo azul + cara asustada; si `frightTimer<=120`, alternar azul/blanco. Manual: comer pellet → fantasmas azules con cara asustada, parpadean los últimos ~2 s y vuelven a la normalidad a los ~7 s.
4. **`game.js` (comportamiento huida):** en `decideGhost`, si `g.frightened`, elegir dirección que **maximice** la distancia Manhattan a Pac-Man (greedy invertido, mismo `choices`/`ghost-out`). Manual: los fantasmas azules huyen de Pac-Man.
5. **`game.js` (comer fantasma + combo + teletransporte):** en el bucle de colisión de `update`, si `collides && g.frightened` → `score += GHOST_EAT_SCORE[frightCombo]`, `frightCombo = min(frightCombo+1, 3)`, teletransportar el ghost a `GHOST_STARTS[i]` con `inPen=true`, `dir='up'`, `releaseAt = game.frame + i*120`, `bobDir=1`, `corner=0`, `frightened=false`, `speed=GHOST_SPEED`. Manual: comer fantasmas da 200/400/800/1600; reaparecen en el pen y se re-liberen escalonadamente.
6. **`game.js` (edges):** segundo pellet → `frightTimer=420` y `frightCombo=0`. En `resetPositions`: `frightTimer=0`, todos `frightened=false`, `speed=GHOST_SPEED`. Cuando un ghost salga del pen durante fright (`inPen` pasa a `false`) y `frightTimer>0`, poner `frightened=true` y `speed=0.05`. Manual: 2º pellet resetea; perder vida cancela el modo; un ghost liberado a media sesión se asusta.

## Acceptance criteria

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] Se ven 4 Power Pellets grandes en las esquinas `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` al iniciar.
- [ ] Comer un Power Pellet da 50 puntos y lo elimina del tablero.
- [ ] Al comer un Power Pellet, los fantasmas fuera del pen se vuelven azules con cara asustada y se mueven a 0.05 celdas/frame.
- [ ] Los fantasmas asustados huyen de Pac-Man (aumentan la distancia Manhattan en cada decisión).
- [ ] En los últimos ~120 frames del modo, los fantasmas parpadean azul/blanco.
- [ ] El modo asustado dura ~420 frames; al terminar los fantasmas recuperan color, comportamiento y velocidad normales.
- [ ] Comer fantasmas asustados da 200, 400, 800 y 1600 puntos sucesivos en la misma sesión.
- [ ] Comer un segundo Power Pellet reinicia el temporizador a 420 y el combo a 200.
- [ ] Un fantasma comido desaparece del mapa y reaparece en su celda del pen, re-liberándose escalonadamente.
- [ ] Los fantasmas dentro del pen (esperando o recién comidos) NO se asustan ni pueden ser comidos.
- [ ] Comer los 4 Power Pellets (además de los dots) es necesario para ganar; `dotsRemaining` los cuenta.
- [ ] Perder una vida durante el modo asustado lo cancela (`frightTimer=0`, fantasmas vuelven a la normalidad).
- [ ] `MAZE` (pristino) no se muta; los resets restauran el nivel incluidos los power pellets.

## Decisions

- **Yes:** Tile 4 con char `'o'` para Power Pellets. Mantiene intactos los tiles 0/1/2/3 existentes.
- **Yes:** 4 esquinas clásicas `(1,3),(26,3),(1,23),(26,23)`. Fiel al nivel 1 y ya son celdas transitables con dot.
- **Yes:** Duración 420 frames (~7 s) y velocidad asustada 0.05. Equilibrio clásico/jugable; permite alcanzarlos con Pac-Man (0.125).
- **Yes:** Comportamiento de huida (greedy invertido). Reutiliza `greedyDir` y se lee claramente como "huyen".
- **Yes:** Puntuación clásica 200/400/800/1600 con combo que resetea al comer un nuevo pellet.
- **Yes:** Teletransporte al pen + re-liberación escalonada. Evita la animación de ojos **y no requiere tocar la puerta unidireccional de SPEC 02** (no se añade `'ghost-return'`).
- **Yes:** Parpadeo en los últimos 120 frames como aviso visual.
- **Yes:** Los pellets cuentan para `dotsRemaining`/victoria. Coherente con "comer todo".
- **Yes:** Segundo pellet resetea timer a 420 y combo a 0. Consistente con el clásico.
- **No:** Animación de ojos volviendo al pen. Va en otro spec; el teletransporte es suficiente y no rompe SPEC 02.
- **No:** Forzar reversa de dirección al iniciar el modo. Comportamiento clásico omitido por simplicidad; fuera de alcance.
- **No:** Asustar a los fantasmas del pen. Solo los de fuera pueden ser comidos (Pac-Man no puede entrar al pen).

## Risks

| Risk | Mitigation |
|------|------------|
| Comerse al fantasma naranja (i=3) lo deja esperando ~6 s (360 frames) para re-salir | Aceptado por coherencia con SPEC 01; si se quiere más rápido, un retardo fijo corto va en otro spec. |
| Fantasmas huyendo greedy pueden acorralarse en callejones | El fallback de giro 180° existente en `decideGhost` cubre el caso sin salida. |
| El combo podría quedar "colgado" al terminar el modo sin comer un nuevo pellet | Se resetea también a 0 cuando `frightTimer` llega a 0 (defensivo). |

## What is **not** in this spec

- Animación de ojos volviendo al pen (otro spec; ahí sí se reentraría por la puerta).
- Forzar reversa de dirección al entrar en modo asustado.
- Ciclo global scatter/chase.
- Niveles/dificultad con duración variable del modo asustado.
- Power Pellets que reaparecen entre vidas.

Cada uno de esos, si llega, va en su propio spec.
