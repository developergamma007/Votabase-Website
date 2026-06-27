import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import withSerwistInit from '@serwist/next';

const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ||
  crypto.randomUUID();

/** @type {import("@serwist/build").ManifestTransform} */
const manifestTransforms = async (manifestEntries) => {
  const manifest = manifestEntries.map((entry) => {
    if (entry.url.includes('/_next/../public/')) {
      entry.url = entry.url.replace('/_next/../public/', '/');
    }
    return entry;
  });
  return { manifest, warnings: [] };
};

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.js',
  swDest: 'public/sw.js',
  scope: '/ui/',
  register: true,
  reloadOnOnline: true,
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === 'development',
  additionalPrecacheEntries: [{ url: '/ui/~offline', revision }],
  manifestTransforms: [manifestTransforms],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/ui',
  reactStrictMode: true,
  experimental: {
    // Reduce parallel work during build on small EC2 instances.
    cpus: 1,
    workerThreads: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Permissions-Policy', value: 'display-capture=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
