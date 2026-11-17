# ComfyUI-WFS-Games (experimental)

A game pack for [ComfyUI Workflow Studio](https://github.com/ketle-man/ComfyUI-Workflow-Studio).
When this pack is installed, Workflow Studio shows a **Game** tab. Play a game, clear it, and Workflow Studio generates an image from the prompts you earned.

This package adds no ComfyUI nodes. It only serves the games:

| Route | Purpose |
|---|---|
| `GET /wfs_games/manifest` | List of installed games (Workflow Studio uses it to detect the pack) |
| `GET /wfs_games/static/...` | Game scripts and assets (`web/`) |

## Games

| Game | Mode | Description |
|---|---|---|
| Star Formation | Clear → generate | 1980s-style vertical shooter (arcade / MSX2 / PC-8801 look: pixel sprites, pixel font, scanlines, chiptune music). 5 stages. Enemy squadrons fly in, line up, then dive at you; when they are all down, a stage boss appears (WARNING, boss music). Between stages, navigator Rina talks in an adventure-game style window. Five flashing enemies per stage drop memory hearts; catch all 5 and that stage's image becomes a private photo of Rina (more casual each stage, up to a swimsuit) instead of the victory shot. A victory shot of her is generated at every other stage clear, the ending scene when you clear all 5, and a defeat scene on game over. |

Controls: `← →` / `A D` move, `Space` / `Z` shot, `Esc` / `P` pause, `Space` / `Z` / `Enter` / click to advance dialogue. A gamepad also works.

The game returns these prompts to Workflow Studio (all in `web/games/shooter/stages.json`):

| Source | Example |
|---|---|
| `style` | `retro artstyle, 1980s (style), pc-98 (style), pixel art, dithering, limited palette, anime coloring` |
| `character` | Rina's look (`1girl, long blue hair, ponytail, amber eyes, white uniform, headset ...`) |
| `scene` | Rina's victory shot (`scene_prompt` of the stage), the ending (`prompts.ending`) or the defeat scene (`prompts.gameover`) |
| `clear` | The stage's background (`clear_prompt`) |

It also returns `negative` (`3d, realistic, photorealistic, blurry, modern`), which Workflow Studio adds to the negative prompt.

Bosses (`boss` in each stage):

| Stage | Type | Behaviour |
|---|---|---|
| 1 | `basic` | Stage-1 enemy at 2x size, 24 HP, aimed shots |
| 2 | `basic` | 3x size, moves 1.5x faster, bullets 2x faster |
| 3 | `radial` | Stronger stage-2 boss that also fires radial bursts |
| 4 | `charge` | Flashes, then rams straight at you with acceleration |
| 5 | `carrier` | 5x size, 60 HP, launches 5 small fighters 3 times |

All music, sprites, story and characters are original.

## Install

```
cd ComfyUI/custom_nodes
git clone https://github.com/ketle-man/ComfyUI-WFS-Games
```

Restart ComfyUI and open Workflow Studio (`/wfm`). The **Game** tab appears next to TagSpace.

## Requirements

- [ComfyUI Workflow Studio](https://github.com/ketle-man/ComfyUI-Workflow-Studio) v0.10.0 or later
- The image is generated with the workflow chosen in the Game tab settings (default: `ws_game_sdxl_t2i.json`, included in Workflow Studio's `workflows/` folder — import it from the Workflow tab and set an SDXL checkpoint you have)

## Adding a game

Create `web/games/<id>/` with:

- `game.json` — `name` / `description` (`en` / `ja` / `zh`), `entry` (default `index.js`), `modes`, `order`
- `index.js` — `export async function mount(container, host)` returning `{ unmount, pause, resume, restart }`

`host.settings` carries `difficulty`, `sound` and `bgm`. Optional calls: `host.runStart()` when a new play starts from the title (Workflow Studio clears the image cards) and `host.stageClear(result)` at each stage clear (`kind: "stage"`; Workflow Studio generates that stage's image in the background). When the game ends, call `host.finish(result)` (`kind: "ending"` or `"gameover"`; both carry rewards, and Workflow Studio generates the ending or the defeat scene):

```json
{
  "gameId": "shooter",
  "kind": "stage",
  "stage": 1,
  "stageName": "Nebula Gate",
  "cleared": true,
  "score": 12340,
  "negative": "3d, realistic",
  "rewards": [{ "type": "prompt", "text": "purple nebula", "weight": 1, "source": "clear" }]
}
```

Games never call ComfyUI directly. Workflow Studio builds the prompt and runs the generation.

## Third-party

- [Phaser](https://phaser.io/) 4.2.1 (MIT) — `web/vendor/phaser/`
- [DotGothic16](https://github.com/fontworks-fonts/DotGothic16) (SIL Open Font License 1.1) — `web/vendor/fonts/`
