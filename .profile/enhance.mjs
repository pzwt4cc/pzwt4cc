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
const DATA_PATH = ".profile/data.json";
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
  "surfaceContainer", "surfaceContainerLow", "surfaceContainerHigh",
  "onSurface", "onSurfaceVariant",
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

const STAT_ICONS = {
  monitoring: "M128.5-128.63Q120-137.25 120-150v-46q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v46q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63Zm165 0Q285-137.25 285-150v-206q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v206q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63Zm165 0Q450-137.25 450-150v-146q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v146q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63Zm165 0Q615-137.25 615-150v-246q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v246q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63Zm165 0Q780-137.25 780-150v-366q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v366q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63ZM559.5-499q-11.5 0-22.46-4.7-10.97-4.69-20.04-13.3L400-634 172-407q-9.07 9-21.53 8.5-12.47-.5-21.34-9.5-8.13-9-8.63-21t8.5-21l229-227q9.07-8.87 20.04-12.93Q389-694 400-694t22.34 4.07Q433.68-685.87 442-677l118 118 229-229q9-9 21-9t20.87 9q8.13 9 8.63 21t-8.5 21L602-517q-8 9-19.5 13.5t-23 4.5Z",
  star: "M480-269 294-157q-8 5-17 4.5t-16-5.5q-7-5-10.5-13t-1.5-18l49-212-164-143q-8-7-9.5-15.5t.5-16.5q2-8 9-13.5t17-6.5l217-19 84-200q4-9 12-13.5t16-4.5q8 0 16 4.5t12 13.5l84 200 217 19q10 1 17 6.5t9 13.5q2 8 .5 16.5T826-544L662-401l49 212q2 10-1.5 18T699-158q-7 5-16 5.5t-17-4.5L480-269Z",
  commit: "M352.5-325.5Q298-371 284-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h164q14-69 68.5-114.5T480-680q73 0 127.5 45.5T676-520h164q17 0 28.5 11.5T880-480q0 17-11.5 28.5T840-440H676q-14 69-68.5 114.5T480-280q-73 0-127.5-45.5ZM479.76-340Q538-340 579-380.76q41-40.77 41-99Q620-538 579.24-579q-40.77-41-99-41Q422-620 381-579.24q-41 40.77-41 99Q340-422 380.76-381q40.77 41 99 41Z",
  book_2: "M290-80q-54 0-92-38t-38-92v-540q0-54 38-92t92-38h450q25 0 42.5 17.5T800-820v515q0 9-5 16.5T781-277q-19 8-30 26t-11 41q0 23 11 40.5t30 25.5q9 4 14 13t5 21q0 12-8.5 21T770-80H290Zm81.5-268.5Q380-357 380-370v-420q0-13-8.5-21.5T350-820q-13 0-21.5 8.5T320-790v420q0 13 8.5 21.5T350-340q13 0 21.5-8.5ZM290-140h409q-9-15-14-33t-5-37q0-20 5-37.5t15-32.5H290q-29 0-49.5 20.5T220-210q0 29 20.5 49.5T290-140Z",
  group: "M38-254q0-35 18-63.5t50-42.5q73-32 131.5-46T358-420q62 0 120 14t131 46q32 14 50.5 42.5T678-254v34q0 25-17.5 42.5T618-160H98q-25 0-42.5-17.5T38-220v-34Zm686 94q5-15 9.5-29.5T738-220v-34q0-63-29-101.5T622-420q69 8 130 22t99 34q33 19 52 47t19 63v34q0 25-17.5 42.5T862-160H724ZM250-523q-42-42-42-108t42-108q42-42 108-42t108 42q42 42 42 108t-42 108q-42 42-108 42t-108-42Zm426 0q-42 42-108 42-11 0-24.5-1.5T519-488q24-25 36.5-61.5T568-631q0-45-12.5-79.5T519-774q11-3 24.5-5t24.5-2q66 0 108 42t42 108q0 66-42 108Z",
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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

function compactStackSvg(svg) {
  if (!svg.includes('y="86.5"')) return svg;
  let out = svg;
  const hMatch = out.match(/viewBox="0 0 840 (\d+)"/);
  const oldH = hMatch ? parseInt(hMatch[1], 10) : 208;
  const newH = oldH - 28;
  out = out.replace(`width="840" height="${oldH}" viewBox="0 0 840 ${oldH}"`, `width="840" height="${newH}" viewBox="0 0 840 ${newH}"`);
  out = out.replace(`<rect width="840" height="${oldH}"`, `<rect width="840" height="${newH}"`);
  out = out.replace(/y="86\.5"/g, 'y="78.5"');
  out = shiftTranslateY(out, "95.0", "87.0");
  out = out.replace(/y="109\.4"/g, 'y="101.4"');
  out = out.replace(/y="144\.5"/g, 'y="122.5"');
  out = shiftTranslateY(out, "153.0", "131.0");
  out = out.replace(/y="167\.4"/g, 'y="145.4"');
  return out;
}

function compactProjectSvg(svg) {
  if (!svg.includes('height="232"')) return svg;
  let out = svg;
  out = out.replace('width="412" height="232" viewBox="0 0 412 232"', 'width="412" height="148" viewBox="0 0 412 148"');
  out = out.replace('<rect width="412" height="232"', '<rect width="412" height="148"');
  const arrowIdx = out.indexOf('<circle cx="372" cy="40"');
  const bgEnd = out.indexOf('<g class="pop"');
  if (bgEnd !== -1 && arrowIdx !== -1) {
    const pre = out.slice(0, bgEnd);
    const badge = out.slice(bgEnd, arrowIdx);
    const post = out.slice(arrowIdx);
    out = pre + `<g transform="translate(46 40) scale(0.76) translate(-52 -52)">${badge}</g>` + post;
  }
  out = out.replace('cx="372" cy="40" r="18"', 'cx="374" cy="38" r="16"');
  out = shiftTranslateY(out, "50.0", "48.0");
  out = out.replace('translate(362.0 48.0)', 'translate(364.0 48.0)');
  out = out.replace('x="24.0" y="116.0"', 'x="82.0" y="47.0"');
  out = out.replace('font-size:23px;font-weight:650;', 'font-size:21px;font-weight:650;');
  out = out.replace('y="142.0"', 'y="86.0"');
  out = out.replace('font-size:15px;font-weight:400;', 'font-size:14.5px;font-weight:400;');
  out = out.replace('y="163.0"', 'y="105.0"');
  out = out.replace(/y="184" (width="[0-9.]+" )height="28"/g, 'y="104" $1height="26"');
  out = out.replace(/y="202\.7"/g, 'y="121.5"');
  out = shiftTranslateY(out, "207.0", "126.0");
  out = out.replace('y="203.0"', 'y="122.0"');
  return out;
}

function buildCompactStatsSvg(p, style, data, profile, motion) {
  const w = 840;
  const h = 160;
  const title = profile.stats?.title || "GitHub activity";
  const b = [`<rect width="${w}" height="${h}" rx="32" fill="${p.surfaceContainerLow}"/>`];

  b.push(`<path class="pop" style="animation-delay:0.00s" d="${shapePath("cookie", 46, 42, 18)}" fill="${p.primaryContainer}"/>`);
  b.push(`<g class="pop" style="animation-delay:0.05s"><path d="${STAT_ICONS.monitoring}" fill="${p.onPrimaryContainer}" transform="translate(36.0 52.0) scale(0.0208)"/></g>`);
  b.push(`<text x="76.0" y="49.0" fill="${p.onSurface}" text-anchor="start" style="font-size:22px;font-weight:600;animation-delay:0.00s;" class="up">${esc(title)}</text>`);

  const tiles = [
    ["star", data.stars, profile.stats?.stars || "Stars", "cookie"],
    ["commit", data.contributions, profile.stats?.contributions || "Contributions", "clover"],
    ["book_2", data.repos, profile.stats?.repos || "Public repos", "sunny"],
    ["group", data.followers, profile.stats?.followers || "Followers", "flower"],
  ];

  tiles.forEach(([ic, value, label, sh], n) => {
    const tx = 28 + n * 199;
    const ty = 74;
    b.push(`<g class="up" style="animation-delay:${(0.08 + n * 0.06).toFixed(2)}s">`);
    b.push(`<rect x="${tx}" y="${ty}" width="187" height="64" rx="20" fill="${p.surfaceContainerHigh}"/>`);
    b.push(`<path d="${shapePath(sh, tx + 32, ty + 32, 17)}" fill="${p.primaryContainer}"/>`);
    b.push(`<path d="${STAT_ICONS[ic]}" fill="${p.onPrimaryContainer}" transform="translate(${(tx + 22).toFixed(1)} ${(ty + 42).toFixed(1)}) scale(0.0208)"/>`);
    b.push(`<text x="${tx + 58}" y="${ty + 33}" fill="${p.onSurface}" text-anchor="start" style="font-size:23px;font-weight:700;">${esc(value)}</text>`);
    b.push(`<text x="${tx + 58}" y="${ty + 50}" fill="${p.onSurfaceVariant}" text-anchor="start" style="font-size:13px;font-weight:500;">${esc(label)}</text>`);
    b.push(`</g>`);
  });

  const animOff = motion ? "" : "<style>*{animation:none!important}</style>";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><style>${style}</style>${animOff}${b.join("")}</svg>`;
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
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
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
    } else if (name === "stack-dark.svg" || name === "stack-light.svg") {
      const p = `assets/${name}`;
      writeFileSync(p, compactStackSvg(readFileSync(p, "utf8")));
    } else if (name.startsWith("project-") && name.endsWith(".svg")) {
      const p = `assets/${name}`;
      writeFileSync(p, compactProjectSvg(readFileSync(p, "utf8")));
    }
  }

  const maksikImg = await fetchImage("https://github.com/lostvalkrie.png?size=200");
  const avatarUri = maksikImg ? maksikImg.dataUri : null;
  const darkPalette = palette(profile.seed, profile.scheme, true);
  const lightPalette = palette(profile.seed, profile.scheme, false);
  const motion = profile.motion !== false;

  mkdirSync("assets", { recursive: true });
  writeFileSync("assets/stats-dark.svg", buildCompactStatsSvg(darkPalette, style, data, profile, motion));
  writeFileSync("assets/stats-light.svg", buildCompactStatsSvg(lightPalette, style, data, profile, motion));
  writeFileSync("assets/maksik-dark.svg", buildMaksikSvg(darkPalette, style, avatarUri, motion));
  writeFileSync("assets/maksik-light.svg", buildMaksikSvg(lightPalette, style, avatarUri, motion));

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
