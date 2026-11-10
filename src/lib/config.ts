export interface AppConfig {
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  geminiApiKey: string;
}

export function getConfig(): AppConfig {
  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
  };
}

export function isConfigured(): { google: boolean; gemini: boolean } {
  const config = getConfig();
  return {
    google: Boolean(config.googleClientId && config.googleClientSecret),
    gemini: Boolean(config.geminiApiKey),
  };
}
