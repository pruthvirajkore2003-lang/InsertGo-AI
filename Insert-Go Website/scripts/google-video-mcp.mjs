#!/usr/bin/env node

import { createInterface } from "node:readline";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GenerateVideosOperation,
  GoogleGenAI,
} from "@google/genai";

const SERVER = { name: "insertgo-google-video", version: "1.0.0" };
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const OUTPUT_DIR = path.join(PROJECT_ROOT, "out", "google-video");
const MODELS = new Set([
  "veo-3.1-generate-preview",
  "veo-3.1-fast-generate-preview",
  "veo-3.1-lite-generate-preview",
]);
const ASPECT_RATIOS = new Set(["16:9", "9:16"]);
const RESOLUTIONS = new Set(["720p", "1080p"]);
const DURATIONS = new Set([4, 6, 8]);
const downloaded = new Map();
let client;
let startPending = false;

const tools = [
  {
    name: "google_video_start",
    description:
      "Start one billable Google Veo video generation through Gemini API. " +
      "Returns an operation name; use google_video_check until complete.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          minLength: 1,
          maxLength: 1024,
          description: "English video prompt.",
        },
        negativePrompt: {
          type: "string",
          minLength: 1,
          maxLength: 1024,
          description: "Elements to exclude.",
        },
        model: {
          type: "string",
          enum: [...MODELS],
          default: "veo-3.1-fast-generate-preview",
        },
        aspectRatio: {
          type: "string",
          enum: [...ASPECT_RATIOS],
          default: "16:9",
        },
        resolution: {
          type: "string",
          enum: [...RESOLUTIONS],
          default: "720p",
        },
        durationSeconds: {
          type: "integer",
          enum: [...DURATIONS],
          default: 8,
        },
        generateAudio: {
          type: "boolean",
          default: true,
          description:
            "Accepted but NOT sent: the Gemini Developer API rejects this " +
            "field (Enterprise Agent Platform only). Plates play muted.",
        },
      },
    },
  },
  {
    name: "google_video_check",
    description:
      "Check a Google Veo operation. Downloads completed MP4 into " +
      "out/google-video and returns absolute path.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["operationName"],
      properties: {
        operationName: {
          type: "string",
          minLength: 1,
          maxLength: 2048,
        },
      },
    },
  },
];

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY missing. Set it in project .env.local, then restart Claude Code."
    );
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value;
}

function rejectUnknown(value, allowed) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new Error(`Unknown argument: ${unknown.join(", ")}.`);
  }
}

function string(value, name, { min = 1, max = 1024 } = {}) {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }
  const clean = value.trim();
  if (clean.length < min || clean.length > max) {
    throw new Error(`${name} length must be ${min}-${max}.`);
  }
  return clean;
}

function choice(value, name, allowed, fallback) {
  const selected = value === undefined ? fallback : value;
  if (!allowed.has(selected)) {
    throw new Error(`${name} unsupported: ${String(selected)}.`);
  }
  return selected;
}

function boolean(value, name, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be boolean.`);
  }
  return value;
}

function safeError(error) {
  let message = error instanceof Error ? error.message : String(error);
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) message = message.replaceAll(apiKey, "[REDACTED]");
  return message.replace(/key=[^&\s]+/gi, "key=[REDACTED]").slice(0, 1200);
}

function slug(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "video"
  );
}

async function startVideo(raw) {
  if (startPending) {
    throw new Error("Another video start request is pending.");
  }
  const args = object(raw, "arguments");
  rejectUnknown(
    args,
    new Set([
      "prompt",
      "negativePrompt",
      "model",
      "aspectRatio",
      "resolution",
      "durationSeconds",
      "generateAudio",
    ])
  );
  const prompt = string(args.prompt, "prompt");
  const negativePrompt =
    args.negativePrompt === undefined
      ? undefined
      : string(args.negativePrompt, "negativePrompt");
  const model = choice(
    args.model,
    "model",
    MODELS,
    "veo-3.1-fast-generate-preview"
  );
  const aspectRatio = choice(
    args.aspectRatio,
    "aspectRatio",
    ASPECT_RATIOS,
    "16:9"
  );
  const resolution = choice(
    args.resolution,
    "resolution",
    RESOLUTIONS,
    "720p"
  );
  const durationSeconds = choice(
    args.durationSeconds,
    "durationSeconds",
    DURATIONS,
    8
  );
  // Validated for callers that pass it, then deliberately dropped: sending
  // generateAudio to the Gemini Developer API fails the whole request with
  // "only supported in Gemini Enterprise Agent Platform mode".
  boolean(args.generateAudio, "generateAudio", true);

  startPending = true;
  try {
    const operation = await getClient().models.generateVideos({
      model,
      prompt,
      config: {
        numberOfVideos: 1,
        aspectRatio,
        resolution,
        durationSeconds,
        ...(negativePrompt ? { negativePrompt } : {}),
      },
    });
    if (!operation.name) {
      throw new Error("Google returned no operation name.");
    }
    return {
      operationName: operation.name,
      status: operation.done ? "complete" : "running",
      next: operation.done
        ? "Call google_video_check to download result."
        : "Call google_video_check in about 30 seconds.",
    };
  } finally {
    startPending = false;
  }
}

async function checkVideo(raw) {
  const args = object(raw, "arguments");
  rejectUnknown(args, new Set(["operationName"]));
  const operationName = string(args.operationName, "operationName", {
    max: 2048,
  });
  if (!/^[A-Za-z0-9._~/-]+$/.test(operationName)) {
    throw new Error("operationName contains invalid characters.");
  }

  const existing = downloaded.get(operationName);
  if (existing) {
    return { operationName, status: "complete", files: existing };
  }

  const operation = new GenerateVideosOperation();
  operation.name = operationName;
  const current = await getClient().operations.getVideosOperation({ operation });

  if (!current.done) {
    return {
      operationName,
      status: "running",
      next: "Call google_video_check again in about 30 seconds.",
    };
  }
  if (current.error) {
    throw new Error(`Google generation failed: ${JSON.stringify(current.error)}`);
  }

  const generated = current.response?.generatedVideos ?? [];
  if (!generated.length) {
    const reasons = current.response?.raiMediaFilteredReasons?.join("; ");
    throw new Error(
      reasons
        ? `No video returned: ${reasons}`
        : "Google completed operation but returned no video."
    );
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const files = [];
  for (const [index, item] of generated.entries()) {
    if (!item.video) continue;
    const file = path.join(
      OUTPUT_DIR,
      `${stamp}-${slug(operationName)}-${index + 1}.mp4`
    );
    await getClient().files.download({
      file: item.video,
      downloadPath: file,
    });
    files.push(file);
  }
  if (!files.length) {
    throw new Error("Google returned video metadata without downloadable media.");
  }
  downloaded.set(operationName, files);
  return { operationName, status: "complete", files };
}

function textResult(value, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function send(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function handle(message) {
  const id = message.id;
  try {
    switch (message.method) {
      case "initialize":
        return send({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: message.params?.protocolVersion ?? "2024-11-05",
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER,
          },
        });
      case "ping":
        return send({ jsonrpc: "2.0", id, result: {} });
      case "tools/list":
        return send({ jsonrpc: "2.0", id, result: { tools } });
      case "tools/call": {
        const name = message.params?.name;
        const action =
          name === "google_video_start"
            ? startVideo
            : name === "google_video_check"
              ? checkVideo
              : null;
        if (!action) {
          return send({
            jsonrpc: "2.0",
            id,
            result: textResult(`Unknown tool: ${String(name)}`, true),
          });
        }
        try {
          const result = await action(message.params?.arguments ?? {});
          return send({ jsonrpc: "2.0", id, result: textResult(result) });
        } catch (error) {
          return send({
            jsonrpc: "2.0",
            id,
            result: textResult(safeError(error), true),
          });
        }
      }
      default:
        if (id === undefined) return;
        return send({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not found" },
        });
    }
  } catch (error) {
    if (id === undefined) return;
    send({
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: safeError(error) },
    });
  }
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  if (!line.trim()) return;
  try {
    void handle(JSON.parse(line));
  } catch {
    send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }
});
