const ZAPI_SDK_URL = 'https://app.z-api.io/sdk.js';
let sdkPromise: Promise<void> | null = null;

interface ConnectorOptions {
  token: string;
  locale?: 'pt' | 'en' | 'es';
  theme?: {
    mode?: 'light' | 'dark';
    light?: { accent?: string; accentContrast?: string };
  };
  methods?: { qr?: boolean; phone?: boolean; migrate?: boolean };
  showQueue?: boolean;
}

declare global {
  interface Window {
    ZAPIConnector?: { open: (options: ConnectorOptions) => Promise<boolean> };
  }
}

export function loadZapiConnector(): Promise<void> {
  if (window.ZAPIConnector?.open) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ZAPI_SDK_URL}"]`);
    const script = existing ?? document.createElement('script');
    const onLoad = () => window.ZAPIConnector?.open
      ? resolve()
      : reject(new Error('zapi_connector_unavailable'));
    const onError = () => reject(new Error('zapi_connector_load_failed'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.src = ZAPI_SDK_URL;
      script.async = true;
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      document.head.appendChild(script);
    }
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

export async function openZapiConnector(token: string): Promise<boolean> {
  await loadZapiConnector();
  return window.ZAPIConnector!.open({
    token,
    locale: 'pt',
    theme: { mode: 'light', light: { accent: '#059669', accentContrast: '#ffffff' } },
    methods: { qr: true, phone: true, migrate: false },
    showQueue: true,
  });
}
