# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

## Proyecto

Tetris en JavaScript vanilla + HTML5 Canvas. Sin dependencias, sin `package.json`, sin build, sin linter, sin tests. El README (en español) documenta la jugabilidad y los controles; los textos de la interfaz en el código también están en español.

## Ejecución

Abre `index.html` directamente, o sirve la carpeta de forma estática (p. ej. `python -m http.server 8000`, `npx serve .`) y visita `http://localhost:8000`.

## Arquitectura

Toda la lógica vive en `game.js`, cargado como script clásico (no como módulo) desde `index.html`. El estado se guarda en variables globales `let` de nivel superior (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...) que se reinician en `init()`, la cual también es el manejador del botón de reinicio.

- El tablero es una matriz `ROWS × COLS` de `0` o un índice de color/pieza del 1 al 8 (el 8 es la "tuerca", un anillo 3×3 con el centro vacío); `COLORS` y `PIECES` se indexan con ese mismo número (el índice 0 es `null`), así que para añadir una pieza basta ampliar ambos arrays (`randomPiece` usa `PIECES.length - 1`).
- Flujo del juego: `loop` (requestAnimationFrame) acumula el tiempo y baja la pieza una vez por `dropInterval`; llama a `draw()` en cada frame. El bloqueo sigue la cadena `lockPiece` → `merge` → `clearLines` → `spawn`; `spawn` llama a `endGame()` si la nueva pieza colisiona.
- `clearLines` se encarga de actualizar puntuación, nivel y velocidad (`dropInterval = max(100, 1000 - (level-1)*90)`). El soft drop y el hard drop suman sus propios puntos.
- La pausa y el game over cancelan el frame de animación y reutilizan el mismo elemento `#overlay`; `togglePause` reinicia `loop` manualmente. La pausa (P o Escape) muestra el bloque `#pause-menu` (Reanudar, Reiniciar, Ver controles, Nivel inicial) y oculta `#restart-btn`; `showPauseMenu(bool)` alterna ambos y el game over muestra solo `#restart-btn`. El nivel inicial vive en `startLevel` (se aplica en `init()`; `clearLines` nunca baja de él). El código está en el bloque `// ==== Menú de pausa ====` de `game.js`.
- La rotación (`rotateCW` + `tryRotate`) es una rotación matricial simple en sentido horario con kicks solo horizontales `[0, -1, 1, -2, 2]`.

- Records: el bloque `// ==== Records ====` al final de `game.js` guarda en `localStorage` (`tetris.records`: top 5 + `bestCombo` + `maxLines`, todo con try/catch). `trackCombo` se llama desde `clearLines`, `showGameOverRecords` desde `endGame` y `resetRecordsRun` desde `init`. El juego ya NO llama a `init()` al cargar: muestra `#start-screen` y espera al botón Jugar (`started` protege el `keydown`, que además ignora eventos de `input`/`textarea`).

- Skins: el bloque `// ==== Skins ====` de `game.js` define `SKINS` (`retro`, `neon`, `pastel`, `pixel`), cada uno con `colors[]` (mismos índices que `COLORS`), `bg`, `grid` y su `drawBlock`. `drawBlock` delega en el skin activo (`skin`), `draw()`/`drawNext()` pintan el fondo con `skin.bg` (ya no `clearRect`) y la preferencia se guarda en `localStorage` (`tetris.skin`). Si añades una pieza, amplía también `colors` de cada skin.

## Detalles a tener en cuenta

- El tamaño en píxeles de los canvas está fijado en `index.html` (`#board` 300×600, `#next-canvas` 120×120). Si cambias `COLS`, `ROWS` o `BLOCK` en `game.js`, actualiza `width`/`height` del canvas a `COLS*BLOCK` × `ROWS*BLOCK`.
- `drawNext` usa su propio tamaño de bloque fijo (30) y una cuadrícula de 4×4 para centrar la pieza.
- El manejador de `keydown` usa `e.code` (teclas físicas) y llama a `updateHUD()` después de cada tecla procesada.
