import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';

const OFFLINE_URL = '/ui/~offline';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();
