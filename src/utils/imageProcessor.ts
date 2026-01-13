// Image processing utilities for E-Paper display
// Converts images to 4-color format with Floyd-Steinberg dithering

// E-Paper display dimensions
export const EPD_WIDTH = 800;
export const EPD_HEIGHT = 480;
export const BUFFER_SIZE = (EPD_WIDTH * EPD_HEIGHT * 2) / 8; // 2 bits per pixel = 96000 bytes

// Color palette for 4-color e-paper (GDEM075F52)
// Values represent the 2-bit color codes
export const COLOR_VALUES = {
  WHITE: 0x00,
  YELLOW: 0x01,
  RED: 0x02,
  BLACK: 0x03,
} as const;

// RGB palette for display preview
const PALETTE_COLOR = [
  { r: 255, g: 255, b: 255, value: COLOR_VALUES.WHITE },  // White
  { r: 255, g: 231, b: 76, value: COLOR_VALUES.YELLOW },   // Yellow
  { r: 179, g: 57, b: 57, value: COLOR_VALUES.RED },       // Red
  { r: 0, g: 0, b: 0, value: COLOR_VALUES.BLACK },         // Black
];

// Black & White palette
const PALETTE_BW = [
  { r: 255, g: 255, b: 255, value: COLOR_VALUES.WHITE },  // White
  { r: 0, g: 0, b: 0, value: COLOR_VALUES.BLACK },         // Black
];

export type ColorMode = 'color' | 'bw';
export type Orientation = 'horizontal' | 'vertical';

interface PaletteColor {
  r: number;
  g: number;
  b: number;
  value: number;
}

// Calculate color distance (Euclidean in RGB space)
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

// Find closest color in palette
function findClosestColor(r: number, g: number, b: number, palette: PaletteColor[]): PaletteColor {
  let minDistance = Infinity;
  let closest = palette[0];

  for (const color of palette) {
    const dist = colorDistance(r, g, b, color.r, color.g, color.b);
    if (dist < minDistance) {
      minDistance = dist;
      closest = color;
    }
  }

  return closest;
}

// Process image and return both preview canvas and binary data
export interface ProcessedImage {
  previewCanvas: HTMLCanvasElement;
  binaryData: Uint8Array;
  orientation: Orientation;
}

// Load image from file
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Process image with Floyd-Steinberg dithering
export function processImage(
  img: HTMLImageElement,
  colorMode: ColorMode = 'color',
  orientation: Orientation = 'horizontal'
): ProcessedImage {
  const palette = colorMode === 'color' ? PALETTE_COLOR : PALETTE_BW;

  // Determine target dimensions based on orientation
  const isVertical = orientation === 'vertical';
  const targetW = isVertical ? EPD_HEIGHT : EPD_WIDTH;  // 480 or 800
  const targetH = isVertical ? EPD_WIDTH : EPD_HEIGHT;  // 800 or 480

  // Create canvas for processing
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  // Calculate crop dimensions to maintain aspect ratio
  const imgRatio = img.width / img.height;
  const targetRatio = targetW / targetH;

  let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;

  if (imgRatio > targetRatio) {
    // Image is wider - crop sides
    srcW = img.height * targetRatio;
    srcX = (img.width - srcW) / 2;
  } else {
    // Image is taller - crop top/bottom
    srcH = img.width / targetRatio;
    srcY = (img.height - srcH) / 2;
  }

  // Draw resized image
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);

  // Get image data
  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const pixels = new Float32Array(imageData.data.length);

  // Copy pixel data to float array for error diffusion
  for (let i = 0; i < imageData.data.length; i++) {
    pixels[i] = imageData.data[i];
  }

  // Array to store dithered colors
  const ditheredColors: PaletteColor[] = new Array(targetW * targetH);

  // Apply Floyd-Steinberg dithering
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const idx = (y * targetW + x) * 4;

      // Clamp values to 0-255
      const oldR = Math.max(0, Math.min(255, pixels[idx]));
      const oldG = Math.max(0, Math.min(255, pixels[idx + 1]));
      const oldB = Math.max(0, Math.min(255, pixels[idx + 2]));

      // Find closest color in palette
      const newColor = findClosestColor(oldR, oldG, oldB, palette);
      ditheredColors[y * targetW + x] = newColor;

      // Update preview canvas
      imageData.data[idx] = newColor.r;
      imageData.data[idx + 1] = newColor.g;
      imageData.data[idx + 2] = newColor.b;
      imageData.data[idx + 3] = 255;

      // Calculate error
      const errR = oldR - newColor.r;
      const errG = oldG - newColor.g;
      const errB = oldB - newColor.b;

      // Distribute error to neighboring pixels (Floyd-Steinberg)
      // Right pixel: 7/16
      if (x + 1 < targetW) {
        const i = idx + 4;
        pixels[i] += errR * 7 / 16;
        pixels[i + 1] += errG * 7 / 16;
        pixels[i + 2] += errB * 7 / 16;
      }

      // Bottom-left pixel: 3/16
      if (y + 1 < targetH && x > 0) {
        const i = idx + (targetW - 1) * 4;
        pixels[i] += errR * 3 / 16;
        pixels[i + 1] += errG * 3 / 16;
        pixels[i + 2] += errB * 3 / 16;
      }

      // Bottom pixel: 5/16
      if (y + 1 < targetH) {
        const i = idx + targetW * 4;
        pixels[i] += errR * 5 / 16;
        pixels[i + 1] += errG * 5 / 16;
        pixels[i + 2] += errB * 5 / 16;
      }

      // Bottom-right pixel: 1/16
      if (y + 1 < targetH && x + 1 < targetW) {
        const i = idx + (targetW + 1) * 4;
        pixels[i] += errR * 1 / 16;
        pixels[i + 1] += errG * 1 / 16;
        pixels[i + 2] += errB * 1 / 16;
      }
    }
  }

  // Put processed data back to canvas for preview
  ctx.putImageData(imageData, 0, 0);

  // Create binary output buffer (always 800x480 for e-paper)
  const binaryData = new Uint8Array(BUFFER_SIZE);

  // Fill buffer with proper rotation if vertical
  for (let epdY = 0; epdY < EPD_HEIGHT; epdY++) {
    for (let epdX = 0; epdX < EPD_WIDTH; epdX++) {
      let srcX: number, srcY: number;

      if (isVertical) {
        // Rotate 90 degrees clockwise: (x,y) -> (height-1-y, x)
        srcX = EPD_HEIGHT - 1 - epdY;
        srcY = epdX;
      } else {
        srcX = epdX;
        srcY = epdY;
      }

      const color = ditheredColors[srcY * targetW + srcX];
      const pixelIndex = epdY * EPD_WIDTH + epdX;
      const byteIndex = Math.floor(pixelIndex / 4);
      const bitPosition = (3 - (pixelIndex % 4)) * 2;
      binaryData[byteIndex] |= (color.value << bitPosition);
    }
  }

  return {
    previewCanvas: canvas,
    binaryData,
    orientation,
  };
}

// Generate a sanitized filename
export function sanitizeFilename(name: string): string {
  // Remove extension
  let clean = name.replace(/\.[^/.]+$/, '');
  // Replace invalid characters with underscore
  clean = clean.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Limit length
  clean = clean.substring(0, 24);
  return clean || 'image';
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
