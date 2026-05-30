/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

const fs = require("fs/promises");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const optionalAssets = [
  "metadata.json",
  "screenshot.png",
  "service-worker.js",
  "offline.html",
  "robots.txt",
  "sitemap.xml",
];

function collectLocalAssets(html) {
  const assets = new Set(["index.html"]);
  const patterns = [/<script\s+[^>]*src="([^"]+)"/g, /<link\s+[^>]*href="([^"]+)"/g];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const asset = match[1];
      if (!asset || asset.startsWith("http") || asset.startsWith("//")) {
        continue;
      }
      assets.add(asset.replace(/^\.\//, ""));
    }
  }

  return assets;
}

async function assertReadable(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  await fs.access(absolutePath);
  return absolutePath;
}

async function copyFile(relativePath) {
  const source = await assertReadable(relativePath);
  const destination = path.join(distDir, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function main() {
  const html = await fs.readFile(path.join(rootDir, "index.html"), "utf8");

  if (!html.includes("Desenvolvido por Matheus Siqueira")) {
    throw new Error("Professional credit text is missing from index.html");
  }

  if (!html.includes("www.matheussiqueira.dev")) {
    throw new Error("Portfolio link is missing from index.html");
  }

  const assets = collectLocalAssets(html);
  for (const asset of optionalAssets) {
    try {
      await assertReadable(asset);
      assets.add(asset);
    } catch {
      // Optional portfolio assets are copied when present.
    }
  }

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  for (const asset of assets) {
    await copyFile(asset);
  }

  console.log(`Static build complete: ${assets.size} files copied to dist/`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
