import { NextResponse } from 'next/server';

// Forces Vercel to use the standard Node.js runtime instead of Edge.
export const runtime = 'nodejs';

const API_BASE = 'https://omnibot.convo360.ai/api';
const BYPASS_HEADER_VALUE = 'biillo_verified_server';

function nowIso() {
  return new Date().toISOString();
}

function short(value: any, maxLen = 500) {
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return str.length > maxLen ? `${str.slice(0, maxLen)}... [truncated]` : str;
  } catch {
    return '[unserializable]';
  }
}

function maskKey(value: string | undefined | null) {
  if (!value) return '[missing]';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function appendQueryParams(url: URL, payload: Record<string, any> | undefined) {
  if (!payload) return;
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.append(key, String(value));
  });
}

async function parseUpstreamResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();

  let data: any = null;
  let parseError: string | null = null;

  try {
    data = JSON.parse(rawText);
  } catch (err: any) {
    parseError = err?.message || 'Failed to parse JSON';
  }

  return {
    data,
    rawText,
    contentType,
    parseError,
  };
}

/**
 * Converts a flat parameters array to the BODY_{{n}} object format
 * that Convo360 requires, e.g. ["Alice", "2025-12-31"] →
 * { "BODY_{{1}}": "Alice", "BODY_{{2}}": "2025-12-31" }
 */
function buildParamsObject(parameters: string[]): Record<string, string> {
  const paramsObj: Record<string, string> = {};
  parameters.forEach((val, idx) => {
    paramsObj[`BODY_{{${idx + 1}}}`] = val;
  });
  return paramsObj;
}

/**
 * Transforms the incoming flat payload into the nested structure
 * Convo360 strictly requires before forwarding to their API.
 */
function buildFinalPayload(action: string, payload: Record<string, any>): Record<string, any> {
  if (action === 'message.sendDirect') {
    const { user_id, template_name, lang, namespace, parameters = [] } = payload;

    return {
      user_id,
      content: {
        name: template_name,
        lang: lang || 'en',
        namespace: namespace || '',
        params: buildParamsObject(parameters),
      },
    };
  }

  if (action === 'broadcast.bulk') {
    const { user_id_list, template_name, lang, namespace, parameters = [] } = payload;

    return {
      user_id_list,
      wa_template: {
        name: template_name,
        lang: lang || 'en',
        namespace: namespace || '',
        params: buildParamsObject(parameters),
        use_default_values: 'yes',
      },
    };
  }

  if (action === 'subscriber.createByPhone') {
    // Convo360 requires top-level `phone` (not `user_id`) on creation.
    // The `user_id` is returned in their response after the subscriber is created.
    const { phone, name } = payload;
    const nameParts = (name || '').trim().split(' ');
    return {
      phone,
      contact: {
        user_name: name || phone,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
      },
    };
  }

  // All other actions pass through as-is (template CRUD, subscriber ops, etc.)
  return payload ?? {};
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  console.log('========================================');
  console.log(`[${nowIso()}] [${requestId}] /api/whatsapp inbound request received`);

  try {
    const reqHeaders = Object.fromEntries(req.headers.entries());

    console.log(`[${requestId}] Incoming request meta:`, {
      method: req.method,
      url: req.url,
      contentType: req.headers.get('content-type'),
      userAgent: req.headers.get('user-agent'),
      referer: req.headers.get('referer'),
      host: req.headers.get('host'),
      xForwardedFor: req.headers.get('x-forwarded-for'),
      xRealIp: req.headers.get('x-real-ip'),
      headerCount: Object.keys(reqHeaders).length,
    });

    const body = await req.json().catch((err) => {
      console.error(`[${requestId}] Failed to parse incoming JSON body:`, err);
      return null;
    });

    console.log(`[${requestId}] Incoming body:`, short(body, 2000));

    const { action, payload } = body ?? {};

    if (!action) {
      console.error(`[${requestId}] Missing action in request body`);
      return NextResponse.json(
        { message: 'Missing action', requestId },
        { status: 400 }
      );
    }

    const apiKey = process.env.CONVO360_API_KEY;

    console.log(`[${requestId}] Env check:`, {
      CONVO360_API_KEY: maskKey(apiKey),
      apiBase: API_BASE,
      bypassHeaderExpected: BYPASS_HEADER_VALUE,
    });

    if (!apiKey) {
      console.error(`[${requestId}] Missing CONVO360_API_KEY env variable`);
      return NextResponse.json(
        { message: 'Missing CONVO360_API_KEY env variable', requestId },
        { status: 500 }
      );
    }

    let endpoint = '';
    let method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST';

    switch (action) {
      case 'template.list':
        endpoint = '/whatsapp-template/list';
        method = 'POST';
        break;
      case 'template.create':
        endpoint = '/whatsapp-template/create';
        method = 'POST';
        break;
      case 'template.sync':
        endpoint = '/whatsapp-template/sync';
        method = 'POST';
        break;
      case 'template.delete':
        endpoint = '/whatsapp-template/delete';
        method = 'DELETE';
        break;

      case 'subscriber.create':
        endpoint = '/subscriber/create';
        method = 'POST';
        break;
      case 'subscriber.createByPhone':
        // Creates a new Convo360 subscriber from a phone number + name.
        // Returns { user_id } which must be saved back to your DB.
        endpoint = '/subscriber/create';
        method = 'POST';
        break;
      case 'subscriber.info':
        endpoint = '/subscriber/get-info-by-user-id';
        method = 'GET';
        break;

      case 'message.sendDirect':
        endpoint = '/subscriber/send-whatsapp-template-by-user-id';
        method = 'POST';
        break;

      case 'broadcast.bulk':
        endpoint = '/subscriber/broadcast-whatsapp-template-by-user-id';
        method = 'POST';
        break;

      default:
        console.error(`[${requestId}] Invalid action routing query:`, action);
        return NextResponse.json(
          { message: 'Invalid action routing query', requestId },
          { status: 400 }
        );
    }

    const url = new URL(`${API_BASE}${endpoint}`);

    console.log(`[${requestId}] Routing decision:`, {
      action,
      endpoint,
      method,
      finalUrlBeforeQuery: url.toString(),
    });

    // ✨ Build the correctly-nested payload Convo360 requires
    const finalPayload = buildFinalPayload(action, payload);

    console.log(`[${requestId}] Transformed payload for Convo360:`, short(finalPayload, 2000));

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-api-bypass': BYPASS_HEADER_VALUE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'Origin': 'https://omnibot.convo360.ai',
        'Referer': 'https://omnibot.convo360.ai/',
      },
    };

    console.log(`[${requestId}] Outgoing headers:`, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${maskKey(apiKey)}`,
      'x-api-bypass': BYPASS_HEADER_VALUE,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
    });

    if (method === 'GET') {
      appendQueryParams(url, payload);
      console.log(`[${requestId}] GET query params appended:`, url.searchParams.toString());
    } else {
      fetchOptions.body = JSON.stringify(finalPayload);
      console.log(`[${requestId}] Outgoing body:`, short(finalPayload, 2000));

      if (action === 'template.list' && payload && typeof payload === 'object') {
        appendQueryParams(url, payload);
        console.log(
          `[${requestId}] template.list query params appended:`,
          url.searchParams.toString()
        );
      }
    }

    console.log(`[${requestId}] Final upstream request:`, {
      url: url.toString(),
      method,
      hasBody: Boolean(fetchOptions.body),
    });

    const fetchStartedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(url.toString(), fetchOptions);
    } catch (fetchErr: any) {
      console.error(`[${requestId}] Fetch threw before response:`, fetchErr);
      return NextResponse.json(
        {
          message: 'Fetch failed before upstream response',
          requestId,
          error: fetchErr?.message || String(fetchErr),
        },
        { status: 502 }
      );
    }

    const fetchDurationMs = Date.now() - fetchStartedAt;

    const {
      data,
      rawText,
      contentType,
      parseError,
    } = await parseUpstreamResponse(response);

    console.log(`[${requestId}] Upstream response meta:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType,
      fetchDurationMs,
      responseUrl: response.url,
      parseError,
      rawLength: rawText?.length ?? 0,
    });

    console.log(
      `[${requestId}] Upstream raw preview:`,
      short(rawText, 2000)
    );

    if (!response.ok) {
      console.error(`[${requestId}] Convo360 API Error:`, {
        action,
        endpoint,
        status: response.status,
        statusText: response.statusText,
        parsedData: data,
        rawPreview: short(rawText, 2000),
      });

      return NextResponse.json(
        {
          message:
            data?.message ||
            data?.error ||
            'Upstream provider error',
          details: data ?? rawText.slice(0, 2000),
          requestId,
          upstreamStatus: response.status,
        },
        { status: response.status }
      );
    }

    if (data !== null) {
      console.log(`[${requestId}] Success response parsed as JSON`);
      console.log(`[${requestId}] Total duration: ${Date.now() - startedAt}ms`);
      return NextResponse.json(data);
    }

    console.warn(`[${requestId}] Upstream returned non-JSON success response`);
    console.log(`[${requestId}] Total duration: ${Date.now() - startedAt}ms`);

    return NextResponse.json(
      {
        message: 'Provider returned non-JSON response',
        raw: rawText.slice(0, 2000),
        requestId,
        upstreamStatus: response.status,
        contentType,
      },
      { status: 502 }
    );
  } catch (error: any) {
    console.error(`[${requestId}] WhatsApp Route Error:`, error);
    console.log(`[${requestId}] Total duration before crash: ${Date.now() - startedAt}ms`);

    return NextResponse.json(
      {
        message: error.message || 'Internal Routing Failure',
        requestId,
      },
      { status: 500 }
    );
  } finally {
    console.log(`[${requestId}] /api/whatsapp request finished`);
    console.log('========================================');
  }
}