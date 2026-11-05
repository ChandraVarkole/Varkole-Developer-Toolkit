/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SALESFORCE_CLIENT_ID?: string;
  readonly VITE_SALESFORCE_API_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
