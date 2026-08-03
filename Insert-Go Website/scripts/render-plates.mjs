#!/usr/bin/env node
// Renders the Veo plate queue in veo-plates.json straight into public/plates/.
//
//   node --env-file=.env.local scripts/render-plates.mjs [id ...]
//
// Same API path as the google-video MCP server, but batch and idempotent: a
// plate whose target file already exists is skipped, so a re-run after editing
// one prompt costs one generation, not five. Delete the mp4 to re-render it.

import { readFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GenerateVideosOperation, GoogleGenAI } from "@google/genai";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE = path.join(ROOT, "scripts", "veo-plates.json");
const POLL_MS = 15_000;
const TIMEOUT_MS = 10 * 60_000;

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("GEMINI_API_KEY missing — run with --env-file=.env.local");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });

const queue = JSON.parse(await readFile(QUEUE, "utf8"));
const only = new Set(process.argv.slice(2));
const wanted = only.size
  ? queue.plates.filter((p) => only.has(p.id))
  : queue.plates;
const unknown = [...only].filter((id) => !queue.plates.some((p) => p.id === id));
if (unknown.length) {
  console.error(`unknown plate id: ${unknown.join(", ")}`);
  process.exit(1);
}

const exists = async (file) => !!(await stat(file).catch(() => null));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const plate of wanted) {
  // `target` is repo-relative in the queue file; keep it authoritative so the
  // JSON stays the one place a plate's destination is written down.
  const target = path.join(ROOT, plate.target);
  if (await exists(target)) {
    console.log(`skip   ${plate.id} — ${plate.target} already rendered`);
    continue;
  }

  console.log(`start  ${plate.id} (${plate.scene})`);
  let operation = await ai.models.generateVideos({
    model: queue._defaults.model,
    prompt: plate.prompt,
    config: {
      numberOfVideos: 1,
      aspectRatio: queue._defaults.aspectRatio,
      resolution: queue._defaults.resolution,
      durationSeconds: queue._defaults.durationSeconds,
      // shared bans plus whatever this plate had to learn the hard way
      negativePrompt: [queue._negativePrompt, plate.negativePromptExtra]
        .filter(Boolean)
        .join(", "),
      // _defaults.generateAudio is honoured by muting playback in the page:
      // the Gemini Developer API rejects the field outright.
    },
  });
  if (!operation.name) throw new Error(`${plate.id}: no operation name`);

  const deadline = Date.now() + TIMEOUT_MS;
  while (!operation.done) {
    if (Date.now() > deadline) {
      throw new Error(`${plate.id}: still running after 10 min — ${operation.name}`);
    }
    await sleep(POLL_MS);
    const handle = new GenerateVideosOperation();
    handle.name = operation.name;
    operation = await ai.operations.getVideosOperation({ operation: handle });
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  if (operation.error) {
    throw new Error(`${plate.id}: ${JSON.stringify(operation.error)}`);
  }
  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) {
    const why = operation.response?.raiMediaFilteredReasons?.join("; ");
    throw new Error(`${plate.id}: no video returned${why ? ` — ${why}` : ""}`);
  }

  await mkdir(path.dirname(target), { recursive: true });
  await ai.files.download({ file: video, downloadPath: target });
  const { size } = await stat(target);
  console.log(`done   ${plate.id} → ${plate.target} (${Math.round(size / 1024)} kB)`);
}
