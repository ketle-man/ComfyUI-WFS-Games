import sys
def check(M, name):
    h, w = len(M), len(M[0])
    assert all(len(r) == w for r in M), (name, [len(r) for r in M])
    assert all(c == '#' for c in M[0] + M[-1]) and all(r[0] == '#' and r[-1] == '#' for r in M), name + ' border'
    pos = {}
    for z, r in enumerate(M):
        for x, c in enumerate(r):
            pos.setdefault(c, []).append((x, z))
    def reach(passable):
        (sx, sz), = pos['@']
        seen = {(sx, sz)}; st = [(sx, sz)]
        while st:
            x, z = st.pop()
            for dx, dz in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, nz = x+dx, z+dz
                if (nx, nz) not in seen and M[nz][nx] in passable:
                    seen.add((nx, nz)); st.append((nx, nz))
        return seen
    adj = lambda cells, s: [c for c in cells if any((c[0]+dx, c[1]+dz) in s for dx, dz in ((1,0),(-1,0),(0,1),(0,-1)))]
    base = '.@i^RD'
    noLB = reach(base); full = reach(base + 'L?BS')
    print(f"{name}: H {len(adj(pos.get('H',[]), full))}/{len(pos.get('H',[]))} (no L/?/B: {len(adj(pos.get('H',[]), noLB))})",
          f"| T {len(adj(pos.get('T',[]), full))}/{len(pos.get('T',[]))} | F {len(adj(pos.get('F',[]), full))}/{len(pos.get('F',[]))}",
          f"| k before L: {len(adj(pos.get('k',[]), reach(base+'?')))}/{len(pos.get('k',[]))}",
          f"| B reachable {[p for p in pos.get('B',[]) if p in reach(base+'L?B')]}",
          f"| S w/o B {[p for p in pos.get('S',[]) if p in reach(base+'L?S')]} with B {[p for p in pos.get('S',[]) if p in full]}",
          f"| dead floor {[p for c in '.^Ri' for p in pos.get(c,[]) if p not in full]}")
if __name__ == '__main__':
    import json
    d = json.load(open(sys.argv[1], encoding='utf-8'))
    for f in d['floors']: check(f['map'], f['name']['en'])
