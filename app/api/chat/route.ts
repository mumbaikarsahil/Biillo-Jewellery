import Groq from "groq-sdk";
import { ERP_INTENTS } from "@/config/aiQueryRouter";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are the executive AI routing engine for Biillo, an enterprise jewelry ERP system.
Your only job is to analyze user natural language requests and map them to one of our master query intents.

====================================================================
CRITICAL ROUTING RULES (MUST FOLLOW):
1. NEVER return null if the question is about Sales, Revenue, Invoices, Billing, or Money -> ALWAYS map to "query_sales_master".
2. NEVER return null if the question is about Stock, Tops, Rings, Items, Barcodes, or Valuation -> ALWAYS map to "query_inventory_master".
3. NEVER return null if the question is about Job bags, Karigars, Artisans, or Repairs -> ALWAYS map to "query_manufacturing_master".
4. NEVER return null if the question is about Customers, Points, Credit, or Kitty plans -> ALWAYS map to "query_crm_master".
5. NEVER return null if the question is about Vouchers, Voucher Stock, Call Assignments, Telecalling Status, Delivery Agents, or Party/Distributor Payments -> ALWAYS map to "query_vouchers_master".
6. If a parameter (like warehouse_name, party_name, or invoice_number) is not explicitly mentioned by the user, leave it null/undefined. Do NOT fail the intent!

====================================================================
EXPLICIT FEW-SHOT EXAMPLES (Memorize these routing patterns):
User: "What is our total sales revenue today?"
Output: {"intent": "query_sales_master", "parameters": {"frequency": "Daily"}}

User: "How many tops are at Andheri West?"
Output: {"intent": "query_inventory_master", "parameters": {"warehouse_name": "Andheri", "search_term": "tops"}}

User: "Check the status of job bag JB-1002"
Output: {"intent": "query_manufacturing_master", "parameters": {"job_bag_number": "JB-1002"}}

User: "Show me stock valuation for Chakan"
Output: {"intent": "query_inventory_master", "parameters": {"warehouse_name": "Chakan"}}

User: "What is the store credit balance for 9876543210?"
Output: {"intent": "query_crm_master", "parameters": {"phone_number": "9876543210"}}

User: "Do we have any pending branch restock requests?"
Output: {"intent": "query_operations_master", "parameters": {"operation_type": "restocks"}}

User: "How many vouchers are in stock?"
Output: {"intent": "query_vouchers_master", "parameters": {}}

User: "Show me voucher call assignments status"
Output: {"intent": "query_vouchers_master", "parameters": {"metric": "calls"}}

User: "What about vouchers which are sent for calling?"
Output: {"intent": "query_vouchers_master", "parameters": {"metric": "calls"}}

User: "Check voucher distribution payments and delivery agents"
Output: {"intent": "query_vouchers_master", "parameters": {"metric": "distributions"}}

User: "How many vouchers were delivered to party Ramesh?"
Output: {"intent": "query_vouchers_master", "parameters": {"party_name": "Ramesh", "metric": "distributions"}}
====================================================================

STORE & BRANCH KEYWORD MAPPING:
- "Sambhajinagar", "Aurangabad" -> "Sambhajinagar"
- "Pimpri", "Chinchwad", "Sangavi" -> "Pimpri"
- "Parbhani" -> "Parbhani"
- "Chakan" -> "Chakan"
- "Uran" -> "Uran"
- "Dombivli" -> "Dombivli"
- "Sangamner" -> "Sangamner"
- "Parel" -> "Parel"
- "Badlapur" -> "Badlapur"
- "Thane" -> "Thane"
- "Kurla" -> "Kurla"
- "Kamothe" -> "Kamothe"
- "Vashi" -> "Vashi"
- "Borivali", "Shimpoli" -> "Borivali"
- "Virar" -> "Virar"
- "Andheri", "Shoppers Stop" -> "Andheri"
- "Breach Candy" -> "Breach Candy"
- "Ghatkopar" -> "Ghatkopar"

Analyze the latest user request in context. Respond ONLY with a valid JSON object containing:
1. "intent": The matched key string from the available intents (or null ONLY if completely unrelated to jewelry/ERP).
2. "parameters": An object containing the extracted variables matching the parameter schema.`;

export async function POST(req: Request) {
  try {
    const { message, companyId, history = [] } = await req.json();

    if (!message || !companyId) {
      return Response.json({ text: "Missing message or tenant company ID." }, { status: 400 });
    }

    const intentDefinitions = Object.entries(ERP_INTENTS)
      .map(([key, val]) => `Intent: "${key}"\nDescription: ${val.description}\nParameters: ${JSON.stringify(val.parameters)}`)
      .join("\n\n");

    const formattedHistory = history.slice(-6).map((msg: { role: string, content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Step 1: Intent & Parameter Extraction via Groq
    const parseCompletion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature forces strict adherence to rules
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\nAVAILABLE INTENTS:\n${intentDefinitions}` },
        ...formattedHistory,
        { role: "user", content: message }
      ]
    });

    const parsedContent = JSON.parse(parseCompletion.choices[0]?.message?.content || "{}");
    console.log("[AI Router Matched]:", parsedContent); // Server console log for debugging

    const intentKey = parsedContent.intent as keyof typeof ERP_INTENTS;
    const parameters = parsedContent.parameters || {};

    // Step 2: Execute Hardcoded Database Logic
    if (intentKey && ERP_INTENTS[intentKey]) {
      const dbResult = await ERP_INTENTS[intentKey].execute(parameters, companyId);
      
      // Step 3: Translate raw JSON database payload into an executive summary
      const summaryCompletion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        temperature: 0.2, // Lowered temperature for stricter formatting
        messages: [
          { 
            role: "system", 
            content: `You are an AI Executive Assistant for a jewelry brand owner. Formulate a professional, insightful summary of the raw database results provided below.
            
            CRITICAL FORMATTING RULES:
            1. NEVER omit any data from 'collection_by_mode', 'store_ranking', 'assignment_statuses', or 'call_outcomes'. If data exists in the payload, list all items clearly.
            2. Use Markdown bullet points to clearly present lists and rankings.
            3. Do not round numbers or change currencies. Use the exact pre-formatted strings provided in the payload (e.g., '₹6,68,018').
            4. Keep your opening summary sentence concise, then immediately provide the bulleted breakdowns.` 
          },
          { 
            role: "user", 
            content: `User Question: "${message}"\nDatabase Execution Payload:\n${JSON.stringify(dbResult, null, 2)}` 
          }
        ]
      });

      return Response.json({ 
        text: summaryCompletion.choices[0]?.message?.content || "Data retrieved successfully.", 
        data: dbResult 
      });
    }

    // Fallback: Smart clarification if the query falls outside active modules
    const clarification = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { 
          role: "system", 
          content: "The user asked a question that falls outside our active ERP query modules (Inventory, Sales, Vouchers, CRM/Kitty, Manufacturing, Operations). Write a polite, concise 1-sentence response explaining which modules you can check." 
        },
        ...formattedHistory,
        { role: "user", content: message }
      ]
    });

    return Response.json({ 
      text: clarification.choices[0]?.message?.content || "Please specify if you are querying Inventory, Sales, Karigars, Vouchers, or Store Operations.", 
      data: null 
    });

  } catch (error: any) {
    console.error("AI Routing Failure:", error);
    return Response.json({ text: "A system error occurred while scanning the ERP database.", error: error.message }, { status: 500 });
  }
}