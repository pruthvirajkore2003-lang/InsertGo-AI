#!/usr/bin/env node
// Makes rendered Veo plates web-shippable:
//
//   node scripts/optimize-plates.mjs [id ...]
//
// Veo hands back ~6.7 MB per 8s 1080p plate — fine as a master, far too heavy
// to autoplay in a page. Each plate is moved aside as the untouched master in
// out/google-video/<id>-master.mp4, re-encoded into public/plates/<id>.mp4 at
// web bitrate, and given a poster frame so the first paint is an image, never
// a black box.
//
// The stashed master doubles as the idempotency marker: present means this
// plate is already optimized, so re-runs are free. Delete it to redo one.

import { readFile, mkdir, rename, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE = path.join(ROOT, "scripts", "veo-plates.json");
const MASTERS = path.join(ROOT, "out", "google-video");

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`)),
    );
  });

const exists = async (f) => !!(await stat(f).catch(() => null));
const kb = async (f) => Math.round((await stat(f)).size / 1024);
// out/ is gitignored, so a fresh clone has the optimized plates but no masters
// — without this the marker check would miss and re-encode a shipped file on
// top of itself. Veo masters run ~6.7 Mbps; anything under 3 is already ours.
const alreadyEncoded = async (file) =>
  (await stat(file)).size * 8 / queue._defaults.durationSeconds < 3_000_000;

const queue = JSON.parse(await readFile(QUEUE, "utf8"));
const only = new Set(process.argv.slice(2));
const wanted = only.size ? queue.plates.filter((p) => only.has(p.id)) : queue.plates;

await mkdir(MASTERS, { recursive: true });

for (const plate of wanted) {
  const target = path.join(ROOT, plate.target);
  const master = path.join(MASTERS, `${plate.id}-master.mp4`);
  const poster = target.replace(/\.mp4$/, ".jpg");

  if (await exists(master)) {
    console.log(`skip   ${plate.id} — master stashed, already optimized`);
    continue;
  }
  if (!(await exists(target))) {
    console.log(`miss   ${plate.id} — ${plate.target} not rendered yet`);
    continue;
  }
  if (await alreadyEncoded(target)) {
    console.log(`skip   ${plate.id} — already at web bitrate`);
    continue;
  }

  const before = await kb(target);
  await rename(target, master);

  // crf 30 is generous for this material: near-black frames with soft glows
  // compress well, and the grain Veo bakes in hides banding. `-an` because the
  // plates are decoration and every browser autoplay policy needs them muted
  // anyway; faststart so playback can begin before the file is fully buffered.
  await run("ffmpeg", [
    "-v", "error", "-y", "-i", master,
    "-c:v", "libx264", "-preset", "slow", "-crf", "30",
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
    "-movflags", "+faststart", "-an", target,
  ]);

  // frame 0, so the poster matches the video's own first frame exactly
  await run("ffmpeg", [
    "-v", "error", "-y", "-i", master, "-frames:v", "1", "-q:v", "6", poster,
  ]);

  console.log(
    `done   ${plate.id} — ${before} kB → ${await kb(target)} kB video, ` +
      `${await kb(poster)} kB poster`,
  );
}
