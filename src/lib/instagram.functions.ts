export async function sendInstagramText(
  recipientId: string,
  text: string,
): Promise<{
  ok: boolean;
  messageId?: string;
  error?: string;
}> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  const version = process.env.META_GRAPH_API_VERSION || "v23.0";
  if (!token || !pageId) return { ok: false, error: "meta_instagram_not_configured" };
  if (!recipientId) return { ok: false, error: "instagram_recipient_missing" };
  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/messages`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: { text: text.slice(0, 1000) },
        }),
      },
    );
    const payload = (await response.json()) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!response.ok)
      return { ok: false, error: payload.error?.message || `Meta HTTP ${response.status}` };
    return { ok: true, messageId: payload.message_id };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function verifyMetaSignature(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const actual = `sha256=${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
  if (actual.length !== signature.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1)
    mismatch |= actual.charCodeAt(index) ^ signature.charCodeAt(index);
  return mismatch === 0;
}
