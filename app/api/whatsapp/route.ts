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
    const { 
      user_id, 
      template_name, 
      lang, 
      namespace, 
      parameters = [], 
      document_link,
      document_name 
    } = payload;

    if (!namespace) {
      console.error(`[buildFinalPayload] namespace is empty for template "${template_name}".`);
    }
    
    const params: Record<string, string> = {};

    // Document header with URL and required display filename
    if (document_link) {
      const fileName = document_name || 'Biillo_Report.pdf';
      params['HEADER_DOCUMENT'] = document_link;
      params['HEADER_DOCUMENT_FILENAME'] = fileName;
      params['HEADER_FILENAME'] = fileName;
    }

    // Body variables mapped to BODY_{{1}}, BODY_{{2}}, etc.
    parameters.forEach((val: any, idx: number) => {
      params[`BODY_{{${idx + 1}}}`] = val ? String(val) : '-';
    });

    return {
      user_id,
      content: {
        name: template_name,
        lang: lang || 'en',
        namespace: namespace,
        params: params,
      },
    };
  }

  if (action === 'broadcast.bulk') {
    const { user_id_list, template_name, lang, namespace, parameters = [] } = payload;

    const wa_template: any = {
      name: template_name,
      lang: lang || 'en',
      namespace: namespace || '',
      use_default_values: 'yes',
    };

    if (parameters.length > 0) {
      wa_template.params = buildParamsObject(parameters);
    }

    return {
      user_id_list,
      wa_template,
    };
  }

  if (action === 'subscriber.createByPhone') {
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

  if (action === 'template.list') {
    return { limit: 100, page_size: 100, pageSize: 100, ...(payload ?? {}) };
  }

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
      case 'subscriber.createByPhone':
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

    // Build the correctly-nested payload Convo360 requires
    const finalPayload = buildFinalPayload(action, payload);

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'x-api-bypass': BYPASS_HEADER_VALUE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    };

    if (method === 'GET') {
      appendQueryParams(url, payload);
      console.log(`[${requestId}] GET query params appended:`, url.searchParams.toString());
    } else {
      fetchOptions.body = JSON.stringify(finalPayload);
      console.log(`[${requestId}] Outgoing body:`, short(finalPayload, 2000));

      if (action === 'template.list') {
        appendQueryParams(url, { limit: 100, page_size: 100, ...(payload && typeof payload === 'object' ? payload : {}) });
        console.log(
          `[${requestId}] template.list query params appended:`,
          url.searchParams.toString()
        );
      }
    }

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

    if (!response.ok) {
      console.error(`[${requestId}] Convo360 API Error:`, {
        action,
        status: response.status,
        parsedData: data,
        rawPreview: short(rawText, 2000),
      });

      return NextResponse.json(
        {
          message: data?.message || data?.error || 'Upstream provider error',
          details: data ?? rawText.slice(0, 2000),
          requestId,
          upstreamStatus: response.status,
        },
        { status: response.status }
      );
    }

    if (data !== null) {
      console.log(`[${requestId}] Success response parsed as JSON. Duration: ${Date.now() - startedAt}ms`);
      return NextResponse.json(data);
    }

    return NextResponse.json(
      {
        message: 'Provider returned non-JSON response',
        raw: rawText.slice(0, 2000),
        requestId,
        upstreamStatus: response.status,
      },
      { status: 502 }
    );
  } catch (error: any) {
    console.error(`[${requestId}] WhatsApp Route Error:`, error);

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