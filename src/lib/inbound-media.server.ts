/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateAiText, transcribeAudio, type AiProvider } from "@/lib/ai-provider.server";

export type InboundMediaInput = {
  mediaType: "image" | "audio" | "document" | "video";
  url?: string | null;
  base64?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  caption?: string | null;
};

export type ProcessedInboundMedia = {
  attachmentId: string | null;
  mediaType: InboundMediaInput["mediaType"];
  contextText: string;
  requiresHandoff: boolean;
  error?: string;
};

type MediaContext = {
  supabase: any;
  organizationId: string;
  leadId: string;
  provider: "zapi" | "meta_instagram";
  externalId?: string | null;
};

const MAX_MEDIA_BYTES = 15_000_000;
const MAX_IMAGE_BYTES = 8_000_000;

export async function processInboundMedia(
  ctx: MediaContext,
  input: InboundMediaInput,
): Promise<ProcessedInboundMedia> {
  const now = new Date().toISOString();
  let bytes: Uint8Array | null = null;
  let mimeType = normalizeMime(input.mimeType, input.mediaType);
  let fileName = sanitizeFileName(input.fileName || defaultFileName(input.mediaType, mimeType));
  let storagePath: string | null = null;
  let attachmentId: string | null = null;

  try {
    const downloaded = input.base64
      ? decodeBase64(input.base64, mimeType)
      : input.url
        ? await downloadMedia(input.url, ctx.provider)
        : null;
    if (!downloaded) throw new Error("Arquivo de mídia sem URL ou conteúdo");
    bytes = downloaded.bytes;
    mimeType = normalizeMime(input.mimeType || downloaded.mimeType, input.mediaType);
    if (!input.fileName && downloaded.fileName) fileName = sanitizeFileName(downloaded.fileName);
    const max = input.mediaType === "image" ? MAX_IMAGE_BYTES : MAX_MEDIA_BYTES;
    if (bytes.byteLength > max)
      throw new Error(`Arquivo excede o limite de ${Math.round(max / 1_000_000)} MB`);

    storagePath = `${ctx.organizationId}/${ctx.leadId}/${crypto.randomUUID()}-${fileName}`;
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const { error: uploadError } = await ctx.supabase.storage
      .from("message-media")
      .upload(storagePath, body, { contentType: mimeType, upsert: false });
    if (uploadError) {
      storagePath = null;
      throw new Error(`Falha ao guardar anexo: ${uploadError.message}`);
    }

    const { data: attachment, error: insertError } = await ctx.supabase
      .from("message_attachments")
      .insert({
        organization_id: ctx.organizationId,
        lead_id: ctx.leadId,
        media_type: input.mediaType,
        mime_type: mimeType,
        file_name: fileName,
        storage_path: storagePath,
        external_url: input.url || null,
      } as never)
      .select("id")
      .single();
    if (insertError) throw new Error(`Falha ao registrar anexo: ${insertError.message}`);
    attachmentId = attachment.id as string;

    const { data: settings } = await ctx.supabase
      .from("company_settings")
      .select("ai_multimodal_enabled, ai_provider, ai_fallback_provider, ai_model")
      .eq("organization_id", ctx.organizationId)
      .limit(1)
      .maybeSingle();
    if (settings?.ai_multimodal_enabled === false) {
      return await finishAttachment(ctx.supabase, attachmentId, {
        contextText: `[${mediaLabel(input.mediaType)} recebido; análise multimodal está desativada.]`,
        mediaType: input.mediaType,
        requiresHandoff: true,
        error: "multimodal_disabled",
      });
    }

    if (input.mediaType === "audio") {
      const transcript = await transcribeAudio(bytes, fileName, mimeType);
      if (!transcript) throw new Error("O áudio não produziu uma transcrição utilizável");
      await ctx.supabase
        .from("message_attachments")
        .update({ transcript, extracted_text: transcript, ai_processed_at: now } as never)
        .eq("id", attachmentId);
      return {
        attachmentId,
        mediaType: input.mediaType,
        contextText: `[Áudio transcrito: ${transcript.slice(0, 6000)}]`,
        requiresHandoff: false,
      };
    }

    if (input.mediaType === "image") {
      const dataUrl = `data:${mimeType};base64,${encodeBase64(bytes)}`;
      const generated = await generateAiText({
        provider: (settings?.ai_provider || "anthropic") as AiProvider,
        fallbackProvider: settings?.ai_fallback_provider as AiProvider | null,
        model: settings?.ai_model,
        maxTokens: 700,
        temperature: 0,
        system: `Analise imagens recebidas em uma conversa comercial. Descreva somente o que estiver visível e relevante para a solicitação. Não identifique pessoas, não deduza dados sensíveis e não invente especificações técnicas. Se a imagem estiver ilegível, diga claramente.`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  input.caption?.trim() ||
                  "Descreva esta imagem para que a assistente Ana possa atender o cliente com segurança.",
              },
              { type: "image_url", url: dataUrl, mediaType: mimeType },
            ],
          },
        ],
      });
      const description = generated.text.trim();
      if (!description) throw new Error("A IA não conseguiu descrever a imagem");
      await ctx.supabase
        .from("message_attachments")
        .update({ extracted_text: description, ai_processed_at: now } as never)
        .eq("id", attachmentId);
      return {
        attachmentId,
        mediaType: input.mediaType,
        contextText: `[Imagem analisada por ${generated.provider}: ${description.slice(0, 6000)}]`,
        requiresHandoff: false,
      };
    }

    return await finishAttachment(ctx.supabase, attachmentId, {
      contextText: `[${mediaLabel(input.mediaType)} recebido. Encaminhar para análise humana.]`,
      mediaType: input.mediaType,
      requiresHandoff: true,
      error: `${input.mediaType}_requires_human_review`,
    });
  } catch (error) {
    const message = (error as Error).message;
    if (attachmentId) {
      await ctx.supabase
        .from("message_attachments")
        .update({
          extracted_text: `Falha de processamento: ${message}`,
          ai_processed_at: new Date().toISOString(),
        } as never)
        .eq("id", attachmentId);
    } else {
      const { data: attachment } = await ctx.supabase
        .from("message_attachments")
        .insert({
          organization_id: ctx.organizationId,
          lead_id: ctx.leadId,
          media_type: input.mediaType,
          mime_type: mimeType,
          file_name: fileName,
          storage_path: storagePath,
          external_url: input.url || null,
          extracted_text: null,
        } as never)
        .select("id")
        .maybeSingle();
      attachmentId = attachment?.id ?? null;
    }
    return {
      attachmentId,
      mediaType: input.mediaType,
      contextText: `[${mediaLabel(input.mediaType)} recebido, mas não foi possível processá-lo com segurança.]`,
      requiresHandoff: true,
      error: message,
    };
  }
}

export async function linkAttachmentsToMessage(
  supabase: any,
  attachmentIds: string[],
  messageId: string,
) {
  if (!attachmentIds.length) return;
  const { error } = await supabase
    .from("message_attachments")
    .update({ message_id: messageId } as never)
    .in("id", attachmentIds);
  if (error) throw new Error(error.message);
}

async function finishAttachment(
  supabase: any,
  attachmentId: string,
  result: Omit<ProcessedInboundMedia, "attachmentId">,
): Promise<ProcessedInboundMedia> {
  await supabase
    .from("message_attachments")
    .update({
      extracted_text: result.contextText,
      ai_processed_at: new Date().toISOString(),
    } as never)
    .eq("id", attachmentId);
  return { attachmentId, ...result };
}

async function downloadMedia(
  rawUrl: string,
  provider: MediaContext["provider"],
): Promise<{ bytes: Uint8Array; mimeType: string | null; fileName: string | null }> {
  const allowedHosts = (process.env.INBOUND_MEDIA_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  let url = validateMediaUrl(rawUrl);
  let response: Response | null = null;
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (
      allowedHosts.length &&
      !allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    ) {
      throw new Error(`Host de mídia não permitido: ${url.hostname}`);
    }
    const sendMetaToken =
      provider === "meta_instagram" &&
      Boolean(process.env.META_PAGE_ACCESS_TOKEN) &&
      isMetaOwnedHost(url.hostname);
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: sendMetaToken
        ? { authorization: `Bearer ${process.env.META_PAGE_ACCESS_TOKEN}` }
        : undefined,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirecionamento de mídia sem destino");
    if (redirects === 3) throw new Error("Muitos redirecionamentos no download da mídia");
    url = validateMediaUrl(new URL(location, url).toString());
  }
  if (!response) throw new Error("Download da mídia não iniciado");
  if (!response.ok) throw new Error(`Download da mídia falhou (HTTP ${response.status})`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_MEDIA_BYTES) throw new Error("Arquivo excede o limite de 15 MB");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_MEDIA_BYTES) throw new Error("Arquivo excede o limite de 15 MB");
  const disposition = response.headers.get("content-disposition") || "";
  const name = disposition.match(/filename\*?=(?:UTF-8''|["']?)([^"';]+)/i)?.[1];
  return {
    bytes: new Uint8Array(buffer),
    mimeType: response.headers.get("content-type")?.split(";")[0] || null,
    fileName: name ? decodeURIComponent(name) : null,
  };
}

function isMetaOwnedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ["facebook.com", "fbcdn.net", "fbsbx.com", "instagram.com"].some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

function validateMediaUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("A mídia precisa usar HTTPS");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80")
  )
    throw new Error("Endereço local ou privado não é permitido");
  url.username = "";
  url.password = "";
  url.hash = "";
  return url;
}

function normalizeMime(
  value: string | null | undefined,
  mediaType: InboundMediaInput["mediaType"],
): string {
  const mime = (value || "").split(";")[0].trim().toLowerCase();
  if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime)) return mime;
  return mediaType === "image"
    ? "image/jpeg"
    : mediaType === "audio"
      ? "audio/ogg"
      : mediaType === "video"
        ? "video/mp4"
        : "application/octet-stream";
}

function defaultFileName(mediaType: InboundMediaInput["mediaType"], mime: string): string {
  const extension =
    mime
      .split("/")[1]
      ?.replace("jpeg", "jpg")
      .replace(/[^a-z0-9]/g, "") || "bin";
  return `${mediaType}-${Date.now()}.${extension}`;
}

function sanitizeFileName(value: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  const safe = decoded
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (safe || `media-${Date.now()}.bin`).slice(-180);
}

function mediaLabel(type: InboundMediaInput["mediaType"]): string {
  return type === "image"
    ? "Imagem"
    : type === "audio"
      ? "Áudio"
      : type === "video"
        ? "Vídeo"
        : "Documento";
}

function decodeBase64(
  value: string,
  fallbackMime: string,
): { bytes: Uint8Array; mimeType: string; fileName: null } {
  const match = value.match(/^data:([^;]+);base64,(.+)$/s);
  const raw = (match?.[2] || value).replace(/\s/g, "");
  if (raw.length > Math.ceil((MAX_MEDIA_BYTES * 4) / 3) + 100)
    throw new Error("Arquivo base64 excede o limite");
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return { bytes, mimeType: match?.[1] || fallbackMime, fileName: null };
}

function encodeBase64(bytes: Uint8Array): string {
  const chunkSize = 32_768;
  let binary = "";
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(start, Math.min(start + chunkSize, bytes.length)),
    );
  }
  return btoa(binary);
}
