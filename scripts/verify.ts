import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { buildModel, sampleModel } from "../lib/loadModel";

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

// ---- AMFG quotes on the sample part ----
import { quoteSLA, quotePolyJet, quoteFDM, SLA, POLYJET, FDM } from "../lib/quote";
{
  const m = sampleModel();
  const input = { volume: m.volume, area: m.area, size: { x: m.size.x, y: m.size.y, z: m.size.z }, supportVolume: m.supportVolume, quantity: 1, productionTime: 1 };
  console.log("support cm3:", (m.supportVolume / 1000).toFixed(2), "area mm2:", m.area.toFixed(0));
  const sla = quoteSLA(input, SLA.resins[0].costPerMm3, 0.05);
  console.log("SLA", sla.total.toFixed(2), sla.items.map((i) => i.value.toFixed(2)));
  const pj = quotePolyJet(input, POLYJET.materials[0].costPerMm3);
  console.log("PolyJet", pj.total.toFixed(2), pj.items.map((i) => i.value.toFixed(2)));
  const fdm = quoteFDM(input, FDM.materials[0]);
  console.log("FDM", fdm.total.toFixed(2), fdm.items.map((i) => i.value.toFixed(2)), fdm.notes);
  console.log("SLA qty10 next-day total:", quoteSLA({ ...input, quantity: 10, productionTime: 1.5 }, 0.000174, 0.05).total.toFixed(2));
  // Support sanity: a 20mm cube on the plate needs ~0 support; an L-overhang needs some.
  const cube = buildModel(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20)), { name: "c", format: "x", zUp: false, defaultUnit: "mm" });
  console.log("cube support (≈0):", cube.supportVolume.toFixed(1));
  const t = new THREE.Mesh(new THREE.BoxGeometry(40, 4, 40)); t.position.y = 30;
  const post = new THREE.Mesh(new THREE.BoxGeometry(10, 30, 10)); post.position.y = 15;
  const g = new THREE.Group(); g.add(t, post);
  const mush = buildModel(g, { name: "m", format: "x", zUp: false, defaultUnit: "mm" });
  console.log("mushroom size", mush.size.toArray(), "support", mush.supportVolume.toFixed(0));
}
