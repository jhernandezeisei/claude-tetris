# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

## Proyecto

Tetris en JavaScript vanilla + HTML5 Canvas. Sin dependencias, sin `package.json`, sin build, sin linter, sin tests. El README (en español) documenta la jugabilidad y los controles; los textos de la interfaz en el código también están en español.

## Ejecución

Abre `index.html` directamente, o sirve la carpeta de forma estática (p. ej. `python -m http.server 8000`, `npx serve .`) y visita `http://localhost:8000`.

## Arquitectura

Toda la lógica vive en `game.js`, cargado como script clásico (no como módulo) desde `index.html`. El estado se guarda en variables globales `let` de nivel superior (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...) que se reinician en `init()`, la cual también es el manejador del botón de reinicio.

- El tablero es una matriz `ROWS × COLS` de `0` o un índice de color/pieza del 1 al 7; `COLORS` y `PIECES` se indexan con ese mismo número (el índice 0 es `null`), así que para añadir una pieza hay que ampliar ambos arrays y el `Math.random() * 7` de `randomPiece`.
- Flujo del juego: `loop` (requestAnimationFrame) acumula el tiempo y baja la pieza una vez por `dropInterval`; llama a `draw()` en cada frame. El bloqueo sigue la cadena `lockPiece` → `merge` → `clearLines` → `spawn`; `spawn` llama a `endGame()` si la nueva pieza colisiona.
- `clearLines` se encarga de actualizar puntuación, nivel y velocidad (`dropInterval = max(100, 1000 - (level-1)*90)`). El soft drop y el hard drop suman sus propios puntos.
- La pausa y el game over cancelan el frame de animación y reutilizan el mismo elemento `#overlay`; `togglePause` reinicia `loop` manualmente.
- La rotación (`rotateCW` + `tryRotate`) es una rotación matricial simple en sentido horario con kicks solo horizontales `[0, -1, 1, -2, 2]`.

## Detalles a tener en cuenta

- El tamaño en píxeles de los canvas está fijado en `index.html` (`#board` 300×600, `#next-canvas` 120×120). Si cambias `COLS`, `ROWS` o `BLOCK` en `game.js`, actualiza `width`/`height` del canvas a `COLS*BLOCK` × `ROWS*BLOCK`.
- `drawNext` usa su propio tamaño de bloque fijo (30) y una cuadrícula de 4×4 para centrar la pieza.
- El manejador de `keydown` usa `e.code` (teclas físicas) y llama a `updateHUD()` después de cada tecla procesada.
