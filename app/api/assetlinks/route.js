import { assetLinks } from '../../lib/assetLinks';

export async function GET() {
  return Response.json(assetLinks, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
