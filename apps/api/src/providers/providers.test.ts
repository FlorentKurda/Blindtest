import { describe, expect, it, vi } from 'vitest';
import { EpidemicMusicProvider } from './epidemic-music-provider.js';
import { LocalMusicProvider } from './local-music-provider.js';

describe('LocalMusicProvider', () => {
  it('expose les capacités audio locales et la piste de test', async () => {
    const provider = new LocalMusicProvider();
    expect((await provider.status()).capabilities).toMatchObject({ playback: true, volume: true, download: false });
    const result = await provider.search({ query: 'fichier' });
    expect(result.tracks[0]).toMatchObject({ id: 'local-demo', provider: 'local' });
    await expect(provider.getPlaybackResource('missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('EpidemicMusicProvider', () => {
  it('envoie la clé uniquement dans le header serveur et normalise les pistes', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ tracks: [{
      id: 'track-1', title: 'Neon', mainArtists: ['Ada'], length: 123000,
      genres: [{ id: 'pop', name: 'Pop' }], moods: [], isPreviewOnly: true,
    }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const provider = new EpidemicMusicProvider('secret-key', false, http);
    const result = await provider.search({ query: 'neon', limit: 10 });
    expect(result.tracks[0]).toMatchObject({ id: 'track-1', title: 'Neon', artists: ['Ada'], provider: 'epidemic' });
    const [url, init] = http.mock.calls[0]!;
    expect(String(url)).not.toContain('secret-key');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
  });

  it.each([
    [401, 'EPIDEMIC_401'], [403, 'EPIDEMIC_403'], [429, 'EPIDEMIC_429'],
  ])('traduit une réponse %i', async (status, code) => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }));
    const provider = new EpidemicMusicProvider('key', false, http);
    await expect(provider.search({})).rejects.toMatchObject({ status, code });
  });

  it('isole la lecture quiz derrière une autorisation explicite', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ collections: [] }), { status: 200 }));
    const provider = new EpidemicMusicProvider('key', false, http);
    await expect(provider.getPlaybackResource('track')).rejects.toMatchObject({ code: 'QUIZ_PREVIEW_DISABLED' });
    expect((await provider.status()).capabilities.playback).toBe(false);
  });

  it('transforme un échec réseau sans divulguer la clé', async () => {
    const http = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const provider = new EpidemicMusicProvider('never-log-me', false, http);
    await expect(provider.search({})).rejects.toMatchObject({ status: 502, code: 'PROVIDER_NETWORK_ERROR' });
  });
});
