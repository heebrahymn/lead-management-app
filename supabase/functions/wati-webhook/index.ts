import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // GET request for health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "live", message: "WATI Webhook is ready" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    console.log("FULL WEBHOOK BODY:", JSON.stringify(body, null, 2));

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceKey);

    await processWebhook(supabase, body);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("CRITICAL WEBHOOK ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processWebhook(supabase: any, body: any) {
  // WATI fields
  const waId = body.waId || "";
  const senderName = body.senderName || (body.messageContact && body.messageContact.name) || "Unknown";
  const messageText = body.text || "";
  const messageType = body.type || "text";
  const watiMsgId = body.id || body.whatsappMessageId || null;
  const operatorName = body.operatorName || null;
  const isOwner = body.owner === true;
  const eventType = body.eventType || "";

  if (eventType === "statusChange") return;
  if (!waId) {
    console.warn("Skipping: No waId found");
    return;
  }

  const direction = isOwner ? "outbound" : "inbound";
  const phoneRaw = waId.replace(/^\+/, "");
  const phonePlus = `+${phoneRaw}`;

  console.log(`Processing ${direction} message for ${phoneRaw}`);

  // 1. Lead lookup/creation
  let leadId = null;
  const { data: existingLeads, error: searchError } = await supabase
    .from("leads")
    .select("id")
    .or(`phone.eq.${phoneRaw},phone.eq.${phonePlus}`)
    .limit(1);

  if (searchError) {
    console.error("DB Error (lead search):", searchError);
  }

  if (existingLeads && existingLeads.length > 0) {
    leadId = existingLeads[0].id;
    console.log(`Found existing lead: ${leadId}`);
  } else if (direction === "inbound") {
    console.log(`Creating new lead for ${phoneRaw}`);
    const { data: newLead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name: senderName,
        phone: phoneRaw,
        source: "whatsapp",
        status: "new",
      })
      .select("id")
      .single();

    if (leadError) {
      console.error("DB Error (lead insert):", leadError);
    } else if (newLead) {
      leadId = newLead.id;
      console.log(`Created new lead: ${leadId}`);
    }
  }

  // 2. Message storage
  const { error: insertError } = await supabase
    .from("whatsapp_messages")
    .insert({
      wati_message_id: watiMsgId,
      lead_id: leadId,
      sender_name: senderName,
      wa_id: phoneRaw,
      message_text: messageText,
      message_type: messageType,
      direction: direction,
      status: isOwner ? (body.statusString?.toLowerCase() ?? "sent") : "received",
      operator_name: operatorName,
    });

  if (insertError) {
    console.error("DB Error (message insert):", insertError);
  } else {
    console.log("Message successfully saved to DB");
  }
}
