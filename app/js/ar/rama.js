// Obraz w ramie: leży na planszy, wstaje, a potem gra na nim film.
import * as THREE from "../../vendor/three.module.min.js";
import { BOARD_H, FRAME_SCALE, THICKNESS } from "./uklad.js";
import { JUMP_PICTURE, KEY, jumpPlane } from "./skok.js";

const BAR = 34 / 900; // szerokość listwy ramy, taka sama jak w filmie ze skokiem
const DEPTH = 0.02; // grubość ramy
const WOOD = 0x7a5230;

const easeInOut = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const mix = (a, b, k) => a + (b - a) * k;

// Układ grupy: początek to środek dolnej krawędzi ramy. Leżąc, obraz pokrywa planszę,
// a stojąc, ma dolną krawędź na dalszym brzegu planszy i patrzy na gracza.
const LYING = { y: THICKNESS + 0.004, z: BOARD_H + BAR, rotation: -Math.PI / 2, scale: 1 }; // nad ułożonymi elementami
const STANDING = { y: 0, z: 0, rotation: 0, scale: FRAME_SCALE };

export class Frame {
  constructor({ parent, animator, image }) {
    this.animator = animator;
    this.group = new THREE.Group();
    this.group.position.x = 0.5;
    // Przezroczysty obraz nie może zapisywać głębi, bo zasłaniałby leżącą pod nim planszę.
    this.material = new THREE.MeshBasicMaterial({ map: pictureTexture(image), transparent: true, opacity: 0, depthWrite: false });
    const picture = new THREE.Mesh(new THREE.PlaneGeometry(1, BOARD_H), this.material);
    picture.position.set(0, BAR + BOARD_H / 2, 0.001);
    picture.renderOrder = 11;
    this.wood = new THREE.MeshBasicMaterial({ color: WOOD, transparent: true, opacity: 0 });
    this.back = new THREE.Mesh(new THREE.BoxGeometry(1 + BAR * 2, BOARD_H + BAR * 2, DEPTH), this.wood);
    this.back.position.set(0, BAR + BOARD_H / 2, -DEPTH / 2);
    this.back.renderOrder = 10;
    this.back.visible = false;
    this.group.add(this.back, picture);
    this.applyPose(0);
    parent.add(this.group);
  }

  // Postęp od 0 (leży) do 1 (stoi).
  applyPose(k) {
    this.group.position.y = mix(LYING.y, STANDING.y, k);
    this.group.position.z = mix(LYING.z, STANDING.z, k);
    this.group.rotation.x = mix(LYING.rotation, STANDING.rotation, k);
    this.group.scale.setScalar(mix(LYING.scale, STANDING.scale, k));
    this.wood.opacity = Math.min(1, k * 4);
    this.back.visible = k > 0;
  }

  show(ms) {
    return this.animator.add(ms, (e) => (this.material.opacity = e));
  }

  hide(ms = 0) {
    const from = this.material.opacity;
    return this.animator.add(ms, (e) => (this.material.opacity = from * (1 - e)));
  }

  rise(ms = 1300) {
    return this.animator.add(ms, (e) => this.applyPose(e), easeInOut);
  }

  lower(ms = 700) {
    return this.animator.add(ms, (e) => this.applyPose(1 - e), easeInOut);
  }

  play(video) {
    this.setMap(mediaTexture(video));
  }

  showImage(image) {
    this.setMap(pictureTexture(image));
  }

  // Film ze skokiem na płaszczyźnie większej niż rama. Obraz z filmu pokrywa obraz w ramie, a zielone tło znika.
  showJump(video, fadeMs) {
    if (!this.jump) {
      const { width, height } = jumpPlane(1);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: null },
          picture: {
            value: new THREE.Vector4(
              JUMP_PICTURE.x,
              1 - JUMP_PICTURE.y - JUMP_PICTURE.h,
              JUMP_PICTURE.x + JUMP_PICTURE.w,
              1 - JUMP_PICTURE.y,
            ),
          },
          key: { value: new THREE.Vector3(KEY.low, KEY.high, KEY.spill) },
          opacity: { value: 0 },
        },
        vertexShader: JUMP_VERTEX,
        fragmentShader: JUMP_FRAGMENT,
        transparent: true,
        depthTest: false, // zwierzę jest zawsze na wierzchu, także przed podłogą w symulatorze
        depthWrite: false,
        toneMapped: false,
      });
      this.jump = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      this.jump.position.set(0, BAR + BOARD_H / 2, 0.002);
      this.jump.renderOrder = 12;
      this.group.add(this.jump);
    }
    const { map, opacity } = this.jump.material.uniforms;
    map.value = rawVideoTexture(video);
    opacity.value = 0;
    this.jump.visible = true;
    return this.animator.add(fadeMs, (e) => (opacity.value = e));
  }

  hideJump() {
    if (this.jump) this.jump.visible = false;
  }

  get jumpVisible() {
    return this.jump?.visible ?? false;
  }

  setMap(texture) {
    this.material.map?.dispose();
    this.material.map = texture;
    this.material.needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
    this.material.map?.dispose();
    this.material.dispose();
    this.wood.dispose();
    this.jump?.material.uniforms.map.value?.dispose();
    this.jump?.material.dispose();
    for (const child of this.group.children) child.geometry.dispose();
  }
}

const JUMP_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Kolory bez konwersji, bo próg tła jest dobrany do wartości z pliku. W obrazie nic nie znika, bo mech też jest zielony.
const JUMP_FRAGMENT = `
  uniform sampler2D map;
  uniform vec4 picture;
  uniform vec3 key;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    vec4 color = texture2D(map, vUv);
    if (vUv.x > picture.x && vUv.x < picture.z && vUv.y > picture.y && vUv.y < picture.w) {
      gl_FragColor = vec4(color.rgb, opacity);
      return;
    }
    float others = max(color.r, color.b);
    float excess = color.g - others;
    float alpha = 1.0 - smoothstep(key.x, key.y, excess);
    // Krawędzie filmu wtapiają się w pokój: zwierzę bywa większe niż kadr i byłoby ucięte prostą linią.
    alpha *= smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.97, vUv.y);
    alpha *= smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
    // Krawędź futra to mieszanka futra i tła: bez nadmiaru zieleni rude futro nie robi się oliwkowe.
    float green = mix(color.g, min(color.g, (color.r + color.b) * 0.5 + key.z), smoothstep(-0.08, 0.04, excess));
    gl_FragColor = vec4(color.r, green, color.b, alpha * opacity);
  }
`;

function pictureTexture(image) {
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// Jedna tekstura na element wideo: każda VideoTexture zostawia po sobie własną pętlę requestVideoFrameCallback.
const videoTextures = new WeakMap();

function rawVideoTexture(video) {
  let texture = videoTextures.get(video);
  if (!texture) {
    texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.NoColorSpace;
    videoTextures.set(video, texture);
  }
  return texture;
}

function mediaTexture(video) {
  let texture = videoTextures.get(video);
  if (!texture) {
    texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    videoTextures.set(video, texture);
  }
  return texture;
}
