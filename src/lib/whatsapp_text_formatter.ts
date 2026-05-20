import type { WhatsAppInlineToken } from "../types/whatsapp_campaign";

const WHATSAPP_INLINE_PATTERN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;

export function tokenizeWhatsAppInline(text: string): WhatsAppInlineToken[] {
  return text
    .split(WHATSAPP_INLINE_PATTERN)
    .filter(Boolean)
    .map((token) => {
      if (/^\*[^*\n]+\*$/.test(token)) {
        return { kind: "bold", value: token.slice(1, -1) } satisfies WhatsAppInlineToken;
      }

      if (/^_[^_\n]+_$/.test(token)) {
        return { kind: "italic", value: token.slice(1, -1) } satisfies WhatsAppInlineToken;
      }

      if (/^~[^~\n]+~$/.test(token)) {
        return { kind: "strike", value: token.slice(1, -1) } satisfies WhatsAppInlineToken;
      }

      if (/^`[^`\n]+`$/.test(token)) {
        return { kind: "code", value: token.slice(1, -1) } satisfies WhatsAppInlineToken;
      }

      return { kind: "text", value: token } satisfies WhatsAppInlineToken;
    });
}

export function splitWhatsAppMessageLines(text: string): WhatsAppInlineToken[][] {
  return text.split("\n").map((line) => tokenizeWhatsAppInline(line));
}
