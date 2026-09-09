/** Projection and compound sampling are shared by acquisition and its recorded-image display. */
export type RetinaProfile = {
  width: number;
  height: number;
  radius: number;
  distortion: number;
  zoom: number;
};

export const retinaProfile: Readonly<RetinaProfile> = Object.freeze({
  width: 128, height: 128, radius: 15, distortion: 3.8, zoom: 2.72,
});

export const retinaCameraProjection = Object.freeze({
  verticalFovDegrees: 157, aspect: 450 / 512, nearMetres: 0.00001, farMetres: 100,
});

export class RetinaProjection {
  readonly cells: readonly { q: number; r: number; x: number; y: number }[];
  private readonly pixelCells: Int16Array;
  private readonly pixelCounts: Uint16Array;
  private readonly sourcePixels: Int32Array;


  readonly profile: Readonly<RetinaProfile>;

  constructor(profile: Readonly<RetinaProfile>) {
    const { width, height, radius, distortion, zoom } = profile;
    this.profile = Object.freeze({ width, height, radius, distortion, zoom });
    if (![width, height, radius].every(Number.isInteger) || width < 16 || width > 256
      || height < 16 || height > 256 || radius < 3 || radius > 15
      || !Number.isFinite(distortion) || distortion < 0 || !Number.isFinite(zoom) || zoom <= 0)
      throw new Error("Invalid retinal projection");
    const cells = [];
    for (let r = -radius; r <= radius; r++) for (let q = -radius; q <= radius; q++) {
      if (Math.abs(q + r) <= radius) cells.push({ q, r, x: q + r / 2, y: r * Math.sqrt(3) / 2 });
    }
    this.cells = Object.freeze(cells.map(cell => Object.freeze(cell)));
    this.pixelCells = new Int16Array(width * height).fill(-1);
    this.sourcePixels = new Int32Array(width * height).fill(-1);
    this.pixelCounts = new Uint16Array(cells.length);
    const scale = radius + 0.6;
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
      const x = (2 * (col + 0.5) / width - 1) * scale;
      const y = (2 * (row + 0.5) / height - 1) * scale;
      let nearest = -1, distance = Infinity;
      for (let i = 0; i < cells.length; i++) {
        const squared = (cells[i].x - x) ** 2 + (cells[i].y - y) ** 2;
        if (squared < distance) { distance = squared; nearest = i; }
      }
      // Bound the aperture to the hexagon's outer cells instead of stretching them into the corners.
      if (distance > 0.6 ** 2) continue;
      const pixel = row * width + col;
      this.pixelCells[pixel] = nearest;
      this.pixelCounts[nearest]++;
      // FlyGym's optical transformation uses pixel-edge coordinates and integer truncation.
      const yn = ((2 * row - height) / height) / zoom;
      const xn = ((2 * col - width) / width) / zoom;
      const denominator = 1 - distortion * (xn * xn + yn * yn) + 1e-6;
      const sourceRow = Math.trunc((yn / denominator + 1) * height / 2);
      const sourceCol = Math.trunc((xn / denominator + 1) * width / 2);
      if (sourceRow >= 0 && sourceRow < height && sourceCol >= 0 && sourceCol < width)
        this.sourcePixels[pixel] = sourceRow * width + sourceCol;
    }
    if (this.pixelCounts.some(count => !count)) throw new Error("Retinal layout has cells without capture pixels");

  }

  /** Atlas rows are bottom-up WebGL readback; sample rows are top-down eye coordinates. */
  sample(atlas: Float32Array, atlasWidth: number, tileX: number, tileY: number): Uint8Array {
    const { width, height } = this.profile;
    const sum = new Float64Array(this.cells.length * 3);
    for (let pixel = 0; pixel < this.pixelCells.length; pixel++) {
      const cell = this.pixelCells[pixel], source = this.sourcePixels[pixel];
      if (cell < 0 || source < 0) continue;
      const row = Math.floor(source / width), col = source % width;
      const offset = ((tileY + height - 1 - row) * atlasWidth + tileX + col) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const value = atlas[offset + channel];
        if (!Number.isFinite(value)) throw new Error("Retinal capture contains nonfinite pixels");
        sum[cell * 3 + channel] += value;
      }
    }
    return Uint8Array.from(sum, (value, index) => Math.round(255 * Math.max(0, Math.min(1, value / this.pixelCounts[Math.floor(index / 3)]))));
  }

  /** First integer in each row is its pixel count, followed by top-down source indices; -1 is black. */
  poolingTable(): { data: Int32Array; width: number; height: number } {
    const width = Math.max(...this.pixelCounts) + 1;
    const data = new Int32Array(width * this.cells.length).fill(-1);
    const cursor = new Uint16Array(this.cells.length).fill(1);
    for (let cell = 0; cell < this.cells.length; cell++) data[cell * width] = this.pixelCounts[cell];
    for (let pixel = 0; pixel < this.pixelCells.length; pixel++) {
      const cell = this.pixelCells[pixel];
      if (cell >= 0) data[cell * width + cursor[cell]++] = this.sourcePixels[pixel];
    }
    return { data, width, height: this.cells.length };
  }

  /** Diagnostic unpooled camera raster; this is not the neural sample stream. */
  cameraImage(atlas: Float32Array, atlasWidth: number, tileX: number, tileY: number): Uint8ClampedArray<ArrayBuffer> {
    const { width, height } = this.profile;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
      const source = ((tileY + height - row - 1) * atlasWidth + tileX + col) * 4;
      const target = (row * width + col) * 4;
      for (let channel = 0; channel < 3; channel++) pixels[target + channel] = displayByte(atlas[source + channel]);
      pixels[target + 3] = 255;
    }
    return pixels;
  }

  /** Human display encodes the recorded linear RGB bytes; it never reconstructs a scene. */
  image(samples: Uint8Array): Uint8ClampedArray<ArrayBuffer> {
    if (samples.length !== this.cells.length * 3) throw new Error("Retinal color sample count differs from its layout");
    const pixels = new Uint8ClampedArray(this.pixelCells.length * 4);
    for (let pixel = 0; pixel < this.pixelCells.length; pixel++) {
      const cell = this.pixelCells[pixel];
      if (cell < 0) continue;
      for (let channel = 0; channel < 3; channel++) {
        const linear = samples[cell * 3 + channel] / 255;
        pixels[pixel * 4 + channel] = displayByte(linear);
      }
      pixels[pixel * 4 + 3] = 255;
    }
    return pixels;
  }
}

function displayByte(value: number): number {
  const linear = Math.max(0, Math.min(1, value));
  return Math.round(255 * (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055));
}
