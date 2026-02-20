# PewPewPew 2.0

**Play it here:** [pewpewpew2.0](http://marvyn.com/pewpewpew2.0/)


## Abilities (Powerups)

Spawn randomly on the map every 10–15 seconds. Fly over them to collect.

| Name | Effect |
|------|--------|
|Health | Restore 1 HP (up to max) |
| Trishot | Fire 3 bullets per shot for 6 seconds |
| Minigun | Rapid fire at 120ms rate with recoil for 5 seconds |
| Freeze | All enemies stop moving for 4 seconds |
| Nuke | Instantly destroy all on-screen enemies |
| Missile | Fire explosive missiles that kill all nearby enemies on impact for 8 seconds |
| Shield | Absorb the next enemy hit without losing HP |
| Magnet | Pull all XP orbs and powerups within 200px toward you for 8 seconds |

Abilities stack where applicable — e.g. Minigun + Trishot fires 3 rapid bullets, Minigun + Missile fires rapid missiles.

---

## Player Upgrades

Awarded on level up — choose 1 of 3 randomly offered upgrades. XP is dropped by defeated enemies.

| Name | Effect |
|------|--------|
| Speed Boost | Max speed +15% |
| Precision | Acceleration +25% (snappier response, no top speed loss) |
| Rapid Fire | Fire rate 15% faster (stacks, applies to all fire modes) |
| Big Shots | Bullet radius +1 |
| Fast Shots | Bullet travel speed +20% |
| +1 Max HP | Gain 1 max HP and immediately restore 1 HP |
| Reach | Pickup radius +15px for XP orbs and powerups |

---

## Bosses

Bosses appear sequentially, each 60 seconds after the previous is defeated. All bosses are slowed to 30% speed by the Freeze powerup, and take 10 damage (but cannot be killed) from Nuke.

---

### The Hunter
**Spawns:** 60 seconds into the game

| Mode | Behaviour |
|------|-----------|
| Hunt | Steers toward player, fires a **predictive aimed shot** every 2.5s |
| Windup | Brakes to a stop over 1.8s, charging boosters (immune to knockback) |
| Dash | Launches at 900 px/s in a straight line toward the player's locked position |

---

### The Fighter
**Spawns:** 60s after The Hunter

| Mode | Behaviour |
|------|-----------|
| Defend | Orbits player at distance, **dodges incoming bullets** sideways, fires **lazy homing missiles** every 3s |
| Attack | Chases player, fires a **3-bullet spread** every 1.8s, periodically **forward dashes** at 740 px/s |

Modes alternate every 11s. On phase switch, homing missiles lose tracking and fly straight.

---

### The Mothership
**Spawns:** 60s after the previous boss

| Mode | Behaviour |
|------|-----------|
| Fortify | **Immune** (shield active). Stops moving, fires a **rotating ring** of 10 bullets every 1.5s, **spawns 2 enemy minions** every 3s |
| Siege | Vulnerable. Slowly chases player, fires **expanding shockwave rings** every 4s that damage on contact |

**Phase 2 (≤50% HP):** Ring has 14 bullets every 1s, 4 minions per wave. Siege fires 2 staggered shockwaves + a 3-bullet spread per cooldown.

---

### The Phantom
**Spawns:** 60s after the previous boss

| Mode | Behaviour |
|------|-----------|
| Ghost | Semi-transparent. **Teleports** every 2s to a random position, firing a **ring of 8 bullets** + 1 targeted bullet on each arrival |
| Anchor | Stationary. Shows a **laser sight line** for 0.65s then fires a **fast sniper shot** (600 px/s) every 2.2s |

**Phase 2 (≤50% HP):** Teleports every 1.2s, ring doubles to 16 bullets + a predictive bullet. Anchor adds a **sweeping laser beam** that rotates across the arena and damages on contact.

---

### The Sniper
**Spawns:** 60s after the previous boss

| Mode | Behaviour |
|------|-----------|
| Retreat | Flees from the player. Shows a **laser sight line** for 0.6s then fires a **fast sniper shot** (580 px/s) every 2.5s |
| Suppress | Holds position. Fires a **6-bullet shotgun burst** if the player gets within 220px (1.8s cooldown), otherwise fires instant sniper shots every 2s |

**Phase 2 (≤50% HP):** Retreat fires 2 simultaneous shots — one at current position, one predictive. Shotgun burst also spawns 4 slow lingering bullets that persist for 3s.

---

### The Berserker
**Spawns:** 60s after the previous boss

| Mode | Behaviour |
|------|-----------|
| Brawl | Aggressively chases player, fires a **3-bullet spread** every 1.6s |
| Taunt | Stops and flashes. **Immune** for 2s, then fires a **16-bullet omnidirectional burst** |

**Phase 2 (≤50% HP, permanent):** Modes are replaced entirely.
| Mode | Behaviour |
|------|-----------|
| Frenzy | Speed jumps to 500 px/s, **bounces off walls**, fires a **12-bullet 360° spray** every 0.8s while chasing |
| Rampage | Immunity shortened to 0.8s, fires a **24-bullet burst**, then immediately **dashes** at 750 px/s toward the player |

HP bar turns red and the boss visually shakes when enraged.

---

### The Swarm Queen
**Spawns:** 60s after the previous boss

| Mode | Behaviour |
|------|-----------|
| Nest | **Immune** (shield active). Retreats to the nearest corner, spawns **3 minion waves** (one wave every 3.5s), fires an **outward spiral** of 6 bullets every 1.2s |
| Hunt | Vulnerable. Chases player, fires **homing minion-missiles** every 3s — missiles home in lazily and **spawn 1 enemy** at the point of impact |

**Phase 2 (≤50% HP):** Spawns 5 minions per wave every 2.8s, dual spiral (two directions at once). Missiles spawn 2 enemies on impact.

**On death:** Only half of all remaining minions are destroyed. The other half go **berserk** (2× speed) for 5 seconds before returning to normal.

---

## To Do:
- [x] disable arrow key page movement
- [ ] add mobile support
- [x] add firebase leaderboard
- [x] for the bosses the freeze power up should slow it
- [x] nuke does a bit of damage instead of nothing to bosses

## Ayden's To Do:
- [ ] Two more backgrounds, sun/fire themed and ice/comet themed
- [ ] Character (jet/plane) sprites
- [ ] Boss sprites
- [ ] Enemy sprites
- [ ] Power up sprites maybe (yes please!!)?
- [ ] Bullet sprites
- [ ] Pewpewpew lore
