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

| Sky Heart | Clear → generate | 1980s-style into-the-screen flying shooter (pseudo-3D striped ground with a grid, chiptune music). Hikari of the sky patrol flies a jet pack through 5 stages - flower plains, crystal canyon, sunset sea, neon sky city, moon ruins - each ending with a boss (Twin Wing, Prism Core, Sky Fortress, Neon Giant, Star Tyrant). Your shots fly straight into the screen, so line up with an enemy to hit it; dodge enemy bullets and the trees, crystals, rocks, towers and columns on the ground (fly over or around them). 3 lives (5 on easy). Same image system as the other games: a victory shot per stage, a private photo if you catch all 5 hearts, the ending scene, and a defeat scene. |

Sky Heart controls: `← → ↑ ↓` / `WASD` move, hold `Space` / `Z` to shoot, `Esc` / `P` pause, `Space` / `Z` / `Enter` / click to advance dialogue. A gamepad also works (stick / D-pad, A to shoot).

Sky Heart details: the altimeter on the left shows your height (and pink marks for the height of incoming hearts). Each stage has 5 hearts in the air and 5 more just above the ground - catch any 5 for the private photo. Missile launchers sit on the ground (3 in stage 1, one more each stage); they fire at you when you get close (twice from stage 3), hurt you if you hit them, and can be destroyed by flying low and shooting them. Power-up capsules (4 per stage, alternating in the air and on the ground; also shown on the altimeter in their color): green **1UP** (one extra life, at most one per stage), blue **barrier** (blocks 3 hits, up to 5; shown as a ring with dots), orange **support** (two round support mechs appear beside you and fire the same shots for 15 seconds). Barrier and support time carry over to the next stage. In stage 4 (Neon Sky City) the buildings can be destroyed with 4 shots.

| Smash Heart | Clear → generate | 1980s-style tennis seen from behind your court (perspective court in meters, ball physics with bounce per surface). Nanami plays 5 rivals one by one - Kurumi (steady baseliner), Hinata (lob master), Gloria (power hitter), Shion (net rusher), Elena (champion) - each on her own court (park hard court, clay, grass, indoor arena, night stadium). A match is 4 games (normal 15-30-40-deuce scoring); more games wins, 2-2 is a draw and you choose rematch or quit. Each rival and Nanami talk before and after the match (pep talk, winner's and loser's lines). Touch the hearts that appear on your court (5 per match) for the private photo. No music: recorded sounds (racket hits, bounces, net, applause, cheering, crowd ambience) and synthesized shoe squeaks plus the umpire's score calls and serve shouts by the browser's speech synthesis. |

Smash Heart controls: `← → ↑ ↓` move, `Z` / `Space` shot, `X` lob; hold `← →` at contact to aim, `↑` for a deep fast shot, `↓` for a drop shot. Serve: `Z` to toss, `Z` again to hit — hit near the top of the toss for a fast, accurate serve (two faults = double fault). A yellow ring marks where the rival's ball will land. Rivals let balls that are going out pass. The sound effects in `web/games/tennis/sfx/` were generated locally with Stable Audio 3; the shoe squeaks are synthesized in the game (`squeak.js`). On a serve the ball is tossed straight above the racket hand and hit at the top of the toss.

Shared code lives in `web/common/` (`audio.js` PSG-style sound engine with engine noise and sample playback (`loadSamples` / `addSynthSample` / `playSample` / `startLoop`), `retro.js` pixel font / dialogue window / pixel textures).

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
