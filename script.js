// ──────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────
const PRESETS = {
  example: { grid: [[0, 0, 1], [1, 0, 1], [0, 2, 0]], start: [0, 0], targets: [[2, 1]] },
  hard: { grid: [[0, 1, 0, 0, 0], [0, 1, 0, 1, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 0], [0, 0, 0, 1, 2]], start: [0, 0], targets: [[4, 4]] },
  nopath: { grid: [[0, 0, 0, 0, 0], [0, 1, 1, 1, 0], [0, 1, 2, 1, 0], [0, 1, 1, 1, 0], [0, 0, 0, 0, 0]], start: [0, 0], targets: [[2, 2]] },
  // Two perpendicular walls — path must snake all the way around both
  maze: {
    grid: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 0],
      [0, 1, 0, 0, 0, 0, 0],
      [0, 1, 0, 1, 1, 1, 0],
      [0, 1, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 1, 0],
      [0, 0, 0, 0, 0, 2, 0]
    ],
    start: [0, 0], targets: [[6, 5]]
  }
};
const DIR_NAMES = { '-1,0': '↑ Up', '1,0': '↓ Down', '0,-1': '← Left', '0,1': '→ Right' };
const DIR_ARROW = { '-1,0': '↑', '1,0': '↓', '0,-1': '←', '0,1': '→' };
const SPEEDS = [{ lbl: 'Slow', ms: 700 }, { lbl: 'Normal', ms: 300 }, { lbl: 'Fast', ms: 120 }, { lbl: 'Turbo', ms: 40 }];
let speedIdx = 1, animTimer = null, cellSz = 52, lastRes = null, activeTab = 'presets', showExplored = false;

// ──────────────────────────────────────────
// ALGORITHM — no DOM
// ──────────────────────────────────────────
function parseAndValidate(str) {
  let p;
  try { p = JSON.parse(str); } catch (e) { throw new Error('Invalid JSON: ' + e.message); }
  if (!p || typeof p !== 'object') throw new Error('Input must be a JSON object {}');
  if (!Array.isArray(p.grid) || !p.grid.length) throw new Error('Missing/empty field "grid" — must be a 2D array.');
  for (let r = 0; r < p.grid.length; r++) {
    if (!Array.isArray(p.grid[r])) throw new Error(`Row ${r} of "grid" is not an array.`);
    if (p.grid[r].length !== p.grid[0].length) throw new Error(`Row ${r} has inconsistent column count.`);
    for (let c = 0; c < p.grid[r].length; c++)
      if (![0, 1, 2].includes(p.grid[r][c])) throw new Error(`Invalid cell value at [${r},${c}] — must be 0, 1, or 2.`);
  }
  if (!Array.isArray(p.start) || p.start.length !== 2) throw new Error('"start" must be [row, col].');
  const [sr, sc] = p.start;
  if (sr < 0 || sr >= p.grid.length || sc < 0 || sc >= p.grid[0].length) throw new Error(`"start" [${sr},${sc}] is out of bounds.`);
  if (p.grid[sr][sc] === 1) throw new Error(`"start" [${sr},${sc}] is on an obstacle (value 1). Move start to a walkable cell (value 0).`);
  if (!Array.isArray(p.targets) || !p.targets.length) throw new Error('"targets" must be a non-empty array.');
  for (let i = 0; i < p.targets.length; i++) {
    if (!Array.isArray(p.targets[i]) || p.targets[i].length !== 2) throw new Error(`"targets[${i}]" must be [row, col].`);
    const [tr, tc] = p.targets[i];
    if (tr < 0 || tr >= p.grid.length || tc < 0 || tc >= p.grid[0].length) throw new Error(`"targets[${i}]" [${tr},${tc}] is out of bounds.`);
    if (p.grid[tr][tc] === 1) throw new Error(`"targets[${i}]" [${tr},${tc}] is on an obstacle (value 1). Target must be on value 0 or 2.`);
  }
  return { grid: p.grid, start: p.start, targets: p.targets };
}

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  let grid, start, targets;
  if (lines.length === 2 && lines[0] === 'grid,start,targets') {
    // Handle the special CSV format with JSON strings
    const data = lines[1];
    // Remove outer quotes and split by '","'
    const parts = data.slice(1, -1).split('","');
    if (parts.length !== 3) throw new Error('Invalid CSV format. Expected 3 columns: grid, start, targets.');
    try {
      grid = JSON.parse(parts[0]);
      start = JSON.parse(parts[1]);
      targets = JSON.parse(parts[2]);
    } catch (e) {
      throw new Error('Failed to parse JSON in CSV: ' + e.message);
    }
  } else {
    // Original format
    grid = [];
    for (const line of lines) {
      if (line.startsWith('start,')) {
        const p = line.split(',');
        start = [+p[1], +p[2]];
      } else if (line.startsWith('target,')) {
        const p = line.split(',');
        if (!targets) targets = [];
        targets.push([+p[1], +p[2]]);
      } else {
        const row = line.split(',').map(v => +v.trim());
        if (row.some(isNaN)) throw new Error(`Bad CSV row: "${line}"`);
        grid.push(row);
      }
    }
    if (!start) start = [0, 0];
    if (!targets) {
      for (let r = 0; r < grid.length; r++)
        for (let c = 0; c < grid[r].length; c++)
          if (grid[r][c] === 2) targets = [[r, c]];
    }
    if (!targets) throw new Error('No target found. Add a cell value of 2 or a "target,row,col" line.');
  }
  return JSON.stringify({ grid, start, targets });
}

function reconstructPath(parentMap, startKey, target) {
  const path = [];
  let cur = target[0] + ',' + target[1];
  while (cur !== null) { const [r, c] = cur.split(',').map(Number); path.push([r, c]); cur = parentMap.has(cur) ? parentMap.get(cur) : null; }
  return path.reverse();
}

function bfs(grid, start, targets) {
  const R = grid.length, C = grid[0].length, DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const sk = start[0] + ',' + start[1], tk = targets[0][0] + ',' + targets[0][1]; // For compatibility, but will change
  const t0 = performance.now();
  const queue = [start], visited = new Set([sk]), parent = new Map([[sk, null]]);
  let reached = false, reachedTarget = null;
  const targetSet = new Set(targets.map(t => t[0] + ',' + t[1]));
  outer: while (queue.length) {
    const [r, c] = queue.shift();
    const key = r + ',' + c;
    if (targetSet.has(key)) {
      reached = true;
      reachedTarget = [r, c];
      break outer;
    }
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc, nk = nr + ',' + nc;
      if (nr >= 0 && nr < R && nc >= 0 && nc < C && grid[nr][nc] !== 1 && !visited.has(nk)) {
        visited.add(nk); parent.set(nk, key); queue.push([nr, nc]);
      }
    }
  }
  const t1 = performance.now();
  const path = reached ? reconstructPath(parent, sk, reachedTarget) : [];
  return { path, targetReached: reached, executionTimeMs: Math.round(t1 - t0), visited, reachedTarget };
}

function buildOutput(path, reached, ms, reachedTarget) {
  return { total_steps: reached ? path.length - 1 : 0, path, target_reached: reached, execution_time_ms: ms, reached_target: reachedTarget || null };
}

// ──────────────────────────────────────────
// RENDERING
// ──────────────────────────────────────────
function renderGrid(grid, path, start, target) {
  const R = grid.length, C = grid[0].length;
  const pathMap = new Map(); path.forEach((p, i) => pathMap.set(p[0] + ',' + p[1], i));
  const sk = start[0] + ',' + start[1], tk = target[0] + ',' + target[1];

  // Identify obstacle cells adjacent to the path (visually highlighted as "bypassed")
  const bypassedObs = new Set();
  const DIRS4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [pr, pc] of path) {
    for (const [dr, dc] of DIRS4) {
      const nr = pr + dr, nc = pc + dc;
      if (nr >= 0 && nr < R && nc >= 0 && nc < C && grid[nr][nc] === 1) bypassedObs.add(nr + ',' + nc);
    }
  }

  const wrap = document.getElementById('grid-wrap');
  wrap.innerHTML = '';
  // Use actual container width for proper fitting
  const gridCard = document.querySelector('.grid-card');
  const containerW = gridCard ? gridCard.clientWidth - 64 : Math.min(800, window.innerWidth - 100);
  const maxW = Math.min(containerW, 900);
  cellSz = Math.max(40, Math.min(110, Math.floor((maxW - (C - 1) * 4) / C)));
  wrap.style.gridTemplateColumns = `repeat(${C},${cellSz}px)`;
  wrap.style.gridTemplateRows = `repeat(${R},${cellSz}px)`;
  wrap.style.gap = '4px';

  // Coordinate headers
  const ctop = document.getElementById('coord-top');
  ctop.innerHTML = '';
  for (let c = 0; c < C; c++) {
    const d = document.createElement('div');
    d.className = 'coord-lbl'; d.style.width = cellSz + 'px'; d.style.textAlign = 'center'; d.textContent = c;
    ctop.appendChild(d);
  }
  const cleft = document.getElementById('coord-left');
  cleft.innerHTML = '';
  for (let r = 0; r < R; r++) {
    const d = document.createElement('div');
    d.className = 'coord-lbl'; d.style.height = cellSz + 'px'; d.style.lineHeight = cellSz + 'px';
    d.style.textAlign = 'right'; d.style.paddingRight = '6px'; d.textContent = r;
    cleft.appendChild(d);
  }

  // Build explored set reference
  const exploredSet = lastRes && lastRes.visited ? lastRes.visited : new Set();

  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const key = r + ',' + c;
      const el = document.createElement('div');
      el.className = 'cell'; el.dataset.row = r; el.dataset.col = c; el.dataset.key = key;
      el.style.width = el.style.height = cellSz + 'px';
      el.style.fontSize = Math.max(9, Math.floor(cellSz * 0.22)) + 'px';

      if (grid[r][c] === 1) {
        el.classList.add('obstacle');
        if (bypassedObs.has(key)) el.classList.add('bypassed');
      } else if (key === sk) {
        el.classList.add('start');
        const lb = document.createElement('div'); lb.className = 'cell-lbl'; lb.textContent = 'S'; el.appendChild(lb);
      } else if (key === tk) {
        el.classList.add('target');
        const lb = document.createElement('div'); lb.className = 'cell-lbl lt'; lb.textContent = 'T'; el.appendChild(lb);
      } else if (pathMap.has(key)) {
        const step = pathMap.get(key);
        el.classList.add('path');
        el.style.animationDelay = (step * 0.04) + 's';
        // Direction arrow
        if (step > 0) {
          const prev = path[step - 1];
          const dr = r - prev[0], dc = c - prev[1];
          const arrowKey = dr + ',' + dc;
          const arrow = document.createElement('div');
          arrow.className = 'dir-arrow';
          arrow.textContent = DIR_ARROW[arrowKey] || '·';
          el.appendChild(arrow);
        }
        if (cellSz >= 44) {
          const sn = document.createElement('div'); sn.className = 'step-num'; sn.textContent = step; el.appendChild(sn);
        }
      } else {
        // explored overlay (only non-path, non-obstacle cells visited by BFS)
        if (showExplored && exploredSet.has(key)) {
          el.classList.add('explored');
        } else {
          el.classList.add('walkable');
        }
      }
      wrap.appendChild(el);
    }
  }

  // SVG path line overlay
  drawPathLine(path, C);

  document.getElementById('grid-sec').classList.add('show');
  buildStepTable(path);
}

function drawPathLine(path, C) {
  const wrap = document.getElementById('grid-wrap');
  const svg = document.getElementById('path-svg');
  const GAP = 4;
  const totalW = C * cellSz + (C - 1) * GAP;
  svg.setAttribute('width', totalW);
  svg.setAttribute('height', wrap.style.gridTemplateRows.split(' ').length * cellSz +
    (wrap.style.gridTemplateRows.split(' ').length - 1) * GAP);

  // Recalculate height properly
  const rows = parseInt(wrap.style.gridTemplateRows.match(/repeat\((\d+)/)?.[1] || 1);
  svg.setAttribute('height', rows * cellSz + (rows - 1) * GAP);

  if (path.length < 2) { svg.innerHTML = ''; return; }
  // Build polyline points: center of each path cell
  const pts = path.map(([r, c]) => {
    const x = c * (cellSz + GAP) + cellSz / 2;
    const y = r * (cellSz + GAP) + cellSz / 2;
    return `${x},${y}`;
  }).join(' ');
  svg.innerHTML = `<polyline class="path-line" points="${pts}"/>`;
}

function buildStepTable(path) {
  const tbody = document.getElementById('step-body');
  tbody.innerHTML = '';
  if (!path.length) { document.getElementById('step-card').classList.remove('show'); return; }
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    const isSt = i === 0, isEn = i === path.length - 1;
    let dir = '—';
    if (i > 0) { const dr = path[i][0] - path[i - 1][0], dc = path[i][1] - path[i - 1][1]; dir = DIR_NAMES[dr + ',' + dc] || '?'; }
    const cls = isSt ? 'sbadge sb' : isEn ? 'sbadge eb' : 'sbadge';
    const note = isSt ? '🟢 Start' : isEn ? '🎯 Arrived at Target' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="${cls}">${i}</span></td><td style="font-family:var(--mono)">[${r}, ${c}]</td><td>${dir}</td><td style="font-size:11px;color:var(--text3)">${note}</td>`;
    tbody.appendChild(tr);
  }
  document.getElementById('step-card').classList.add('show');
}

// ── Custom horizontal-matrix output formatter ──────────────────────────────
// Renders inner [row,col] pairs on one line, padded for alignment, e.g.:
//   "path": [
//     [  0,  0 ],
//     [  0,  1 ],
//     ...
//   ],
function formatOutput(obj) {
  const path = obj.path;

  // Find max digit widths for padding
  let maxR = 1, maxC = 1;
  if (path && path.length) {
    for (const [r, c] of path) {
      maxR = Math.max(maxR, String(r).length);
      maxC = Math.max(maxC, String(c).length);
    }
  }

  const pad = (n, w) => String(n).padStart(w, ' ');

  const pathLines = path && path.length
    ? path.map(([r, c]) => `    [ ${pad(r, maxR)}, ${pad(c, maxC)} ]`).join(',\n')
    : '';

  const raw = `{
  "total_steps": ${obj.total_steps},
  "path": ${path && path.length
      ? `[\n${pathLines}\n  ]`
      : '[ ]'
    },
  "target_reached": ${obj.target_reached},
  "execution_time_ms": ${obj.execution_time_ms},
  "reached_target": ${obj.reached_target ? `[${obj.reached_target[0]}, ${obj.reached_target[1]}]` : null}
}`;

  return raw;
}

function syntaxHL(obj) {
  const raw = formatOutput(obj);

  // Colour: keys, numbers, booleans, strings — left as-is (not strings in our output)
  return raw
    // keys
    .replace(/"(total_steps|path|target_reached|execution_time_ms|reached_target)"(\s*:)/g,
      '<span class="jk">"$1"</span>$2')
    // booleans
    .replace(/\b(true)\b/g, '<span class="jt">$1</span>')
    .replace(/\b(false)\b/g, '<span class="jf">$1</span>')
    // null
    .replace(/\b(null)\b/g, '<span class="jn">$1</span>')
    // numbers (standalone, not inside strings)
    .replace(/(?<!["\w])-?\b(\d+)\b(?!["\w])/g, '<span class="jn">$1</span>');
}

// ── Download helpers ────────────────────────────────────────────────────────
function downloadJSON() {
  if (!lastRes) return;
  const text = formatOutput(lastRes.output);
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'routemaster_output.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('⬇ routemaster_output.json downloaded!');
}

function downloadPNG() {
  if (!lastRes) return;
  const { grid, path, start, target } = lastRes;
  const R = grid.length, C = grid[0].length;
  const pathMap = new Map();
  path.forEach((p, i) => pathMap.set(p[0] + ',' + p[1], i));
  const sk = start[0] + ',' + start[1], tk = target[0] + ',' + target[1];

  const SZ = 56, GAP = 4, PAD = 28, COORD = 22;
  const W = PAD + COORD + C * SZ + (C - 1) * GAP + PAD;
  const H = PAD + COORD + R * SZ + (R - 1) * GAP + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W * 2; canvas.height = H * 2; // 2× for retina
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = '#050b14';
  ctx.fillRect(0, 0, W, H);

  // Column coord labels
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  for (let c = 0; c < C; c++) {
    const x = PAD + COORD + c * (SZ + GAP) + SZ / 2;
    ctx.fillText(String(c), x, PAD + COORD - 6);
  }
  // Row coord labels
  ctx.textAlign = 'right';
  for (let r = 0; r < R; r++) {
    const y = PAD + COORD + r * (SZ + GAP) + SZ / 2 + 4;
    ctx.fillText(String(r), PAD + COORD - 6, y);
  }

  const CELL_COLORS = {
    start: { bg: '#059669', border: '#047857', text: '#fff' },
    target: { bg: '#dc2626', border: '#b91c1c', text: '#fff' },
    path: { bg: '#d97706', border: '#b45309', text: '#1a1000' },
    obstacle: { bg: '#080f1a', border: '#1e3a52', text: null },
    walkable: { bg: '#0c1829', border: '#1e293b', text: null },
  };

  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const key = r + ',' + c;
      const x = PAD + COORD + c * (SZ + GAP);
      const y = PAD + COORD + r * (SZ + GAP);
      let type = 'walkable';
      if (grid[r][c] === 1) type = 'obstacle';
      else if (key === sk) type = 'start';
      else if (key === tk) type = 'target';
      else if (pathMap.has(key)) type = 'path';

      const col = CELL_COLORS[type];
      // Rounded rect fill
      const rad = 6;
      ctx.fillStyle = col.bg;
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + SZ - rad, y);
      ctx.quadraticCurveTo(x + SZ, y, x + SZ, y + rad);
      ctx.lineTo(x + SZ, y + SZ - rad);
      ctx.quadraticCurveTo(x + SZ, y + SZ, x + SZ - rad, y + SZ);
      ctx.lineTo(x + rad, y + SZ);
      ctx.quadraticCurveTo(x, y + SZ, x, y + SZ - rad);
      ctx.lineTo(x, y + rad);
      ctx.quadraticCurveTo(x, y, x + rad, y);
      ctx.closePath();
      ctx.fill();
      // Border
      ctx.strokeStyle = col.border;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px sans-serif';
      const lbl = type === 'start' ? 'S' : type === 'target' ? 'T' : type === 'path' ? String(pathMap.get(key)) : type === 'obstacle' ? '▦' : '';
      if (lbl) {
        ctx.fillStyle = type === 'obstacle' ? 'rgba(255,255,255,0.15)' : col.text;
        ctx.fillText(lbl, x + SZ / 2, y + SZ / 2 + 5);
      }
    }
  }

  // Legend
  const LEG = [
    { color: '#059669', label: 'Start' },
    { color: '#dc2626', label: 'Target' },
    { color: '#d97706', label: 'Path' },
    { color: '#080f1a', label: 'Obstacle', border: '#1e3a52' },
    { color: '#0c1829', label: 'Walkable', border: '#1e293b' },
  ];
  let lx = PAD;
  const ly = H - 14;
  ctx.font = '10px monospace';
  for (const leg of LEG) {
    ctx.fillStyle = leg.color;
    ctx.strokeStyle = leg.border || leg.color;
    ctx.lineWidth = 1;
    ctx.fillRect(lx, ly - 10, 12, 12);
    ctx.strokeRect(lx, ly - 10, 12, 12);
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(leg.label, lx + 16, ly);
    lx += ctx.measureText(leg.label).width + 32;
  }

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'routemaster_grid.png';
  a.click();
  toast('⬇ routemaster_grid.png downloaded!');
}

// ──────────────────────────────────────────
// ANIMATION
// ──────────────────────────────────────────
function playAnim() {
  if (!lastRes || !lastRes.path.length) return;
  if (animTimer) { clearTimeout(animTimer); animTimer = null; }
  const { path, grid } = lastRes;
  const wrap = document.getElementById('grid-wrap');
  // Reset path cells back to walkable
  wrap.querySelectorAll('.cell.path,.cell.path-flash').forEach(el => {
    el.classList.remove('path', 'path-flash', 'cell-appear');
    el.classList.add('walkable'); el.innerHTML = '';
  });
  // Clear SVG line
  document.getElementById('path-svg').innerHTML = '';

  const prog = document.getElementById('anim-prog'), fill = document.getElementById('prog-fill'), lbl = document.getElementById('prog-lbl');
  prog.classList.add('show'); fill.style.width = '0%';
  const pb = document.getElementById('play-btn'); pb.classList.add('active'); pb.textContent = '⏸ Playing…';
  const rows = [...document.querySelectorAll('#step-body tr')];
  const spd = SPEEDS[speedIdx].ms;
  let i = 0;
  const drawnPath = [];

  function step() {
    if (i >= path.length) { done(); return; }
    const [r, c] = path[i], key = r + ',' + c;
    const el = wrap.querySelector(`[data-key="${key}"]`);
    if (el && !el.classList.contains('start') && !el.classList.contains('target')) {
      el.classList.remove('walkable', 'explored');
      el.classList.add('path', 'cell-appear', 'path-flash');
      el.innerHTML = '';
      // Direction arrow
      if (i > 0) {
        const prev = path[i - 1];
        const dr = r - prev[0], dc = c - prev[1];
        const arrow = document.createElement('div'); arrow.className = 'dir-arrow';
        arrow.textContent = DIR_ARROW[dr + ',' + dc] || '·'; el.appendChild(arrow);
      }
      if (cellSz >= 44) { const sn = document.createElement('div'); sn.className = 'step-num'; sn.textContent = i; el.appendChild(sn); }
      setTimeout(() => el.classList.remove('path-flash'), 350);
    }
    drawnPath.push([r, c]);
    drawPathLine(drawnPath, grid[0].length);
    fill.style.width = ((i + 1) / path.length * 100) + '%';
    lbl.textContent = `Step ${i} of ${path.length - 1}`;
    if (rows[i]) { rows.forEach(r => r.classList.remove('hl')); rows[i].classList.add('hl'); rows[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    i++; animTimer = setTimeout(step, spd);
  }
  function done() { pb.classList.remove('active'); pb.textContent = '▶ Play Path'; animTimer = null; toast('✅ Animation complete!'); }
  step();
}

function toggleExplored() {
  showExplored = !showExplored;
  const btn = document.getElementById('explore-btn');
  btn.textContent = showExplored ? '👁 Hide BFS Explored' : '👁 Show BFS Explored';
  btn.classList.toggle('explored-on', showExplored);
  if (lastRes) renderGrid(lastRes.grid, lastRes.path, lastRes.start, lastRes.target);
}

function cycleSpeed() {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  document.getElementById('speed-btn').textContent = '⚡ ' + SPEEDS[speedIdx].lbl;
}
function zoom(d) {
  if (!lastRes) return;
  cellSz = Math.max(28, Math.min(96, cellSz + d * 12));
  renderGrid(lastRes.grid, lastRes.path, lastRes.start, lastRes.target);
}

// ──────────────────────────────────────────
// UI ORCHESTRATION
// ──────────────────────────────────────────
function getJSON() { return document.getElementById('json-input').value.trim(); }

function handleCalc() {
  clearErr();
  const btn = document.getElementById('calc-btn'); btn.classList.add('loading');
  setTimeout(() => {
    try {
      const raw = getJSON();
      if (!raw) throw new Error('No input detected. Choose a preset, paste JSON, or upload a file.');
      const { grid, start, targets } = parseAndValidate(raw);
      const { path, targetReached, executionTimeMs, visited, reachedTarget } = bfs(grid, start, targets);
      const out = buildOutput(path, targetReached, executionTimeMs, reachedTarget);
      lastRes = { grid, start, target: reachedTarget || targets[0], path, output: out, visited };

      // Stats
      document.getElementById('s-steps').textContent = out.total_steps;
      const re = document.getElementById('s-reached');
      re.textContent = targetReached ? '✓  Yes' : '✗  No';
      re.className = 'stat-val med ' + (targetReached ? 'green' : 'red');
      document.getElementById('s-reached-sub').textContent = targetReached ? `Reached target at [${reachedTarget[0]}, ${reachedTarget[1]}]` : 'No target reachable';
      document.getElementById('s-time').textContent = executionTimeMs + 'ms';
      document.getElementById('s-grid').textContent = grid.length + ' × ' + grid[0].length;
      document.getElementById('stats-card').classList.add('show');

      const rp = document.getElementById('result-pill');
      rp.textContent = targetReached ? '✓ Solved' : '✗ No Path';
      rp.className = 'card-pill ' + (targetReached ? 'green' : 'red');

      const sh = document.getElementById('shimmer'); sh.style.display = 'block';
      setTimeout(() => sh.style.display = 'none', 2500);

      const pre = document.getElementById('output-pre');
      pre.classList.remove('out-ph'); pre.innerHTML = syntaxHL(out);
      document.getElementById('out-pill').textContent = 'Ready';
      document.getElementById('copy-btn').classList.add('show');
      document.getElementById('dl-json-btn').style.display = 'inline-flex';

      renderGrid(grid, path, start, reachedTarget || targets[0]);
      toast(targetReached ? `🎯 Path found! ${out.total_steps} step${out.total_steps !== 1 ? 's' : ''} to reach target at [${reachedTarget[0]}, ${reachedTarget[1]}].` : '🚫 No path available — no target is reachable.');
    } catch (e) { showErr(e.message); }
    btn.classList.remove('loading');
  }, 60);
}

function handleReset() {
  if (animTimer) { clearTimeout(animTimer); animTimer = null; }
  clearErr();
  document.getElementById('json-input').value = '';
  const pre = document.getElementById('output-pre');
  pre.innerHTML = '// Run a calculation to see the result here.'; pre.classList.add('out-ph');
  document.getElementById('stats-card').classList.remove('show');
  document.getElementById('grid-sec').classList.remove('show');
  document.getElementById('step-card').classList.remove('show');
  document.getElementById('copy-btn').classList.remove('show');
  document.getElementById('dl-json-btn').style.display = 'none';
  document.getElementById('out-pill').textContent = 'Awaiting input';
  document.getElementById('anim-prog').classList.remove('show');
  document.getElementById('play-btn').textContent = '▶ Play Path';
  document.getElementById('play-btn').classList.remove('active');
  showExplored = false;
  document.getElementById('explore-btn').textContent = '👁 Show BFS Explored';
  document.getElementById('explore-btn').classList.remove('explored-on');
  clearFile(); lastRes = null;
}

function copyOut() {
  if (!lastRes) return;
  navigator.clipboard.writeText(formatOutput(lastRes.output))
    .then(() => toast('📋 Copied to clipboard!'))
    .catch(() => toast('Copy failed — please copy manually.'));
}

function showErr(msg) { document.getElementById('err-txt').textContent = msg; document.getElementById('err-box').classList.add('show'); }
function clearErr() { document.getElementById('err-box').classList.remove('show'); }

function toast(msg) {
  const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

// ──────────────────────────────────────────
// TABS
// ──────────────────────────────────────────
function switchTab(name, btn) {
  activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('mode-pill').textContent = { presets: 'Preset', json: 'JSON', upload: 'File' }[name];
  clearErr();
}

// ──────────────────────────────────────────
// PRESETS
// ──────────────────────────────────────────
function loadPreset(name) {
  document.getElementById('json-input').value = JSON.stringify(PRESETS[name], null, 2);
  toast('📋 Preset loaded — click Calculate Route!'); clearErr();
}

// ──────────────────────────────────────────
// FILE UPLOAD
// ──────────────────────────────────────────
function handleFile(e) { const f = e.target.files[0]; if (f) processFile(f); }
function processFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['json', 'csv'].includes(ext)) { showErr('Unsupported file. Please upload a .json or .csv file.'); return; }
  document.getElementById('fp-icon').textContent = ext === 'json' ? '📋' : '📊';
  document.getElementById('fp-name').textContent = file.name;
  document.getElementById('fp-size').textContent = fmtBytes(file.size);
  document.getElementById('fp').classList.add('show');
  document.getElementById('upload-zone').style.display = 'none';
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const json = ext === 'csv' ? parseCSV(e.target.result) : e.target.result;
      document.getElementById('json-input').value = json; clearErr();
      toast(`📂 ${file.name} loaded successfully!`);
    } catch (err) { showErr('File error: ' + err.message); }
  };
  reader.readAsText(file);
}
function clearFile() {
  document.getElementById('fp').classList.remove('show');
  document.getElementById('upload-zone').style.display = '';
  document.getElementById('file-input').value = '';
  document.getElementById('json-input').value = '';
}
function fmtBytes(b) { if (b < 1024) return b + 'B'; if (b < 1048576) return (b / 1024).toFixed(1) + 'KB'; return (b / 1048576).toFixed(1) + 'MB'; }

const uz = document.getElementById('upload-zone');
uz.addEventListener('dragover', e => { e.preventDefault(); uz.classList.add('drag-over'); });
uz.addEventListener('dragleave', () => uz.classList.remove('drag-over'));
uz.addEventListener('drop', e => { e.preventDefault(); uz.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) processFile(f); });

// ──────────────────────────────────────────
// INIT
// ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => loadPreset('example'));
