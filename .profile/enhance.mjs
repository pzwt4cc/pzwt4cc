import { setDefaultResultOrder } from "node:dns";
setDefaultResultOrder("ipv4first");
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import {
  argbFromHex,
  Hct,
  hexFromArgb,
  QuantizerCelebi,
  SchemeExpressive,
  SchemeFidelity,
  SchemeMonochrome,
  SchemeTonalSpot,
  SchemeVibrant,
  Score,
} from "@material/material-color-utilities";

const PROFILE_PATH = "profile.json";
const STATE_PATH = ".profile/state.json";
const README_PATH = "README.md";

const SCHEMES = {
  tonalSpot: SchemeTonalSpot,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  monochrome: SchemeMonochrome,
};

const ROLES = [
  "primary", "onPrimary", "primaryContainer", "onPrimaryContainer",
  "secondary", "onSecondary", "secondaryContainer", "onSecondaryContainer",
  "tertiary", "onTertiary", "tertiaryContainer", "onTertiaryContainer",
  "surfaceContainer", "surfaceContainerLow", "onSurface", "onSurfaceVariant",
];

const SHAPE_PARAMS = {
  cookie: [9, 0.07, 1],
  cookie12: [12, 0.05, 1],
  clover: [4, 0.2, 1],
  sunny: [8, 0.1, 2.2],
  flower: [8, 0.16, 1],
  pill: [2, 0, 1],
  soft: [4, 0.05, 0.6],
  gem: [6, 0.07, 1.6],
};

const AVATAR_SHAPES = ["cookie12", "cookie", "flower", "pill", "gem", "clover", "sunny"];

function shapePath(kind, cx, cy, r) {
  const [n, a, sharp] = SHAPE_PARAMS[kind] ?? SHAPE_PARAMS.cookie12;
  const steps = 180;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    const c = Math.cos(n * t);
    const wave = Math.sign(c) * Math.abs(c) ** (1 / sharp);
    const rad = r * (1 - a + a * wave);
    const x = (cx + rad * Math.cos(t)).toFixed(2);
    const y = (cy + rad * Math.sin(t)).toFixed(2);
    pts.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }
  return pts.join(" ") + " Z";
}

function palette(seed, scheme, dark) {
  const Scheme = SCHEMES[scheme] ?? SchemeTonalSpot;
  const s = new Scheme(Hct.fromInt(argbFromHex(seed)), dark, 0);
  const out = {};
  for (const r of ROLES) out[r] = hexFromArgb(s[r]);
  return out;
}

function decodePixels(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const png = PNG.sync.read(buf);
    return png.data;
  }
  const raw = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return raw.data;
}

function extractSeedFromImage(buf) {
  const rgba = decodePixels(buf);
  const pixels = [];
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 125) continue;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    pixels.push(((a << 24) | (r << 16) | (g << 8) | b) >>> 0);
  }
  const quantized = QuantizerCelebi.quantize(pixels, 128);
  const ranked = Score.score(quantized);
  const vibrant = ranked.find((c) => Hct.fromInt(c).chroma >= 24);
  return hexFromArgb(vibrant ?? ranked[0]).toUpperCase();
}

function pickShapeFromHash(hash, current) {
  const pool = AVATAR_SHAPES.filter((s) => s !== current);
  const idx = parseInt(hash.slice(0, 8), 16) % pool.length;
  return pool[idx];
}

async function fetchImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
  const type = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
    return { buf, dataUri: `data:${type};base64,${buf.toString("base64")}` };
  } catch {
    return null;
  }
}

async function runPre() {
  const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
  if (!profile.seedFromAvatar) return;

  const img = await fetchImage(`https://github.com/${profile.login}.png?size=160`);
  if (!img) return;

  const hash = createHash("sha256").update(img.buf).digest("hex");
  mkdirSync(".profile", { recursive: true });
  const prev = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf8")) : null;

  if (!prev) {
    writeFileSync(STATE_PATH, JSON.stringify({ avatarHash: hash }, null, 2) + "\n");
    return;
  }

  if (prev.avatarHash !== hash) {
    profile.seed = extractSeedFromImage(img.buf);
    profile.hero.avatarShape = pickShapeFromHash(hash, profile.hero.avatarShape);
    writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2) + "\n");
    writeFileSync(STATE_PATH, JSON.stringify({ avatarHash: hash }, null, 2) + "\n");
  }
}

function extractStyle() {
  const ref = readFileSync("assets/about-dark.svg", "utf8");
  const match = ref.match(/<style>([\s\S]*?)<\/style>/);
  return match ? match[1] : "";
}

function buildMaksikSvg(p, style, avatarUri, motion) {
  const w = 840;
  const h = 116;
  const cx = 66;
  const cy = 58;
  const ring = shapePath("sunny", cx, cy, 44);
  const bgFrame = shapePath("cookie12", cx, cy, 39);
  const clip = shapePath("cookie12", cx, cy, 37);

  const b = [];
  b.push(`<clipPath id="mk-card"><rect width="${w}" height="${h}" rx="32"/></clipPath>`);
  b.push(`<rect width="${w}" height="${h}" rx="32" fill="${p.surfaceContainer}"/>`);
  b.push(`<g clip-path="url(#mk-card)">`);
  b.push(`<path class="spin" d="${shapePath("flower", 790, 14, 72)}" fill="${p.primaryContainer}" opacity=".75"/>`);
  b.push(`<path class="bob" d="${shapePath("clover", 718, 108, 34)}" fill="${p.tertiaryContainer}" opacity=".85"/>`);
  b.push(`</g>`);

  b.push(`<path class="spin" d="${ring}" fill="${p.primary}" opacity=".9"/>`);
  b.push(`<clipPath id="mk-ava"><path d="${clip}"/></clipPath>`);
  b.push(`<path d="${bgFrame}" fill="${p.surfaceContainer}"/>`);
  if (avatarUri) {
    b.push(`<g class="fade"><image href="${avatarUri}" x="${cx - 38}" y="${cy - 38}" width="76" height="76" clip-path="url(#mk-ava)" preserveAspectRatio="xMidYMid slice"/></g>`);
  } else {
    b.push(`<path d="${clip}" fill="${p.primaryContainer}"/>`);
  }

  b.push(`<g class="up" style="animation-delay:0.1s">`);
  b.push(`<text x="128" y="40" fill="${p.primary}" style="font-size:12px;font-weight:700;letter-spacing:1.1px;">MY PERSONAL AI CODING BRO</text>`);
  b.push(`</g>`);
  b.push(`<g class="up" style="animation-delay:0.2s">`);
  b.push(`<text x="128" y="71" fill="${p.onSurface}" style="font-size:28px;font-weight:700;">MAKSIK.AI</text>`);
  b.push(`</g>`);
  b.push(`<g class="up" style="animation-delay:0.3s">`);
  b.push(`<text x="128" y="92" fill="${p.onSurfaceVariant}" style="font-size:14px;font-weight:500;">github.com/lostvalkrie</text>`);
  b.push(`</g>`);

  const pillX = 640;
  const pillY = 36;
  const pillW = 168;
  const pillH = 44;
  b.push(`<g class="pop" style="animation-delay:0.35s">`);
  b.push(`<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="22" fill="${p.secondaryContainer}"/>`);
  b.push(`<text x="${pillX + 20}" y="${pillY + 27}" fill="${p.onSecondaryContainer}" style="font-size:15px;font-weight:600;">@lostvalkrie</text>`);
  b.push(`<path d="M6.4 18 5 16.6 14.6 7H6V5h12v12h-2V8.4Z" fill="${p.onSecondaryContainer}" transform="translate(${pillX + 130} ${pillY + 11}) scale(0.92)"/>`);
  b.push(`</g>`);

  const animOff = motion ? "" : "<style>*{animation:none!important}</style>";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Maksik.AI — Coding Bro"><title>Maksik.AI — Coding Bro</title><style>${style}</style>${animOff}${b.join("")}</svg>`;
}

async function runPost() {
  const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
  const style = extractStyle();
  const maksikImg = await fetchImage("https://github.com/lostvalkrie.png?size=200");
  const avatarUri = maksikImg ? maksikImg.dataUri : null;

  const darkPalette = palette(profile.seed, profile.scheme, true);
  const lightPalette = palette(profile.seed, profile.scheme, false);

  mkdirSync("assets", { recursive: true });
  writeFileSync("assets/maksik-dark.svg", buildMaksikSvg(darkPalette, style, avatarUri, profile.motion !== false));
  writeFileSync("assets/maksik-light.svg", buildMaksikSvg(lightPalette, style, avatarUri, profile.motion !== false));

  let readme = readFileSync(README_PATH, "utf8");
  const maksikTag = `<a href="https://github.com/lostvalkrie"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/maksik-dark.svg"><img src="assets/maksik-light.svg" width="100%" alt="Maksik.AI — Coding Bro"></picture></a>`;
  readme = readme.replace(/\n*<a href="https:\/\/github\.com\/lostvalkrie"><picture>[\s\S]*?<\/picture><\/a>\n*/g, "\n\n");

  const buttonRowMarker = `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/button-l-dark.svg">`;
  const creditMarker = `<a href="https://metawka.github.io/expressive-profile/`;
  if (readme.includes(buttonRowMarker)) {
    readme = readme.replace(buttonRowMarker, `${maksikTag}\n\n${buttonRowMarker}`);
  } else if (readme.includes(creditMarker)) {
    readme = readme.replace(creditMarker, `${maksikTag}\n\n${creditMarker}`);
  } else {
    readme = readme.replace("</div>", `\n${maksikTag}\n\n</div>`);
  }
  writeFileSync(README_PATH, readme);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "pre") {
    await runPre();
  } else if (cmd === "post") {
    await runPost();
  } else {
    throw new Error("Usage: enhance.mjs <pre|post>");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
