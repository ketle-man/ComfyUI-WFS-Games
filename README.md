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

| Turbo Heart | Clear → generate | 1980s-style behind-the-car racer (pseudo-3D road, same retro look). 5 races along the coast - seaside highway, autumn mountain pass, desert canyon at sunset, neon city at night, tropical coast at dawn. 8 cars; you start last and must finish in the top 3 to advance (4th or worse is game over). Nitro (3 per race), speed lines, overtakes. Mechanic Misaki talks between races. Same image system as Star Formation: a victory shot of Misaki per race, a private photo if you pick up all 5 hearts on the road, the ending scene, and a defeat scene. |

Turbo Heart controls: `← →` steer, `↑` / `Z` gas, `↓` / `X` brake, `Space` / `C` nitro, `Esc` / `P` pause. A gamepad also works (A gas, B brake, X nitro).

Turbo Heart obstacles: stacked cardboard boxes (2 per race, same place every time) block part of the road and hide what's behind — driving through smashes them and slows you down; an oil slick (1 per race) spins the car around twice with no control; a person may cross the road (0 or 1, random every play) — hitting them is game over (shown only as ACCIDENT!; the dialogue says they were unhurt). Rivals steer around all of them.

| Prompt Typer | Typing → generate | 1980s-style typing game (no music, sound effects only). Type in **English, Japanese or Chinese** (pick on the title screen; Japanese and Chinese are typed through your IME, and the characters you confirm are used as they are - a wrong kanji conversion counts as a typo and stays in the prompt). 10 stages of 20 words; words get longer every 2 stages (3-6 → 6-10 → 10-15 → 15-22 → 22-32 letters). Each stage is a scene (morning cafe, flower field, seaside town ... starry observatory). Every key you press goes into the word, so **what you type becomes the image prompt as it is, typos included**. `Backspace` fixes the current word (not finished words), but a typo you made still counts as a miss. 85% correct characters clears the stage. An image is generated after every stage whether you clear it or not, and you can retry a stage as often as you like. The ending image joins the first word of every stage as you typed it. |

Prompt Typer controls: `↑ ↓` on the title picks the typing language, `← →` the start stage (stages you have reached), `Enter` start / next, `R` retry, `Q` give up (on a failed stage), `Esc` pause. English: type letters / numbers / space with the IME off (only `a-z 0-9 space ' . -` are accepted). Japanese / Chinese: type into the input box with your IME and confirm; converting is free; one confirmed chunk only goes into the current word (confirming an unconverted reading doesn't spill into the next word), and `Backspace` with an empty input box deletes from the current word. Japanese words with kanji show their reading above them, the words use the spelling an IME gives by default, and hiragana / katakana count as the same letter (こーひー = コーヒー). Prompt symbols `( ) : { } | _ , [ ] < > \` are dropped in every language, so typos can't create prompt weights or wildcards. Note: Japanese / Chinese prompts need an image model that understands those languages (the default SDXL workflow mostly doesn't). The words and letter counts per stage are in `web/games/typing/stages.json` (`words.en / ja / zh`, `tiers.en / ja / zh`).

Shared code lives in `web/common/` (`audio.js` PSG-style sound engine with engine noise, `retro.js` pixel font / dialogue window / pixel textures).

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
