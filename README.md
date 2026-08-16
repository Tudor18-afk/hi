# DEAD AHEAD

First-person zombie survival in a small abandoned town. Hold the crossroads, clear waves, and do not let the horde close in.

## Play

Serve the folder (modules will not load from `file://`):

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Click | Fire |
| R | Reload |
| Shift | Sprint |
| Space | Jump |
| Esc | Pause / release mouse |

## Zombie movement

Zombies chase the **player's world position** at a fixed meters-per-second speed. Camera yaw/pitch never feeds their AI, so turning to look around will not make them sprint away from your crosshair.
