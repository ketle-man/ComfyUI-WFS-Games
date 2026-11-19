"""ComfyUI-WFS-Games

Workflow Studio (WFS) 用のゲームパック。
このパッケージ自体は ComfyUI のノードを持たず、次の2つのルートを登録するだけ:

  GET /wfs_games/manifest      ... インストール済みゲームの一覧 (WFS がこれで検出する)
  GET /wfs_games/static/...    ... ゲーム本体の JS / アセット (web/ 配下)

ゲームは WFS の Game タブに動的 import され、`mount(container, host)` で起動する。
画像生成は WFS 側が行い、ゲームは結果 (クリア/スコア/報酬プロンプト) を返すだけ。
"""

import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

API_VERSION = 1
PACKAGE_VERSION = "0.4.1"

WEB_DIR = Path(__file__).parent / "web"
GAMES_DIR = WEB_DIR / "games"
STATIC_PREFIX = "/wfs_games/static"

_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
# game.json の entry / thumbnail はゲームフォルダ内の相対ファイル名のみ許可
_REL_FILE_RE = re.compile(r"^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}(/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}){0,3}$")


def _safe_rel(value):
    return isinstance(value, str) and _REL_FILE_RE.match(value) and ".." not in value


def _load_games():
    games = []
    if not GAMES_DIR.is_dir():
        return games
    for game_dir in sorted(p for p in GAMES_DIR.iterdir() if p.is_dir()):
        meta_path = game_dir / "game.json"
        if not meta_path.is_file():
            continue
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning("[WFS-Games] invalid game.json in %s: %s", game_dir.name, e)
            continue
        gid = game_dir.name
        entry = meta.get("entry", "index.js")
        if not _ID_RE.match(gid) or not _safe_rel(entry) or not (game_dir / entry).is_file():
            logger.warning("[WFS-Games] skipped game folder: %s", gid)
            continue
        item = {
            "id": gid,
            "name": meta.get("name") or {"en": gid},
            "description": meta.get("description") or {},
            "version": meta.get("version", ""),
            "entry": f"{STATIC_PREFIX}/games/{gid}/{entry}",
            "modes": meta.get("modes") or ["clear"],
            "order": meta.get("order", 100),
        }
        thumb = meta.get("thumbnail")
        if _safe_rel(thumb) and (game_dir / thumb).is_file():
            item["thumbnail"] = f"{STATIC_PREFIX}/games/{gid}/{thumb}"
        games.append(item)
    games.sort(key=lambda g: (g["order"], g["id"]))
    return games


def _register_routes():
    from aiohttp import web
    from server import PromptServer  # type: ignore

    app = PromptServer.instance.app

    async def handle_manifest(request):
        return web.json_response(
            {"api_version": API_VERSION, "package_version": PACKAGE_VERSION, "games": _load_games()},
            headers={"Cache-Control": "no-store"},
        )

    app.router.add_get("/wfs_games/manifest", handle_manifest)
    # aiohttp の add_static は配下外へのトラバーサルを拒否する (follow_symlinks=False)
    app.router.add_static(STATIC_PREFIX, str(WEB_DIR))
    logger.info("[WFS-Games] routes registered (%d games)", len(_load_games()))


try:
    _register_routes()
except Exception as _e:  # ComfyUI 外での import (テスト等) では何もしない
    print(f"[WARNING] ComfyUI-WFS-Games: route registration skipped: {_e}")

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
