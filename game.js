'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let startLevel = 1;   // selección del menú (próxima partida)
let baseLevel = 1;    // nivel mínimo de la partida en curso
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let started = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(baseLevel, Math.floor(lines / 10) + 1);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  trackCombo(cleared);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ==== Skins ====
const SKIN_KEY = 'tetris.skin';

function rrectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, r);
  } else {
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    bg: '#1a1a25',
    grid: '#22222e',
    drawBlock(context, x, y, color, size) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    name: 'Neon',
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff1744', '#4d6dff', '#ff9100', '#e0e0ff'],
    bg: '#000000',
    grid: '#14141f',
    drawBlock(context, x, y, color, size) {
      const a = context.globalAlpha;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = color;
      context.globalAlpha = a * 0.35;
      context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.globalAlpha = a;
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#a8e6ef', '#fff1b8', '#d8b4e8', '#b9e4c0', '#f7b8b8', '#b8c0f0', '#fdd5a8', '#d5dde2'],
    bg: '#f6f1ee',
    grid: '#e6dfe0',
    drawBlock(context, x, y, color, size) {
      rrectPath(context, x * size + 2, y * size + 2, size - 4, size - 4, 8);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.12)';
      context.lineWidth = 1;
      context.stroke();
    },
  },
  pixel: {
    name: 'Pixel art',
    colors: [null, '#29c5d6', '#f2c200', '#9c27b0', '#43a047', '#e53935', '#3949ab', '#fb8c00', '#78909c'],
    bg: '#12121c',
    grid: '#1e1e2c',
    drawBlock(context, x, y, color, size) {
      const px = x * size, py = y * size, u = size / 6;
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      // textura: luz arriba/izquierda, sombra abajo/derecha y puntos
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px, py, size, u);
      context.fillRect(px, py, u, size);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px, py + size - u, size, u);
      context.fillRect(px + size - u, py, u, size);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 2; i < 5; i += 2)
        for (let j = 2; j < 5; j += 2)
          context.fillRect(px + i * u, py + j * u, u, u);
    },
  },
};

function loadSkin() {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    if (saved && Object.prototype.hasOwnProperty.call(SKINS, saved)) return saved;
  } catch (e) { /* sin localStorage */ }
  return 'retro';
}

let currentSkin = loadSkin();
let skin = SKINS[currentSkin];

function setSkin(id) {
  if (!Object.prototype.hasOwnProperty.call(SKINS, id)) return;
  currentSkin = id;
  skin = SKINS[id];
  try { localStorage.setItem(SKIN_KEY, id); } catch (e) { /* ignorar */ }
  if (board && current && next) {
    draw();
    drawNext();
  }
}

const skinSelect = document.getElementById('skin-select');
if (skinSelect) {
  for (const id of Object.keys(SKINS)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = SKINS[id].name;
    skinSelect.appendChild(opt);
  }
  skinSelect.value = currentSkin;
  skinSelect.addEventListener('change', () => {
    setSkin(skinSelect.value);
    skinSelect.blur();
  });
  // Evita que las teclas del juego cambien el select o abran el desplegable
  skinSelect.addEventListener('keydown', e => {
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
}
// ==== Fin Skins ====

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x, y, skin.colors[colorIndex], size);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = skin.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.fillStyle = skin.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.fillStyle = skin.bg;
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  showPauseMenu(false);
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    resumeReset();
    if (document.activeElement) document.activeElement.blur();
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    showPauseMenu(true);
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  started = true;
  resetRecordsRun();
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  showPauseMenu(false);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ==== Menú de pausa ====
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSel = document.getElementById('start-level');

// Muestra el menú de pausa (y oculta el botón de game over) o al revés.
function showPauseMenu(show) {
  pauseMenu.classList.toggle('hidden', !show);
  restartBtn.classList.toggle('hidden', show);
  if (!show) {
    pauseControls.classList.add('hidden');
    controlsBtn.textContent = 'Ver controles';
  }
}

// Al reanudar se descarta el tiempo acumulado para evitar caídas accidentales.
function resumeReset() {
  dropAccum = 0;
}

resumeBtn.addEventListener('click', () => { if (paused) togglePause(); });
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  const hidden = pauseControls.classList.toggle('hidden');
  controlsBtn.textContent = hidden ? 'Ver controles' : 'Ocultar controles';
});
startLevelSel.addEventListener('change', () => {
  startLevel = parseInt(startLevelSel.value, 10) || 1;
});
// Quita el foco de los botones para que Espacio/Enter no los activen al jugar.
[resumeBtn, pauseRestartBtn, controlsBtn].forEach(el =>
  el.addEventListener('click', () => el.blur()));
// ==== Fin menú de pausa ====

document.addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (!started) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat) togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// ==== Records ====
const RECORDS_KEY = 'tetris.records';
const MAX_RECORDS = 5;
const DEFAULT_NAME = 'Jugador';

const startScreen = document.getElementById('start-screen');
const startRecordsEl = document.getElementById('start-records');
const playBtn = document.getElementById('play-btn');
const recordsWrap = document.getElementById('records-wrap');
const recordsPanel = document.getElementById('records-panel');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const resetRecordsBtns = document.querySelectorAll('.reset-records-btn');

let combo = 0;
let runBestCombo = 0;
let pendingRecord = false;
let highlightDate = null;

function emptyRecords() {
  return { list: [], bestCombo: 0, maxLines: 0 };
}

function nonNeg(v) {
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return emptyRecords();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyRecords();
    const list = Array.isArray(data.list) ? data.list : [];
    return {
      list: list
        .filter(r => r && typeof r === 'object' && Number.isFinite(r.score))
        .map(r => ({
          name: String(r.name == null ? DEFAULT_NAME : r.name).slice(0, 12),
          score: nonNeg(r.score),
          lines: nonNeg(r.lines),
          level: nonNeg(r.level),
          date: String(r.date || ''),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS),
      bestCombo: nonNeg(data.bestCombo),
      maxLines: nonNeg(data.maxLines),
    };
  } catch (err) {
    return emptyRecords();
  }
}

function saveRecords(rec) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
  } catch (err) { /* sin localStorage: la app sigue funcionando */ }
}

function resetRecordsRun() {
  submitRecord(); // si había un record pendiente, se guarda con el nombre escrito
  combo = 0;
  runBestCombo = 0;
  pendingRecord = false;
  highlightDate = null;
  recordsWrap.classList.add('hidden');
  nameForm.classList.add('hidden');
  startScreen.classList.add('hidden');
}

function trackCombo(cleared) {
  if (cleared) {
    combo++;
    if (combo > runBestCombo) runBestCombo = combo;
  } else {
    combo = 0;
  }
}

function qualifies(rec, sc) {
  if (sc <= 0) return false;
  return rec.list.length < MAX_RECORDS || sc > rec.list[rec.list.length - 1].score;
}

function renderRecords(container, rec) {
  container.textContent = '';
  const title = document.createElement('p');
  title.className = 'records-title';
  title.textContent = 'MEJORES PUNTUACIONES';
  container.appendChild(title);

  if (rec.list.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Aún no hay records';
    container.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'records-table';
    const head = table.createTHead().insertRow();
    ['#', 'Nombre', 'Puntos', 'Líneas', 'Nivel'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    });
    const body = table.createTBody();
    rec.list.forEach((r, i) => {
      const tr = body.insertRow();
      if (highlightDate !== null && r.date === highlightDate) tr.className = 'record-new';
      [i + 1, r.name, r.score.toLocaleString(), r.lines, r.level].forEach(v => {
        tr.insertCell().textContent = v;
      });
    });
    container.appendChild(table);
  }

  const stats = document.createElement('p');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${rec.bestCombo} · Líneas máximas: ${rec.maxLines}`;
  container.appendChild(stats);
}

function showStartScreen() {
  renderRecords(startRecordsEl, loadRecords());
  startScreen.classList.remove('hidden');
  playBtn.focus();
}

function showGameOverRecords() {
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, runBestCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);
  pendingRecord = qualifies(rec, score);
  renderRecords(recordsPanel, rec);
  recordsWrap.classList.remove('hidden');
  if (pendingRecord) {
    nameInput.value = DEFAULT_NAME;
    nameForm.classList.remove('hidden');
    // retraso para que las teclas pulsadas al morir no acaben en el campo
    setTimeout(() => {
      if (pendingRecord) { nameInput.focus(); nameInput.select(); }
    }, 700);
  } else {
    nameForm.classList.add('hidden');
  }
}

function submitRecord() {
  if (!pendingRecord) return;
  pendingRecord = false;
  const rec = loadRecords();
  const name = nameInput.value.trim().slice(0, 12) || DEFAULT_NAME;
  const date = new Date().toISOString();
  rec.list.push({ name, score, lines, level, date });
  rec.list.sort((a, b) => b.score - a.score);
  rec.list = rec.list.slice(0, MAX_RECORDS);
  saveRecords(rec);
  highlightDate = date;
  nameForm.classList.add('hidden');
  nameInput.blur();
  renderRecords(recordsPanel, rec);
}

function resetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los records?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (err) { /* ignorado */ }
  highlightDate = null;
  pendingRecord = false;
  nameForm.classList.add('hidden');
  const rec = emptyRecords();
  renderRecords(recordsPanel, rec);
  renderRecords(startRecordsEl, rec);
}

saveNameBtn.addEventListener('click', submitRecord);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitRecord(); });
resetRecordsBtns.forEach(b => b.addEventListener('click', resetRecords));
playBtn.addEventListener('click', init);

showStartScreen();
// ==== /Records ====
