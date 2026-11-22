// Input: keyboard (WASD/arrows + Shift sneak), mouse click, and touch drag.
// Actions are edge-triggered and consumed once via takeActions().
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let touchId = null;
  let touchStart = null;
  let touchMove = { x: 0, y: 0 };

  function keyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyR') actions |= ACTION_RESTART;
    if (e.code === 'KeyM') actions |= ACTION_MUTE;
  }
  function keyUp(e) {
    keys.delete(e.code);
  }
  function onClick() {
    actions |= ACTION_CONFIRM;
  }
  function onTouchStart(e) {
    const t = e.changedTouches[0];
    touchId = t.identifier;
    touchStart = { x: t.clientX, y: t.clientY };
    touchMove = { x: 0, y: 0 };
    e.preventDefault();
  }
  function onTouchMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId) continue;
      touchMove = { x: (t.clientX - touchStart.x) / 40, y: (t.clientY - touchStart.y) / 40 };
    }
    e.preventDefault();
  }
  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId) continue;
      touchId = null;
      touchMove = { x: 0, y: 0 };
    }
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (touchId !== null) {
      x += Math.max(-1, Math.min(1, touchMove.x));
      y += Math.max(-1, Math.min(1, touchMove.y));
    }
    return { x, y, sneak: keys.has('ShiftLeft') || keys.has('ShiftRight') };
  }

  function takeActions() {
    const a = actions;
    actions = 0;
    return a;
  }

  return { direction, takeActions };
}
