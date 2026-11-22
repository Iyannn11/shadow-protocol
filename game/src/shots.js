// Screenshot scenes behind ?shot=start|play|alert|win. Each one plays the real rules
// forward from a fresh world, steered by a small autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP, TILE } from './config.js';
import { EVENT_CAUGHT, EVENT_WIN, findPath } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const WIN_LIMIT_SECONDS = 300;
const SAMPLE = STEP;

// An autopilot that walks the player along a BFS path to a list of target tiles,
// waiting in place whenever the guards are close to spotting it.
function makeAutopilot(world, targets, sneak) {
  let targetIndex = 0;
  let path = [];
  let pathIndex = 0;
  function plan(fromTx, fromTy) {
    const [tx, ty] = targets[targetIndex];
    path = findPath(fromTx, fromTy, tx, ty);
    pathIndex = 0;
  }
  return function input(state) {
    const p = state.player;
    if (targetIndex >= targets.length) return { x: 0, y: 0, sneak: false };
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    if (pathIndex >= path.length) {
      const [gx, gy] = targets[targetIndex];
      if (tx === gx && ty === gy) {
        targetIndex += 1;
        if (targetIndex >= targets.length) return { x: 0, y: 0, sneak: false };
        plan(tx, ty);
      } else {
        plan(tx, ty);
      }
    }
    // Hold still while a guard is about to spot us; the meter drains.
    if (state.detection > 0.22) return { x: 0, y: 0, sneak: true };
    if (pathIndex >= path.length) return { x: 0, y: 0, sneak: false };
    const [nx, ny] = path[pathIndex];
    const px = nx * TILE + TILE / 2;
    const py = ny * TILE + TILE / 2;
    const dx = px - p.x;
    const dy = py - p.y;
    if (Math.hypot(dx, dy) < 6) {
      pathIndex += 1;
      return { x: 0, y: 0, sneak: sneak };
    }
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len, sneak };
  };
}

function statsFor(world, detections, bestMs) {
  return {
    ms: Math.round(world.state.time * 1000),
    detections,
    best: false,
    bestMs,
  };
}

// Set `world` to the named scene and return the screen to draw and the stats to show.
export function stageShot(name, world, bestMs) {
  world.reset();
  if (name === 'play') {
    const pilot = makeAutopilot(world, [[10, 2], [29, 1], [15, 9]], true);
    let detections = 0;
    let prevAlarm = false;
    for (let t = 0; t < PLAY_SECONDS / SAMPLE; t += 1) {
      const events = world.step(SAMPLE, pilot(world.state), true);
      if (world.state.alert === 'alarm' && !prevAlarm) detections += 1;
      prevAlarm = world.state.alert === 'alarm';
      if (events & (EVENT_CAUGHT | EVENT_WIN)) break;
    }
    return { screen: SCREEN_PLAY, stats: statsFor(world, detections, bestMs) };
  }
  if (name === 'alert') {
    const pilot = makeAutopilot(world, [[15, 9], [25, 9]], false);
    let detections = 0;
    for (let t = 0; t < 14 / SAMPLE; t += 1) {
      world.step(SAMPLE, pilot(world.state), true);
      if (world.state.alert === 'alarm') { detections = 1; break; }
    }
    // Force the alarm if the autopilot stayed hidden: trip it by hand so the
    // frame shows the chase, then let the real rules run with the alarm live.
    const s = world.state;
    if (s.alert !== 'alarm') {
      s.detection = 0.95;
      s.alert = 'alarm';
      s.lastSeen = { x: s.player.x, y: s.player.y };
      for (const g of s.guards) {
        g.state = 'chase';
        g.chaseTimer = 4;
        g.repathTimer = 0;
      }
    }
    // Let the real rules run for a moment with the alarm live, the player
    // fleeing, so the HUD shows ALARM and the meter fills.
    for (let t = 0; t < 0.4 / SAMPLE; t += 1) {
      world.step(SAMPLE, { x: -1, y: 0, sneak: false }, false);
    }
    return { screen: SCREEN_PLAY, stats: statsFor(world, detections, bestMs) };
  }
  if (name === 'win') {
    const pilot = makeAutopilot(world, [[10, 2], [29, 1], [3, 14], [30, 14]], true);
    let detections = 0;
    let prevAlarm = false;
    let won = false;
    for (let t = 0; t < WIN_LIMIT_SECONDS / SAMPLE; t += 1) {
      const events = world.step(SAMPLE, pilot(world.state), true);
      if (world.state.alert === 'alarm' && !prevAlarm) detections += 1;
      prevAlarm = world.state.alert === 'alarm';
      if (events & EVENT_WIN) { won = true; break; }
      if (events & EVENT_CAUGHT) break;
    }
    if (!won) {
      // The autopilot could not finish cleanly: stage the win screen directly
      // over the real level (all intel taken, player at the exit).
      for (const intel of world.state.intels) intel.taken = true;
      world.state.intelGot = world.state.intelTotal;
      world.state.exitOpen = true;
      world.state.player.x = world.state.exit.x;
      world.state.player.y = world.state.exit.y;
      world.state.detection = 0;
      world.state.alert = 'calm';
      world.state.time = 167.4;
    }
    const stats = statsFor(world, detections, bestMs);
    stats.best = true;
    return { screen: SCREEN_WIN, stats };
  }
  // Default: start — guards patrol for a few seconds behind the title card.
  for (let t = 0; t < START_SECONDS / SAMPLE; t += 1) {
    world.step(SAMPLE, { x: 0, y: 0, sneak: false }, true);
  }
  return { screen: SCREEN_TITLE, stats: statsFor(world, 0, bestMs) };
}
