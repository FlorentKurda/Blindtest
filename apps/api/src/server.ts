import type { MusicProvider, MusicProviderId } from '@blindvoice/shared';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { EpidemicMusicProvider } from './providers/epidemic-music-provider.js';
import { LocalMusicProvider } from './providers/local-music-provider.js';

const config = readConfig();
const providers = new Map<MusicProviderId, MusicProvider>([
  ['local', new LocalMusicProvider()],
  ['epidemic', new EpidemicMusicProvider(config.epidemicApiKey, config.epidemicQuizPreviewEnabled)],
]);

createApp(providers, config.mobileOrigin).listen(config.port, () => {
  console.log(`BlindVoice API listening on http://localhost:${config.port}`);
  console.log(`Epidemic Sound configured: ${Boolean(config.epidemicApiKey)}`);
});
