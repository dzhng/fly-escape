import * as THREE from "three";

/** World-space billboards inherit each fly's displayed size, without inheriting its roll. */
export class FlyOutcomes {
  readonly root = new THREE.Group();
  private readonly materials = {
    zapped: iconMaterial("☠", "#fff5dd", "#523e57"),
    escaped: iconMaterial("✓", "#fff7c7", "#397550"),
  };
  private readonly markers: THREE.Sprite[];
  constructor(count: number) {
    this.markers = Array.from({ length: count }, () => {
      const marker = new THREE.Sprite(this.materials.zapped);
      marker.visible = false;
      this.root.add(marker);
      return marker;
    });
  }
  set(index: number, outcome?: "zapped" | "escaped") {
    const marker = this.markers[index];
    marker.visible = outcome !== undefined;
    if (outcome) marker.material = this.materials[outcome];
  }
  update(flies: readonly THREE.Object3D[], nativeSpan: number, nativeScale: THREE.Vector3) {
    this.markers.forEach((marker, index) => {
      if (!marker.visible) return;
      const fly = flies[index];
      const span = nativeSpan * fly.scale.x / nativeScale.x;
      marker.position.copy(fly.position);
      marker.position.y += span * 1.15;
      marker.scale.setScalar(span * 0.5);
    });
  }
  dispose() {
    // Both shared materials must be disposed even if no fly used that outcome.
    this.root.clear();
    for (const material of Object.values(this.materials)) {
      material.map?.dispose();
      material.dispose();
    }
  }
}

function iconMaterial(glyph: string, ink: string, background: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = background;
  context.beginPath();
  context.arc(64, 64, 55, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = ink;
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = ink;
  context.font = 'bold 82px "Arial Unicode MS", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(glyph, 64, 67);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false });
}
