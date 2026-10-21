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

const categories: MusicCategory[] = [
  { id: 'demo', name: 'Fichiers autorisés' },
  { id: 'electro', name: 'Électro' },
  { id: 'pop', name: 'Pop' },
];

const tracks: MusicTrack[] = [
  {
    id: 'local-demo',
    provider: 'local',
    title: 'Votre fichier audio local',
    artists: ['Artiste local'],
    durationMs: 30_000,
    genres: [categories[0]!],
    moods: [],
    sourceUrl: '/audio/demo.mp3',
  },
];

export class LocalMusicProvider implements MusicProvider {
  readonly id = 'local' as const;

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      name: 'Fichiers locaux',
      available: true,
      capabilities: {
        search: true, metadata: true, categories: true, playback: true,
        pause: true, seek: true, volume: true, next: true, download: false,
      },
      restrictions: ['Utiliser uniquement des fichiers dont vous possédez les droits.'],
    };
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    const term = options.query?.toLocaleLowerCase('fr') ?? '';
    const filtered = tracks.filter((track) =>
      (!term || `${track.title} ${track.artists.join(' ')}`.toLocaleLowerCase('fr').includes(term)) &&
      (!options.categoryId || track.genres.some((genre) => genre.id === options.categoryId)),
    );
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 20;
    return { tracks: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit };
  }

  async getTrack(trackId: string): Promise<MusicTrack | null> {
    return tracks.find((track) => track.id === trackId) ?? null;
  }

  async getCategories(): Promise<MusicCategory[]> { return categories; }

  async getPlaybackResource(trackId: string): Promise<PlaybackResource> {
    const track = await this.getTrack(trackId);
    if (!track?.sourceUrl) throw new ProviderError('Piste locale introuvable.', 404, 'TRACK_NOT_FOUND');
    return { url: track.sourceUrl, format: 'file' };
  }
}
