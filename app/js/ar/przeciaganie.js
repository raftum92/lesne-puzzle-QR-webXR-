// Przeciąganie elementów palcem po podłodze: promień dotyku, punkt na planszy, przyciąganie do miejsca.
// Ten moduł nie zna Three.js. Pozycje elementów zmienia sam, a rysowanie zostawia wywołującemu.
import { pickPiece, clampToArea, shouldSnap, isNear, intersectBoard, targetOf } from "./uklad.js";

export class Dragger {
  // `bottom` to największe z dla przeciąganego elementu (clampToArea); bez niego obowiązuje zwykły obszar.
  constructor({ pieces, level, bottom, toBoard, onPick, onMove, onNear, onSnap, onDrop }) {
    Object.assign(this, { pieces, level, bottom, toBoard, onPick, onMove, onNear, onSnap, onDrop });
    this.enabled = true;
    this.drag = null;
    this.near = null;
  }

  // Liczy się tylko palec, który chwycił element; pozostałe są ignorowane.
  pointer(type, ray, id) {
    if (type === "down") this.grab(ray, id);
    else if (this.drag?.id !== id) return;
    else if (type === "move") this.move(ray);
    else if (type === "up") this.release();
  }

  point(ray) {
    const { origin, direction } = this.toBoard(ray);
    return intersectBoard(origin, direction);
  }

  grab(ray, id) {
    if (!this.enabled || this.drag) return;
    const point = this.point(ray);
    const piece = point && pickPiece(this.pieces, point, this.level);
    if (!piece) return;
    // Punkt chwytu zostaje pod palcem przez całe przeciąganie, jak w puzzle.js.
    this.drag = { piece, id, dx: piece.x - point.x, dz: piece.z - point.z };
    this.onPick(piece);
  }

  move(ray) {
    const point = this.point(ray);
    if (!point) return; // promień prawie równoległy do planszy: element czeka na miejscu
    const { piece, dx, dz } = this.drag;
    Object.assign(piece, clampToArea({ x: point.x + dx, z: point.z + dz }, this.bottom));
    this.onMove(piece);
    this.setNear(this.level.hints && isNear(piece, piece, this.level) ? piece : null);
  }

  release() {
    const { piece } = this.drag;
    this.drag = null;
    this.setNear(null);
    if (!shouldSnap(piece, piece, this.level)) return this.onDrop(piece);
    Object.assign(piece, targetOf(piece.r, piece.c, this.level), { placed: true });
    this.onSnap(piece);
  }

  // Palec mógł zniknąć bez końca dotyku, na przykład po schowaniu sesji.
  cancel() {
    if (!this.drag) return;
    const { piece } = this.drag;
    this.drag = null;
    this.setNear(null);
    this.onDrop(piece);
  }

  setNear(piece) {
    if (piece === this.near) return;
    this.near = piece;
    this.onNear(piece);
  }
}
