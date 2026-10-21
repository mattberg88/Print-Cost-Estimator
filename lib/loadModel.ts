import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { badEdgeCount, signedVolume, surfaceArea } from "./geometry";
import type { Unit } from "./printers";

export const ACCEPTED_EXTENSIONS = ["stl", "obj", "3mf", "ply", "glb", "gltf"] as const;

export interface LoadedModel {
  id: string;
  name: string;
  format: string;
  /** Y-up, in file units, centered on X/Z and resting on y = 0. */
  geometry: THREE.BufferGeometry;
  /** Volume in file units³. */
  volume: number;
  /** Surface area in file units². */
  area: number;
  /** Bounding box size in file units (x = width, y = height, z = depth). */
  size: THREE.Vector3;
  triangles: number;
  parts: number;
  badEdges: number;
  defaultUnit: Unit;
}

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function parseToObject(file: File, ext: string): Promise<THREE.Object3D> {
  switch (ext) {
    case "stl": {
      const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
      return new THREE.Mesh(new STLLoader().parse(await file.arrayBuffer()));
    }
    case "ply": {
      const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js");
      return new THREE.Mesh(new PLYLoader().parse(await file.arrayBuffer()));
    }
    case "obj": {
      const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
      return new OBJLoader().parse(await file.text());
    }
    case "3mf": {
      const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
      return new ThreeMFLoader().parse(await file.arrayBuffer());
    }
    case "glb":
    case "gltf": {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
      loader.setDRACOLoader(draco);
      const data = ext === "glb" ? await file.arrayBuffer() : await file.text();
      const gltf = await loader.parseAsync(data, "");
      draco.dispose();
      return gltf.scene;
    }
    default:
      throw new Error(`Unsupported file type ".${ext}". Try STL, OBJ, 3MF, PLY or GLB.`);
  }
}

export function buildModel(
  object: THREE.Object3D,
  opts: { name: string; format: string; zUp: boolean; defaultUnit: Unit },
): LoadedModel {
  object.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  let volume = 0;
  let area = 0;
  let badEdges = 0;

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.getAttribute("position")) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", mesh.geometry.getAttribute("position").clone());
    if (mesh.geometry.getIndex()) g.setIndex(mesh.geometry.getIndex()!.clone());
    g.applyMatrix4(mesh.matrixWorld);
    // abs() per part so a part with inverted normals still counts as solid.
    volume += Math.abs(signedVolume(g));
    area += surfaceArea(g);
    badEdges += badEdgeCount(g);
    parts.push(g.index ? g.toNonIndexed() : g);
  });

  if (!parts.length) throw new Error("No mesh data found in this file.");

  const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (!geometry) throw new Error("Couldn't combine the meshes in this file.");
  if (opts.zUp) geometry.rotateX(-Math.PI / 2);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -box.min.y, -center.z);
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();

  return {
    id: `${opts.name}-${Date.now()}`,
    name: opts.name,
    format: opts.format,
    geometry,
    volume,
    area,
    size: geometry.boundingBox!.getSize(new THREE.Vector3()),
    triangles: geometry.getAttribute("position").count / 3,
    parts: parts.length,
    badEdges,
    defaultUnit: opts.defaultUnit,
  };
}

export async function loadModelFile(file: File): Promise<LoadedModel> {
  const ext = extOf(file.name);
  const object = await parseToObject(file, ext);
  const isGltf = ext === "glb" || ext === "gltf";
  return buildModel(object, {
    name: file.name,
    format: ext.toUpperCase(),
    // STL / 3MF / PLY are conventionally Z-up (slicer space); OBJ and glTF are Y-up.
    zUp: ext === "stl" || ext === "3mf" || ext === "ply",
    // glTF is defined in meters; the rest are almost always millimeters.
    defaultUnit: isGltf ? "m" : "mm",
  });
}

/** A sample part so the app is usable without a file: a 30 mm torus knot. */
export function sampleModel(): LoadedModel {
  const geo = new THREE.TorusKnotGeometry(14, 4.5, 300, 40);
  return buildModel(new THREE.Mesh(geo), {
    name: "Sample torus knot",
    format: "Sample",
    zUp: false,
    defaultUnit: "mm",
  });
}
