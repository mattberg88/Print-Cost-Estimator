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
