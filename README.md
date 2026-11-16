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
| Star Formation | Clear → generate | 1980s-style vertical shooter (arcade / MSX2 / PC-8801 look: pixel sprites, pixel font, scanlines, chiptune music). Enemy squadrons fly in, line up, then dive at you. Between stages, navigator Rina talks in an adventure-game style window. Clear all 3 stages to generate the ending scene with her. |

Controls: `← →` / `A D` move, `Space` / `Z` shot, `Esc` / `P` pause, `Space` / `Z` / `Enter` / click to advance dialogue. A gamepad also works.

The game returns these prompts to Workflow Studio (all in `web/games/shooter/stages.json`):

| Source | Example |
|---|---|
| `style` | `retro artstyle, 1980s (style), pc-98 (style), pixel art, dithering, limited palette, anime coloring` |
| `character` | Rina's look (`1girl, long blue hair, ponytail, amber eyes, white uniform, headset ...`) |
| `scene` | The ending scene (only when cleared) |
| `clear` | One prompt per cleared stage |

It also returns `negative` (`3d, realistic, photorealistic, blurry, modern`), which Workflow Studio adds to the negative prompt.

All music, sprites, story and characters are original.

## Requirements

- ComfyUI Workflow Studio with Game tab support
- The image is generated with the workflow chosen in the Game tab settings (default: `ws_game_sdxl_t2i.json`)

## Adding a game

Create `web/games/<id>/` with:

- `game.json` — `name` / `description` (`en` / `ja` / `zh`), `entry` (default `index.js`), `modes`, `order`
- `index.js` — `export async function mount(container, host)` returning `{ unmount, pause, resume, restart }`

`host.settings` carries `difficulty`, `sound` and `bgm`. When the game ends, call `host.finish(result)`:

```json
{
  "gameId": "shooter",
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
