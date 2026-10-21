import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { MusicProvider, MusicProviderId } from '@blindvoice/shared';
import { createApp } from './app.js';
import { LocalMusicProvider } from './providers/local-music-provider.js';

describe('API music routes', () => {
  const providers = new Map<MusicProviderId, MusicProvider>([['local', new LocalMusicProvider()]]);
  const app = createApp(providers);

  it('publie l’état sans secret', async () => {
    const response = await request(app).get('/api/providers').expect(200);
    expect(JSON.stringify(response.body)).not.toContain('Authorization');
    expect(response.body[0]).toMatchObject({ id: 'local', available: true });
  });

  it('valide les fournisseurs inconnus', async () => {
    const response = await request(app).get('/api/providers/nope/search').expect(404);
    expect(response.body.error.code).toBe('PROVIDER_NOT_FOUND');
  });
});
