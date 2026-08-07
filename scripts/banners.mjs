import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const bannerRoot = path.join(root, "banner");
const configPath = path.join(bannerRoot, "banners.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function parseArgs(values) {
  const args = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    args[value.slice(2)] = values[index + 1];
    index += 1;
  }
  return args;
}

function extension(file) {
  return path.extname(file).slice(1).toLowerCase().replace("jpeg", "jpg");
}

function readPngSize(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegSize(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) break;
    offset += length + 2;
  }
  return null;
}

function mp4Boxes(buffer, start = 0, end = buffer.length) {
  const result = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let header = 8;
    if (size === 1 && offset + 16 <= end) {
      size = Number(buffer.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) break;
    result.push({ offset, size, type, payload: offset + header });
    offset += size;
  }
  return result;
}

function readMp4Size(buffer) {
  const containers = new Set(["moov", "trak", "mdia", "minf", "stbl"]);
  const pending = [{ start: 0, end: buffer.length }];
  while (pending.length) {
    const range = pending.pop();
    for (const box of mp4Boxes(buffer, range.start, range.end)) {
      if (containers.has(box.type)) {
        pending.push({ start: box.payload, end: box.offset + box.size });
      } else if (box.type === "tkhd") {
        const version = buffer[box.payload];
        const dimensionsOffset = box.payload + 4 + (version === 0 ? 72 : 84);
        if (dimensionsOffset + 8 <= box.offset + box.size) {
          const width = buffer.readUInt32BE(dimensionsOffset) >>> 16;
          const height = buffer.readUInt32BE(dimensionsOffset + 4) >>> 16;
          if (width && height) return { width, height };
        }
      }
    }
  }
  return null;
}

function mediaSize(file) {
  const buffer = fs.readFileSync(file);
  const format = extension(file);
  if (format === "png") return readPngSize(buffer);
  if (format === "jpg") return readJpegSize(buffer);
  if (format === "mp4") return readMp4Size(buffer);
  return null;
}

function validateAsset(file, item) {
  const errors = [];
  if (!fs.existsSync(file)) return [`No existe: ${file}`];
  if (extension(file) !== item.format) errors.push(`Formato ${extension(file)}; se requiere ${item.format}`);
  const size = mediaSize(file);
  if (!size) errors.push("No se pudieron leer las dimensiones");
  else if (size.width !== item.width || size.height !== item.height) {
    errors.push(`Dimensiones ${size.width}x${size.height}; se requieren ${item.width}x${item.height}`);
  }
  return errors;
}

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderCode(item, url, alt) {
  const publicFolder = item.publicFolder ?? item.folder;
  const source = `${config.cdnBaseUrl}/${publicFolder}/${item.canonicalFile}`;
  const safeUrl = escapeAttribute(url);
  const safeAlt = escapeAttribute(alt);
  const media = item.format === "mp4"
    ? `<video${item.template === "video-fluid" ? ' width="100%"' : ' class="img-publi"'} autoplay playsinline muted loop>\n        <source src="${source}" type="video/mp4">\n    </video>`
    : `<img class="img-publi" src="${source}" alt="${safeAlt}">`;
  const inner = `    <a href="${safeUrl}" target="_blank" rel="noopener" aria-label="${safeAlt}">\n    ${media}\n    </a>`;
  if (item.template === "caynet-video") {
    return `<!-- Inicio Banner Eternet -->\n<div id="Eternet" class="col-sm">\n  <div class="newscard-ad-bx">\n${inner}\n  </div>\n</div>\n<!-- Fin Banner Eternet -->\n`;
  }
  if (item.template === "lvp-video") {
    return `<!-- Inicio Banner Eternet -->\n<div class="publicidad default mt-default mx-auto">\n  <div id="Eternet">\n${inner}\n  </div>\n</div>\n<!-- Fin Banner Eternet -->\n`;
  }
  return `<!-- Inicio Banner Eternet -->\n<div id="Eternet">\n${inner}\n</div>\n<!-- Fin Banner Eternet -->\n`;
}

function audit() {
  let errors = 0;
  for (const [id, item] of Object.entries(config.media)) {
    const file = path.join(bannerRoot, item.folder, item.legacyActiveFile);
    const issues = validateAsset(file, item);
    if (issues.length) errors += 1;
    console.log(`${issues.length ? "ERROR" : "OK"} ${id}: ${issues.join("; ") || `${item.width}x${item.height} ${item.format}`}`);
  }
  if (errors) fail(`${errors} medio(s) requieren revisión.`);
}

function prepare(args) {
  const required = ["media", "input", "campaign", "url", "alt"];
  const missing = required.filter((key) => !args[key]);
  if (missing.length) return fail(`Faltan parámetros: ${missing.map((key) => `--${key}`).join(", ")}`);
  const item = config.media[args.media];
  if (!item) return fail(`Medio desconocido: ${args.media}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.campaign)) return fail("--campaign debe usar minúsculas, números y guiones.");
  const input = path.resolve(args.input);
  const issues = validateAsset(input, item);
  if (issues.length) return fail(issues.join("; "));
  const output = path.join(bannerRoot, "_prepared", args.campaign, item.folder);
  fs.mkdirSync(output, { recursive: true });
  fs.copyFileSync(input, path.join(output, item.canonicalFile));
  fs.writeFileSync(path.join(output, "codigo.txt"), renderCode(item, args.url, args.alt), "utf8");
  fs.writeFileSync(path.join(output, "manifest.json"), `${JSON.stringify({
    media: args.media,
    campaign: args.campaign,
    source: input,
    outputFile: item.canonicalFile,
    format: item.format,
    width: item.width,
    height: item.height,
    destinationUrl: args.url,
    altText: args.alt,
    status: "preparado"
  }, null, 2)}\n`, "utf8");
  console.log(`Preparado: ${path.relative(root, output)}`);
}

const [command = "help", ...rest] = process.argv.slice(2);
if (command === "audit") audit();
else if (command === "prepare") prepare(parseArgs(rest));
else {
  console.log("Uso:\n  node scripts/banners.mjs audit\n  node scripts/banners.mjs prepare --media ID --input ARCHIVO --campaign SLUG --url URL --alt TEXTO");
}
