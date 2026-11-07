// Elementy puzzli i plansza w 3D, z tych samych obrysów co gra na ekranie (ksztalty.js).
import * as THREE from "../../vendor/three.module.min.js";
import { pieceOutline } from "../ksztalty.js";
import { BOARD_H, THICKNESS, cellSize } from "./uklad.js";

const CURVE_SEGMENTS = 8;
const CARDBOARD = 0xc9b48f;
const SEAM = 0x000000;
const NEAR_COLOR = 0xe3a75b; // bursztyn z interfejsu gry

// Warstwy leżące płasko, każda minimalnie wyżej. Rysujemy je w ustalonej kolejności, bo są przezroczyste
// i Three.js układałby je według odległości od kamery.
const LAYER = { base: 0, ghost: 0.0003, slot: 0.0006, line: 0.0009, peek: 0.0012, shadow: 0.0015 };
const ORDER = { base: 1, ghost: 2, slot: 3, line: 4, peek: 5, shadow: 6, seam: 7 };

// Obrys elementu jako kształt Three.js: y kształtu to odwrócona oś z planszy, względem punktu (cx, cz).
function outlineShape(cuts, r, c, level, cx = 0, cz = 0) {
  const { cw, ch } = cellSize(level);
  const edges = pieceOutline(cuts, r, c, cw, ch);
  const point = ([x, y]) => [x - cx, -(y - cz)];
  const shape = new THREE.Shape();
  shape.moveTo(...point(edges[0][0]));
  for (const chain of edges) {
    for (let i = 1; i < chain.length; i += 3) {
      shape.bezierCurveTo(...point(chain[i]), ...point(chain[i + 1]), ...point(chain[i + 2]));
    }
  }
  return shape;
}

function outlineLine(shape, material) {
  const points = shape.getPoints(CURVE_SEGMENTS).map(({ x, y }) => new THREE.Vector3(x, 0, -y));
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
}

// Element jako kawałek tektury: wierzch z obrazkiem, boki w kolorze tektury, środek komórki w początku układu.
export function createPieceMesh(cuts, r, c, level, texture, shadowTexture = null) {
  const { cw, ch } = cellSize(level);
  const cx = (c + 0.5) * cw;
  const cz = (r + 0.5) * ch;
  const shape = outlineShape(cuts, r, c, level, cx, cz);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: THICKNESS, bevelEnabled: false, curveSegments: CURVE_SEGMENTS });
  geometry.rotateX(-Math.PI / 2);
  // Współrzędne obrazka liczymy od nowa, żeby każdy element pokazywał swój kawałek tego samego zdjęcia.
  const { position, uv } = geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, position.getX(i) + cx, 1 - (position.getZ(i) + cz) / BOARD_H);
  }
  const mesh = new THREE.Mesh(geometry, [
    new THREE.MeshBasicMaterial({ map: texture }),
    new THREE.MeshBasicMaterial({ color: CARDBOARD }),
  ]);
  const group = new THREE.Group();
  const seam = outlineLine(shape, new THREE.LineBasicMaterial({ color: SEAM, transparent: true, opacity: 0.35 }));
  seam.position.y = THICKNESS + 0.0005;
  seam.renderOrder = ORDER.seam;
  group.add(mesh, seam);
  let shadow = null;
  if (shadowTexture) {
    const material = new THREE.MeshBasicMaterial({ color: 0x000000, map: shadowTexture, transparent: true, opacity: 0.45, depthWrite: false });
    shadow = new THREE.Mesh(new THREE.PlaneGeometry(cw * 1.35, ch * 1.35).rotateX(-Math.PI / 2), material);
    shadow.position.y = LAYER.shadow - 0.002;
    shadow.renderOrder = ORDER.shadow;
    group.add(shadow);
  }
  group.userData = { mesh, shadow };
  return group;
}

export function createShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 10, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.format = THREE.RGBAFormat;
  return texture;
}

function flatPlane(material, layer, width = 1, depth = BOARD_H) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), material);
  mesh.position.set(0.5, LAYER[layer], BOARD_H / 2);
  mesh.renderOrder = ORDER[layer];
  return mesh;
}

function pictureTexture(image, gray) {
  let source = image;
  if (gray) {
    source = document.createElement("canvas");
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const ctx = source.getContext("2d");
    ctx.filter = "grayscale(1)";
    ctx.drawImage(image, 0, 0);
  }
  const texture = new THREE.Texture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// Plansza: ciemna podstawa, obrazek-podpowiedź według poziomu i obrysy miejsc.
export function createBoard(cuts, level, image) {
  const group = new THREE.Group();
  const overlay = { transparent: true, depthWrite: false };
  group.add(flatPlane(new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.35, ...overlay }), "base", 1.03, BOARD_H + 0.03));
  if (level.ghost > 0) {
    const map = pictureTexture(image, level.mono);
    group.add(flatPlane(new THREE.MeshBasicMaterial({ map, opacity: level.ghost, ...overlay }), "ghost"));
  }
  const peek = flatPlane(new THREE.MeshBasicMaterial({ map: pictureTexture(image, false), ...overlay }), "peek");
  peek.visible = false;
  group.add(peek);
  const slots = [];
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const shape = outlineShape(cuts, r, c, level);
      const fill = new THREE.Mesh(
        new THREE.ShapeGeometry(shape, CURVE_SEGMENTS).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.1, side: THREE.DoubleSide, ...overlay }),
      );
      fill.position.y = LAYER.slot;
      fill.renderOrder = ORDER.slot;
      const line = outlineLine(shape, lineMaterial);
      line.position.y = LAYER.line;
      line.renderOrder = ORDER.line;
      group.add(fill, line);
      slots.push(fill);
    }
  }
  return {
    group,
    setNear(index) {
      slots.forEach((fill, i) => {
        fill.material.color.setHex(i === index ? NEAR_COLOR : 0xffffff);
        fill.material.opacity = i === index ? 0.35 : 0.1;
      });
    },
    setFilled(index) {
      slots[index].visible = false;
    },
    setPeek(on) {
      peek.visible = on;
    },
  };
}
