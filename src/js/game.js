// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

const POWER_PELLET = 4;
const FRIGHT_DURATION = 420;     // frames (~7 s a 60fps)
const FRIGHT_FLASH_FRAMES = 120; // ultimos 120 frames -> parpadeo
const FRIGHT_SPEED = 0.05;       // mitad de GHOST_SPEED
const POWER_PELLET_SCORE = 50;
const GHOST_EAT_SCORE = [ 200, 400, 800, 1600 ];

// Esquinas para 'patrol' (horario): TL, TR, BR, BL
const CORNERS = [
  { x: 1, y: 1 }, { x: 26, y: 1 }, { x: 26, y: 29 }, { x: 1, y: 29 },
];

// Celda de salida del pen (arriba de la puerta)
const PEN_EXIT = { x: 13, y: 11 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    frame: 0,
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frightTimer: 0,    // frames restantes del modo asustado
    frightCombo: 0,    // indice en GHOST_EAT_SCORE; resetea al comer pellet
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseAt: i * 120,  // frame en que se libera (0,120,240,360)
      inPen: true,         // true mientras este dentro del pen
      bobDir: 1,           // +1/-1 para el rebote vertical mientras espera
      corner: 0,           // indice de esquina actual (solo 'patrol')
      frightened: false,   // true solo si !inPen y frightTimer > 0
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman:     bloqueado por pared (1) y puerta (3)
//   ghost:      bloqueado solo por pared (1)  (puerta transitable — solo durante salida)
//   ghost-out:  bloqueado por pared (1) y puerta (3)  (fantasma ya libre, no re-entra)
//
// Documentacion de actores (cabecera de game.js):
//   salida (inPen=true)  → usar 'ghost'      (la puerta es transitable)
//   fuera   (inPen=false) → usar 'ghost-out'  (la puerta bloquea el regreso)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor !== 'ghost' ) return true;  // puerta bloquea a todos salvo al fantasma en salida
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer Power Pellet.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += POWER_PELLET_SCORE;
      game.dotsRemaining--;
      game.frightTimer = FRIGHT_DURATION;
      game.frightCombo = 0;
      game.ghosts.forEach( ( g ) => {
        if ( !g.inPen ) {
          g.frightened = true;
          g.speed = FRIGHT_SPEED;
        }
      } );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Seleccion voraz por distancia Manhattan hacia un objetivo (tx,ty).
function greedyDir( g, choices, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost-out' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Modo asustado: huyen de Pac-Man (greedy invertido: maximiza distancia Manhattan).
  if ( g.frightened ) {
    const px = Math.round( p.x );
    const py = Math.round( p.y );
    let best = choices[ 0 ];
    let bestDist = -Infinity;
    for ( const dir of choices ) {
      const d = DIRS[ dir ];
      const nx = g.x + d.x;
      const ny = g.y + d.y;
      const dist = Math.abs( nx - px ) + Math.abs( ny - py );
      if ( dist > bestDist ) {
        bestDist = dist;
        best = dir;
      }
    }
    g.dir = best;
    return;
  }

  if ( g.kind === 'hunter' ) {
    // Persigue agresivamente la celda exacta de Pac-Man.
    const px = Math.round( p.x );
    const py = Math.round( p.y );
    g.dir = greedyDir( g, choices, px, py );
  } else if ( g.kind === 'ambush' ) {
    // Apunta a la celda 4 posiciones adelante de Pac-Man segun su dir.
    const pd = DIRS[ p.dir ];
    const tx = Math.round( p.x ) + 4 * pd.x;
    const ty = Math.round( p.y ) + 4 * pd.y;
    g.dir = greedyDir( g, choices, tx, ty );
  } else if ( g.kind === 'patrol' ) {
    // Cicla las 4 esquinas en sentido horario.
    let tx = CORNERS[ g.corner ].x;
    let ty = CORNERS[ g.corner ].y;
    // Cerca de la esquina actual: avanzar a la siguiente.
    if ( Math.abs( g.x - tx ) + Math.abs( g.y - ty ) <= 1 ) {
      g.corner = ( g.corner + 1 ) % 4;
      tx = CORNERS[ g.corner ].x;
      ty = CORNERS[ g.corner ].y;
    }
    g.dir = greedyDir( g, choices, tx, ty );
  } else {
    // random: elige direccion aleatoria entre las validas.
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // --- Rutina del pen (antes de decideGhost) ---
  // Espera: rebote vertical entre y=13 y y=15 dentro del pen.
  if ( game.frame < g.releaseAt ) {
    if ( aligned( g.x ) && aligned( g.y ) ) {
      g.y = Math.round( g.y );
      if ( g.y >= 15 ) g.bobDir = -1;
      else if ( g.y <= 13 ) g.bobDir = 1;
    }
    g.y += g.bobDir * g.speed;
    return;
  }

  // Salida: decision voraz hacia PEN_EXIT.
  if ( g.inPen ) {
    if ( aligned( g.x ) && aligned( g.y ) ) {
      g.x = Math.round( g.x );
      g.y = Math.round( g.y );
      const options = Object.keys( DIRS ).filter(
        ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
      );
      const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];
      let best = choices[ 0 ];
      let bestDist = Infinity;
      for ( const dir of choices ) {
        const d = DIRS[ dir ];
        const nx = g.x + d.x;
        const ny = g.y + d.y;
        const dist = Math.abs( nx - PEN_EXIT.x ) + Math.abs( ny - PEN_EXIT.y );
        if ( dist < bestDist ) {
          bestDist = dist;
          best = dir;
        }
      }
      g.dir = best;
      if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
    }
    const d = DIRS[ g.dir ];
    g.x += d.x * g.speed;
    g.y += d.y * g.speed;
    if ( Math.round( g.y ) <= 11 ) g.inPen = false;
    return;
  }

  // --- Fuera del pen: decideGhost normal ---
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost-out' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.inPen = true;
    g.releaseAt = game.resetFrame + i * 120;
    g.bobDir = 1;
    g.corner = 0;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  // Modo asustado: decrementar temporizador y restaurar al expirar.
  if ( game.frightTimer > 0 ) {
    game.frightTimer--;
    if ( game.frightTimer <= 0 ) {
      game.frightTimer = 0;
      game.frightCombo = 0;
      game.ghosts.forEach( ( g ) => {
        g.frightened = false;
        g.speed = GHOST_SPEED;
      } );
    }
  }

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      game.resetFrame = game.frame;
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';

  game.frame++;
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
