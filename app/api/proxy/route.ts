import { NextRequest, NextResponse } from 'next/server';

/** Convert a potentially relative URL into an absolute one based on the page's URL */
function makeAbsolute(href: string, pageUrl: string): string {
  if (!href) return '';
  if (href.startsWith('data:') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('#')) return href;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('//')) return 'https:' + href;

  try {
    return new URL(href, pageUrl).href;
  } catch {
    return href;
  }
}

/** Rewrite all navigable anchor hrefs to go through our proxy */
function rewriteAnchors(html: string, pageUrl: string, proxyBase: string): string {
  // Handle double-quoted hrefs
  html = html.replace(/(<a\b[^>]*?\shref=")([^"]*?)(")/gi, (_match, pre, href, post) => {
    const abs = makeAbsolute(href, pageUrl);
    if (!abs || abs === href && (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('#'))) return _match;
    if (abs.startsWith('javascript:') || abs.startsWith('mailto:') || abs.startsWith('#')) return _match;
    return `${pre}${proxyBase}${encodeURIComponent(abs)}${post}`;
  });

  // Handle single-quoted hrefs
  html = html.replace(/(<a\b[^>]*?\shref=')([^']*?)(')/gi, (_match, pre, href, post) => {
    const abs = makeAbsolute(href, pageUrl);
    if (!abs || abs.startsWith('javascript:') || abs.startsWith('mailto:') || abs.startsWith('#')) return _match;
    return `${pre}${proxyBase}${encodeURIComponent(abs)}${post}`;
  });

  return html;
}

/** Rewrite form action attributes */
function rewriteForms(html: string, pageUrl: string, proxyBase: string): string {
  html = html.replace(/(<form\b[^>]*?\saction=")([^"]*?)(")/gi, (_match, pre, action, post) => {
    const abs = makeAbsolute(action, pageUrl);
    if (!abs) return _match;
    return `${pre}${proxyBase}${encodeURIComponent(abs)}${post}`;
  });
  return html;
}

/** Inject base tag so relative asset URLs (CSS, JS, images) resolve correctly */
function injectBase(html: string, pageUrl: string): string {
  const baseTag = `<base href="${pageUrl}">`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/(<head\b[^>]*>)/i, `$1${baseTag}`);
  }
  return baseTag + html;
}

/** Inject script to intercept client-side navigation and notify parent */
function injectNavigationScript(html: string): string {
  const script = `<script>
(function () {
  // Intercept all clicks on links
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a') : null;
    if (el && el.href && !el.href.startsWith('javascript:') && !el.href.startsWith('mailto:')) {
      window.parent.postMessage({ type: 'PROXY_NAVIGATE', url: el.href }, '*');
    }
  }, true);

  // Intercept form submits
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form && form.action) {
      e.preventDefault();
      var url = form.action;
      if (form.method && form.method.toLowerCase() === 'get') {
        var params = new URLSearchParams(new FormData(form));
        url = url.split('?')[0] + '?' + params.toString();
      }
      window.parent.postMessage({ type: 'PROXY_NAVIGATE', url: url }, '*');
    }
  }, true);
})();
<\/script>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}</body>`);
  }
  return html + script;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing ?url parameter' }, { status: 400 });
  }

  // Normalize URL
  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    const contentType = upstream.headers.get('content-type') ?? 'text/plain';
    const finalUrl = upstream.url || targetUrl;

    // ── HTML response ──────────────────────────────────────────────
    if (contentType.toLowerCase().includes('text/html')) {
      const host = request.headers.get('host') ?? 'localhost:3000';
      const scheme =
        request.headers.get('x-forwarded-proto') ??
        (process.env.NODE_ENV === 'production' ? 'https' : 'http');
      const proxyBase = `${scheme}://${host}/api/proxy?url=`;

      let html = await upstream.text();
      html = injectBase(html, finalUrl);
      html = rewriteAnchors(html, finalUrl, proxyBase);
      html = rewriteForms(html, finalUrl, proxyBase);
      html = injectNavigationScript(html);

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── Non-HTML (CSS, JS, images, fonts, etc.) ────────────────────
    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Proxy Error</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #fef2f2; color: #7f1d1d; }
    .card { background: white; border-radius: 12px; padding: 2rem 2.5rem; max-width: 480px;
            box-shadow: 0 4px 24px rgba(0,0,0,.08); text-align: center; }
    h2 { font-size: 1.4rem; margin-bottom: .5rem; }
    code { background: #fef2f2; padding: .2rem .5rem; border-radius: 4px; font-size: .85rem; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
    <h2>Could not load page</h2>
    <p>${message}</p>
    <code>${targetUrl}</code>
  </div>
</body>
</html>`;

    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
