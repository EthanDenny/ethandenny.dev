import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/prepare-demo-night-images.mjs <source-images-directory>");
  process.exit(1);
}

const output = path.resolve("public/demo-night/images");
const manifest = path.resolve("src/data/demo-night-photos.json");
const events = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => Number(a) - Number(b));
const photos = [];

for (const event of events) {
  const images = (await readdir(path.join(source, event)))
    .filter((name) => /\.jpe?g$/i.test(name))
    .sort();
  await mkdir(path.join(output, event), { recursive: true });
  for (const filename of images) {
    const name = path.parse(filename).name;
    const destination = path.join(output, event, `${name}.webp`);
    const { width, height } = await sharp(path.join(source, event, filename))
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(destination);
    photos.push({
      event,
      filename,
      src: `/demo-night/images/${event}/${name}.webp`,
      width,
      height,
    });
  }
}

await writeFile(manifest, `${JSON.stringify(photos, null, 2)}\n`);
console.log(`Optimized ${photos.length} photos into ${output}`);
