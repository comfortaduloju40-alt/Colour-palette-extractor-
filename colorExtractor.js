const sharp = require('sharp');

// ─── Main Export: Extract colours from image buffer ───
async function extractColors(imageBuffer, numColors = 6) {
  // Resize to small size for fast processing, remove alpha channel
  const { data, info } = await sharp(imageBuffer)
    .resize(100, 100, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = [];
  const channels = info.channels;

  // Collect all pixels as [r, g, b] arrays
  for (let i = 0; i < data.length; i += channels) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  // Run k-means clustering to find dominant colours
  const centroids = kMeans(pixels, numColors);

  // Return full colour objects
  return centroids.map(([r, g, b]) => ({
    r, g, b,
    hex: rgbToHex(r, g, b),
    name: getColorName(r, g, b)
  }));
}

// ─── K-Means Clustering ────────────────────────────────
function kMeans(pixels, k, iterations = 15) {
  if (pixels.length === 0) return [];

  // Pick evenly spaced starting centroids
  const step = Math.floor(pixels.length / k);
  let centroids = [];
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[i * step]]);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const clusters = Array.from({ length: k }, () => []);

    // Assign each pixel to nearest centroid
    for (const pixel of pixels) {
      let minDist = Infinity;
      let closest = 0;
      for (let j = 0; j < centroids.length; j++) {
        const dist = colorDist(pixel, centroids[j]);
        if (dist < minDist) { minDist = dist; closest = j; }
      }
      clusters[closest].push(pixel);
    }

    // Recalculate centroids as the average of each cluster
    for (let j = 0; j < k; j++) {
      if (clusters[j].length === 0) continue;
      const sum = [0, 0, 0];
      for (const p of clusters[j]) {
        sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2];
      }
      centroids[j] = [
        Math.round(sum[0] / clusters[j].length),
        Math.round(sum[1] / clusters[j].length),
        Math.round(sum[2] / clusters[j].length)
      ];
    }
  }

  return centroids;
}

// ─── Euclidean distance between two colours ────────────
function colorDist(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

// ─── RGB to Hex string ─────────────────────────────────
function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => v.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

// ─── Approximate colour name from RGB ─────────────────
function getColorName(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = ((max + min) / 2 / 255) * 100;

  if (l < 12) return 'Black';
  if (l > 88) return 'White';

  const s = max === min
    ? 0
    : ((max - min) / (l < 50 ? max + min : 510 - max - min)) * 100;

  if (s < 15) return 'Gray';

  const delta = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  if (h < 15 || h >= 345) return 'Red';
  if (h < 45)  return 'Orange';
  if (h < 65)  return 'Yellow';
  if (h < 150) return 'Green';
  if (h < 195) return 'Cyan';
  if (h < 255) return 'Blue';
  if (h < 285) return 'Purple';
  if (h < 345) return 'Pink';
  return 'Red';
}

// ─── Generate visual palette image using sharp ─────────
async function generatePaletteImage(colors) {
  const swatchW = 120;
  const swatchH = 200;
  const totalW = swatchW * colors.length;

  // Create each solid colour swatch as a PNG buffer
  const swatches = await Promise.all(
    colors.map(({ r, g, b }) =>
      sharp({
        create: {
          width: swatchW,
          height: swatchH,
          channels: 3,
          background: { r, g, b }
        }
      }).png().toBuffer()
    )
  );

  // Composite all swatches side by side
  const composites = swatches.map((input, i) => ({
    input,
    left: i * swatchW,
    top: 0
  }));

  return await sharp({
    create: {
      width: totalW,
      height: swatchH,
      channels: 3,
      background: { r: 30, g: 30, b: 46 }
    }
  })
  .composite(composites)
  .png()
  .toBuffer();
}

module.exports = { extractColors, generatePaletteImage };
