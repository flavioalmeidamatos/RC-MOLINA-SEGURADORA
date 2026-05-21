import type { WhatsAppInlineToken, WhatsAppInlineTokenKind } from "../types/whatsapp_campaign";

const DELIMITERS: { char: string; kind: WhatsAppInlineTokenKind }[] = [
  { char: "```", kind: "code" },
  { char: "*", kind: "bold" },
  { char: "_", kind: "italic" },
  { char: "~", kind: "strike" },
  { char: "`", kind: "code" }
];

function findFirstValidPair(text: string, d: string): { start: number; end: number } | null {
  let i = 0;
  while (i < text.length) {
    i = text.indexOf(d, i);
    if (i === -1) break;
    
    if (i + d.length < text.length && text[i + d.length] !== ' ') {
      let j = i + d.length;
      while (j < text.length) {
        j = text.indexOf(d, j);
        if (j === -1) break;
        
        if (j > i + d.length && text[j - 1] !== ' ') {
          return { start: i, end: j };
        }
        j++;
      }
    }
    i++;
  }
  return null;
}

function parseText(text: string, activeKinds: Set<WhatsAppInlineTokenKind>): WhatsAppInlineToken[] {
  if (!text) return [];

  let earliestPair: { start: number; end: number; kind: WhatsAppInlineTokenKind; char: string } | null = null;

  for (const { char, kind } of DELIMITERS) {
    if (activeKinds.has(kind)) continue;

    const pair = findFirstValidPair(text, char);
    if (pair) {
      if (!earliestPair || pair.start < earliestPair.start) {
        earliestPair = { ...pair, kind, char };
      }
    }
  }

  if (!earliestPair) {
    return [{ kind: "text", value: text }];
  }

  const { start, end, kind, char } = earliestPair;
  const beforeText = text.slice(0, start);
  const insideText = text.slice(start + char.length, end);
  const afterText = text.slice(end + char.length);

  const tokens: WhatsAppInlineToken[] = [];

  if (beforeText) {
    tokens.push(...parseText(beforeText, activeKinds));
  }

  let children: WhatsAppInlineToken[] | undefined;
  if (kind === "code") {
    children = [{ kind: "text", value: insideText }];
  } else {
    const newActive = new Set(activeKinds);
    newActive.add(kind);
    children = parseText(insideText, newActive);
  }

  tokens.push({
    kind,
    value: insideText,
    children
  });

  if (afterText) {
    tokens.push(...parseText(afterText, activeKinds));
  }

  return tokens;
}

export function tokenizeWhatsAppInline(text: string): WhatsAppInlineToken[] {
  return parseText(text, new Set());
}

export function splitWhatsAppMessageLines(text: string): WhatsAppInlineToken[][] {
  return text.split("\n").map((line) => tokenizeWhatsAppInline(line));
}
