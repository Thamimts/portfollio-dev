module.exports = async function handler(req, res) {
  const backendBaseUrl = process.env.RENDER_BACKEND_URL;

  if (!backendBaseUrl) {
    return res.status(500).json({
      error: 'RENDER_BACKEND_URL is not configured on Vercel.',
    });
  }

  const requestUrl = new URL(req.url, backendBaseUrl);
  const targetUrl = `${backendBaseUrl.replace(/\/$/, '')}${requestUrl.pathname}${requestUrl.search}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    const lowerKey = key.toLowerCase();
    if (['host', 'content-length', 'connection'].includes(lowerKey)) continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    } else {
      headers.set(key, value);
    }
  }

  const init = {
    method: req.method,
    headers,
    redirect: 'follow',
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    init.body = req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : await new Promise((resolve) => {
          let raw = '';
          req.on('data', (chunk) => {
            raw += chunk;
          });
          req.on('end', () => resolve(raw || undefined));
        });

    if (init.body) {
      headers.set('content-type', req.headers['content-type'] || 'application/json');
    }
  }

  try {
    const response = await fetch(targetUrl, init);
    const responseBuffer = Buffer.from(await response.arrayBuffer());

    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    return res.send(responseBuffer);
  } catch (error) {
    console.error('API proxy error:', error);
    return res.status(502).json({
      error: 'Failed to proxy request to backend.',
    });
  }
}
