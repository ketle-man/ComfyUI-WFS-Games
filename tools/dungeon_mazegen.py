"""
Dungeon Heart の階の迷路を作る(種つきで毎回同じ結果)
- 7×7 の部屋をつないだ 15×15 の迷路(深さ優先)+ ところどころ壁を抜いて輪を作る
- 物はすべて行き止まりに置く(置いても道がふさがらない)
- S(階段/祭壇)= 開始からいちばん遠い行き止まり、その手前の通路 = B(ボス)
- L(鍵の扉)= 開始→B の道の途中で、そこを通らないと B に行けない通路。k(鍵)は L の手前の行き止まり
- ? (隠し壁)= 行き止まりへの入口の通路。その奥にハート
条件を満たす種が見つかるまで試す。
"""
import random, json, sys
from collections import deque

N = 7          # 部屋の数(1辺)
W = 2 * N + 1  # 15


def gen(seed, loops):
    rnd = random.Random(seed)
    g = [["#"] * W for _ in range(W)]
    cell = lambda cx, cy: (2 * cx + 1, 2 * cy + 1)
    seen = {(0, 0)}
    st = [(0, 0)]
    g[1][1] = "."
    while st:
        # 成長木: 半分は最後の部屋(長い通路)、半分はランダムな部屋(枝分かれ・行き止まりが増える)
        idx = len(st) - 1 if rnd.random() < 0.5 else rnd.randrange(len(st))
        cx, cy = st[idx]
        nb = [(cx + dx, cy + dy, dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= cx + dx < N and 0 <= cy + dy < N and (cx + dx, cy + dy) not in seen]
        if not nb:
            st.pop(idx); continue
        nx, ny, dx, dy = rnd.choice(nb)
        x, y = cell(cx, cy)
        g[y + dy][x + dx] = "."
        X, Y = cell(nx, ny)
        g[Y][X] = "."
        seen.add((nx, ny)); st.append((nx, ny))
    # 輪を作る
    walls = [(x, y) for y in range(1, W - 1) for x in range(1, W - 1) if g[y][x] == "#" and ((x % 2 == 0 and y % 2 == 1) or (x % 2 == 1 and y % 2 == 0))]
    rnd.shuffle(walls)
    for x, y in walls[:loops]:
        g[y][x] = "."
    return g


def nbrs(g, x, y):
    return [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if g[y + dy][x + dx] != "#"]


def bfs(g, start, block=()):
    dist = {start: 0}
    prev = {}
    q = deque([start])
    while q:
        p = q.popleft()
        for n in nbrs(g, *p):
            if n in dist or n in block:
                continue
            dist[n] = dist[p] + 1
            prev[n] = p
            q.append(n)
    return dist, prev


def build(seed, loops, hearts=5, chests=4, need_stairs=True, rotate=0, traps=2):
    g = gen(seed, loops)
    start = (1, 1)
    dist, prev = bfs(g, start)
    dead = [p for p in dist if p != start and len(nbrs(g, *p)) == 1 and p[0] % 2 == 1 and p[1] % 2 == 1]
    if len(dead) < hearts + chests + 3:
        return None
    dead.sort(key=lambda p: -dist[p])
    S = dead[0]
    B = nbrs(g, *S)[0]  # S の手前(通路)
    # 開始→B の道
    path = []
    p = B
    while p != start:
        path.append(p); p = prev[p]
    path.reverse()
    # L: 道の後半で、そこをふさぐと B に行けない通路(偶数座標を含む通路マス)
    L = None
    for q in path[len(path) // 2:-2]:
        if (q[0] % 2 == 0) == (q[1] % 2 == 0):
            continue  # 部屋ではなく、部屋と部屋の間の通路だけ
        d2, _ = bfs(g, start, block={q})
        if B not in d2:
            L = q; break
    if not L:
        return None
    before, _ = bfs(g, start, block={L})
    rest = [p for p in dead[1:] if p not in (S,)]
    # 鍵は L の手前の行き止まり(開始から近すぎない)
    kcands = [p for p in rest if p in before and dist[p] >= 6]
    if not kcands:
        return None
    k = kcands[len(kcands) // 2]
    rest.remove(k)
    # 隠し壁: 行き止まりの入口(通路マス)を ? に。奥にハート
    secret = None
    for p in rest:
        q = nbrs(g, *p)[0]
        if (q[0] % 2 == 0) != (q[1] % 2 == 0) and q not in path and q != L:
            secret = (p, q); break
    if not secret:
        return None
    rest.remove(secret[0])
    if len(rest) < hearts - 1 + chests + 1:
        return None
    # 泉: 開始からの距離が真ん中くらい
    rest.sort(key=lambda p: dist[p])
    F = rest.pop(len(rest) // 2)
    rnd = random.Random(seed * 7 + 1)
    rnd.shuffle(rest)
    H = [secret[0]] + rest[:hearts - 1]
    T = rest[hearts - 1:hearts - 1 + chests]
    m = [r[:] for r in g]
    m[start[1]][start[0]] = "@"
    m[S[1]][S[0]] = "S" if need_stairs else "A"
    m[B[1]][B[0]] = "B"
    m[L[1]][L[0]] = "L"
    m[k[1]][k[0]] = "k"
    m[secret[1][1]][secret[1][0]] = "?"
    m[F[1]][F[0]] = "F"
    for p in H: m[p[1]][p[0]] = "H"
    for p in T: m[p[1]][p[0]] = "T"
    # 罠・回転床: 通路の上(分かれ道でない2方向のマス)
    corr = [p for p in dist if m[p[1]][p[0]] == "." and len(nbrs(g, *p)) == 2 and dist[p] > 3 and p not in path[-3:]]
    rnd.shuffle(corr)
    for p in corr[:traps]: m[p[1]][p[0]] = "^"
    # 回転床は分かれ道(3方向以上)に置くと迷いやすい
    cross = [p for p in dist if m[p[1]][p[0]] == "." and len(nbrs(g, *p)) >= 3 and dist[p] > 2]
    rnd.shuffle(cross)
    for p in cross[:rotate]: m[p[1]][p[0]] = "R"
    rows = ["".join(r) for r in m]
    return {"seed": seed, "map": rows, "chests": [list(p) for p in T], "trap_cells": [list(p) for p in corr[:traps]], "path_len": len(path)}


if __name__ == "__main__":
    specs = [
        ("B2", dict(loops=4, chests=4, rotate=0, traps=2)),
        ("B3", dict(loops=5, chests=4, rotate=3, traps=1)),
        ("B4", dict(loops=4, chests=4, rotate=0, traps=3)),
        ("B5", dict(loops=5, chests=4, rotate=1, traps=2, need_stairs=False)),
    ]
    out = {}
    base = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    for i, (name, kw) in enumerate(specs):
        for seed in range(base + i * 1000, base + i * 1000 + 5000):
            r = build(seed, **kw)
            if r and r["path_len"] >= 22:
                out[name] = r
                break
        print(name, out[name]["seed"], "path", out[name]["path_len"])
        print("\n".join(out[name]["map"]))
    json.dump(out, open(sys.argv[2] if len(sys.argv) > 2 else "maps_gen.json", "w"), indent=1)
