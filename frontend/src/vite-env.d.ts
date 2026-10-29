/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" to use the FastAPI backend (falls back to built-in data when it is not running). */
  readonly VITE_USE_API?: string;
  /** Origin of the backend when it is not behind the same host. Empty uses the /api proxy. */
  readonly VITE_API_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
