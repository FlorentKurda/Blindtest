import type {
  MusicCategory,
  MusicProvider,
  MusicTrack,
  PlaybackResource,
  ProviderStatus,
  SearchOptions,
  SearchResult,
} from '@blindvoice/shared';
import { ProviderError } from './provider-error.js';

type FetchLike = typeof fetch;
type RawCategory = { id: string; name: string; images?: Record<string, string> };
type RawTrack = {
  id: string; title: string; mainArtists?: string[]; featuredArtists?: string[];
  length?: number; bpm?: number; genres?: RawCategory[]; moods?: RawCategory[];
  images?: Record<string, string>; isPreviewOnly?: boolean;
};

export class EpidemicMusicProvider implements MusicProvider {
  readonly id = 'epidemic' as const;
  private readonly baseUrl = 'https://api.epidemicsound.com';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly quizPreviewEnabled: boolean,
    private readonly http: FetchLike = fetch,
  ) {}

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(this.apiKey);
    let reachable = configured;
    let reason = configured ? undefined : 'Clé API backend non configurée';
    if (configured) {
      try {
        await this.request('/v0/collections?excludeField=tracks&limit=1&offset=0');
      } catch (error) {
        reachable = false;
        reason = error instanceof Error ? error.message : 'Fournisseur inaccessible';
      }
    }
    return {
      id: this.id,
      name: 'Epidemic Sound',
      available: reachable,
      reason,
      capabilities: {
        search: reachable, metadata: reachable, categories: reachable,
        playback: reachable && this.quizPreviewEnabled,
        pause: false, seek: false, volume: false, next: false, download: false,
      },
      restrictions: [
        'Clé et appels conservés côté serveur.',
        'Préécoute quiz désactivée tant que l’autorisation contractuelle n’est pas confirmée.',
        'Aucun téléchargement ni distribution publique dans ce lot.',
      ],
    };
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 60);
    const offset = Math.max(options.offset ?? 0, 0);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (options.query && !options.categoryId) params.set('term', options.query);
    const path = options.categoryId
      ? `/v0/collections/${encodeURIComponent(options.categoryId)}?${params}`
      : `/v0/tracks/search?${params}`;
    const body = await this.request<{ tracks: RawTrack[]; availableTracks?: number; pagination?: { total?: number } }>(path);
    return { tracks: body.tracks.map(mapTrack), total: body.availableTracks ?? body.pagination?.total, offset, limit };
  }

  async getTrack(trackId: string): Promise<MusicTrack | null> {
    const params = new URLSearchParams();
    params.append('trackId', trackId);
    const body = await this.request<RawTrack[]>(`/v0/tracks/metadata?${params}`);
    return body[0] ? mapTrack(body[0]) : null;
  }

  async getCategories(): Promise<MusicCategory[]> {
    const body = await this.request<{ collections: Array<RawCategory> }>('/v0/collections?excludeField=tracks&limit=20&offset=0');
    return body.collections.map(mapCategory);
  }

  async getPlaybackResource(trackId: string): Promise<PlaybackResource> {
    if (!this.quizPreviewEnabled) {
      throw new ProviderError('La préécoute Epidemic pour un quiz exige une autorisation explicite.', 403, 'QUIZ_PREVIEW_DISABLED');
    }
    const body = await this.request<{ url: string; expires: string }>(`/v0/tracks/${encodeURIComponent(trackId)}/stream`);
    return { url: body.url, format: 'hls', expiresAt: body.expires };
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.apiKey) throw new ProviderError('Clé Epidemic Sound non configurée.', 503, 'PROVIDER_NOT_CONFIGURED');
    let response: Response;
    try {
      response = await this.http(`${this.baseUrl}${path}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new ProviderError(error instanceof Error ? `Epidemic Sound indisponible: ${error.message}` : 'Erreur réseau Epidemic Sound.', 502, 'PROVIDER_NETWORK_ERROR');
    }
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: 'Clé Epidemic Sound invalide ou expirée.',
        403: 'Cette opération n’est pas autorisée par les droits du compte.',
        429: 'Quota Epidemic Sound atteint. Réessayez plus tard.',
      };
      throw new ProviderError(messages[response.status] ?? `Erreur Epidemic Sound (${response.status}).`, response.status, `EPIDEMIC_${response.status}`, response.headers.get('retry-after') ?? undefined);
    }
    return response.json() as Promise<T>;
  }
}

function mapCategory(raw: RawCategory): MusicCategory {
  return { id: raw.id, name: raw.name, artworkUrl: raw.images?.default };
}

function mapTrack(raw: RawTrack): MusicTrack {
  return {
    id: raw.id, provider: 'epidemic', title: raw.title,
    artists: [...(raw.mainArtists ?? []), ...(raw.featuredArtists ?? [])],
    durationMs: raw.length, bpm: raw.bpm,
    genres: (raw.genres ?? []).map(mapCategory), moods: (raw.moods ?? []).map(mapCategory),
    artworkUrl: raw.images?.default, previewOnly: raw.isPreviewOnly,
  };
}
