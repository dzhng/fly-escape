import * as THREE from 'three';

/** Soft atmospheric glow; it has no physical or sensory effect. */
export function sunGlow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const glow = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,244,166,0.65)');
  glow.addColorStop(0.12, 'rgba(255,227,122,0.38)');
  glow.addColorStop(0.4, 'rgba(255,208,99,0.12)');
  glow.addColorStop(1, 'rgba(255,203,89,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}));
}
