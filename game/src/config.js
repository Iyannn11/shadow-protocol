// SHADOW PROTOCOL — config: constants, level map, palette.
// A bright top-down stealth level: 32 x 18 tiles of 40 px, exactly 1280 x 720.
// Legend: # wall, . floor, C crate (cover: blocks movement and sight),
// P player start, I intel pickup, E exit, G guard spawn (patrols defined below).
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const WIDTH = COLS * TILE; // 1280
export const HEIGHT = ROWS * TILE; // 720
export const STEP = 1 / 60;

export const MAP = [
  '################################',
  '#P.....#......#.........#....I.#',
  '#......#..I...#....C....#......#',
  '#..C...#......#.........#...C..#',
  '#......#..C...#....C....#......#',
  '####.######.#######.########.###',
  '#..............................#',
  '#..C.......C.......C.......C...#',
  '#..............................#',
  '#.....G......C......G......C...#',
  '#..............................#',
  '#..C.......C.......C.......C...#',
  '####.######.#####.#####.#####.##',
  '#......#.......#...#.......#...#',
  '#..I...#..C....#...#..C....#..E#',
  '#......#.......#...#.......#...#',
  '#......#.......#...#.......#.G.#',
  '################################',
];

// Guard patrols: lists of tile waypoints each guard walks in order, then back.
// Guards pathfind between waypoints on the tile grid, so routes may pass through doors.
export const GUARDS = [
  { tiles: [[6, 9], [15, 9], [25, 9], [15, 9]], speed: 72 },
  { tiles: [[5, 8], [25, 8], [25, 10], [5, 10]], speed: 78 },
  { tiles: [[28, 16], [28, 13], [23, 13], [23, 16]], speed: 66 },
];

// Wall-mounted security cameras: fixed tile, sweep around a base angle.
export const CAMERAS = [
  { tile: [16, 0], baseAngle: Math.PI / 2, sweep: 0.9, period: 5.0, phase: 0 },
  { tile: [0, 12], baseAngle: 0, sweep: 0.8, period: 6.0, phase: 2.1 },
];

export const PLAYER_SPEED = 168; // px/s walking
export const SNEAK_SPEED = 108; // px/s sneaking (Shift) — harder to spot
export const GUARD_PATROL_SPEED = 72;
export const GUARD_CHASE_SPEED = 132;
export const GUARD_RADIUS = 13;
export const PLAYER_RADIUS = 13;

// Vision: guards see 190 px ahead in a 70-degree cone; cameras 175 px, 60 degrees.
export const GUARD_RANGE = 190;
export const GUARD_HALF_ANGLE = (35 * Math.PI) / 180;
export const CAMERA_RANGE = 175;
export const CAMERA_HALF_ANGLE = (30 * Math.PI) / 180;

// Detection meter 0..1. Fills while seen (faster up close, slower while sneaking),
// drains while unseen. 0.35 = suspicious (guard turns to look), 0.75 = alarm.
export const DETECT_FILL = 0.85; // per second at point blank
export const DETECT_FILL_FAR = 0.35; // per second at max range
export const SNEAK_FACTOR = 0.45; // sneak multiplies the fill rate
export const CAMERA_FILL = 0.55;
export const DETECT_DRAIN = 0.3;
export const SUSPICIOUS_AT = 0.35;
export const ALARM_AT = 0.75;
export const ALARM_MEMORY = 4.0; // seconds a guard keeps hunting after losing sight
export const CATCH_DIST = 26; // px: a chasing guard this close catches the player

export const BEST_KEY = 'shadow-protocol-best-ms';

// Bright, readable palette — no dark muddy frames.
export const PALETTE = {
  floorA: '#dde7ec',
  floorB: '#d3dfe6',
  floorLine: '#c3d2da',
  wall: '#41586b',
  wallTop: '#5d7a92',
  wallEdge: '#2e4152',
  crate: '#c9903f',
  crateEdge: '#9a6a24',
  crateLine: '#a87c2e',
  player: '#0e9aa7',
  playerEdge: '#076b75',
  guard: '#d64541',
  guardEdge: '#96221f',
  camera: '#7a5fd0',
  coneCalm: 'rgba(255, 190, 60, 0.30)',
  coneSuspicious: 'rgba(255, 140, 40, 0.38)',
  coneAlarm: 'rgba(230, 50, 45, 0.42)',
  coneCamera: 'rgba(150, 110, 255, 0.30)',
  intel: '#f5b90c',
  intelEdge: '#a67c00',
  exit: '#22b573',
  exitEdge: '#0f7a48',
  exitLocked: '#8a97a3',
  hudBg: 'rgba(16, 34, 48, 0.88)',
  hudText: '#eaf4f8',
  hudDim: '#9fc0cc',
  accent: '#ffc53d',
};
