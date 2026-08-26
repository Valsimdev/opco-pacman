# AGENTS.md

PacMan-like arcade game in Vanilla JS + HTML + Canvas. No build step, no bundler, no package manager, no tests. The repo is also a learning vehicle for **Spec Driven Development** (`.agents/skills/spec`, `spec-impl`).

## Running

Open `src/index.html` directly in a browser. Scripts are plain `<script>` tags (not ES modules), so `file://` works — no dev server required. For live reload during edits, any static server over `src/` is fine.

## Architecture

`src/index.html` loads four scripts in a **fixed order**; the order is load-bearing (no module system):

1. `maze.js` — maze grid + constants (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`). Exposes them on `window`.
2. `game.js` — state & rules (`createGame`, `update`, `DIRS`). Consumes maze globals; exposes its API on `window`.
3. `render.js` — canvas drawing (`draw`, `GHOST_COLORS`). Consumes `DIRS` from game.
4. `main.js` — requestAnimationFrame loop, keyboard, overlay screens. Calls `createGame`/`update`/`draw` as globals.

### Globals contract
Each file attaches its public API to `window` and reads dependencies as globals from previously-loaded files. Do **not** introduce `import`/`export` or change the load order in `index.html` — both break the app. Each file's header comment documents its global dependencies; follow that pattern when adding files.

### Maze immutability
`MAZE` in `maze.js` is the pristine level definition. `createGame()` copies it into `game.grid`; dot-eating and resets mutate `game.grid`, never `MAZE`. Preserve this or resets corrupt the level.

## Conventions

- UI strings and code comments are in **Spanish**; keep new user-facing text and comments in Spanish.
- Code style: single quotes, spaces inside parens (`function ( x )`), 2-space indent, semicolons. Match surrounding style; don't reformat unrelated lines.
- Movement uses fractional cell coords with `aligned()` snapping; speeds are fractions of a cell per frame (`PACMAN_SPEED = 0.125`, `GHOST_SPEED = 0.1`). Tunnels wrap on row 14.

## Workflow (spec-driven)

New features are specced before coding. Use the `spec` skill to author a spec, then `spec-impl` to implement an approved spec (it creates a branch named after the spec and steps through it with review pauses).
