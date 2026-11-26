import { setDefaultResultOrder } from "node:dns";
setDefaultResultOrder("ipv4first");
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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
  const ref = readFileSync("assets/hero-dark.svg", "utf8");
  const match = ref.match(/<style>([\s\S]*?)<\/style>/);
  return match ? match[1] : "";
}

function shiftTranslateY(svg, fromY, toY) {
  return svg.replace(
    new RegExp(`translate\\(([0-9.]+) ${fromY}\\)`, "g"),
    (_, x) => `translate(${x} ${toY})`,
  );
}

function shiftPathY(svg, delta) {
  return svg.replace(/\bd="([^"]+)"/g, (_, d) => {
    const updated = d.replace(/([ML])([0-9.]+) ([0-9.]+)/g, (__, cmd, x, y) => {
      return `${cmd}${x} ${(parseFloat(y) + delta).toFixed(1)}`;
    });
    return `d="${updated}"`;
  });
}

function compactProjectSvg(svg) {
  let out = svg;
  out = out.replace('width="412" height="232" viewBox="0 0 412 232"', 'width="412" height="194" viewBox="0 0 412 194"');
  out = out.replace('<rect width="412" height="232"', '<rect width="412" height="194"');
  const titleIdx = out.indexOf('<text x="24.0" y="116.0"');
  if (titleIdx !== -1) {
    let head = shiftPathY(out.slice(0, titleIdx), -8);
    head = head.replace('translate(39.0 65.0)', 'translate(39.0 57.0)');
    head = head.replace('translate(39.0 39.0)', 'translate(39.0 31.0)');
    head = head.replace('cx="372" cy="40"', 'cx="372" cy="36"');
    head = shiftTranslateY(head, "50.0", "46.0");
    head = shiftTranslateY(head, "30.0", "26.0");
    out = head + out.slice(titleIdx);
  }
  out = out.replace('y="116.0"', 'y="102.0"');
  out = out.replace('y="98"', 'y="84"');
  out = out.replace('y="113"', 'y="99"');
  out = out.replace('y="142.0"', 'y="125.0"');
  out = out.replace('y="163.0"', 'y="146.0"');
  out = out.replace(/y="184"/g, 'y="146"');
  out = out.replace(/y="202\.7"/g, 'y="164.7"');
  out = shiftTranslateY(out, "207.0", "169.0");
  out = out.replace('y="203.0"', 'y="165.0"');
  return out;
}

function compactStatsSvg(svg) {
  let out = svg;
  const hMatch = out.match(/viewBox="0 0 840 (\d+)"/);
  const oldH = hMatch ? parseInt(hMatch[1], 10) : 400;
  const newH = oldH - 54;
  out = out.replace(`width="840" height="${oldH}" viewBox="0 0 840 ${oldH}"`, `width="840" height="${newH}" viewBox="0 0 840 ${newH}"`);
  out = out.replace(`<rect width="840" height="${oldH}"`, `<rect width="840" height="${newH}"`);

  out = out.replace(/<rect x="(28|224)" y="86" width="184" height="96"/g, '<rect x="$1" y="84" width="184" height="80"');
  out = out.replace(/translate\((52\.0|248\.0) 130\.0\)/g, 'translate($1 124.0)');
  out = out.replace(/y="132\.0"/g, 'y="126.0"');
  out = out.replace(/y="164\.0"( fill="[^"]+" text-anchor="start")/g, 'y="150.0"$1');

  const tileRow2Start = out.indexOf('<rect x="28" y="192"');
  const calStart = out.indexOf('x="432.0"');
  if (tileRow2Start !== -1 && calStart !== -1) {
    const before = out.slice(0, tileRow2Start);
    let mid = out.slice(tileRow2Start, calStart);
    const after = out.slice(calStart);
    mid = shiftPathY(mid, -20);
    mid = mid.replace(/y="192" width="184" height="96"/g, 'y="172" width="184" height="80"');
    mid = shiftTranslateY(mid, "236.0", "212.0");
    mid = mid.replace(/y="238\.0"/g, 'y="214.0"');
    mid = mid.replace(/y="270\.0"/g, 'y="238.0"');
    out = before + mid + after;
  }

  out = out.replace('y="100.0"', 'y="96.0"');
  out = out.replace(/y="124\.0"/g, 'y="118.0"');
  out = out.replace(/y="136" (width="49\.1" )height="46"/g, 'y="128" $1height="38"');
  out = out.replace(/y="164\.0"( fill="[^"]+" text-anchor="middle")/g, 'y="152.0"$1');
  out = out.replace(/y="188" (width="49\.1" )height="46"/g, 'y="172" $1height="38"');
  out = out.replace(/y="216\.0"( fill="[^"]+" text-anchor="middle")/g, 'y="196.0"$1');
  out = out.replace(/y="240" (width="49\.1" )height="46"/g, 'y="216" $1height="38"');
  out = out.replace(/y="268\.0"( fill="[^"]+" text-anchor="middle")/g, 'y="240.0"$1');
  out = out.replace(/y="133" (width="55\.1" )height="52"/g, 'y="125" $1height="44"');
  out = out.replace(/y="185" (width="55\.1" )height="52"/g, 'y="169" $1height="44"');
  out = out.replace(/y="237" (width="55\.1" )height="52"/g, 'y="213" $1height="44"');
  out = out.replace(/y="136\.75" (width="47\.6" )height="44\.5"/g, 'y="128.75" $1height="36.5"');
  out = out.replace(/y="188\.75" (width="47\.6" )height="44\.5"/g, 'y="172.75" $1height="36.5"');
  out = out.replace(/y="240\.75" (width="47\.6" )height="44\.5"/g, 'y="216.75" $1height="36.5"');

  out = out.replace('y="322.0"', 'y="274.0"');
  out = out.replace(/y="334" (width="[0-9.]+" )height="14"/g, 'y="286" $1height="13"');
  out = out.replace(/cy="367"/g, 'cy="318"');
  out = out.replace(/y="372\.0"/g, 'y="323.0"');
  out = out.replace(/cy="393"/g, 'cy="344"');
  out = out.replace(/y="398\.0"/g, 'y="349.0"');
  return out;
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

  const hidden = new Set(profile.hidden || []);
  for (const name of readdirSync("assets")) {
    if (
      name === "credit-dark.svg" ||
      name === "credit-light.svg" ||
      (hidden.has("about") && name.startsWith("about-")) ||
      (hidden.has("streak") && name.startsWith("streak-")) ||
      (hidden.has("buttons") && name.startsWith("button-"))
    ) {
      unlinkSync(`assets/${name}`);
    } else if (name.startsWith("project-") && name.endsWith(".svg")) {
      const p = `assets/${name}`;
      writeFileSync(p, compactProjectSvg(readFileSync(p, "utf8")));
    } else if (name === "stats-dark.svg" || name === "stats-light.svg") {
      const p = `assets/${name}`;
      writeFileSync(p, compactStatsSvg(readFileSync(p, "utf8")));
    }
  }

  const maksikImg = await fetchImage("https://github.com/lostvalkrie.png?size=200");
  const avatarUri = maksikImg ? maksikImg.dataUri : null;
  const darkPalette = palette(profile.seed, profile.scheme, true);
  const lightPalette = palette(profile.seed, profile.scheme, false);

  mkdirSync("assets", { recursive: true });
  writeFileSync("assets/maksik-dark.svg", buildMaksikSvg(darkPalette, style, avatarUri, profile.motion !== false));
  writeFileSync("assets/maksik-light.svg", buildMaksikSvg(lightPalette, style, avatarUri, profile.motion !== false));

  let readme = readFileSync(README_PATH, "utf8");
  const creditRe = /\n*<a href="https:\/\/metawka\.github\.io\/expressive-profile\/[^"]*"><picture>[\s\S]*?<\/picture><\/a>\n*/g;
  readme = readme.replace(creditRe, "\n\n");
  const maksikRe = /\n*<a href="https:\/\/github\.com\/lostvalkrie"><picture>[\s\S]*?<\/picture><\/a>\n*/g;
  readme = readme.replace(maksikRe, "\n\n");

  const maksikTag = `<a href="https://github.com/lostvalkrie"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/maksik-dark.svg"><img src="assets/maksik-light.svg" width="100%" alt="Maksik.AI — Coding Bro"></picture></a>`;
  readme = readme.replace(/\s*<\/div>\s*$/, `\n\n${maksikTag}\n\n</div>\n`);
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
