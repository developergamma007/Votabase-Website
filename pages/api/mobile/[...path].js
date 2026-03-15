const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export const config = {
  api: {
    bodyParser: false,
  },
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : '';
  const search = new URLSearchParams();

  Object.entries(req.query).forEach(([key, value]) => {
    if (key === 'path') return;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
    } else if (value !== undefined) {
      search.set(key, String(value));
    }
  });

  const target = `${API_BASE_URL}/${path}${search.toString() ? `?${search.toString()}` : ''}`;
  const authHeader = req.headers.authorization || (req.cookies.token ? `Bearer ${req.cookies.token}` : '');
  const contentType = req.headers['content-type'];

  const headers = {};
  if (authHeader) headers.Authorization = authHeader;
  if (contentType) headers['Content-Type'] = contentType;

  const init = {
    method: req.method,
    headers,
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    const rawBody = await readBody(req);
    if (rawBody) init.body = rawBody;
  }

  try {
    const upstream = await fetch(target, init);
    const upstreamType = upstream.headers.get('content-type') || '';
    let payload = upstreamType.includes('application/json')
      ? await upstream.json()
      : await upstream.text();

    if (
      upstream.ok &&
      typeof payload === 'object' &&
      payload?.data?.result &&
      typeof payload.data.result === 'string' &&
      path === 'votebase/v1/api/voters/snapshot'
    ) {
      const snapshot = await fetch(payload.data.result);
      if (snapshot.ok) {
        payload = {
          ...payload,
          data: {
            ...payload.data,
            result: await snapshot.json(),
          },
        };
      }
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', typeof payload === 'string' ? upstreamType || 'text/plain; charset=utf-8' : 'application/json');
    res.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Proxy request failed' });
  }
}
