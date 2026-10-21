import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { MusicProvider, MusicProviderId } from '@blindvoice/shared';
import { ProviderError } from './providers/provider-error.js';

export function createApp(providers: Map<MusicProviderId, MusicProvider>, mobileOrigin = 'http://localhost:5173') {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: mobileOrigin.split(',').map((origin) => origin.trim()).filter(Boolean) }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_request, response) => response.json({ ok: true }));
  app.get('/api/providers', async (_request, response, next) => {
    try { response.json(await Promise.all([...providers.values()].map((provider) => provider.status()))); }
    catch (error) { next(error); }
  });
  app.get('/api/providers/:providerId/search', async (request, response, next) => {
    try {
      const provider = requireProvider(providers, request.params.providerId);
      response.json(await provider.search({
        query: stringValue(request.query.q), categoryId: stringValue(request.query.category),
        limit: numberValue(request.query.limit), offset: numberValue(request.query.offset),
      }));
    } catch (error) { next(error); }
  });
  app.get('/api/providers/:providerId/tracks/:trackId', async (request, response, next) => {
    try {
      const track = await requireProvider(providers, request.params.providerId).getTrack(request.params.trackId ?? '');
      if (!track) throw new ProviderError('Piste introuvable.', 404, 'TRACK_NOT_FOUND');
      response.json(track);
    } catch (error) { next(error); }
  });
  app.get('/api/providers/:providerId/categories', async (request, response, next) => {
    try { response.json(await requireProvider(providers, request.params.providerId).getCategories()); }
    catch (error) { next(error); }
  });
  app.get('/api/providers/:providerId/tracks/:trackId/playback', async (request, response, next) => {
    try { response.json(await requireProvider(providers, request.params.providerId).getPlaybackResource(request.params.trackId ?? '')); }
    catch (error) { next(error); }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ProviderError) {
      if (error.retryAfter) response.setHeader('Retry-After', error.retryAfter);
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    console.error('Unhandled API error', error instanceof Error ? error.message : 'unknown error');
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne.' } });
  });
  return app;
}

function requireProvider(providers: Map<MusicProviderId, MusicProvider>, value?: string): MusicProvider {
  const provider = providers.get(value as MusicProviderId);
  if (!provider) throw new ProviderError('Fournisseur inconnu.', 404, 'PROVIDER_NOT_FOUND');
  return provider;
}
function stringValue(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function numberValue(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}
