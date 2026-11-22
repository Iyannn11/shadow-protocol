// SHADOW PROTOCOL — renderer: paints the level, vision cones, HUD and screens.
// All drawing is plain 2D canvas. Vision cones are raycast polygons, so they bend
// around walls and crates exactly the way the guards' sight does.
import {
  CAMERA_HALF_ANGLE, CAMERA_RANGE, COLS, GUARD_HALF_ANGLE, GUARD_RANGE, HEIGHT,
  MAP, PALETTE, ROWS, TILE, WIDTH,
} from './config.js';
import { castRay } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function conePath(ctx, x, y, angle, range, halfAngle) {
  const rays = 26;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = castRay(x, y, a, range);
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function drawLevel(ctx, state) {
  // Floor: two-tone checker with faint grid lines.
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const c = MAP[y][x];
      if (c === '#') continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  ctx.strokeStyle = PALETTE.floorLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x += 1) {
    ctx.moveTo(x * TILE + 0.5, 0);
    ctx.lineTo(x * TILE + 0.5, HEIGHT);
  }
  for (let y = 0; y <= ROWS; y += 1) {
    ctx.moveTo(0, y * TILE + 0.5);
    ctx.lineTo(WIDTH, y * TILE + 0.5);
  }
  ctx.stroke();

  // Exit pad.
  const e = state.exit;
  ctx.fillStyle = state.exitOpen ? PALETTE.exit : PALETTE.exitLocked;
  roundRect(ctx, e.x - 17, e.y - 17, 34, 34, 7);
  ctx.fill();
  ctx.strokeStyle = state.exitOpen ? PALETTE.exitEdge : '#6b7883';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.exitOpen ? 'EXIT' : 'LOCK', e.x, e.y);
  if (state.exitOpen) {
    const glow = 0.5 + 0.5 * Math.sin(state.time * 3);
    ctx.strokeStyle = `rgba(34, 181, 115, ${0.35 + glow * 0.4})`;
    ctx.lineWidth = 3;
    roundRect(ctx, e.x - 22, e.y - 22, 44, 44, 9);
    ctx.stroke();
  }

  // Intel pickups: pulsing gold diamonds.
  for (const intel of state.intels) {
    if (intel.taken) continue;
    const s = 11 + Math.sin(intel.pulse * 4) * 2;
    ctx.fillStyle = PALETTE.intel;
    ctx.strokeStyle = PALETTE.intelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(intel.x, intel.y - s);
    ctx.lineTo(intel.x + s, intel.y);
    ctx.lineTo(intel.x, intel.y + s);
    ctx.lineTo(intel.x - s, intel.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5c4300';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('i', intel.x, intel.y + 0.5);
  }

  // Crates.
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (MAP[y][x] !== 'C') continue;
      const px = x * TILE;
      const py = y * TILE;
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = PALETTE.crateEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
      ctx.strokeStyle = PALETTE.crateLine;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 2, py + 2);
      ctx.lineTo(px + TILE - 2, py + TILE - 2);
      ctx.moveTo(px + TILE - 2, py + 2);
      ctx.lineTo(px + 2, py + TILE - 2);
      ctx.stroke();
    }
  }

  // Walls: dark slabs with a lighter top edge so the level reads at a glance.
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (MAP[y][x] !== '#') continue;
      const px = x * TILE;
      const py = y * TILE;
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(px, py, TILE, 5);
      ctx.strokeStyle = PALETTE.wallEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function drawCones(ctx, state) {
  // Cameras first (under the guards' cones).
  for (const cam of state.cameras) {
    ctx.fillStyle = PALETTE.coneCamera;
    conePath(ctx, cam.x, cam.y, cam.angle, CAMERA_RANGE, CAMERA_HALF_ANGLE);
    ctx.fill();
  }
  for (const g of state.guards) {
    const fill = g.state === 'chase' ? PALETTE.coneAlarm
      : g.state === 'suspicious' ? PALETTE.coneSuspicious : PALETTE.coneCalm;
    ctx.fillStyle = fill;
    conePath(ctx, g.x, g.y, g.angle, GUARD_RANGE, GUARD_HALF_ANGLE);
    ctx.fill();
  }
}

function drawActor(ctx, x, y, angle, radius, body, edge, visor) {
  ctx.fillStyle = body;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Facing wedge + visor dot so the direction reads instantly.
  const fx = x + Math.cos(angle) * radius * 0.55;
  const fy = y + Math.sin(angle) * radius * 0.55;
  ctx.fillStyle = visor;
  ctx.beginPath();
  ctx.arc(fx, fy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle - 0.5) * radius, y + Math.sin(angle - 0.5) * radius);
  ctx.lineTo(x + Math.cos(angle) * (radius + 7), y + Math.sin(angle) * (radius + 7));
  ctx.lineTo(x + Math.cos(angle + 0.5) * radius, y + Math.sin(angle + 0.5) * radius);
  ctx.stroke();
}

function drawActors(ctx, state) {
  for (const cam of state.cameras) {
    ctx.fillStyle = PALETTE.camera;
    ctx.strokeStyle = '#4a2f9e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cam.x + Math.cos(cam.angle) * 5, cam.y + Math.sin(cam.angle) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const g of state.guards) {
    drawActor(ctx, g.x, g.y, g.angle, g.radius, PALETTE.guard, PALETTE.guardEdge, '#ffd9d7');
    if (g.state !== 'patrol') {
      ctx.fillStyle = g.state === 'chase' ? '#e6322d' : '#ff8c28';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.state === 'chase' ? '!' : '?', g.x, g.y - g.radius - 8);
    }
  }
  const p = state.player;
  // Sneaking shows a dashed ring around the player.
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(14, 154, 167, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  drawActor(ctx, p.x, p.y, p.angle, p.radius, PALETTE.player, PALETTE.playerEdge, '#e6fbff');
}

function drawHud(ctx, state, bestMs) {
  // Top bar.
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, 10, 10, WIDTH - 20, 52, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('SHADOW PROTOCOL', 24, 28);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  const objective = state.exitOpen
    ? 'Exit is open — reach the green pad unseen'
    : `Collect intel ${state.intelGot}/${state.intelTotal} to unlock the exit`;
  ctx.fillText(objective, 24, 48);

  // Detection meter.
  const mx = WIDTH - 330;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SEEN', mx, 28);
  ctx.fillStyle = '#22384a';
  roundRect(ctx, mx + 46, 20, 150, 14, 7);
  ctx.fill();
  const d = state.detection;
  ctx.fillStyle = d >= 0.75 ? '#e6322d' : d >= 0.35 ? '#ff8c28' : '#ffc53d';
  if (d > 0.01) {
    roundRect(ctx, mx + 46, 20, Math.max(10, 150 * d), 14, 7);
    ctx.fill();
  }
  ctx.fillStyle = state.alert === 'alarm' ? '#ff6b66' : state.alert === 'suspicious' ? '#ffb066' : PALETTE.hudDim;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(state.alert.toUpperCase(), mx + 204, 28);

  // Timer + intel.
  const secs = Math.floor(state.time);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${mm}:${ss}`, WIDTH - 24, 28);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(`INTEL ${state.intelGot}/${state.intelTotal}`, WIDTH - 24, 48);
  if (bestMs > 0) {
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Best clear: ${formatMs(bestMs)}`, WIDTH / 2, HEIGHT - 14);
  }
  // Controls hint.
  ctx.fillStyle = 'rgba(16, 34, 48, 0.75)';
  roundRect(ctx, 10, HEIGHT - 34, 470, 24, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD / arrows move · Shift sneak · P pause · M mute · R restart', 20, HEIGHT - 22);
}

export function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(Math.floor((ms % 1000) / 100))}`;
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(10, 26, 38, 0.52)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const w = 620;
  const h = 130 + lines.length * 30;
  const x = (WIDTH - w) / 2;
  const y = (HEIGHT - h) / 2;
  ctx.fillStyle = 'rgba(16, 34, 48, 0.96)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(title, WIDTH / 2, y + 52);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '16px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, WIDTH / 2, y + 102 + i * 30);
  });
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  function draw(state, screen, bestMs, stats) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawLevel(ctx, state);
    drawCones(ctx, state);
    drawActors(ctx, state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(ctx, state, bestMs);
    }
    if (screen === SCREEN_TITLE) {
      overlay(ctx, 'SHADOW PROTOCOL', [
        'Sneak through the facility. Grab all 3 intel, then reach the EXIT unseen.',
        'Guards and cameras watch with vision cones — crates and walls block their sight.',
        'Walk slow with Shift to stay hidden. If the meter fills, they chase you.',
        '',
        'Press SPACE or click to start',
      ], PALETTE.accent);
    } else if (screen === SCREEN_PAUSED) {
      overlay(ctx, 'PAUSED', ['Press P or click to keep sneaking.'], PALETTE.accent);
    } else if (screen === SCREEN_WIN) {
      const rating = stats.detections === 0 && state.intelGot === state.intelTotal
        ? 'GHOST — never seen'
        : state.intelGot === state.intelTotal ? 'SHADOW — clean run' : 'OPERATIVE';
      overlay(ctx, 'CLEAR!', [
        `Time ${formatMs(stats.ms)}  ·  Intel ${state.intelGot}/${state.intelTotal}  ·  Alarms ${stats.detections}`,
        `Rating: ${rating}`,
        stats.best ? 'New best time!' : `Best time: ${formatMs(stats.bestMs)}`,
        '',
        'Press R or click to play again',
      ], PALETTE.exit);
    } else if (screen === SCREEN_OVER) {
      overlay(ctx, 'CAUGHT', [
        'A guard caught you in the open.',
        `You had ${state.intelGot}/${state.intelTotal} intel after ${formatMs(stats.ms)}.`,
        '',
        'Press R or click to try again',
      ], '#ff6b66');
    }
  }

  return { draw };
}
