/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_URL: string;
}

// Vite's client types already provide ImportMeta with env containing DEV, PROD, MODE
// We just extend ImportMetaEnv for our custom variables
