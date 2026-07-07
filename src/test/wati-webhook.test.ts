import { describe, it, expect, vi } from "vitest";

// Copy the webhook logic to inspect for JS errors
async function processWebhook(supabase: any, body: any) {
  // WATI fields with case-insensitive fallbacks and type safety
  const waId = body.waId || body.waid || "";
  const senderName = body.senderName || body.sendername || (body.messageContact && body.messageContact.name) || "Unknown";
  const messageText = body.text || "";
  const messageType = body.type || "text";
  const watiMsgId = body.id || body.whatsappMessageId || body.whatsappmessageid || null;
  const operatorName = body.operatorName || body.operatorname || null;
  const isOwner = body.owner === true;
  const eventType = body.eventType || body.eventtype || "";

  if (eventType === "statusChange") return;
  if (!waId) {
    console.warn("Skipping: No waId found");
    return;
  }

  const direction = isOwner ? "outbound" : "inbound";
  const phoneRaw = String(waId).replace(/^\+/, "");
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
      status: isOwner ? (String(body.statusString || body.statusstring || "sent").toLowerCase()) : "received",
      operator_name: operatorName,
    });

  if (insertError) {
    console.error("DB Error (message insert):", insertError);
  } else {
    console.log("Message successfully saved to DB");
  }
}

describe("WATI Webhook processWebhook", () => {
  it("should process the payload correctly without throwing", async () => {
    const payload = {
      "id": "6a4cea47e8753cf5d4facbdb",
      "created": "2026-07-07T12:00:07.838Z",
      "whatsappMessageId": "wamid.HBgMMjYwOTc3Njg5NzM4FQIAEhggQUNGMzE4RTk4RUM0RkE3REUxNkQyQTUyOUZCNzFCRkYA",
      "conversationId": "6a4cea4775ea2a22f5429940",
      "ticketId": "6a4cea47e8753cf5d4facbd4",
      "text": "Hello! Can I get more info on this?",
      "type": "text",
      "data": null,
      "sourceId": "120249870079420486",
      "sourceUrl": "https://fb.me/884lqzdjC",
      "timestamp": "1783425605",
      "owner": false,
      "eventType": "message",
      "statusString": "SENT",
      "avatarUrl": null,
      "assignedId": null,
      "operatorName": null,
      "operatorEmail": null,
      "waId": "260977689738",
      "messageContact": null,
      "senderName": "Car Doctor",
      "listReply": null,
      "interactiveButtonReply": null,
      "buttonReply": null,
      "replyContextId": "",
      "sourceType": 7,
      "frequentlyForwarded": false,
      "forwarded": false,
      "bsuid": "ZM.1718810922453381"
    };

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "mock-new-lead-uuid" }, error: null }),
    };

    await expect(processWebhook(mockSupabase, payload)).resolves.not.toThrow();

    // Verify calls
    expect(mockSupabase.from).toHaveBeenCalledWith("leads");
    expect(mockSupabase.or).toHaveBeenCalledWith("phone.eq.260977689738,phone.eq.+260977689738");
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: "Car Doctor",
      phone: "260977689738",
      source: "whatsapp",
      status: "new"
    }));
  });

  it("should handle numeric waId and lowercase key variants safely without throwing", async () => {
    const payload = {
      id: "6a4cea47e8753cf5d4facbdb",
      owner: false,
      eventtype: "message",
      waid: 260977689738, // numeric waid
      sendername: "Car Doctor",
    };

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: "Insert error" }),
    };

    await expect(processWebhook(mockSupabase, payload)).resolves.not.toThrow();
    expect(mockSupabase.or).toHaveBeenCalledWith("phone.eq.260977689738,phone.eq.+260977689738");
  });

  it("should handle numeric statusString and outbound message safely without throwing", async () => {
    const payload = {
      id: "6a4cea47e8753cf5d4facbdb",
      owner: true, // outbound message
      eventtype: "message",
      waid: "260977689738",
      statusstring: 200, // numeric status
    };

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    await expect(processWebhook(mockSupabase, payload)).resolves.not.toThrow();
  });
});
