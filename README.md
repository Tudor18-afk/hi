# NEXUS ARENA

A first-person deathmatch. Fight AI bots, other people online, or both. First to **20 frags** wins.

## Play

```bash
npm install
npm start
```

Then open [http://localhost:8765](http://localhost:8765).

### Local
1. Leave **LOCAL** selected.
2. Set **AI BOTS** to `0` for an empty arena, or 1–8 for bot opponents.
3. Click **PLAY**.

### Online
1. Click **ONLINE**.
2. Set bots (the room host’s value is used; `0` means humans only).
3. **CREATE ROOM** and share the 4-letter code.
4. Friends open the **same site**, click **ONLINE**, type the code, and **JOIN**.

Everyone must be on the same running `npm start` server (or the shared preview URL). Mouse lock is optional. On a phone, use the stick and FIRE button.

## Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Look | Mouse |
| Fire | Left mouse |
| Sprint | `Shift` |
| Jump | `Space` |
| Crouch | `C` |
| Reload | `R` |
| Scoreboard | `Tab` |
| Pause | `Esc` |

## AI

Bots are free-for-all opponents. Each one rolls an archetype: rusher, soldier, sniper, or lurker.
