import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { buildModel, sampleModel } from "../lib/loadModel";
import { estimate, PRINTERS } from "../lib/printers";

function viaStl(geo: THREE.BufferGeometry, name: string) {
  const buf = new STLExporter().parse(new THREE.Mesh(geo), { binary: true }) as DataView;
  const parsed = new STLLoader().parse(buf.buffer as ArrayBuffer);
  return buildModel(new THREE.Mesh(parsed), { name, format: "STL", zUp: true, defaultUnit: "mm" });
}

const cube = viaStl(new THREE.BoxGeometry(20, 20, 20), "cube");
console.log("cube 20mm: volume", cube.volume.toFixed(2), "expected 8000; badEdges", cube.badEdges, "size", cube.size.toArray());

const r = 15;
const sphere = viaStl(new THREE.SphereGeometry(r, 256, 128), "sphere");
console.log("sphere r15: volume", sphere.volume.toFixed(1), "expected ~", ((4 / 3) * Math.PI * r ** 3).toFixed(1), "badEdges", sphere.badEdges);

// Inverted normals should still give positive volume
const flipped = new THREE.BoxGeometry(10, 10, 10).toNonIndexed();
const p = flipped.getAttribute("position");
for (let i = 0; i < p.count; i += 3) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)); p.setXYZ(i + 1, x, y, z); }
console.log("flipped cube 10mm:", buildModel(new THREE.Mesh(flipped), { name: "f", format: "x", zUp: false, defaultUnit: "mm" }).volume.toFixed(2));

// Open mesh detection
const open = new THREE.PlaneGeometry(10, 10);
console.log("plane badEdges (should be >0):", buildModel(new THREE.Mesh(open), { name: "p", format: "x", zUp: false, defaultUnit: "mm" }).badEdges);

const s = sampleModel();
console.log("sample knot ml:", (s.volume / 1000).toFixed(2), "badEdges", s.badEdges, "size", s.size.toArray().map((v) => v.toFixed(1)));

// 8000 mm³ = 8 ml; at 0% waste, density 1.1, $28/kg -> 8.8 g -> $0.2464; Form 4 $149/L -> $1.192
for (const pr of [PRINTERS[0], PRINTERS[7]]) {
  const e = estimate(pr, pr.resin.price, 8000, { x: 20, y: 20, z: 20 }, 0, 1.1);
  console.log(pr.model, "cost", e.cost.toFixed(4), "fit", e.fit, "hours", e.hours.toFixed(2));
}
console.log("fit rotate check:", estimate(PRINTERS[1], 28, 1, { x: 10, y: 10, z: 150 }, 0, 1.1).fit, "/ too big:", estimate(PRINTERS[1], 28, 1, { x: 400, y: 10, z: 10 }, 0, 1.1).fit);
