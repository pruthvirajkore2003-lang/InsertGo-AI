/// <reference types="vite/client" />

// The client holds NO LLM key — every generation is proxied to the website's
// `/api/ai/generate`, where the Gemini key is server-held. These `VITE_*` vars
// are non-secret configuration (a model id and the API base URL), read unguarded
// because they are inlined into the shipped bundle by design. No `import`
// statements here or the augmentation breaks.
interface ImportMetaEnv {
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
