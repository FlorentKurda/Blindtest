import 'dotenv/config';

export interface ApiConfig {
  port: number;
  mobileOrigin: string;
  epidemicApiKey?: string;
  epidemicQuizPreviewEnabled: boolean;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsedPort = Number(env.PORT ?? 3000);
  return {
    port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000,
    mobileOrigin: env.MOBILE_ORIGIN ?? 'http://localhost:5173',
    epidemicApiKey: env.EPIDEMIC_SOUND_API_KEY?.trim() || undefined,
    epidemicQuizPreviewEnabled: env.EPIDEMIC_ENABLE_QUIZ_PREVIEW === 'true',
  };
}
