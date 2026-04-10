/**
 * Genera texturas de fondo tileable como PNG puro (sin dependencias externas).
 * Usa zlib nativo de Node.js y construye el PNG byte a byte.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

// ── CRC32 (requerido por el formato PNG) ────────────────────────────────────
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// ── Crear chunk PNG ─────────────────────────────────────────────────────────
function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([t, data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, c])
}

// ── Generar PNG con noise ───────────────────────────────────────────────────
function generateNoisePNG(w, h, { baseR, baseG, baseB, noiseR, noiseG, noiseB, intensity, seed = 42 }) {
  // Simple PRNG (mulberry32)
  let s = seed | 0
  function rand() {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Raw pixel data (filter byte + RGBA per pixel, per row)
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    const rowOffset = y * (1 + w * 4)
    raw[rowOffset] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      const px = rowOffset + 1 + x * 4
      const n = (rand() - 0.5) * 2 * intensity
      raw[px]     = Math.max(0, Math.min(255, baseR + n * noiseR))
      raw[px + 1] = Math.max(0, Math.min(255, baseG + n * noiseG))
      raw[px + 2] = Math.max(0, Math.min(255, baseB + n * noiseB))
      raw[px + 3] = 255
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const compressed = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Generar texturas ────────────────────────────────────────────────────────
mkdirSync('public/textures', { recursive: true })

// Light mode: grano muy sutil sobre el slate claro (#f1f5f9 = 241,245,249)
const light = generateNoisePNG(192, 192, {
  baseR: 241, baseG: 245, baseB: 249,
  noiseR: 1, noiseG: 1, noiseB: 0.8,
  intensity: 6,
  seed: 7731,
})
writeFileSync('public/textures/grain-light.png', light)
console.log(`grain-light.png: ${light.length} bytes`)

// Dark mode: grano muy sutil sobre el dark (#0f172a = 15,23,42)
const dark = generateNoisePNG(192, 192, {
  baseR: 15, baseG: 23, baseB: 42,
  noiseR: 0.6, noiseG: 0.7, noiseB: 1,
  intensity: 5,
  seed: 9924,
})
writeFileSync('public/textures/grain-dark.png', dark)
console.log(`grain-dark.png: ${dark.length} bytes`)

console.log('Done!')
