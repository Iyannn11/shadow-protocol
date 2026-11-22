# shadow-protocol

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Iyannn11/shadow-protocol/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Iyannn11/shadow-protocol/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Shadow Protocol** — a complete top-down stealth game that runs offline in a desktop browser. Sneak through a guarded facility, grab all 3 intel, then reach the EXIT unseen. Guards patrol with raycast vision cones that bend around walls and crates; security cameras sweep the halls. Walk slow with Shift to stay hidden — if the detection meter fills, the guards chase you down.

- Guards with visible vision cones, patrol routes, suspicious + alarm states, and chase AI
- Cover (crates and walls) that blocks both movement and sight
- 2 sweeping security cameras, 3 intel pickups, a locked exit, win/lose screens
- HUD with objective, detection meter, alert state, timer and intel count
- WebAudio synth sounds (pickup, spotted, alarm, win) — M to mute
- Keyboard (WASD/arrows, Shift to sneak, P pause, R restart) and touch drag to move

## Run it

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080
```

Screenshots are staged from the game's own code with `?shot=start|play|alert|win&seed=1` (see `shots.json`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=jef0vgd5&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
