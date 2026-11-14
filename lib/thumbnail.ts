import * as THREE from "three";
import type { LoadedModel } from "./loadModel";

/**
 * Renders a small static preview image of a part (front-right, slightly above),
 * on a light background, using one shared offscreen renderer.
 */

let renderer: THREE.WebGLRenderer | null = null;
const SIZE = 320;

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  return renderer;
}

export function renderThumbnail(model: LoadedModel): string {
  try {
    const r = getRenderer();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f1f1");
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa0aa, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1, 1.6, 1.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-1.2, 0.6, -1);
    scene.add(fill);

    const mat = new THREE.MeshStandardMaterial({ color: "#9a9a9a", roughness: 0.6, metalness: 0.05 });
    const mesh = new THREE.Mesh(model.geometry, mat);
    scene.add(mesh);

    const box = model.geometry.boundingBox ?? new THREE.Box3().setFromBufferAttribute(model.geometry.getAttribute("position") as THREE.BufferAttribute);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 1e-6);
    const cam = new THREE.PerspectiveCamera(30, 1, radius / 100, radius * 100);
    const dir = new THREE.Vector3(0.9, 0.7, 1.25).normalize();
    cam.position.copy(center).addScaledVector(dir, (radius / Math.sin(THREE.MathUtils.degToRad(15))) * 1.05);
    cam.lookAt(center);

    r.render(scene, cam);
    const url = r.domElement.toDataURL("image/png");
    mat.dispose();
    return url;
  } catch {
    return "";
  }
}
