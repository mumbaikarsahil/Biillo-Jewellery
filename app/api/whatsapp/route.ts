import { NextResponse } from 'next/server';

const API_BASE = "https://omnibot.convo360.ai/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, payload } = body; 
    
    let endpoint = "";
    let method = "POST";

    // Route the requested action to the correct Convo360 endpoint
    switch (action) {
      // ==========================================
      // TEMPLATE MANAGEMENT
      // ==========================================
      case 'template.list':   
        endpoint = "/whatsapp-template/list"; 
        break;
      case 'template.create': 
        endpoint = "/whatsapp-template/create"; 
        break;
      case 'template.sync':   
        endpoint = "/whatsapp-template/sync"; 
        break;
      case 'template.delete': 
        endpoint = "/whatsapp-template/delete"; 
        method = "DELETE"; 
        break;

      // ==========================================
      // SUBSCRIBER MANAGEMENT
      // ==========================================
      case 'subscriber.create': 
        // Payload: { name: string, phone: string, first_name?: string }
        endpoint = "/subscriber/create"; 
        break;
      case 'subscriber.info':   
        // Payload: { user_id: string }
        endpoint = "/subscriber/get-info-by-user-id"; 
        method = "GET"; 
        break;

      // ==========================================
      // DIRECT MESSAGING (For CRM Individual Sends)
      // ==========================================
      case 'message.sendDirect': 
        /* Expected Payload format:
          {
            "user_id": "phone_number",
            "create_if_not_found": "yes",
            "content": {
              "namespace": "string",
              "name": "template_name",
              "lang": "en",
              "params": {
                "BODY_{{1}}": "Customer Name",
                "BODY_{{2}}": "Order Value"
              }
            }
          }
        */
        endpoint = "/subscriber/send-whatsapp-template-by-user-id"; 
        break;

      // ==========================================
      // BULK BROADCASTING (For Automation Page)
      // ==========================================
      case 'broadcast.bulk': 
        /* Expected Payload format:
          {
            "user_id_list": "919876543210,919876543211", // Comma separated
            "wa_template": {
              "namespace": "string",
              "name": "template_name",
              "lang": "en",
              "use_default_values": "yes",
              "params": {
                "BODY_{{1}}": "Valued Customer"
              }
            }
          }
        */
        endpoint = "/subscriber/broadcast-whatsapp-template-by-user-id"; 
        break;

      default:
        return NextResponse.json({ message: "Invalid action routing query" }, { status: 400 });
    }

    // Construct the URL
    const url = new URL(`${API_BASE}${endpoint}`);
    let fetchOptions: RequestInit = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONVO360_API_KEY}`
      }
    };

    // Attach Payload based on HTTP Method
    if (method === "POST" || method === "PUT" || method === "DELETE") {
      fetchOptions.body = JSON.stringify(payload);
      
      // Edge case: /whatsapp-template/list uses POST but the docs say parameters are (query)
      if (action === 'template.list' && payload) {
         Object.keys(payload).forEach(key => url.searchParams.append(key, payload[key]));
      }
    } else if (method === "GET" && payload) {
      // Append payload parameters to URL for GET requests
      Object.keys(payload).forEach(key => url.searchParams.append(key, payload[key]));
    }

    // Execute the request to Convo360
    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      console.error("Convo360 API Error:", data);
      return NextResponse.json({ message: data.message || "Upstream provider error" }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("WhatsApp Route Error:", error);
    return NextResponse.json({ message: error.message || "Internal Routing Failure" }, { status: 500 });
  }
}