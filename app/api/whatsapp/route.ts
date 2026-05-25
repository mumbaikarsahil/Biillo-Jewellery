import { NextResponse } from 'next/server';

// ✨ IMPORTANT: Forces Vercel to use the standard Node.js runtime instead of Edge.
export const runtime = 'nodejs';

const API_BASE = 'https://omnibot.convo360.ai/api';

function appendQueryParams(url: URL, payload: Record<string, any> | undefined) {
  if (!payload) return;
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.append(key, String(value));
  });
}

async function parseUpstreamResponse(response: Response) {
  const rawText = await response.text();

  try {
    return { data: JSON.parse(rawText), rawText };
  } catch {
    return { data: null, rawText };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, payload } = body ?? {};

    if (!action) {
      return NextResponse.json(
        { message: 'Missing action' },
        { status: 400 }
      );
    }

    if (!process.env.CONVO360_API_KEY) {
      return NextResponse.json(
        { message: 'Missing CONVO360_API_KEY env variable' },
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
        return NextResponse.json(
          { message: 'Invalid action routing query' },
          { status: 400 }
        );
    }

    const url = new URL(`${API_BASE}${endpoint}`);

    // ✨ THE FIX: Added Browser Spoofing & Domain Whitelist Headers
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONVO360_API_KEY}`,
        
        // Browser spoofing headers
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        
        // ✨ THE SECRET CLOUDFLARE BYPASS HEADER
        'x-api-bypass': 'biillo_verified_server'
      },
    };

    if (method === 'GET') {
      appendQueryParams(url, payload);
    } else {
      fetchOptions.body = JSON.stringify(payload ?? {});

      // Keep the original behavior for template.list in case the provider expects query params.
      if (action === 'template.list' && payload && typeof payload === 'object') {
        appendQueryParams(url, payload);
      }
    }

    console.log('Convo360 request:', {
      action,
      method,
      url: url.toString(),
      payload,
    });

    const response = await fetch(url.toString(), fetchOptions);
    const { data, rawText } = await parseUpstreamResponse(response);

    if (!response.ok) {
      console.error('Convo360 API Error:', {
        status: response.status,
        statusText: response.statusText,
        data,
        rawText: rawText.slice(0, 1000),
      });

      return NextResponse.json(
        {
          message:
            data?.message ||
            data?.error ||
            'Upstream provider error',
          details: data ?? rawText.slice(0, 1000),
        },
        { status: response.status }
      );
    }

    if (data !== null) {
      return NextResponse.json(data);
    }

    return NextResponse.json(
      {
        message: 'Provider returned non-JSON response',
        raw: rawText.slice(0, 1000),
      },
      { status: 502 }
    );
  } catch (error: any) {
    console.error('WhatsApp Route Error:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Routing Failure' },
      { status: 500 }
    );
  }
}