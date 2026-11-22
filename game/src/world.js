// SHADOW PROTOCOL — world: state, fixed-step simulation, guards, vision, detection.
// The level is a tile grid; movement is smooth pixel motion with circle-vs-tile
// collision. Guards patrol by BFS pathfinding on the grid, see through raycast
// vision cones, and chase when the alarm trips. Cameras sweep fixed cones.
import {
  ALARM_AT, ALARM_MEMORY, CAMERAS, CAMERA_FILL, CAMERA_HALF_ANGLE, CAMERA_RANGE,
  CATCH_DIST, COLS, DETECT_DRAIN, DETECT_FILL, DETECT_FILL_FAR, GUARDS, GUARD_CHASE_SPEED,
  GUARD_HALF_ANGLE, GUARD_PATROL_SPEED, GUARD_RANGE, GUARD_RADIUS, MAP, PLAYER_RADIUS,
  PLAYER_SPEED, ROWS, SNEAK_FACTOR, SNEAK_SPEED, SUSPICIOUS_AT, TILE,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2; // detection crossed into suspicious
export const EVENT_ALARM = 4; // detection crossed into alarm
export const EVENT_CAUGHT = 8;
export const EVENT_WIN = 16;

const TAU = Math.PI * 2;

export function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return MAP[ty][tx];
}

export function isSolidTile(tx, ty) {
  const c = tileAt(tx, ty);
  return c === '#' || c === 'C';
}

// True when the pixel point is inside a solid tile.
export function solidAtPx(x, y) {
  return isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE));
}

// BFS path on the tile grid from tile a to tile b (4-directional, walkable tiles
// only). Returns an array of tile coords excluding the start, including the goal.
export function findPath(ax, ay, bx, by) {
  if (ax === bx && ay === by) return [];
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const queue = [[ax, ay]];
  prev.set(key(ax, ay), null);
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (isSolidTile(nx, ny)) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, [x, y]);
      if (nx === bx && ny === by) {
        const path = [];
        let cur = [bx, by];
        while (cur) {
          path.unshift(cur);
          cur = prev.get(key(cur[0], cur[1]));
        }
        path.shift(); // drop the start tile
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return [];
}

// Raycast from (x, y) along angle: distance to the first solid tile, capped at max.
// Steps in small increments so thin walls are never skipped.
export function castRay(x, y, angle, max) {
  const step = 5;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  for (let d = step; d <= max; d += step) {
    px += dx;
    py += dy;
    if (solidAtPx(px, py)) return d;
  }
  return max;
}

// True when nothing solid blocks the segment from (x0, y0) to (x1, y1).
export function hasLineOfSight(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const steps = Math.ceil(dist / 6);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (solidAtPx(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Move a circle (x, y, radius) by (dx, dy), sliding along solid tiles.
function moveCircle(body, dx, dy) {
  const r = body.radius;
  let nx = body.x + dx;
  if (dx !== 0) {
    const edge = dx > 0 ? nx + r : nx - r;
    const top = Math.floor((body.y - r + 1) / TILE);
    const bottom = Math.floor((body.y + r - 1) / TILE);
    const tx = Math.floor(edge / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      if (isSolidTile(tx, ty)) {
        nx = dx > 0 ? tx * TILE - r - 0.01 : (tx + 1) * TILE + r + 0.01;
        break;
      }
    }
  }
  body.x = nx;
  let ny = body.y + dy;
  if (dy !== 0) {
    const edge = dy > 0 ? ny + r : ny - r;
    const left = Math.floor((body.x - r + 1) / TILE);
    const right = Math.floor((body.x + r - 1) / TILE);
    const ty = Math.floor(edge / TILE);
    for (let tx = left; tx <= right; tx += 1) {
      if (isSolidTile(tx, ty)) {
        ny = dy > 0 ? ty * TILE - r - 0.01 : (ty + 1) * TILE + r + 0.01;
        break;
      }
    }
  }
  body.y = ny;
}

function scanMap() {
  let player = null;
  const intels = [];
  let exit = null;
  const guardSpawns = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const c = MAP[y][x];
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      if (c === 'P') player = { x: cx, y: cy };
      else if (c === 'I') intels.push({ x: cx, y: cy, taken: false, pulse: 0 });
      else if (c === 'E') exit = { x: cx, y: cy };
      else if (c === 'G') guardSpawns.push({ x: cx, y: cy });
    }
  }
  return { player, intels, exit, guardSpawns };
}

export function createWorld(random) {
  const scanned = scanMap();
  const state = {
    time: 0,
    player: {
      x: scanned.player.x, y: scanned.player.y, radius: PLAYER_RADIUS,
      angle: -Math.PI / 2, moving: false, sneaking: false, speed: 0,
    },
    guards: GUARDS.map((def, i) => ({
      x: scanned.guardSpawns[i].x, y: scanned.guardSpawns[i].y,
      radius: GUARD_RADIUS, angle: 0, waypoint: 1, path: [], pathIndex: 0,
      state: 'patrol', // patrol | suspicious | chase
      lookTimer: 0, chaseTimer: 0, repathTimer: 0, speed: def.speed,
      tiles: def.tiles, defSpeed: def.speed,
    })),
    cameras: CAMERAS.map((def) => ({
      x: def.tile[0] * TILE + TILE / 2,
      y: def.tile[1] * TILE + TILE / 2,
      angle: def.baseAngle, baseAngle: def.baseAngle,
      sweep: def.sweep, period: def.period, phase: def.phase,
    })),
    intels: scanned.intels,
    intelGot: 0,
    intelTotal: scanned.intels.length,
    exit: scanned.exit,
    exitOpen: false,
    detection: 0,
    alert: 'calm', // calm | suspicious | alarm
    lastSeen: null,
    caught: false,
    won: false,
    steps: 0,
  };

  function reset() {
    const fresh = scanMap();
    state.time = 0;
    state.player.x = fresh.player.x;
    state.player.y = fresh.player.y;
    state.player.angle = -Math.PI / 2;
    state.player.moving = false;
    state.player.sneaking = false;
    state.guards.forEach((g, i) => {
      g.x = fresh.guardSpawns[i].x;
      g.y = fresh.guardSpawns[i].y;
      g.angle = 0;
      g.waypoint = 1;
      g.path = [];
      g.pathIndex = 0;
      g.state = 'patrol';
      g.lookTimer = 0;
      g.chaseTimer = 0;
      g.repathTimer = 0;
      g.speed = g.defSpeed;
    });
    state.intels = fresh.intels;
    state.intelGot = 0;
    state.exitOpen = false;
    state.detection = 0;
    state.alert = 'calm';
    state.lastSeen = null;
    state.caught = false;
    state.won = false;
    state.steps = 0;
  }

  // Follow a tile path: returns the pixel target, or null when the path is done.
  function followPath(guard, dt, speed) {
    if (guard.pathIndex >= guard.path.length) return null;
    const [tx, ty] = guard.path[guard.pathIndex];
    const px = tx * TILE + TILE / 2;
    const py = ty * TILE + TILE / 2;
    const dx = px - guard.x;
    const dy = py - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      guard.pathIndex += 1;
      return followPath(guard, dt, speed);
    }
    const want = Math.atan2(dy, dx);
    guard.angle += angleDiff(want, guard.angle) * Math.min(1, dt * 8);
    const stepLen = Math.min(dist, speed * dt);
    moveCircle(guard, (dx / dist) * stepLen, (dy / dist) * stepLen);
    return { x: px, y: py };
  }

  function setPathTo(guard, tx, ty) {
    const gx = Math.floor(guard.x / TILE);
    const gy = Math.floor(guard.y / TILE);
    guard.path = findPath(gx, gy, tx, ty);
    guard.pathIndex = 0;
  }

  function stepGuard(guard, dt) {
    if (guard.state === 'chase') {
      guard.repathTimer -= dt;
      if (guard.repathTimer <= 0 && state.lastSeen) {
        guard.repathTimer = 0.5;
        setPathTo(guard, Math.floor(state.lastSeen.x / TILE), Math.floor(state.lastSeen.y / TILE));
      }
      const target = followPath(guard, dt, GUARD_CHASE_SPEED);
      if (target === null) {
        // Reached the last seen spot: look around, then give up.
        guard.chaseTimer -= dt;
        guard.angle += dt * 1.6;
        if (guard.chaseTimer <= 0) {
          guard.state = 'patrol';
          setPathTo(guard, guard.tiles[guard.waypoint][0], guard.tiles[guard.waypoint][1]);
        }
      }
      return;
    }
    if (guard.state === 'suspicious') {
      guard.lookTimer -= dt;
      if (guard.lookTimer <= 0) guard.state = 'patrol';
      return;
    }
    // Patrol: walk the waypoint loop.
    if (guard.pathIndex >= guard.path.length) {
      const [wx, wy] = guard.tiles[guard.waypoint];
      const gx = Math.floor(guard.x / TILE);
      const gy = Math.floor(guard.y / TILE);
      if (gx === wx && gy === wy) {
        guard.waypoint = (guard.waypoint + 1) % guard.tiles.length;
      } else {
        setPathTo(guard, wx, wy);
      }
    }
    followPath(guard, dt, guard.defSpeed);
  }

  // How much the player is seen by one watcher (guard or camera) this step:
  // 0 when outside the cone or behind cover, up to 1 at point blank.
  function seenBy(wx, wy, angle, range, halfAngle) {
    const dx = state.player.x - wx;
    const dy = state.player.y - wy;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return 0;
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(toPlayer, angle)) > halfAngle) return 0;
    if (!hasLineOfSight(wx, wy, state.player.x, state.player.y)) return 0;
    return 1 - (dist / range) * 0.6;
  }

  function step(dt, input, attract) {
    state.time += dt;
    state.steps += 1;
    let events = EVENT_NONE;

    // --- player movement ---
    const p = state.player;
    const ix = input.x;
    const iy = input.y;
    const mag = Math.hypot(ix, iy);
    p.sneaking = input.sneak && mag > 0;
    p.moving = mag > 0.05;
    if (p.moving) {
      const speed = p.sneaking ? SNEAK_SPEED : PLAYER_SPEED;
      const nx = ix / (mag || 1);
      const ny = iy / (mag || 1);
      p.angle = Math.atan2(ny, nx);
      p.speed = speed;
      moveCircle(p, nx * speed * dt, ny * speed * dt);
    } else {
      p.speed = 0;
    }

    // --- intel pickups ---
    for (const intel of state.intels) {
      intel.pulse += dt;
      if (!intel.taken && Math.hypot(intel.x - p.x, intel.y - p.y) < 26) {
        intel.taken = true;
        state.intelGot += 1;
        events |= EVENT_PICKUP;
        if (state.intelGot >= state.intelTotal) state.exitOpen = true;
      }
    }

    // --- exit ---
    if (state.exitOpen && Math.hypot(state.exit.x - p.x, state.exit.y - p.y) < 26) {
      state.won = true;
      return events | EVENT_WIN;
    }

    // --- cameras sweep ---
    for (const cam of state.cameras) {
      cam.angle = cam.baseAngle + Math.sin((state.time + cam.phase) * (TAU / cam.period)) * cam.sweep;
    }

    // --- detection ---
    let seen = 0;
    let seer = null;
    for (const g of state.guards) {
      const s = seenBy(g.x, g.y, g.angle, GUARD_RANGE, GUARD_HALF_ANGLE);
      if (s > seen) { seen = s; seer = g; }
    }
    let camSeen = 0;
    for (const cam of state.cameras) {
      const s = seenBy(cam.x, cam.y, cam.angle, CAMERA_RANGE, CAMERA_HALF_ANGLE);
      if (s > camSeen) camSeen = s;
    }
    const prevAlert = state.alert;
    if (seen > 0) {
      const rate = DETECT_FILL_FAR + (DETECT_FILL - DETECT_FILL_FAR) * seen;
      state.detection += rate * (p.sneaking ? SNEAK_FACTOR : 1) * dt;
      state.lastSeen = { x: p.x, y: p.y };
      if (seer && state.detection >= SUSPICIOUS_AT && state.detection < ALARM_AT) {
        seer.state = 'suspicious';
        seer.lookTimer = 1.2;
        seer.angle += angleDiff(Math.atan2(p.y - seer.y, p.x - seer.x), seer.angle) * Math.min(1, dt * 6);
      }
    } else if (camSeen > 0) {
      state.detection += CAMERA_FILL * camSeen * dt;
      state.lastSeen = { x: p.x, y: p.y };
    } else {
      state.detection = Math.max(0, state.detection - DETECT_DRAIN * dt);
    }
    state.detection = Math.min(1, state.detection);
    state.alert = state.detection >= ALARM_AT ? 'alarm'
      : state.detection >= SUSPICIOUS_AT ? 'suspicious' : 'calm';
    if (prevAlert !== 'suspicious' && state.alert === 'suspicious') events |= EVENT_SPOTTED;
    if (prevAlert !== 'alarm' && state.alert === 'alarm') {
      events |= EVENT_ALARM;
      for (const g of state.guards) {
        g.state = 'chase';
        g.chaseTimer = ALARM_MEMORY;
        g.repathTimer = 0;
      }
    }
    if (state.alert !== 'alarm') {
      // A lone suspicious guard keeps staring; patrol guards walk on.
    } else if (state.lastSeen) {
      for (const g of state.guards) {
        if (g.state !== 'chase') {
          g.state = 'chase';
          g.chaseTimer = ALARM_MEMORY;
          g.repathTimer = 0;
        }
      }
    }

    // --- guards move ---
    for (const g of state.guards) stepGuard(g, dt);

    // --- caught? ---
    if (state.alert === 'alarm') {
      for (const g of state.guards) {
        if (Math.hypot(g.x - p.x, g.y - p.y) < CATCH_DIST) {
          state.caught = true;
          return events | EVENT_CAUGHT;
        }
      }
    }

    // Title-screen attract mode: guards patrol, no player.
    if (attract) {
      state.detection = 0;
      state.alert = 'calm';
    }
    return events;
  }

  return { state, step, reset };
}
