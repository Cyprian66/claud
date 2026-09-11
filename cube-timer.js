(() => {
  'use strict';

  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const MODS = ['', "'", '2'];

  // =====================================================================
  //  Puzzle geometry engine
  //  Every sticker is a polygon on a regular polyhedron. A move rotates the
  //  centroids of the selected stickers around an axis and the colors follow
  //  the centroids to their new positions. Nets are unfolded along shared edges.
  // =====================================================================
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => V.scale(a, 1 / V.len(a)),
    eq: (a, b, eps) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps && Math.abs(a[2] - b[2]) < eps,
    centroid: pts => V.scale(pts.reduce((a, p) => V.add(a, p), [0, 0, 0]), 1 / pts.length),
    rot(p, k, th) { // Rodrigues rotation of p around unit axis k by th (right-hand rule)
      const c = Math.cos(th), s = Math.sin(th);
      return V.add(V.add(V.scale(p, c), V.scale(V.cross(k, p), s)), V.scale(k, V.dot(k, p) * (1 - c)));
    },
  };
  const P2 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
    scale: (a, s) => [a[0] * s, a[1] * s],
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    norm: a => { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; },
    inter(p, d, q, e) { // p + t d = q + s e
      const den = d[0] * e[1] - d[1] * e[0];
      const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
      return [p[0] + d[0] * t, p[1] + d[1] * t];
    },
  };

  // face: outward normal from its centroid (polyhedron centered at origin), CCW from outside
  function makeFace(name, verts, color) {
    const center = V.centroid(verts);
    const n = V.norm(center);
    const cr = V.cross(V.sub(verts[1], verts[0]), V.sub(verts[2], verts[0]));
    if (V.dot(cr, n) < 0) verts = verts.slice().reverse();
    const u = V.norm(V.sub(verts[0], center));
    const v = V.cross(n, u);
    const to2 = p => { const d = V.sub(p, center); return [V.dot(d, u), V.dot(d, v)]; };
    const to3 = q => V.add(center, V.add(V.scale(u, q[0]), V.scale(v, q[1])));
    return { name, n, center, verts, color, to2, to3, local: verts.map(to2) };
  }

  // ---- sticker subdivisions in face-local 2D ----
  function quadGrid(Q, n) {
    const P = (s, t) => P2.add(Q[0], P2.add(P2.scale(P2.sub(Q[1], Q[0]), s), P2.scale(P2.sub(Q[3], Q[0]), t)));
    const out = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
      out.push([P(i / n, j / n), P((i + 1) / n, j / n), P((i + 1) / n, (j + 1) / n), P(i / n, (j + 1) / n)]);
    return out;
  }
  function triGrid(T, n) {
    const [A, B, C] = T;
    const P = (i, j) => P2.add(A, P2.add(P2.scale(P2.sub(B, A), i / n), P2.scale(P2.sub(C, A), j / n)));
    const out = [];
    for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) {
      out.push([P(i, j), P(i + 1, j), P(i, j + 1)]);
      if (i + j < n - 1) out.push([P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]);
    }
    return out;
  }
  function skewbStickers(Q) {
    const m = Q.map((q, k) => P2.lerp(q, Q[(k + 1) % 4], 0.5));
    const out = [m];
    for (let k = 0; k < 4; k++) out.push([Q[k], m[k], m[(k + 3) % 4]]);
    return out;
  }
  function pentaStickers(Q, inset) {
    const n = 5, L = [];
    for (let k = 0; k < n; k++) {
      const e = P2.sub(Q[(k + 1) % n], Q[k]);
      const m = P2.norm([-e[1], e[0]]); // inward for CCW
      L.push({ p: P2.add(Q[k], P2.scale(m, inset)), d: e });
    }
    const E = k => ({ p: Q[k], d: P2.sub(Q[(k + 1) % n], Q[k]) });
    const X = (a, b) => P2.inter(a.p, a.d, b.p, b.d);
    const C = [];
    for (let k = 0; k < n; k++) C.push(X(L[(k + 4) % n], L[k]));
    const out = [C.slice()];
    for (let k = 0; k < n; k++) {
      const prev = (k + 4) % n;
      out.push([Q[k], X(L[prev], E(k)), C[k], X(L[k], E(prev))]);              // corner at Q[k]
      out.push([X(L[prev], E(k)), X(L[(k + 1) % n], E(k)), C[(k + 1) % n], C[k]]); // edge k
    }
    return out;
  }

  function buildPuzzle(faces, gen) {
    const stickers = [];
    faces.forEach((f, fi) => gen(f, fi).forEach(poly => {
      stickers.push({ f: fi, poly, c: V.centroid(poly.map(f.to3)) });
    }));
    const byName = {};
    faces.forEach((f, i) => { byName[f.name] = i; });
    return { faces, stickers, byName, solved: stickers.map(s => faces[s.f].color) };
  }

  function applyMove(puz, colors, axis, angle, select) {
    const st = puz.stickers, out = colors.slice();
    for (let i = 0; i < st.length; i++) {
      if (!select(st[i].c)) continue;
      const c2 = V.rot(st[i].c, axis, angle);
      let j = -1;
      for (let k = 0; k < st.length; k++) if (V.eq(st[k].c, c2, 1e-3)) { j = k; break; }
      if (j >= 0) out[j] = colors[i];
    }
    return out;
  }

  // ---- nets ----
  const T2 = {
    apply: (T, p) => [T.c * p[0] - T.s * p[1] + T.x, T.s * p[0] + T.c * p[1] + T.y],
    make: (a, x, y) => ({ c: Math.cos(a), s: Math.sin(a), x, y }),
  };
  function sharedVerts(a, b) {
    return a.verts.filter(p => b.verts.some(q => V.eq(p, q, 1e-6)));
  }
  function computeNet(puz, components) {
    const F = puz.faces, T = new Array(F.length);
    const comps = [];
    for (const comp of components) {
      const root = puz.byName[comp.root];
      const edgeFace = puz.byName[comp.edgeWith];
      const sv = sharedVerts(F[root], F[edgeFace]);
      const mid = F[root].to2(V.centroid(sv));
      const target = comp.dir === 'up' ? Math.PI / 2 : -Math.PI / 2;
      T[root] = T2.make(target - Math.atan2(mid[1], mid[0]), 0, 0);
      const members = [root];
      for (const [pn, cn] of comp.children) {
        const p = puz.byName[pn], c = puz.byName[cn];
        const [v1, v2] = sharedVerts(F[p], F[c]);
        const P1 = F[c].to2(v1), Pt2 = F[c].to2(v2);
        const Q1 = T2.apply(T[p], F[p].to2(v1)), Q2 = T2.apply(T[p], F[p].to2(v2));
        const a = Math.atan2(Q2[1] - Q1[1], Q2[0] - Q1[0]) - Math.atan2(Pt2[1] - P1[1], Pt2[0] - P1[0]);
        const R = T2.make(a, 0, 0), RP = T2.apply(R, P1);
        T[c] = T2.make(a, Q1[0] - RP[0], Q1[1] - RP[1]);
        members.push(c);
      }
      comps.push(members);
    }
    // place components side by side
    let cursor = 0, first = true;
    for (const members of comps) {
      let minX = Infinity, maxX = -Infinity;
      for (const s of puz.stickers) if (members.includes(s.f))
        for (const p of s.poly) { const q = T2.apply(T[s.f], p); minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); }
      const gap = first ? 0 : (maxX - minX) * 0.12;
      const shift = cursor + gap - minX;
      for (const fi of members) T[fi].x += shift;
      cursor = maxX + shift;
      first = false;
    }
    return T;
  }

  const FACE_SHRINK = 0.92; // leaves a small gap between neighbouring faces of the net
  function svgFromPuzzle(puz, colors, net, stroke) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const centers = net.map(T => T2.apply(T, [0, 0]));
    const paths = puz.stickers.map((s, i) => {
      const c = centers[s.f];
      const pts = s.poly.map(p => {
        const q = T2.apply(net[s.f], p);
        return [c[0] + (q[0] - c[0]) * FACE_SHRINK, -(c[1] + (q[1] - c[1]) * FACE_SHRINK)];
      });
      for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      return `<path d="M${pts.map(p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join('L')}Z" fill="${colors[i]}"/>`;
    });
    const pad = stroke;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(minX - pad).toFixed(3)} ${(minY - pad).toFixed(3)} ${(maxX - minX + 2 * pad).toFixed(3)} ${(maxY - minY + 2 * pad).toFixed(3)}"><g stroke="#1c1c1e" stroke-width="${stroke}" stroke-linejoin="round">${paths.join('')}</g></svg>`;
  }

  // ---- concrete puzzles ----
  const CUBE_COLORS = { U: '#f4f4f2', D: '#f6d34a', F: '#4cbb6c', B: '#4a8df0', R: '#e5555b', L: '#f5923e' };
  const CUBE_N = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
  function cubeFaces(h) {
    return Object.keys(CUBE_N).map(name => {
      const n = CUBE_N[name];
      const a = Math.abs(n[1]) === 1 ? [1, 0, 0] : [0, 1, 0];
      const b = V.cross(n, a);
      const verts = [V.add(V.add(n, a), b), V.add(V.sub(n, a), b), V.sub(V.sub(n, a), b), V.sub(V.add(n, a), b)].map(p => V.scale(p, h));
      return makeFace(name, verts, CUBE_COLORS[name]);
    });
  }
  const CUBE_NET = [{ root: 'F', edgeWith: 'D', dir: 'down', children: [['F', 'U'], ['F', 'D'], ['F', 'L'], ['F', 'R'], ['R', 'B']] }];

  function makeCube(n) {
    const puz = buildPuzzle(cubeFaces(n / 2), f => quadGrid(f.local, n));
    const net = computeNet(puz, CUBE_NET);
    const step = Math.PI / 2;
    const parse = tok => {
      let m = tok.match(/^(\d)?([UDFBRL])(w)?(['2])?$/);
      if (m) {
        const depth = m[1] ? +m[1] : (m[3] ? 2 : 1);
        const turns = m[4] === "'" ? -1 : m[4] === '2' ? 2 : 1;
        const face = puz.faces[puz.byName[m[2]]];
        return { axis: face.n, angle: -turns * step, select: c => V.dot(c, face.n) > n / 2 - depth };
      }
      m = tok.match(/^([xyz])(['2])?$/);
      if (m) {
        const turns = m[2] === "'" ? -1 : m[2] === '2' ? 2 : 1;
        const axis = { x: CUBE_N.R, y: CUBE_N.U, z: CUBE_N.F }[m[1]];
        return { axis, angle: -turns * step, select: () => true };
      }
      return null;
    };
    return { puz, net, parse, stroke: 0.07 };
  }

  function makeSkewb() {
    const puz = buildPuzzle(cubeFaces(1), f => skewbStickers(f.local));
    const net = computeNet(puz, CUBE_NET);
    const r3 = 1 / Math.sqrt(3);
    // Fixed corner notation: the corners not touching UFR.
    const AX = { R: [r3, -r3, -r3], L: [-r3, -r3, r3], U: [-r3, r3, -r3], B: [-r3, -r3, -r3] };
    const parse = tok => {
      const m = tok.match(/^([RLUB])(')?$/);
      if (!m) return null;
      const axis = AX[m[1]];
      return { axis, angle: (m[2] ? 1 : -1) * 2 * Math.PI / 3, select: c => V.dot(c, axis) > 0 };
    };
    return { puz, net, parse, stroke: 0.05 };
  }

  function makePyraminx() {
    const r = 2 * Math.SQRT2 / 3, s3 = Math.sqrt(3) / 2;
    const VX = { U: [0, 1, 0], L: [-r * s3, -1 / 3, r / 2], R: [r * s3, -1 / 3, r / 2], B: [0, -1 / 3, -r] };
    const faces = [
      makeFace('F', [VX.U, VX.L, VX.R], '#4cbb6c'),
      makeFace('L', [VX.U, VX.B, VX.L], '#e5555b'),
      makeFace('R', [VX.U, VX.R, VX.B], '#4a8df0'),
      makeFace('D', [VX.L, VX.B, VX.R], '#f6d34a'),
    ];
    const puz = buildPuzzle(faces, f => triGrid(f.local, 3));
    const net = computeNet(puz, [{ root: 'F', edgeWith: 'D', dir: 'down', children: [['F', 'L'], ['F', 'R'], ['F', 'D']] }]);
    const parse = tok => {
      const m = tok.match(/^([ULRBulrb])(')?$/);
      if (!m) return null;
      const axis = VX[m[1].toUpperCase()];
      const thr = m[1] === m[1].toLowerCase() ? 5 / 9 : 1 / 9; // rows are equally spaced along the vertex axis
      return { axis, angle: (m[2] ? 1 : -1) * 2 * Math.PI / 3, select: c => V.dot(c, axis) > thr };
    };
    return { puz, net, parse, stroke: 0.035 };
  }

  function makeFTO() {
    const NAMES = { 'U': [1, 1, 1], 'F': [-1, 1, 1], 'R': [1, -1, 1], 'L': [1, 1, -1], 'D': [-1, -1, -1], 'B': [1, -1, -1], 'BR': [-1, -1, 1], 'BL': [-1, 1, -1] };
    const COL = { U: '#f4f4f2', F: '#4cbb6c', R: '#e5555b', L: '#9b6bf0', D: '#f6d34a', B: '#4a8df0', BR: '#f5923e', BL: '#a9a9b0' };
    const faces = Object.keys(NAMES).map(name => {
      const s = NAMES[name];
      return makeFace(name, [[s[0], 0, 0], [0, s[1], 0], [0, 0, s[2]]], COL[name]);
    });
    const puz = buildPuzzle(faces, f => triGrid(f.local, 3));
    const net = computeNet(puz, [
      { root: 'U', edgeWith: 'F', dir: 'down', children: [['U', 'F'], ['U', 'L'], ['U', 'R']] },
      { root: 'D', edgeWith: 'B', dir: 'up', children: [['D', 'B'], ['D', 'BL'], ['D', 'BR']] },
    ]);
    const thr = 1 / (3 * Math.sqrt(3));
    const parse = tok => {
      const m = tok.match(/^(BL|BR|[UDFBRL])(')?$/);
      if (!m) return null;
      const face = puz.faces[puz.byName[m[1]]];
      return { axis: face.n, angle: (m[2] ? 1 : -1) * 2 * Math.PI / 3, select: c => V.dot(c, face.n) > thr };
    };
    return { puz, net, parse, stroke: 0.025 };
  }

  function makeMegaminx() {
    const phi = (1 + Math.sqrt(5)) / 2, ip = 1 / phi;
    const normals = [], verts = [];
    for (const a of [1, -1]) for (const b of [1, -1]) {
      normals.push([a, 0, b * phi], [0, a * phi, b], [a * phi, b, 0]); // face centers of this dodecahedron
      verts.push([0, a * ip, b * phi], [a * ip, b * phi, 0], [a * phi, 0, b * ip]);
      for (const c of [1, -1]) verts.push([a, b, c]);
    }
    const nrm = normals.map(V.norm);
    const up = nrm[0]; // U
    const isAdj = (a, b) => Math.abs(V.dot(a, b) - 1 / Math.sqrt(5)) < 1e-6;
    const uNeighbors = nrm.filter(n => isAdj(n, up));
    const fN = uNeighbors[0];
    const frontRaw = V.sub(fN, V.scale(up, V.dot(fN, up)));
    const right = V.norm(V.cross(up, frontRaw));
    const lN = uNeighbors.find(n => isAdj(n, fN) && V.dot(n, right) < 0);
    const named = new Map([[up, 'U'], [V.scale(up, -1), 'D'], [fN, 'F'], [lN, 'L'], [V.scale(fN, -1), 'B']]);
    const PALETTE = ['#f4f4f2', '#4cbb6c', '#e5555b', '#4a8df0', '#f6d34a', '#9b6bf0', '#a9a9b0', '#b8e068', '#f5923e', '#f48fb1', '#3ec9c9', '#c08457'];
    let idx = 0;
    const faces = nrm.map(n => {
      const dots = verts.map(v => V.dot(v, n)), mx = Math.max(...dots);
      const fv = verts.filter((v, i) => dots[i] > mx - 1e-6);
      // order around the normal
      const tmpU = V.norm(V.sub(fv[0], V.scale(n, V.dot(fv[0], n)))), tmpV = V.cross(n, tmpU);
      fv.sort((p, q) => Math.atan2(V.dot(p, tmpV), V.dot(p, tmpU)) - Math.atan2(V.dot(q, tmpV), V.dot(q, tmpU)));
      let name = null;
      for (const [k, v] of named) if (V.eq(k, n, 1e-6)) name = v;
      if (!name) name = 'f' + (idx++);
      return makeFace(name, fv, null);
    });
    // colors: U white, D gray, others in palette order
    let pi = 0;
    faces.forEach(f => { f.color = f.name === 'U' ? PALETTE[0] : f.name === 'D' ? PALETTE[6] : null; });
    faces.forEach(f => { if (!f.color) { while ([0, 6].includes(pi)) pi++; f.color = PALETTE[pi++]; } });
    const [a0, b0] = faces[0].local, e0 = P2.sub(b0, a0), m0 = P2.norm([-e0[1], e0[0]]);
    const ap = -(a0[0] * m0[0] + a0[1] * m0[1]); // apothem: distance from face center to an edge
    const inset = 0.4 * ap;
    const puz = buildPuzzle(faces, f => pentaStickers(f.local, inset));
    const planeDist = V.dot(faces[0].verts[0], faces[0].n);
    const thr = planeDist - inset * Math.sin(Math.PI - Math.acos(-1 / Math.sqrt(5)));
    const children = root => faces.filter(f => isAdj(f.n, faces[puz.byName[root]].n)).map(f => [root, f.name]);
    const net = computeNet(puz, [
      { root: 'U', edgeWith: 'F', dir: 'down', children: children('U') },
      { root: 'D', edgeWith: 'B', dir: 'up', children: children('D') },
    ]);
    const step = 2 * Math.PI / 5;
    const parse = tok => {
      let m = tok.match(/^U(')?$/);
      if (m) { const n = faces[puz.byName.U].n; return { axis: n, angle: (m[1] ? 1 : -1) * step, select: c => V.dot(c, n) > thr }; }
      m = tok.match(/^([RD])(\+\+|--)$/);
      if (m) {
        const n = faces[puz.byName[m[1] === 'R' ? 'L' : 'U']].n; // R++ turns everything except L, D++ everything except U
        return { axis: n, angle: (m[2] === '++' ? 1 : -1) * 2 * step, select: c => V.dot(c, n) < thr };
      }
      return null;
    };
    return { puz, net, parse, stroke: 0.045 };
  }

  const PUZZLE_CACHE = {};
  function getPuzzle(kind) {
    if (!PUZZLE_CACHE[kind]) {
      PUZZLE_CACHE[kind] = kind === 'skewb' ? makeSkewb() : kind === 'pyram' ? makePyraminx() : kind === 'fto' ? makeFTO()
        : kind === 'minx' ? makeMegaminx() : makeCube(parseInt(kind.slice(4), 10));
    }
    return PUZZLE_CACHE[kind];
  }
  function polyhedronSvg(kind, scramble) {
    const P = getPuzzle(kind);
    let colors = P.puz.solved;
    for (const tok of scramble.split(/\s+/).filter(Boolean)) {
      const mv = P.parse(tok);
      if (mv) colors = applyMove(P.puz, colors, mv.axis, mv.angle, mv.select);
    }
    return svgFromPuzzle(P.puz, colors, P.net, P.stroke);
  }

  // ---- Clock ----
  function clockSvg(scramble) {
    let front = new Array(9).fill(0), back = new Array(9).fill(0);
    const PINS = { UL: [0, 0], UR: [0, 2], DL: [2, 0], DR: [2, 2] };
    const SETS = { UR: ['UR'], DR: ['DR'], DL: ['DL'], UL: ['UL'], U: ['UL', 'UR'], R: ['UR', 'DR'], D: ['DL', 'DR'], L: ['UL', 'DL'], ALL: ['UL', 'UR', 'DL', 'DR'] };
    let pinsUp = [];
    for (const tok of scramble.split(/\s+/).filter(Boolean)) {
      if (tok === 'y2') { [front, back] = [back, front]; continue; }
      let m = tok.match(/^(UR|DR|DL|UL|U|R|D|L|ALL)(\d)([+-])$/);
      if (m) {
        const k = (m[3] === '+' ? 1 : -1) * +m[2];
        const cells = new Set();
        for (const p of SETS[m[1]]) {
          const [r, c] = PINS[p];
          const r0 = r === 0 ? 0 : 1, c0 = c === 0 ? 0 : 1;
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) cells.add((r0 + i) * 3 + c0 + j);
          back[r * 3 + (2 - c)] = (back[r * 3 + (2 - c)] - k + 120) % 12;
        }
        for (const i of cells) front[i] = (front[i] + k + 120) % 12;
        continue;
      }
      m = tok.match(/^(UR|DR|DL|UL)$/);
      if (m) pinsUp.push(m[1]);
    }
    const frontPins = Object.keys(PINS).map(p => pinsUp.includes(p));
    const backPins = Object.keys(PINS).map((p, i) => { const [r, c] = PINS[p]; const mirror = Object.keys(PINS).find(q => PINS[q][0] === r && PINS[q][1] === 2 - c); return !pinsUp.includes(mirror); });
    const panel = (vals, pins, ox, body, dial, hand) => {
      let s = `<rect x="${ox - 0.75}" y="-0.75" width="3.5" height="3.5" rx="0.35" fill="${body}"/>`;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const cx = ox + c, cy = r, v = vals[r * 3 + c];
        const a = v * Math.PI / 6;
        s += `<circle cx="${cx}" cy="${cy}" r="0.42" fill="${dial}"/>`;
        for (let h = 0; h < 12; h++) { const t = h * Math.PI / 6; s += `<circle cx="${(cx + 0.36 * Math.sin(t)).toFixed(3)}" cy="${(cy - 0.36 * Math.cos(t)).toFixed(3)}" r="${h === 0 ? 0.045 : 0.022}" fill="${hand}" opacity="${h === 0 ? 1 : 0.5}"/>`; }
        s += `<line x1="${cx}" y1="${cy}" x2="${(cx + 0.3 * Math.sin(a)).toFixed(3)}" y2="${(cy - 0.3 * Math.cos(a)).toFixed(3)}" stroke="${hand}" stroke-width="0.07" stroke-linecap="round"/>`;
        s += `<circle cx="${cx}" cy="${cy}" r="0.05" fill="${hand}"/>`;
      }
      Object.keys(PINS).forEach((p, i) => {
        const [r, c] = PINS[p];
        const px = ox + (c === 0 ? 0.5 : 1.5), py = r === 0 ? 0.5 : 1.5;
        s += pins[i] ? `<circle cx="${px}" cy="${py}" r="0.14" fill="#ffd500" stroke="#000" stroke-width="0.03"/>` : `<circle cx="${px}" cy="${py}" r="0.1" fill="${body}" stroke="${hand}" stroke-width="0.03" opacity="0.6"/>`;
      });
      return s;
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.85 -0.85 7.6 3.7">${panel(front, frontPins, 0, '#1f4fb0', '#f4f4f4', '#101010')}${panel(back, backPins, 3.9, '#dcdcdf', '#1c1c1e', '#f4f4f4')}</svg>`;
  }

  // ---- Square-1 ----
  const SQ1_SIDES = ['#4cbb6c', '#e5555b', '#4a8df0', '#f5923e'];
  function sq1Init() {
    // corner = two 30° slots, edge = one; the vertical cut sits between slot 11 and 0 and between 5 and 6
    const IDS = [0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7];
    const mk = (ud, idBase) => IDS.map((id, i) => ({
      id: id + idBase, ud,
      side: SQ1_SIDES[Math.floor(((15 + 30 * i - 30 + 360) % 360) / 90)], // cube faces span 90° starting at 30°
    }));
    return { top: mk('#f4f4f2', 0), bot: mk('#f6d34a', 100), mid: false };
  }
  function sq1Svg(scramble) {
    const st = sq1Init();
    const rotate = (arr, k) => { const out = new Array(12); for (let i = 0; i < 12; i++) out[(((i + k) % 12) + 12) % 12] = arr[i]; return out; };
    const legal = arr => arr[0].id !== arr[11].id && arr[5].id !== arr[6].id;
    const re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|\//g;
    let m;
    while ((m = re.exec(scramble))) {
      if (m[0] === '/') {
        if (!legal(st.top) || !legal(st.bot)) continue;
        const tr = st.top.slice(0, 6).reverse(), br = st.bot.slice(0, 6).reverse();
        st.top = br.concat(st.top.slice(6));
        st.bot = tr.concat(st.bot.slice(6));
        st.mid = !st.mid;
      } else {
        st.top = rotate(st.top, +m[1]);
        st.bot = rotate(st.bot, +m[2]);
      }
    }
    const layer = (arr, cx, mirror) => {
      const R = 1, R2 = 1.28;
      const pt = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [(cx + (mirror ? -1 : 1) * r * Math.cos(a)).toFixed(3), (r * Math.sin(a)).toFixed(3)]; };
      let s = '';
      for (let i = 0; i < 12; i++) {
        const a0 = 30 * i, a1 = a0 + 30;
        const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [X0, Y0] = pt(R2, a0), [X1, Y1] = pt(R2, a1);
        const sweep = mirror ? 0 : 1;
        s += `<path d="M${cx} 0L${x0} ${y0}A${R} ${R} 0 0 ${sweep} ${x1} ${y1}Z" fill="${arr[i].ud}"/>`;
        s += `<path d="M${x0} ${y0}L${X0} ${Y0}A${R2} ${R2} 0 0 ${sweep} ${X1} ${Y1}L${x1} ${y1}A${R} ${R} 0 0 ${1 - sweep} ${x0} ${y0}Z" fill="${arr[i].side}"/>`;
      }
      for (let i = 0; i < 12; i++) if (arr[i].id !== arr[(i + 11) % 12].id) {
        const [x, y] = pt(R2, 30 * i);
        s += `<line x1="${cx}" y1="0" x2="${x}" y2="${y}" stroke="#1c1c1e" stroke-width="0.06"/>`;
      }
      s += `<circle cx="${cx}" cy="0" r="${R}" fill="none" stroke="#1c1c1e" stroke-width="0.05"/><circle cx="${cx}" cy="0" r="${R2}" fill="none" stroke="#1c1c1e" stroke-width="0.06"/>`;
      s += `<line x1="${cx}" y1="${-R2 - 0.12}" x2="${cx}" y2="${-R2 + 0.15}" stroke="#fff" stroke-width="0.06"/><line x1="${cx}" y1="${R2 - 0.15}" x2="${cx}" y2="${R2 + 0.12}" stroke="#fff" stroke-width="0.06"/>`;
      return s;
    };
    const midBar = `<rect x="-0.9" y="1.55" width="0.9" height="0.28" fill="${SQ1_SIDES[0]}" stroke="#1c1c1e" stroke-width="0.04"/><rect x="0" y="1.55" width="0.9" height="0.28" fill="${st.mid ? SQ1_SIDES[2] : SQ1_SIDES[0]}" stroke="#1c1c1e" stroke-width="0.04"/>`;
    const midBarR = `<rect x="2.1" y="1.55" width="0.9" height="0.28" fill="${st.mid ? SQ1_SIDES[2] : SQ1_SIDES[0]}" stroke="#1c1c1e" stroke-width="0.04"/><rect x="3" y="1.55" width="0.9" height="0.28" fill="${SQ1_SIDES[0]}" stroke="#1c1c1e" stroke-width="0.04"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.45 -1.45 5.9 3.4">${layer(st.top, 0, false)}${layer(st.bot, 3, true)}${midBar}${midBarR}</svg>`;
  }

  // ---- dispatcher ----
  const IMAGE_KIND = {
    '222': 'cube2', '333': 'cube3', '333oh': 'cube3', '333bf': 'cube3', '444': 'cube4', '444bf': 'cube4',
    '555': 'cube5', '555bf': 'cube5', '666': 'cube6', '777': 'cube7',
    'pyram': 'pyram', 'skewb': 'skewb', 'minx': 'minx', 'fto': 'fto', 'clock': 'clock', 'sq1': 'sq1',
  };
  function scrambleSvg(eventId, scramble) {
    const kind = IMAGE_KIND[eventId];
    if (!kind) return '';
    if (kind === 'clock') return clockSvg(scramble);
    if (kind === 'sq1') return sq1Svg(scramble);
    return polyhedronSvg(kind, scramble);
  }
  window.__cubeTimerDebug = { scrambleSvg, getPuzzle, applyMove };

  // =====================================================================
  //  Scramble generators
  // =====================================================================
  const FACES = ['U', 'D', 'R', 'L', 'F', 'B'];
  function genNxN(n, length) {
    const moves = [];
    const maxRun = n >= 4 ? 3 : 2;
    let runAxis = -1, run = [];
    while (moves.length < length) {
      const f = rnd(6), axis = f >> 1;
      let width = 1;
      if (n >= 4) {
        const r = Math.random();
        if (n >= 6 && r < 0.25) width = 3;
        else if (r < 0.5) width = 2;
      }
      const key = FACES[f] + width;
      if (axis === runAxis) {
        if (run.length >= maxRun || run.includes(key)) continue;
        run.push(key);
      } else { runAxis = axis; run = [key]; }
      moves.push((width === 3 ? '3' : '') + FACES[f] + (width > 1 ? 'w' : '') + pick(MODS));
    }
    return moves.join(' ');
  }
  function gen222() {
    const faces = ['R', 'U', 'F'], moves = [];
    let last = null;
    const length = 9 + rnd(3);
    while (moves.length < length) {
      const f = pick(faces);
      if (f === last) continue;
      moves.push(f + pick(MODS));
      last = f;
    }
    return moves.join(' ');
  }
  function orientation(xs, ys) {
    const parts = [];
    if (Math.random() < 0.8) parts.push(pick(xs));
    if (Math.random() < 0.75) parts.push(pick(ys));
    return parts.length ? ' ' + parts.join(' ') : '';
  }
  const gen333bf = () => genNxN(3, 20) + orientation(['Rw', "Rw'", 'Rw2', 'Fw', "Fw'"], ['Uw', "Uw'", 'Uw2']);
  const gen444bf = () => genNxN(4, 40) + orientation(['x', "x'", 'x2', 'z', "z'"], ['y', "y'", 'y2']);
  const gen555bf = () => genNxN(5, 60) + orientation(['x', "x'", 'x2', 'z', "z'"], ['y', "y'", 'y2']);
  function genClock() {
    const v = () => { const n = rnd(12) - 5; return n === 0 ? '0+' : Math.abs(n) + (n > 0 ? '+' : '-'); };
    const a = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'].map(p => p + v());
    const b = ['U', 'R', 'D', 'L', 'ALL'].map(p => p + v());
    const pins = ['UR', 'DR', 'DL', 'UL'].filter(() => Math.random() < 0.5);
    return [...a, 'y2', ...b, ...pins].join(' ');
  }
  function genMinx() {
    const lines = [];
    for (let i = 0; i < 7; i++) {
      const m = [];
      for (let j = 0; j < 10; j++) m.push((j % 2 ? 'D' : 'R') + (Math.random() < 0.5 ? '++' : '--'));
      m.push(Math.random() < 0.5 ? 'U' : "U'");
      lines.push(m.join(' '));
    }
    return lines.join('\n');
  }
  function genCorner(faces, length, mods) {
    const m = [];
    let last = null;
    while (m.length < length) {
      const f = pick(faces);
      if (f === last) continue;
      last = f;
      m.push(f + pick(mods));
    }
    return m;
  }
  function genPyram() {
    const m = genCorner(['U', 'L', 'R', 'B'], 10, ['', "'"]);
    const tips = ['u', 'l', 'r', 'b'].map(t => { const r = rnd(3); return r === 0 ? '' : t + (r === 1 ? '' : "'"); }).filter(Boolean);
    return m.concat(tips).join(' ');
  }
  const genSkewb = () => genCorner(['U', 'L', 'R', 'B'], 11, ['', "'"]).join(' ');
  function genSq1(pairs) {
    let top = [0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7];
    let bot = [8, 8, 9, 10, 10, 11, 12, 12, 13, 14, 14, 15];
    const rot = (arr, k) => { const out = new Array(12); for (let i = 0; i < 12; i++) out[(((i + k) % 12) + 12) % 12] = arr[i]; return out; };
    const ok = arr => arr[0] !== arr[11] && arr[5] !== arr[6];
    const out = [];
    while (out.length < pairs) {
      const a = rnd(12) - 5, b = rnd(12) - 5;
      if (a === 0 && b === 0) continue;
      const t = rot(top, a), bo = rot(bot, b);
      if (!ok(t) || !ok(bo)) continue;
      const tr = t.slice(0, 6).reverse(), br = bo.slice(0, 6).reverse();
      top = br.concat(t.slice(6));
      bot = tr.concat(bo.slice(6));
      out.push(`(${a},${b})`);
    }
    return out.join(' / ');
  }
  const FTO_AXES = [['U', 'D'], ['F', 'B'], ['L', 'BR'], ['R', 'BL']];
  function genFTO(length) {
    const m = [];
    let lastAxis = -1, lastFace = null, run = 0;
    while (m.length < length) {
      const ax = rnd(4), f = FTO_AXES[ax][rnd(2)];
      if (ax === lastAxis) { if (f === lastFace || run >= 2) continue; run++; } else run = 1;
      lastAxis = ax; lastFace = f;
      m.push(f + pick(['', "'"]));
    }
    return m.join(' ');
  }

  const EVENTS = {
    '333':   { name: '3x3x3',                group: 'wca', fmt: 'ao',  insp: true,  scr: () => genNxN(3, 20) },
    '222':   { name: '2x2x2',                group: 'wca', fmt: 'ao',  insp: true,  scr: gen222 },
    '444':   { name: '4x4x4',                group: 'wca', fmt: 'ao',  insp: true,  scr: () => genNxN(4, 40) },
    '555':   { name: '5x5x5',                group: 'wca', fmt: 'ao',  insp: true,  scr: () => genNxN(5, 60) },
    '666':   { name: '6x6x6',                group: 'wca', fmt: 'mo3', insp: true,  scr: () => genNxN(6, 80) },
    '777':   { name: '7x7x7',                group: 'wca', fmt: 'mo3', insp: true,  scr: () => genNxN(7, 100) },
    '333bf': { name: '3x3x3 Blindfolded',  group: 'wca', fmt: 'mo3', insp: false, scr: gen333bf },
    '333oh': { name: '3x3x3 One-Handed',     group: 'wca', fmt: 'ao',  insp: true,  scr: () => genNxN(3, 20) },
    'clock': { name: 'Clock',                group: 'wca', fmt: 'ao',  insp: true,  scr: genClock },
    'minx':  { name: 'Megaminx',             group: 'wca', fmt: 'ao',  insp: true,  scr: genMinx },
    'pyram': { name: 'Pyraminx',             group: 'wca', fmt: 'ao',  insp: true,  scr: genPyram },
    'skewb': { name: 'Skewb',                group: 'wca', fmt: 'ao',  insp: true,  scr: genSkewb },
    'sq1':   { name: 'Square-1',             group: 'wca', fmt: 'ao',  insp: true,  scr: () => genSq1(12 + rnd(3)) },
    '444bf': { name: '4x4x4 Blindfolded',  group: 'wca', fmt: 'mo3', insp: false, scr: gen444bf },
    '555bf': { name: '5x5x5 Blindfolded',  group: 'wca', fmt: 'mo3', insp: false, scr: gen555bf },
    'fto':   { name: 'FTO',                  group: 'other', fmt: 'ao', insp: true, scr: () => genFTO(30) },
  };
  const GROUPS = { wca: 'Official WCA events', other: 'Unofficial' };

  // =====================================================================
  //  State: named sessions, each with its own event and solves
  // =====================================================================
  const STORAGE_KEY = 'cubeTimer.v2';
  const LEGACY_KEY = 'cubeTimer.v1';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  let state = { sessions: [], current: null, inspection: false, hideTime: false, showImage: true, showStats: true, showDiff: true, inputMode: 'timer' };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = Object.assign(state, JSON.parse(raw));
      } else {
        const old = localStorage.getItem(LEGACY_KEY);
        if (old) {
          const v1 = JSON.parse(old);
          state.inspection = !!v1.inspection; state.hideTime = !!v1.hideTime;
          for (const [ev, list] of Object.entries(v1.sessions || {})) {
            if (EVENTS[ev] && list.length) state.sessions.push({ id: uid(), name: EVENTS[ev].name, event: ev, solves: list });
          }
          if (state.sessions.length) state.current = (state.sessions.find(s => s.event === v1.cubeType) || state.sessions[0]).id;
        }
      }
    } catch (e) { /* ignore corrupt storage */ }
    if (!Array.isArray(state.sessions)) state.sessions = [];
    state.sessions = state.sessions.filter(s => s && EVENTS[s.event] && Array.isArray(s.solves));
    if (!state.sessions.length) state.sessions.push({ id: uid(), name: 'Session 1', event: '333', solves: [] });
    if (!state.sessions.some(s => s.id === state.current)) state.current = state.sessions[0].id;
    // every solve belongs to the event it was done in; older data inherits the session's event
    for (const ses of state.sessions) {
      if (ses.type !== 'comp' && ses.type !== 'relay') ses.type = 'normal';
      if (ses.type === 'relay') { ses.relay = (ses.relay || []).filter(e => EVENTS[e]); if (!ses.relay.length) ses.type = 'normal'; }
      if (typeof ses.target !== 'number' || !(ses.target > 0)) ses.target = null;
      for (const sv of ses.solves) if (!EVENTS[sv.event]) sv.event = ses.event;
    }
    delete state.precision;
    if (typeof state.showImage !== 'boolean') state.showImage = true;
    if (typeof state.showStats !== 'boolean') state.showStats = true;
    if (state.inputMode !== 'typing') state.inputMode = 'timer';
    if (typeof state.showDiff !== 'boolean') state.showDiff = true;
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* quota */ } }
  const session = () => state.sessions.find(s => s.id === state.current);
  const allSolves = () => session().solves;
  const solves = allSolves; // a session keeps all its times whatever event is selected
  const event = () => EVENTS[session().event];
  const inspectionActive = () => state.inspection && event().insp;
  const isComp = () => session().type === 'comp';
  const isRelay = () => session().type === 'relay';
  // competition simulation: solves are grouped into rounds (ao5, or mo3 for mean-of-3 events)
  const roundSize = () => event().fmt === 'mo3' ? 3 : 5;
  const roundFn = () => event().fmt === 'mo3' ? meanOf : average;
  const roundLabel = () => event().fmt === 'mo3' ? 'mo3' : 'ao5';
  function rounds(list) {
    const n = roundSize(), out = [];
    for (let i = 0; i < list.length; i += n) {
      const sl = list.slice(i, i + n);
      out.push({ no: out.length + 1, start: i, solves: sl, avg: sl.length === n ? roundFn()(sl) : null });
    }
    if (!out.length || out[out.length - 1].solves.length === n) out.push({ no: out.length + 1, start: list.length, solves: [], avg: null });
    return out;
  }
  const hitTarget = avg => session().target != null && avg != null && isFinite(avg) && avg <= session().target;
  // after 4 of 5 solves: best / worst possible ao5 (5th solve trimmed as best, or as worst/DNF)
  function bpaWpa(four) {
    const v = four.map(effectiveMs).sort((a, b) => a - b);
    const m = arr => arr.includes(Infinity) ? Infinity : arr.reduce((a, b) => a + b, 0) / arr.length;
    return { bpa: m(v.slice(0, 3)), wpa: m(v.slice(1, 4)) };
  }
  const showBpa = r => roundSize() === 5 && r.solves.length === 4;

  // =====================================================================
  //  Formatting & statistics
  // =====================================================================
  function fmt(ms, decimals = 2) {
    if (ms == null || !isFinite(ms)) return 'DNF';
    const total = Math.floor(ms);
    const m = Math.floor(total / 60000);
    const s = (total % 60000) / 1000;
    const sStr = s.toFixed(decimals);
    return m > 0 ? `${m}:${sStr.padStart(decimals + 3, '0')}` : sStr;
  }
  function effectiveMs(solve) {
    if (solve.penalty === 'DNF') return Infinity;
    if (solve.penalty === '+2') return solve.ms + 2000;
    return solve.ms;
  }
  function fmtSolve(solve) {
    if (solve.penalty === 'DNF') return 'DNF';
    return fmt(effectiveMs(solve)) + (solve.penalty === '+2' ? '+' : '');
  }
  function average(list) {
    const n = list.length;
    if (n < 3) return null;
    const vals = list.map(effectiveMs).sort((a, b) => a - b);
    const trim = Math.ceil(n * 0.05);
    if (vals.filter(v => v === Infinity).length > trim) return Infinity;
    const kept = vals.slice(trim, n - trim);
    return kept.reduce((a, b) => a + b, 0) / kept.length;
  }
  function meanOf(list) {
    const vals = list.map(effectiveMs);
    if (vals.includes(Infinity)) return Infinity;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const lastN = (list, n, f) => list.length < n ? null : f(list.slice(-n));
  function bestN(list, n, f) {
    if (list.length < n) return null;
    let best = null;
    for (let i = 0; i + n <= list.length; i++) {
      const a = f(list.slice(i, i + n));
      if (a !== null && (best === null || a < best)) best = a;
    }
    return best;
  }
  function mean(list) {
    const valid = list.map(effectiveMs).filter(v => v !== Infinity);
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  }
  const bestSolve = list => { const v = list.filter(s => effectiveMs(s) !== Infinity); return v.length ? v.reduce((a, b) => effectiveMs(a) < effectiveMs(b) ? a : b) : null; };
  const worstSolve = list => { const v = list.filter(s => effectiveMs(s) !== Infinity); return v.length ? v.reduce((a, b) => effectiveMs(a) > effectiveMs(b) ? a : b) : null; };
  const dash = v => v == null ? '–' : fmt(v);
  function bestWindowStart(list, n, f) {
    if (list.length < n) return -1;
    let best = null, at = -1;
    for (let i = 0; i + n <= list.length; i++) {
      const a = f(list.slice(i, i + n));
      if (a !== null && (best === null || a < best)) { best = a; at = i; }
    }
    return at;
  }
  const BIG_AVGS = [25, 50, 100, 200, 500, 1000]; // shown only once the session has that many solves
  const availableAvgs = list => BIG_AVGS.filter(n => list.length >= n);

  // =====================================================================
  //  DOM
  // =====================================================================
  const $ = id => document.getElementById(id);
  const el = {
    app: $('app'), main: $('main'), stage: $('stage'), timer: $('timer'), timerRow: $('timerRow'), diff: $('diff'), scramble: $('scramble'),
    scrBar: document.querySelector('.scr-bar'), relayLabel: $('relayLabel'), relayEvents: $('relayEvents'), btnRelayPrev: $('btnRelayPrev'), btnRelayNext: $('btnRelayNext'),
    entryBox: $('entryBox'), entryInput: $('entryInput'),
    penaltyBar: $('penaltyBar'), imgCard: $('imgCard'), scrImg: $('scrImg'), centerStats: $('centerStats'),
    sessionSel: $('sessionSel'), eventSel: $('eventSel'), sbStats: $('sbStats'), sbSummary: $('sbSummary'), timesList: $('timesList'),
    btnPrevScr: $('btnPrevScr'), modalBg: $('modalBg'), dialog: $('dialog'),
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  for (const [gid, gname] of Object.entries(GROUPS)) {
    const og = document.createElement('optgroup');
    og.label = gname;
    for (const [id, ev] of Object.entries(EVENTS)) {
      if (ev.group !== gid) continue;
      const o = document.createElement('option');
      o.value = id; o.textContent = ev.name;
      og.appendChild(o);
    }
    el.eventSel.appendChild(og);
  }

  // ---- dialogs (the page may run in a sandbox where prompt/confirm are blocked) ----
  let dialogResolve = null;
  function openDialog(html, cls = '') {
    el.dialog.className = 'dialog' + (cls ? ' ' + cls : '');
    el.dialog.innerHTML = html;
    el.modalBg.classList.add('open');
  }
  function closeDialog(result = null) {
    el.modalBg.classList.remove('open');
    el.dialog.innerHTML = '';
    const r = dialogResolve; dialogResolve = null;
    if (r) r(result);
    if (state.inputMode === 'typing') el.entryInput.focus();
  }
  const dialogOpen = () => el.modalBg.classList.contains('open');
  // ask({ title, message, input, value, ok, danger }) -> Promise<string | true | null>
  function ask(o) {
    return new Promise(resolve => {
      dialogResolve = resolve;
      openDialog(`<h2>${esc(o.title)}</h2>${o.message ? `<p>${esc(o.message)}</p>` : ''}
        ${o.input ? `<input class="field" id="dlgInput" type="text" maxlength="40" value="${esc(o.value || '')}" placeholder="${esc(o.input)}">` : ''}
        <div class="actions"><button id="dlgCancel">Cancel</button><button id="dlgOk" class="primary${o.danger ? ' danger' : ''}">${esc(o.ok || 'OK')}</button></div>`);
      const input = $('dlgInput');
      const ok = () => closeDialog(input ? input.value.trim() : true);
      $('dlgOk').addEventListener('click', ok);
      $('dlgCancel').addEventListener('click', () => closeDialog(null));
      if (input) { input.focus(); input.select(); input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); e.stopPropagation(); }); }
      else $('dlgOk').focus();
    });
  }
  el.modalBg.addEventListener('click', e => { if (e.target === el.modalBg) closeDialog(null); });
  // sessionForm({ title, name, type, target, ok }) -> Promise<{ name, type, target } | null>
  function sessionForm(o) {
    return new Promise(resolve => {
      dialogResolve = resolve;
      openDialog(`<h2>${esc(o.title)}</h2>
        <div class="form">
          <label>Session name<input class="field" id="sfName" type="text" maxlength="40" value="${esc(o.name || '')}" placeholder="Session name"></label>
          <label>Session type<select class="field" id="sfType"><option value="normal"${o.type === 'normal' || !o.type ? ' selected' : ''}>Normal</option><option value="comp"${o.type === 'comp' ? ' selected' : ''}>Comp sim (rounds of 5)</option><option value="relay"${o.type === 'relay' ? ' selected' : ''}>Relay (several puzzles, one time)</option></select></label>
          <label id="sfRelayWrap"${o.type === 'relay' ? '' : ' hidden'}>Puzzles in the relay<div class="checks">${Object.entries(EVENTS).map(([id, ev]) => `<label><input type="checkbox" value="${id}"${(o.relay || []).includes(id) ? ' checked' : ''}>${esc(ev.name)}</label>`).join('')}</div><span class="hint">Scrambles are shown one at a time; use the arrows to move between puzzles. The whole relay is one solve.</span></label>
          <label id="sfTargetWrap"${o.type === 'comp' ? '' : ' hidden'}>Target average<input class="field" id="sfTarget" type="text" inputmode="decimal" value="${o.target != null ? fmt(o.target) : ''}" placeholder="e.g. 12.34 or 1234"><span class="hint">Each round of 5 solves is compared with this ao5 (mo3 rounds of 3 for 6x6, 7x7 and blindfolded).</span></label>
        </div>
        <div class="actions"><button id="dlgCancel">Cancel</button><button id="dlgOk" class="primary">${esc(o.ok || 'Save')}</button></div>`);
      const name = $('sfName'), type = $('sfType'), target = $('sfTarget');
      type.addEventListener('change', () => { $('sfTargetWrap').hidden = type.value !== 'comp'; $('sfRelayWrap').hidden = type.value !== 'relay'; if (type.value === 'comp') target.focus(); });
      const ok = () => {
        let t = null, relay = null;
        if (type.value === 'comp' && target.value.trim()) { const r = parseTyped(target.value); if (!r || r.penalty) { target.select(); return; } t = r.ms; }
        if (type.value === 'relay') {
          relay = [...el.dialog.querySelectorAll('#sfRelayWrap input:checked')].map(i => i.value);
          if (!relay.length) { el.dialog.querySelector('#sfRelayWrap .checks').style.outline = '2px solid var(--hold)'; return; }
        }
        closeDialog({ name: name.value.trim(), type: type.value, target: t, relay });
      };
      $('dlgOk').addEventListener('click', ok);
      $('dlgCancel').addEventListener('click', () => closeDialog(null));
      for (const inp of [name, target]) inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); e.stopPropagation(); });
      name.focus(); name.select();
    });
  }

  // =====================================================================
  //  Scrambles with history (previous / next)
  // =====================================================================
  // history entries are scramble strings, or for relay sessions arrays of { event, scramble }
  let scrHistory = [], scrIndex = -1, currentScramble = '', relayScr = null, relayIdx = 0;
  const imageEvent = () => relayScr ? relayScr[relayIdx].event : session().event;
  const imageScramble = () => relayScr ? relayScr[relayIdx].scramble : currentScramble;
  function showScramble() {
    const entry = scrHistory[scrIndex];
    relayScr = Array.isArray(entry) ? entry : null;
    if (relayScr) { relayIdx = Math.min(relayIdx, relayScr.length - 1); currentScramble = relayScr.map(r => `${EVENTS[r.event].name}: ${r.scramble.replace(/\n/g, ' / ')}`).join('\n'); }
    else currentScramble = entry;
    const text = relayScr ? relayScr[relayIdx].scramble : currentScramble;
    el.scramble.textContent = text;
    el.scramble.classList.toggle('multi', text.includes('\n'));
    el.scramble.classList.toggle('long', !text.includes('\n') && text.length > 130 && text.length <= 260);
    el.scramble.classList.toggle('xlong', !text.includes('\n') && text.length > 260);
    el.btnPrevScr.disabled = scrIndex <= 0;
    el.scrBar.classList.toggle('relay', !!relayScr);
    if (relayScr) {
      el.relayLabel.innerHTML = `<b>${esc(EVENTS[relayScr[relayIdx].event].name)}</b> · ${relayIdx + 1}/${relayScr.length}<span class="dots">${relayScr.map((_, i) => `<span class="${i === relayIdx ? 'on' : ''}">●</span>`).join('')}</span>`;
      el.btnRelayPrev.disabled = relayIdx === 0;
      el.btnRelayNext.disabled = relayIdx >= relayScr.length - 1;
    }
    renderImage();
  }
  function relayStep(d) { if (!relayScr) return; const n = relayIdx + d; if (n < 0 || n >= relayScr.length) return; relayIdx = n; showScramble(); }
  el.btnRelayPrev.addEventListener('click', e => { relayStep(-1); e.currentTarget.blur(); });
  el.btnRelayNext.addEventListener('click', e => { relayStep(1); e.currentTarget.blur(); });
  function newScramble() {
    scrHistory = scrHistory.slice(0, scrIndex + 1);
    relayIdx = 0;
    scrHistory.push(isRelay() ? session().relay.map(ev => ({ event: ev, scramble: EVENTS[ev].scr() })) : event().scr());
    if (scrHistory.length > 50) scrHistory.shift();
    scrIndex = scrHistory.length - 1;
    showScramble();
  }
  function nextScramble() { if (scrIndex < scrHistory.length - 1) { scrIndex++; showScramble(); } else newScramble(); }
  function prevScramble() { if (scrIndex > 0) { scrIndex--; showScramble(); } }
  function resetScrambles() { scrHistory = []; scrIndex = -1; newScramble(); }
  function renderImage() {
    el.imgCard.hidden = !state.showImage;
    el.centerStats.hidden = !state.showStats;
    el.scrImg.innerHTML = state.showImage ? scrambleSvg(imageEvent(), imageScramble()) : '';
  }
  $('btnNextScr').addEventListener('click', e => { nextScramble(); e.currentTarget.blur(); });
  el.btnPrevScr.addEventListener('click', e => { prevScramble(); e.currentTarget.blur(); });

  // =====================================================================
  //  Timer state machine
  // =====================================================================
  const HOLD_MS = 500, INSPECTION_MS = 15000;
  let phase = 'idle', holdTimer = null, startTime = 0, rafId = null, inspectionStart = 0, inspectionPenalty = null, lastSolveId = null;
  let spaceDown = false, pointerDown = false;
  const zero = () => fmt(0);
  function setPhase(p) {
    phase = p;
    el.main.classList.toggle('holding', p === 'holding' || p === 'inspHolding');
    el.main.classList.toggle('ready', p === 'ready' || p === 'inspReady');
    el.main.classList.toggle('inspecting', p === 'inspecting'); // holding / ready colours win while the key is held
    el.scramble.classList.toggle('hidden-during-solve', p === 'running');
    el.imgCard.style.visibility = p === 'running' ? 'hidden' : '';
    el.centerStats.style.visibility = p === 'running' ? 'hidden' : '';
    if (p === 'running') el.penaltyBar.innerHTML = '';
  }
  function tick() {
    if (phase === 'running') {
      el.timer.textContent = state.hideTime ? '···' : fmt(performance.now() - startTime);
      rafId = requestAnimationFrame(tick);
    } else if (phase.startsWith('insp')) {
      const left = INSPECTION_MS - (performance.now() - inspectionStart);
      const typing = state.inputMode === 'typing'; // while typing times the countdown is informational only
      if (left > -2000) { el.timer.textContent = left > 0 ? Math.ceil(left / 1000) : '+2'; inspectionPenalty = left > 0 || typing ? null : '+2'; }
      else if (typing) { el.timer.textContent = 'DNF'; inspectionPenalty = null; }
      else {
        // 17 s of inspection: the attempt is a DNF and is recorded right away (WCA A3d1)
        cancelAnimationFrame(rafId); clearTimeout(holdTimer); spaceDown = false; pointerDown = false; inspectionPenalty = null;
        setPhase('idle');
        addSolve(0, 'DNF');
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
  }
  function startInspection() { inspectionStart = performance.now(); inspectionPenalty = null; setPhase('inspecting'); cancelAnimationFrame(rafId); tick(); }
  function startRunning() { startTime = performance.now(); setPhase('running'); cancelAnimationFrame(rafId); tick(); }
  // difference between the last two solves, shown next to the time
  function renderDiff() {
    const list = solves();
    el.diff.textContent = ''; el.diff.className = 'diff';
    if (!state.showDiff || !lastSolveId || list.length < 2 || list[list.length - 1].id !== lastSolveId) return;
    const a = effectiveMs(list[list.length - 1]), b = effectiveMs(list[list.length - 2]);
    if (!isFinite(a) || !isFinite(b)) return;
    const d = a - b;
    el.diff.textContent = (d < 0 ? '-' : '+') + fmt(Math.abs(d));
    el.diff.classList.add(d < 0 ? 'better' : d > 0 ? 'worse' : 'same');
  }
  function addSolve(ms, penalty) {
    const solve = { id: uid(), ms: Math.round(ms), penalty, event: session().event, scramble: currentScramble, date: new Date().toISOString() };
    if (relayScr) solve.relay = relayScr.map(r => ({ event: r.event, scramble: r.scramble }));
    allSolves().push(solve);
    lastSolveId = solve.id;
    save();
    el.timer.textContent = fmtSolve(solve);
    renderDiff();
    renderPenaltyBar(solve);
    render();
    newScramble();
  }
  function stopRunning() {
    const ms = performance.now() - startTime;
    cancelAnimationFrame(rafId);
    setPhase('idle');
    addSolve(ms, inspectionPenalty);
  }
  function penaltyButtons(solve, onChange) {
    const frag = document.createDocumentFragment();
    for (const [label, pen] of [['OK', null], ['+2', '+2'], ['DNF', 'DNF']]) {
      const b = document.createElement('button');
      b.textContent = label;
      if (solve.penalty === pen) b.classList.add('primary');
      b.addEventListener('click', e => { e.stopPropagation(); setPenalty(solve.id, pen); onChange && onChange(); });
      frag.append(b);
    }
    return frag;
  }
  function renderPenaltyBar(solve) {
    el.penaltyBar.innerHTML = '';
    el.penaltyBar.append(penaltyButtons(solve, () => { const s = solves().find(x => x.id === solve.id); if (s) renderPenaltyBar(s); }));
    const del = document.createElement('button');
    del.className = 'danger'; del.textContent = 'Delete';
    del.addEventListener('click', e => { e.stopPropagation(); deleteSolve(solve.id); });
    el.penaltyBar.append(del);
  }
  function setPenalty(id, pen) {
    const s = solves().find(x => x.id === id);
    if (!s) return;
    s.penalty = pen; save();
    if (id === lastSolveId && phase === 'idle') { el.timer.textContent = fmtSolve(s); renderDiff(); }
    render();
  }
  function deleteSolve(id) {
    const list = allSolves(), idx = list.findIndex(x => x.id === id);
    if (idx < 0) return;
    list.splice(idx, 1); save();
    if (id === lastSolveId) resetDisplay();
    render();
  }
  function resetDisplay() { lastSolveId = null; el.timer.textContent = zero(); el.penaltyBar.innerHTML = ''; renderDiff(); }
  function cancelTiming() {
    if (phase === 'idle') return;
    cancelAnimationFrame(rafId); clearTimeout(holdTimer); inspectionPenalty = null; setPhase('idle');
    const last = lastSolveId && solves().find(x => x.id === lastSolveId);
    el.timer.textContent = last ? fmtSolve(last) : zero();
    renderDiff();
  }

  // ---- typed times (csTimer style: 1234 = 12.34, 10234 = 1:02.34, trailing + = +2, DNF) ----
  function parseTyped(raw) {
    let t = raw.trim().toUpperCase().replace(',', '.');
    if (!t) return null;
    if (t === 'DNF') return { ms: 0, penalty: 'DNF' };
    let penalty = null;
    if (t.endsWith('+')) { penalty = '+2'; t = t.slice(0, -1); }
    let ms;
    if (/^\d+$/.test(t)) {
      const d = t.padStart(3, '0');
      const hund = +d.slice(-2), rest = d.slice(0, -2);
      const sec = +rest.slice(-2), min = +(rest.slice(0, -2) || 0);
      ms = (min * 60 + sec) * 1000 + hund * 10;
    } else {
      const m = t.match(/^(?:(\d+):)?(\d+(?:\.\d{0,3})?)$/);
      if (!m) return null;
      ms = Math.round(((+m[1] || 0) * 60 + parseFloat(m[2])) * 1000);
    }
    if (!isFinite(ms) || ms <= 0) return null;
    return { ms, penalty };
  }
  function applyInputMode() {
    const typing = state.inputMode === 'typing';
    cancelTiming();
    el.entryBox.hidden = !typing;
    el.stage.classList.toggle('typing', typing);
    el.timerRow.classList.toggle('small', typing);
    if (typing) { el.entryInput.value = ''; el.entryInput.focus(); }
  }
  // Space in the (empty) box starts a 15 s inspection; Space again ends it, then the typed
  // time is submitted with the inspection penalty (+2 / DNF) applied on top of any typed one.
  el.entryInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.code === 'Space' && inspectionActive() && !el.entryInput.value.trim()) {
      e.preventDefault();
      if (phase === 'idle') startInspection();
      else if (phase === 'inspecting') { cancelAnimationFrame(rafId); phase = 'typingWait'; el.main.classList.remove('inspecting'); el.timer.textContent = inspectionPenalty || 'type time'; }
      return;
    }
    if (e.key === 'Enter') {
      const r = parseTyped(el.entryInput.value);
      if (!r) { el.entryInput.select(); return; }
      el.entryInput.value = '';
      const insp = (phase === 'inspecting' || phase === 'typingWait') ? inspectionPenalty : null;
      const penalty = r.penalty === 'DNF' || insp === 'DNF' ? 'DNF' : (r.penalty === '+2' || insp === '+2') ? '+2' : null;
      cancelAnimationFrame(rafId); inspectionPenalty = null; setPhase('idle');
      addSolve(r.ms, penalty);
    } else if (e.key === 'Escape') { el.entryInput.value = ''; if (phase !== 'idle') cancelTiming(); }
  });
  el.entryBox.addEventListener('click', () => el.entryInput.focus());

  // ---- input ----
  function press() {
    if (dialogOpen() || state.inputMode === 'typing') return;
    if (phase === 'running') { stopRunning(); return; }
    if (phase === 'idle') { if (inspectionActive()) startInspection(); else beginHold('holding', 'ready'); }
    else if (phase === 'inspecting') beginHold('inspHolding', 'inspReady');
  }
  function beginHold(holdPhase, readyPhase) {
    setPhase(holdPhase);
    if (holdPhase === 'holding') el.timer.textContent = zero();
    el.diff.textContent = '';
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { if (phase === holdPhase) setPhase(readyPhase); }, HOLD_MS);
  }
  function release() {
    clearTimeout(holdTimer);
    if (phase === 'ready' || phase === 'inspReady') startRunning();
    else if (phase === 'holding') {
      setPhase('idle');
      const s = lastSolveId && solves().find(x => x.id === lastSolveId);
      if (s) { el.timer.textContent = fmtSolve(s); renderDiff(); }
    } else if (phase === 'inspHolding') setPhase('inspecting');
  }
  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (dialogOpen()) { if (e.key === 'Escape') closeDialog(null); return; }
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    if (state.inputMode === 'typing' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { el.entryInput.focus(); return; }
    if (phase === 'running') { e.preventDefault(); stopRunning(); return; }
    if (e.code === 'Space') { e.preventDefault(); if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') e.target.blur(); spaceDown = true; press(); }
    else if (e.code === 'Escape') { if (phase.startsWith('insp')) cancelTiming(); }
    else if (e.key === 'n' || e.key === 'N') nextScramble();
    else if (e.key === 'p' || e.key === 'P') prevScramble();
    else if (e.key === 'ArrowRight' && relayScr) { e.preventDefault(); relayStep(1); }
    else if (e.key === 'ArrowLeft' && relayScr) { e.preventDefault(); relayStep(-1); }
  });
  document.addEventListener('keyup', e => { if (e.code === 'Space' && spaceDown) { e.preventDefault(); spaceDown = false; release(); } });
  el.stage.addEventListener('pointerdown', e => {
    if (state.inputMode === 'typing') return;
    if (phase !== 'running' && e.target.closest('button, .center-stats, .entry-box')) return;
    e.preventDefault(); pointerDown = true; press();
  });
  const pointerUp = () => { if (pointerDown) { pointerDown = false; release(); } };
  el.stage.addEventListener('pointerup', pointerUp);
  el.stage.addEventListener('pointercancel', pointerUp);
  el.stage.addEventListener('pointerleave', pointerUp);

  // =====================================================================
  //  Rendering
  // =====================================================================
  const tile = (label, value) => `<div class="stat"><div class="l">${label}</div><div class="v${value === 'DNF' ? ' dnf' : ''}">${value}</div></div>`;
  const sbRow = (label, value) => `<span class="l">${label}</span><span class="v${value === 'DNF' ? ' dnf' : ''}">${value}</span>`;
  function renderSessionSelect() {
    el.sessionSel.innerHTML = state.sessions.map(s => `<option value="${s.id}">${esc(s.name)}${s.type === 'comp' ? ' (comp)' : s.type === 'relay' ? ' (relay)' : ''}</option>`).join('');
    el.sessionSel.value = state.current;
    $('btnDeleteSession').disabled = state.sessions.length <= 1;
  }
  function render() {
    const list = solves(), ev = event(), best = bestSolve(list), worst = worstSolve(list);
    renderSessionSelect();
    el.eventSel.value = session().event;
    el.eventSel.hidden = isRelay();
    el.relayEvents.hidden = !isRelay();
    if (isRelay()) el.relayEvents.textContent = 'Relay: ' + session().relay.map(e => EVENTS[e].name).join(' + ');
    document.title = `${session().name} · ${ev.name} · Cube Timer`;

    const cur = (n, f) => dash(lastN(list, n, f)), bst = (n, f) => dash(bestN(list, n, f));
    const td = (v, attrs = '') => `<td class="${v === 'DNF' ? 'dnf' : v === '–' ? 'none' : 'link'}"${v === '–' ? '' : ' ' + attrs}>${v}</td>`;
    const avgRow = (kind, n) => `<tr><td>${kind}${kind === 'mo' ? 3 : n}</td>${td(cur(n, kind === 'mo' ? meanOf : average), `data-avg="${kind}${n}" data-which="current"`)}${td(bst(n, kind === 'mo' ? meanOf : average), `data-avg="${kind}${n}" data-which="best"`)}</tr>`;
    const trs = [`<tr><td>time</td>${td(list.length ? fmtSolve(list[list.length - 1]) : '–', `data-solve="${list.length ? list[list.length - 1].id : ''}"`)}${td(best ? fmtSolve(best) : '–', `data-solve="${best ? best.id : ''}"`)}</tr>`];
    if (isComp()) {
      // comp sim: the round average (last completed round / best round), not a rolling average
      const done = rounds(list).filter(r => r.avg != null);
      const lastR = done[done.length - 1], bestR = done.reduce((a, r) => (a == null || r.avg < a.avg) ? r : a, null);
      trs.push(`<tr><td>${roundLabel()}</td>${td(lastR ? dash(lastR.avg) : '–', lastR ? `data-avg="${roundLabel()}" data-start="${lastR.start}"` : '')}${td(bestR ? dash(bestR.avg) : '–', bestR ? `data-avg="${roundLabel()}" data-start="${bestR.start}"` : '')}</tr>`);
    } else {
      if (ev.fmt === 'mo3') trs.push(avgRow('mo', 3));
      trs.push(avgRow('ao', 5), avgRow('ao', 12));
      for (const n of availableAvgs(list)) trs.push(avgRow('ao', n));
    }
    el.sbStats.innerHTML = `<thead><tr><th></th><th>current</th><th>best</th></tr></thead><tbody>${trs.join('')}</tbody>`;
    const solved = list.filter(s => s.penalty !== 'DNF').length;
    let summary = `Solves: <span class="mono">${solved}/${list.length}</span><br>mean: <span class="mono">${dash(mean(list))}</span>`;
    const rs = isComp() ? rounds(list) : null;
    if (rs) {
      const done = rs.filter(r => r.avg != null), hits = done.filter(r => hitTarget(r.avg)).length;
      summary += `<br>target: <span class="mono target">${session().target != null ? fmt(session().target) : '–'}</span>`;
      summary += `<br>rounds under target: <span class="mono">${session().target != null ? `${hits}/${done.length}` : done.length}</span>`;
    }
    el.sbSummary.innerHTML = summary;
    const line = (k, v, first, extra = '') => `<div class="${first ? 'first' : ''}${v === '–' ? '' : ' link'}" data-avg="${k}"${extra}><span class="k">${k}: </span><span class="v${v === 'DNF' ? ' dnf' : ''}">${v}</span></div>`;
    if (rs) {
      const curR = rs[rs.length - 1], last = [...rs].reverse().find(r => r.avg != null);
      const cls = last ? (session().target == null ? '' : hitTarget(last.avg) ? ' hit' : ' miss') : '';
      const bw = showBpa(curR) ? bpaWpa(curR.solves) : null;
      el.centerStats.innerHTML = `<div class="first"><span class="k">solve: </span><span class="v">${curR.solves.length + 1}/${roundSize()}</span></div>`
        + (bw ? `<div class="bpa"><span class="k">bpa: </span><span class="v${hitTarget(bw.bpa) ? ' ok' : ''}${bw.bpa === Infinity ? ' dnf' : ''}">${dash(bw.bpa)}</span><span class="k"> · wpa: </span><span class="v${hitTarget(bw.wpa) ? ' ok' : ''}${bw.wpa === Infinity ? ' dnf' : ''}">${dash(bw.wpa)}</span></div>` : '')
        + (last ? `<div class="link${cls}" data-avg="${roundLabel()}" data-start="${last.start}"><span class="k">last ${roundLabel()}: </span><span class="v${last.avg === Infinity ? ' dnf' : ''}">${dash(last.avg)}</span></div>` : `<div><span class="k">${roundLabel()}: </span><span class="v">–</span></div>`);
    } else {
      el.centerStats.innerHTML = ev.fmt === 'ao' ? line('ao5', cur(5, average), true) + line('ao12', cur(12, average)) : line('mo3', cur(3, meanOf), true) + line('ao5', cur(5, average));
    }

    if (!list.length) el.timesList.innerHTML = '<div class="empty">No solves in this session yet.<br>Hold space to start.</div>';
    else {
      const rows = [];
      const roundHead = r => {
        const open = r.avg == null, cls = open ? 'open' : session().target == null ? '' : hitTarget(r.avg) ? 'hit' : 'miss';
        const bw = open && showBpa(r) ? bpaWpa(r.solves) : null;
        const val = open ? `${r.solves.length}/${roundSize()}${bw ? ` · bpa ${dash(bw.bpa)} · wpa ${dash(bw.wpa)}` : ''}` : dash(r.avg);
        return `<tr class="round-head ${cls}" data-start="${r.start}"${open ? '' : ' data-avg="' + roundLabel() + '"'}><td colspan="3">Round ${r.no}<span class="r-avg">${open ? val : roundLabel() + ' ' + val}</span></td></tr>`;
      };
      let roundStarts = null;
      if (rs) { roundStarts = new Map(); for (const r of rs) if (r.solves.length) roundStarts.set(r.start + r.solves.length - 1, r); }
      for (let i = list.length - 1; i >= 0; i--) {
        if (roundStarts && roundStarts.has(i)) rows.push(roundHead(roundStarts.get(i)));
        const s = list[i];
        let extra;
        const avgCell = (kind, n) => {
          if (i < n - 1 || (rs && (i + 1) % n !== 0)) return '<td class="time">-</td>';
          const v = (kind === 'mo' ? meanOf : average)(list.slice(i - n + 1, i + 1));
          return `<td class="time link" data-avg="${kind}${n}" data-end="${i}">${fmt(v)}</td>`;
        };
        // comp sim: only the round metric column (ao5, or mo3 for mean-of-3 events)
        extra = rs ? (ev.fmt === 'ao' ? avgCell('ao', 5) : avgCell('mo', 3))
          : ev.fmt === 'ao' ? avgCell('ao', 5) + avgCell('ao', 12) : avgCell('mo', 3) + avgCell('ao', 5);
        const cls = best && s.id === best.id ? ' best' : (s.penalty === 'DNF' || (worst && s.id === worst.id && list.length > 1)) ? ' worst' : '';
        rows.push(`<tr data-id="${s.id}"><td>${i + 1}</td><td class="time${cls}">${fmtSolve(s)}</td>${extra}</tr>`);
      }
      const head = rs ? (ev.fmt === 'ao' ? '<th>time</th><th>ao5</th>' : '<th>time</th><th>mo3</th>')
        : ev.fmt === 'ao' ? '<th>time</th><th>ao5</th><th>ao12</th>' : '<th>time</th><th>mo3</th><th>ao5</th>';
      el.timesList.innerHTML = `<table><thead><tr><th>#</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
    }
  }
  function parseAvg(str) { return { kind: str.slice(0, 2), n: +str.slice(2) }; }
  el.timesList.addEventListener('click', e => {
    const head = e.target.closest('tr.round-head[data-avg]');
    if (head) { const { kind, n } = parseAvg(head.dataset.avg); openAverage(+head.dataset.start, n, kind); return; }
    const cell = e.target.closest('td[data-avg]');
    if (cell) { const { kind, n } = parseAvg(cell.dataset.avg); openAverage(+cell.dataset.end - n + 1, n, kind); return; }
    const tr = e.target.closest('tr[data-id]'); if (tr) openSolve(tr.dataset.id);
  });
  el.sbStats.addEventListener('click', e => {
    const cell = e.target.closest('td[data-avg], td[data-solve]');
    if (!cell) return;
    if (cell.dataset.solve) { openSolve(cell.dataset.solve); return; }
    const { kind, n } = parseAvg(cell.dataset.avg), list = solves(), f = kind === 'mo' ? meanOf : average;
    const start = cell.dataset.start !== undefined ? +cell.dataset.start : cell.dataset.which === 'best' ? bestWindowStart(list, n, f) : list.length - n;
    if (start >= 0) openAverage(start, n, kind);
  });
  el.centerStats.addEventListener('click', e => {
    const line = e.target.closest('[data-avg]');
    if (!line) return;
    const { kind, n } = parseAvg(line.dataset.avg);
    if (line.dataset.start !== undefined) openAverage(+line.dataset.start, n, kind);
    else if (solves().length >= n) openAverage(solves().length - n, n, kind);
  });

  // ---- average details: the solves that make up an average, with scrambles ----
  function openAverage(start, n, kind) {
    const list = solves(), win = list.slice(start, start + n);
    if (win.length !== n) return;
    const f = kind === 'mo' ? meanOf : average, value = f(win), label = `${kind}${n}`;
    // solves trimmed by the WCA average (best/worst 5%) are shown in parentheses
    const trimmed = new Set();
    if (kind === 'ao') {
      const trim = Math.ceil(n * 0.05);
      const order = win.map((s, i) => ({ i, v: effectiveMs(s) })).sort((a, b) => a.v - b.v);
      for (let k = 0; k < trim; k++) { trimmed.add(order[k].i); trimmed.add(order[order.length - 1 - k].i); }
    }
    const rows = win.map((s, i) => {
      const t = fmtSolve(s), isTrim = trimmed.has(i);
      return `<tr data-id="${s.id}"><td class="no">${start + i + 1}</td><td class="t${isTrim ? ' trim' : ''}${s.penalty === 'DNF' ? ' dnf' : ''}">${isTrim ? `(${t})` : t}</td><td class="s">${esc(s.scramble)}</td></tr>`;
    });
    const times = win.map((s, i) => trimmed.has(i) ? `(${fmtSolve(s)})` : fmtSolve(s)).join(', ');
    const text = [`${label}: ${dash(value)} = ${times}`, '', ...win.map((s, i) => `${start + i + 1}. ${trimmed.has(i) ? `(${fmtSolve(s)})` : fmtSolve(s)}   ${s.scramble.replace(/\n/g, ' / ')}`)].join('\n');
    const wb = bestSolve(win), ww = worstSolve(win);
    openDialog(`<h2>${label}: <span class="${value === Infinity ? 'dnf' : ''}" style="font-family:var(--mono)">${dash(value)}</span></h2>
      <div class="avg-summary"><span>Solves <b>${start + 1}–${start + n}</b></span><span>Best <b>${wb ? fmtSolve(wb) : '–'}</b></span><span>Worst <b>${ww ? fmtSolve(ww) : '–'}</b></span><span>Mean <b>${dash(mean(win))}</b></span>${kind === 'ao' ? '<span>Times in parentheses are trimmed</span>' : ''}</div>
      <div class="group"><table class="avg"><thead><tr><th>#</th><th>Time</th><th>Scramble</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
      <div class="section-title">Copy</div><textarea class="copy" readonly rows="8">${esc(text)}</textarea>
      <div class="actions"><button id="dlgCopy">Copy to clipboard</button><button class="primary" id="dlgClose">Close</button></div>`, 'wide');
    $('dlgClose').addEventListener('click', () => closeDialog());
    $('dlgCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); $('dlgCopy').textContent = 'Copied'; } catch (e) { el.dialog.querySelector('textarea').select(); } });
    el.dialog.querySelectorAll('table.avg tbody tr').forEach(r => r.addEventListener('click', () => openSolve(r.dataset.id)));
  }

  // ---- solve details ----
  function openSolve(id) {
    const s = solves().find(x => x.id === id);
    if (!s) return;
    const idx = solves().indexOf(s) + 1;
    openDialog(`<h2>Solve #${idx} <span style="color:var(--muted);font-weight:400;font-size:15px">· ${new Date(s.date).toLocaleString('en-GB')}</span></h2>
      <div class="big${s.penalty === 'DNF' ? ' dnf' : ''}">${fmtSolve(s)}</div>
      <div class="scr">${esc(s.scramble)}</div>
      ${s.relay ? `<div class="preview multi">${state.showImage ? s.relay.map(r => `<div><div class="cap">${esc(EVENTS[r.event] ? EVENTS[r.event].name : r.event)}</div>${EVENTS[r.event] ? scrambleSvg(r.event, r.scramble) : ''}</div>`).join('') : ''}</div>`
        : `<div class="preview">${state.showImage ? scrambleSvg(s.event || session().event, s.scramble) : ''}</div>`}
      <div class="actions" id="solveActions"></div>`, 'wide');
    const actions = $('solveActions');
    actions.append(penaltyButtons(s, () => openSolve(id)));
    const spacer = document.createElement('span'); spacer.className = 'spacer';
    const del = document.createElement('button'); del.className = 'danger'; del.textContent = 'Delete';
    del.addEventListener('click', async () => { closeDialog(); if (await ask({ title: 'Delete this solve?', ok: 'Delete', danger: true })) deleteSolve(id); });
    const close = document.createElement('button'); close.className = 'primary'; close.textContent = 'Close';
    close.addEventListener('click', () => closeDialog());
    actions.append(spacer, del, close);
  }
  el.imgCard.addEventListener('click', () => {
    if (!currentScramble) return;
    openDialog(`<h2>${esc(EVENTS[imageEvent()].name)}</h2><div class="scr">${esc(imageScramble())}</div><div class="zoom">${scrambleSvg(imageEvent(), imageScramble())}</div>
      <div class="actions"><button class="primary" id="dlgClose">Close</button></div>`, 'wide');
    $('dlgClose').addEventListener('click', () => closeDialog());
  });

  // ---- statistics dialog with chart ----
  const CH = { w: 600, h: 240, l: 56, r: 12, t: 12, b: 26 };
  let chartPts = [];
  const statRow = (label, value, sub) => `<div class="row"><div>${label}${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="value${value === 'DNF' ? ' dnf' : ''}">${value}</div></div>`;
  function openStats() {
    const list = solves(), ev = event(), best = bestSolve(list), worst = worstSolve(list);
    const dnfs = list.filter(s => s.penalty === 'DNF').length;
    const rows = [statRow('Solves', list.length, dnfs ? `${dnfs} DNF` : ''), statRow('Best', best ? fmtSolve(best) : '–'), statRow('Worst', worst ? fmtSolve(worst) : '–'), statRow('Mean (all)', dash(mean(list)))];
    if (ev.fmt === 'mo3') rows.push(statRow('mo3', dash(lastN(list, 3, meanOf)), 'current'), statRow('Best mo3', dash(bestN(list, 3, meanOf))));
    rows.push(statRow('ao5', dash(lastN(list, 5, average)), 'current'), statRow('Best ao5', dash(bestN(list, 5, average))),
      statRow('ao12', dash(lastN(list, 12, average)), 'current'), statRow('Best ao12', dash(bestN(list, 12, average))));
    for (const n of availableAvgs(list)) rows.push(statRow(`ao${n}`, dash(lastN(list, n, average)), 'current'), statRow(`Best ao${n}`, dash(bestN(list, n, average))));
    let roundsHtml = '';
    if (isComp()) {
      const rs = rounds(list).filter(r => r.solves.length);
      const rrows = rs.map(r => { const open = r.avg == null, cls = open ? '' : session().target == null ? '' : hitTarget(r.avg) ? ' style="color:var(--ready)"' : ' style="color:var(--hold)"'; return `<div class="row${open ? '' : ' link'}"${open ? '' : ` data-avg="${roundLabel()}" data-start="${r.start}"`}><div>Round ${r.no}<div class="sub">${r.solves.map(fmtSolve).join(', ')}</div></div><div class="value"${cls}>${open ? `${r.solves.length}/${roundSize()}` : dash(r.avg)}</div></div>`; }).reverse();
      roundsHtml = `<div class="section-title">Rounds${session().target != null ? ` · target ${fmt(session().target)}` : ''}</div><div class="group" id="roundsList">${rrows.join('') || '<div class="row"><div class="sub">No rounds yet</div></div>'}</div>`;
    }
    openDialog(`<h2>Statistics · ${esc(session().name)} · ${esc(ev.name)}</h2>${roundsHtml}
      <div class="chart-wrap" id="chartWrap"><svg id="chart" viewBox="0 0 ${CH.w} ${CH.h}" preserveAspectRatio="none" role="img" aria-label="Session times chart"></svg>
      <div class="chart-legend"><span><i style="background:#4f8cff"></i>time</span><span><i style="background:#c97a1c"></i>ao12</span></div><div class="chart-tip" id="chartTip"></div></div>
      <div class="section-title">Statistics</div><div class="group">${rows.join('')}</div>
      <div class="actions"><button class="primary" id="dlgClose">Close</button></div>`, 'wide');
    $('dlgClose').addEventListener('click', () => closeDialog());
    const rl = $('roundsList');
    if (rl) rl.addEventListener('click', e => { const row = e.target.closest('.row[data-avg]'); if (row) { const { kind, n } = parseAvg(row.dataset.avg); openAverage(+row.dataset.start, n, kind); } });
    renderChart($('chart'), list);
    const svg = $('chart'), tip = $('chartTip'), wrap = $('chartWrap');
    const nearest = e => { const rect = svg.getBoundingClientRect(), px = (e.clientX - rect.left) / rect.width * CH.w; let b = chartPts[0]; for (const p of chartPts) if (Math.abs(p.x - px) < Math.abs(b.x - px)) b = p; return { b, rect }; };
    svg.addEventListener('pointermove', e => {
      if (!chartPts.length) return;
      const { b, rect } = nearest(e);
      const cur = $('chartCursor'); cur.style.display = '';
      const line = $('chartCursorLine'); line.setAttribute('x1', b.x); line.setAttribute('x2', b.x);
      const dot = $('chartCursorDot');
      if (b.y != null) { dot.style.display = ''; dot.setAttribute('cx', b.x); dot.setAttribute('cy', b.y); } else dot.style.display = 'none';
      tip.style.display = 'block'; tip.textContent = `#${b.i + 1}  ${fmtSolve(b.s)}`;
      const wr = wrap.getBoundingClientRect();
      tip.style.left = (rect.left - wr.left + b.x / CH.w * rect.width) + 'px';
      tip.style.top = (rect.top - wr.top + (b.y != null ? b.y : CH.h / 2) / CH.h * rect.height) + 'px';
    });
    svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; const c = $('chartCursor'); if (c) c.style.display = 'none'; });
    svg.addEventListener('click', e => { if (chartPts.length) openSolve(nearest(e).b.s.id); });
  }
  function renderChart(svg, list) {
    const pts = list.map((s, i) => ({ i, v: effectiveMs(s), s }));
    const valid = pts.filter(p => isFinite(p.v));
    if (valid.length < 2) { svg.innerHTML = `<text x="${CH.w / 2}" y="${CH.h / 2}" fill="#8e8e93" font-size="13" text-anchor="middle" font-family="inherit">The chart appears after two solves</text>`; chartPts = []; return; }
    const ys = valid.map(p => p.v);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi === lo) { hi += 500; lo -= 500; }
    const pad = (hi - lo) * 0.08; lo = Math.max(0, lo - pad); hi += pad;
    const X = i => CH.l + (list.length === 1 ? 0 : i / (list.length - 1)) * (CH.w - CH.l - CH.r);
    const Y = v => CH.t + (1 - (v - lo) / (hi - lo)) * (CH.h - CH.t - CH.b);
    let g = '';
    for (let k = 0; k <= 4; k++) {
      const v = lo + (hi - lo) * k / 4, y = Y(v).toFixed(1);
      g += `<line x1="${CH.l}" x2="${CH.w - CH.r}" y1="${y}" y2="${y}" stroke="#2c2c2e" stroke-width="1"/>`;
      g += `<text x="${CH.l - 8}" y="${(+y + 4).toFixed(1)}" fill="#8e8e93" font-size="11" text-anchor="end" font-family="JetBrains Mono, monospace">${fmt(v)}</text>`;
    }
    g += `<text x="${CH.l}" y="${CH.h - 8}" fill="#8e8e93" font-size="11" font-family="inherit">1</text><text x="${CH.w - CH.r}" y="${CH.h - 8}" fill="#8e8e93" font-size="11" text-anchor="end" font-family="inherit">${list.length}</text>`;
    let d = '', pen = false;
    for (const p of pts) { if (!isFinite(p.v)) { pen = false; continue; } d += (pen ? 'L' : 'M') + X(p.i).toFixed(1) + ' ' + Y(p.v).toFixed(1); pen = true; }
    g += `<path d="${d}" fill="none" stroke="#4f8cff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (list.length <= 60) for (const p of valid) g += `<circle cx="${X(p.i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3" fill="#4f8cff" stroke="#141416" stroke-width="2"/>`;
    let d2 = ''; pen = false;
    for (let i = 11; i < list.length; i++) {
      const a = average(list.slice(i - 11, i + 1));
      if (!isFinite(a)) { pen = false; continue; }
      d2 += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(a).toFixed(1); pen = true;
    }
    if (d2) g += `<path d="${d2}" fill="none" stroke="#c97a1c" stroke-width="2" stroke-linejoin="round"/>`;
    for (const p of pts) if (!isFinite(p.v)) g += `<text x="${X(p.i).toFixed(1)}" y="${CH.h - CH.b + 14}" fill="#ff5c5c" font-size="9" text-anchor="middle" font-family="inherit">DNF</text>`;
    g += `<g id="chartCursor" style="display:none"><line id="chartCursorLine" y1="${CH.t}" y2="${CH.h - CH.b}" stroke="#8e8e93" stroke-width="1" stroke-dasharray="3 3"/><circle id="chartCursorDot" r="5" fill="#4f8cff" stroke="#fff" stroke-width="2"/></g>`;
    svg.innerHTML = g;
    chartPts = pts.map(p => ({ x: X(p.i), y: isFinite(p.v) ? Y(p.v) : null, s: p.s, i: p.i }));
  }
  $('btnStats').addEventListener('click', openStats);

  // ---- settings dialog ----
  function openSettings() {
    const sw = (id, label, sub, checked, disabled) => `<label class="row"><div>${label}${sub ? `<div class="sub">${sub}</div>` : ''}</div><span class="switch"><input type="checkbox" id="${id}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span class="knob"></span></span></label>`;
    const ev = event();
    openDialog(`<h2>Settings</h2>
      <div class="section-title">Timer</div><div class="group">
        <div class="row"><div>Time entry<div class="sub">Space bar timer or typing times into a box</div></div><select class="field" id="optInputMode" style="width:auto"><option value="timer"${state.inputMode === 'timer' ? ' selected' : ''}>Space bar</option><option value="typing"${state.inputMode === 'typing' ? ' selected' : ''}>Type times</option></select></div>
        ${sw('optInspection', '15 s inspection', ev.insp ? 'WCA +2 / DNF penalties' : 'Not available in this event', state.inspection && ev.insp, !ev.insp)}
        ${sw('optHideTime', 'Hide time while solving', '', state.hideTime)}
      </div>
      <div class="section-title">Panels</div><div class="group">
        ${sw('optImage', 'Scramble image', 'Puzzle state after the scramble', state.showImage)}
        ${sw('optStats', 'Averages under the timer', 'ao5 / ao12 (mo3 / ao5 for mean-of-3 events)', state.showStats)}
        ${sw('optDiff', 'Difference to previous solve', 'Green when faster, red when slower', state.showDiff)}
      </div>
      <div class="section-title">Shortcuts</div><div class="group">
        <div class="row"><div>Start</div><div class="sub">hold <span class="kbd">Space</span>, release when green</div></div>
        <div class="row"><div>Stop</div><div class="sub">any key</div></div>
        <div class="row"><div>Next / previous scramble</div><div class="sub"><span class="kbd">N</span> / <span class="kbd">P</span></div></div>
        <div class="row"><div>Cancel inspection</div><div class="sub"><span class="kbd">Esc</span></div></div>
      </div>
      <div class="actions"><button class="primary" id="dlgClose">Close</button></div>`);
    $('dlgClose').addEventListener('click', () => closeDialog());
    $('optInputMode').addEventListener('change', e => { state.inputMode = e.target.value; save(); applyInputMode(); });
    $('optInspection').addEventListener('change', e => { state.inspection = e.target.checked; save(); });
    $('optHideTime').addEventListener('change', e => { state.hideTime = e.target.checked; save(); });
    $('optImage').addEventListener('change', e => { state.showImage = e.target.checked; save(); renderImage(); });
    $('optStats').addEventListener('change', e => { state.showStats = e.target.checked; save(); renderImage(); });
    $('optDiff').addEventListener('change', e => { state.showDiff = e.target.checked; save(); renderDiff(); });
  }
  $('btnSettings').addEventListener('click', openSettings);

  // =====================================================================
  //  Sessions & events
  // =====================================================================
  function switchSession(id) {
    if (!state.sessions.some(s => s.id === id)) return;
    cancelTiming();
    state.current = id; resetDisplay(); save(); render(); resetScrambles(); setPhase('idle');
  }
  el.sessionSel.addEventListener('change', () => { switchSession(el.sessionSel.value); el.sessionSel.blur(); });
  $('btnNewSession').addEventListener('click', async () => {
    const r = await sessionForm({ title: 'New session', name: `Session ${state.sessions.length + 1}`, type: 'normal', ok: 'Create' });
    if (!r) return;
    const s = { id: uid(), name: r.name || `Session ${state.sessions.length + 1}`, type: r.type, target: r.target, relay: r.relay, event: r.relay ? r.relay[0] : session().event, solves: [] };
    state.sessions.push(s);
    switchSession(s.id);
  });
  $('btnRename').addEventListener('click', async () => {
    const cur = session();
    const r = await sessionForm({ title: 'Edit session', name: cur.name, type: cur.type, target: cur.target, relay: cur.relay, ok: 'Save' });
    if (!r) return;
    const relayChanged = r.type === 'relay' && JSON.stringify(r.relay) !== JSON.stringify(cur.relay || []);
    cur.name = r.name || cur.name; cur.type = r.type; cur.target = r.target; cur.relay = r.relay;
    if (r.relay) cur.event = r.relay[0];
    save(); render();
    if (relayChanged || (r.type !== 'relay') !== !relayScr) resetScrambles();
  });
  $('btnDeleteSession').addEventListener('click', async () => {
    if (state.sessions.length <= 1) return;
    const s = session();
    if (!await ask({ title: `Delete session “${s.name}”?`, message: `The session has ${s.solves.length} solves across all events. This cannot be undone.`, ok: 'Delete', danger: true })) return;
    state.sessions = state.sessions.filter(x => x.id !== s.id);
    switchSession(state.sessions[0].id);
  });
  // Changing the event keeps the session; it only changes which scrambles are generated.
  el.eventSel.addEventListener('change', () => {
    session().event = el.eventSel.value;
    cancelTiming(); resetDisplay(); save(); render(); resetScrambles(); setPhase('idle');
    el.eventSel.blur();
  });
  $('btnClear').addEventListener('click', async () => {
    if (!solves().length) return;
    if (!await ask({ title: 'Clear times?', message: `All ${solves().length} solves in session “${session().name}” will be deleted.`, ok: 'Clear', danger: true })) return;
    session().solves = []; resetDisplay(); save(); render();
  });
  $('btnExport').addEventListener('click', () => {
    const list = solves();
    if (!list.length) return;
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = ['no,time_ms,penalty,result,event,scramble,date'];
    list.forEach((s, i) => lines.push([i + 1, s.ms, s.penalty || '', fmtSolve(s), s.event, q(s.scramble), s.date].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cube-timer-${session().name.replace(/[^\w-]+/g, '_')}-${session().event}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---- init ----
  load();
  el.timer.textContent = zero();
  render();
  resetScrambles();
  setPhase('idle');
  applyInputMode();
})();
