# SPEC 02 — Salida del pen de fantasmas sin re-entrada

> **Estado:** Approved
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-29
> **Objetivo:** Corregir la salida de los fantasmas del pen para que, una vez liberados, no puedan volver a entrar por la puerta y queden atrapados dando vueltas dentro del pen.

## Scope

**In:**

- Hacer la puerta del pen (tile 3) **unidireccional** para fantasmas: transitable solo durante la rutina de salida (`inPen=true`), bloqueada una vez fuera (`inPen=false`).
- Cambiar `isWall` (`src/js/game.js`) para que la puerta bloquee a todo actor excepto `'ghost'` (el fantasma en salida).
- Cambiar las llamadas a `canMove` en `decideGhost` y en el movimiento normal (fuera del pen) de `'ghost'` a `'ghost-out'`, para que el fantasma ya liberado no pueda atravesar la puerta de regreso.
- Mantener la rutina de salida (`inPen=true`) con `'ghost'` (puerta transitable), sin cambios.

**Out of scope (for future specs):**

- Modo asustado, power pellets y comer fantasmas (requiere que los fantasmas vuelvan al pen al ser comidos; va en otro spec).
- Animación de ojos volviendo al pen.
- Cambiar el ritmo de liberación escalonada (se mantiene 0, 120, 240, 360 de SPEC 01).
- Reescribir la rutina greedy de salida (es correcta; el bug está en la re-entrada, no en la salida).

## Data model

```js
// src/js/game.js  —  isWall gana un nuevo valor de actor
//
// Antes:
//   actor === 'pacman' → bloquea pared(1) y puerta(3)
//   actor === 'ghost'  → bloquea solo pared(1)  (puerta siempre transitable)
//
// Después:
//   actor === 'pacman'     → bloquea pared(1) y puerta(3)
//   actor === 'ghost'      → bloquea solo pared(1)  (puerta transitable — solo durante salida)
//   actor === 'ghost-out'  → bloquea pared(1) y puerta(3)  (fantasma ya libre, no re-entra)

function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor !== 'ghost' ) return true;  // puerta bloquea a todos salvo al fantasma en salida
  return false;
}
```

No se añaden campos nuevos al estado del fantasma. Se reutiliza `inPen` de SPEC 01 para distinguir `'ghost'` (en salida) de `'ghost-out'` (fuera).

## Implementation plan

1. **`game.js` — `isWall`**: cambiar la condición de la puerta de `actor === 'pacman'` a `actor !== 'ghost'`. Manual: abrir `index.html`; sin errores en consola. Los fantasmas siguen saliendo (la rutina de salida usa `'ghost'`).
2. **`game.js` — `decideGhost`**: cambiar el `canMove( grid, g.x, g.y, dir, 'ghost' )` a `'ghost-out'`. Manual: los fantasmas que ya salieron no bajan por la puerta; navegan el laberinto rodeando el pen.
3. **`game.js` — movimiento normal (fuera del pen)**: cambiar el `canMove( grid, g.x, g.y, g.dir, 'ghost' )` final a `'ghost-out'`. Manual: ningún fantasma libre re-entra al pen; los 4 se quedan en el mapa tras salir.

## Acceptance criteria

- [ ] Al abrir `src/index.html` no hay errores en la consola.
- [ ] Los 4 fantasmas salen del pen escalonadamente (0, 120, 240, 360 frames) como en SPEC 01.
- [ ] Una vez fuera, ningún fantasma vuelve a entrar al pen por la puerta.
- [ ] Ningún fantasma queda atrapado dando vueltas dentro del pen tras varias partidas y varias vidas perdidas.
- [ ] La rutina de salida (`inPen=true`) sigue atravesando la puerta correctamente (salida por `(13,11)`).
- [ ] `MAZE` (pristino) no se muta.

## Decisions

- **Yes:** Puerta unidireccional para fantasmas (transitable solo en salida). Es el cambio mínimo que elimina la re-entrada, causa raíz del atrapamiento.
- **Yes:** Reutilizar `inPen` para distinguir `'ghost'` de `'ghost-out'` en lugar de añadir un campo nuevo. `inPen` ya separa exactamente los dos estados.
- **Yes:** Mantener la rutina greedy de salida sin cambios. El análisis confirma que es correcta y determinista; el bug está después de salir, no durante.
- **No:** Reescribir la salida con un camino fijo. No hace falta; la salida greedy ya funciona.
- **No:** Añadir lógica defensiva de re-expulsión si un fantasma queda dentro con `inPen=false`. Tras el fix no debería ocurrir; si se quiere, va como refuerzo en otro spec.

## Risks

| Risk | Mitigation |
|------|------------|
| Un fantasma liberado necesita cruzar por encima del pen y la puerta bloqueada lo obliga a rodear | Es el comportamiento deseado (igual que el Pac-Man original tras salir); el laberinto tiene rutas alternativas. |
| Si en el futuro se añade "ojos volviendo al pen" (ser comido), la puerta unidireccional bloquearía el regreso | Esa feature requerirá su propio spec y ajustará el actor en ese caso (p.ej. `'ghost-return'` que sí atraviese la puerta). |
| Confusión entre `'ghost'` y `'ghost-out'` al añadir código nuevo | Documentar en la cabecera de `game.js` qué actor usar en cada rama: salida → `'ghost'`, fuera → `'ghost-out'`. |

## What is **not** in this spec

- Modo asustado, power pellets y comer fantasmas (otro spec).
- Animación de ojos regresando al pen (otro spec; ahí sí se necesitará re-entrar).
- Cambiar el ritmo de liberación escalonada.
- Reescribir la rutina greedy de salida.

Cada uno de esos, si llega, va en su propio spec.
