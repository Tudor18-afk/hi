# NEXUS ARENA

A first-person deathmatch against AI operators. You drop into a warehouse killbox with up to eight bots that hunt, take cover, reload, and fight each other. First to **20 frags** wins.

## Play

This is a single-player match against AI bots. There is no online lobby or join code.

1. Serve the folder (browsers need a local server for the game files):
   ```bash
   python3 -m http.server 8080
   ```
2. Open [http://localhost:8080](http://localhost:8080)
3. Click **PLAY**. The match starts immediately — mouse lock is optional. On a phone, use the on-screen stick and FIRE button.

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

Bots are free-for-all opponents, not teammates. Each one rolls an archetype:

- **Rusher** — closes distance and sprays
- **Soldier** — mid-range, trades fairly
- **Sniper** — holds angles, slower fire
- **Lurker** — peeks cover and waits

They path around the map, react to gunfire, and break line of sight when they are hurt.
