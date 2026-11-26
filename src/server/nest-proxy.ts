import { getLanguage, translate } from '@/lib/i18n';

// Se migra por rutas para que las funcionalidades de los compañeros sigan disponibles.
export const nestRoutes = new Set(['auth', 'session', 'homes', 'invitations', 'notifications', 'expenses', 'payments', 'shopping', 'maintenance', 'polls', 'health', 'docs', 'docs-json']);

export async function forwardToNest(request: Request, path: string[]) {
  const languageCookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith('roomie_language='))?.split('=')[1];
  const language = getLanguage(languageCookie);
  try {
    const url = new URL(`/api/${path.map(encodeURIComponent).join('/')}`, process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001');
    url.search = new URL(request.url).search;
    const headers = new Headers();
    for (const name of ['content-type', 'cookie', 'origin', 'accept']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const upstream = await fetch(url, { method: request.method, headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15000),
    });
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of ['content-type', 'location']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append('set-cookie', cookie);
    let body: ArrayBuffer | string = await upstream.arrayBuffer();
    if (!upstream.ok && upstream.headers.get('content-type')?.includes('application/json')) {
      const result = JSON.parse(new TextDecoder().decode(body));
      if (typeof result.error === 'string') result.error = translate(result.error, language);
      body = JSON.stringify(result);
    }
    return new Response(body || null, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: translate('No pudimos conectar con el servidor. Intenta nuevamente.', language) }, { status: 503 });
  }
}
