import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();

function forEachTriangle(geo: THREE.BufferGeometry, fn: (i0: number, i1: number, i2: number) => void) {
  const index = geo.getIndex();
  const count = index ? index.count : geo.getAttribute("position").count;
  for (let i = 0; i + 2 < count; i += 3) {
    if (index) fn(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    else fn(i, i + 1, i + 2);
  }
}

/**
 * Signed volume of a closed mesh via the divergence theorem: sum of the signed
 * volumes of tetrahedra formed by each triangle and the origin.
 */
export function signedVolume(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute("position");
  let v = 0;
  forEachTriangle(geo, (i0, i1, i2) => {
    _a.fromBufferAttribute(pos, i0);
    _b.fromBufferAttribute(pos, i1);
    _c.fromBufferAttribute(pos, i2);
    v += _a.dot(_ab.crossVectors(_b, _c));
  });
  return v / 6;
}

export function surfaceArea(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute("position");
  let area = 0;
  forEachTriangle(geo, (i0, i1, i2) => {
    _a.fromBufferAttribute(pos, i0);
    _b.fromBufferAttribute(pos, i1);
    _c.fromBufferAttribute(pos, i2);
    _ab.subVectors(_b, _a);
    _ac.subVectors(_c, _a);
    area += _ab.cross(_ac).length() / 2;
  });
  return area;
}

/**
 * Estimates support volume with the part laid so its shortest bounding-box
 * side is vertical ("z-minimised"). Builds a top-surface heightmap and
 * returns (space under the top surface) − (part volume): the empty space
 * beneath the part that support material would fill. Approximate.
 */
export function estimateSupportVolume(geo: THREE.BufferGeometry, partVolume: number, resolution = 220): number {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const ext = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
  const mins = [bb.min.x, bb.min.y, bb.min.z];
  const up = ext.indexOf(Math.min(...ext));
  const [ua, va] = [0, 1, 2].filter((a) => a !== up);
  const cell = Math.max(ext[ua], ext[va]) / resolution;
  if (!(cell > 0)) return 0;
  const nu = Math.max(1, Math.ceil(ext[ua] / cell));
  const nv = Math.max(1, Math.ceil(ext[va] / cell));
  const top = new Float32Array(nu * nv).fill(-1);
  const pos = geo.getAttribute("position");
  const P = [new Float64Array(3), new Float64Array(3), new Float64Array(3)];
  const clampU = (x: number) => Math.min(nu - 1, Math.max(0, x));
  const clampV = (x: number) => Math.min(nv - 1, Math.max(0, x));

  forEachTriangle(geo, (i0, i1, i2) => {
    [i0, i1, i2].forEach((idx, k) => {
      const c = [pos.getX(idx), pos.getY(idx), pos.getZ(idx)];
      P[k][0] = (c[ua] - mins[ua]) / cell;
      P[k][1] = (c[va] - mins[va]) / cell;
      P[k][2] = c[up] - mins[up];
      // Splat vertices so tiny triangles still register.
      const ci = clampV(Math.floor(P[k][1])) * nu + clampU(Math.floor(P[k][0]));
      if (P[k][2] > top[ci]) top[ci] = P[k][2];
    });
    const [a, b, c] = P;
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(det) < 1e-12) return;
    const u0 = clampU(Math.floor(Math.min(a[0], b[0], c[0])));
    const u1 = clampU(Math.ceil(Math.max(a[0], b[0], c[0])));
    const v0 = clampV(Math.floor(Math.min(a[1], b[1], c[1])));
    const v1 = clampV(Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let v = v0; v <= v1; v++) {
      const py = v + 0.5;
      for (let u = u0; u <= u1; u++) {
        const px = u + 0.5;
        const w0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / det;
        const w1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / det;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const h = w0 * a[2] + w1 * b[2] + w2 * c[2];
        const ci = v * nu + u;
        if (h > top[ci]) top[ci] = h;
      }
    }
  });

  let shadow = 0;
  for (let i = 0; i < top.length; i++) if (top[i] > 0) shadow += top[i];
  shadow *= cell * cell;
  return Math.max(0, shadow - partVolume);
}

/**
 * Counts edges that aren't shared by exactly two triangles. Zero means the
 * mesh is closed (watertight), which is what makes the volume trustworthy.
 */
export function badEdgeCount(geo: THREE.BufferGeometry): number {
  const posOnly = new THREE.BufferGeometry();
  posOnly.setAttribute("position", geo.getAttribute("position"));
  if (geo.getIndex()) posOnly.setIndex(geo.getIndex());
  const welded = mergeVertices(posOnly, 1e-5);
  const n = welded.getAttribute("position").count;
  const edges = new Map<number, number>();
  const add = (u: number, w: number) => {
    if (u === w) return;
    const key = u < w ? u * n + w : w * n + u;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  };
  forEachTriangle(welded, (i0, i1, i2) => {
    add(i0, i1);
    add(i1, i2);
    add(i2, i0);
  });
  let bad = 0;
  edges.forEach((c) => {
    if (c !== 2) bad++;
  });
  welded.dispose();
  return bad;
}
