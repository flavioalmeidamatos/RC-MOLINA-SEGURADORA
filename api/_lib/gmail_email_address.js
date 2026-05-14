const ATOM_TEXT_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const QUOTED_LOCAL_PART_PATTERN = /^"(?:[\x20\x21\x23-\x5b\x5d-\x7e]|\\[\x20-\x7e])*"$/;
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

function splitAddressList(value) {
  const items = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;
  let angleDepth = 0;
  let commentDepth = 0;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === '\\' && inQuotes) {
      current += character;
      escaped = true;
      continue;
    }

    if (character === '"' && commentDepth === 0) {
      inQuotes = !inQuotes;
      current += character;
      continue;
    }

    if (!inQuotes) {
      if (character === '(') {
        commentDepth += 1;
        current += character;
        continue;
      }

      if (character === ')' && commentDepth > 0) {
        commentDepth -= 1;
        current += character;
        continue;
      }

      if (commentDepth === 0) {
        if (character === '<') {
          angleDepth += 1;
        } else if (character === '>' && angleDepth > 0) {
          angleDepth -= 1;
        } else if (character === ',' && angleDepth === 0) {
          const nextItem = current.trim();
          if (nextItem) items.push(nextItem);
          current = '';
          continue;
        }
      }
    }

    current += character;
  }

  const nextItem = current.trim();
  if (nextItem) items.push(nextItem);

  return items;
}

function normalizeRecipientInput(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => splitAddressList(String(item)));
  }

  return splitAddressList(String(value));
}

function extractAddressSpec(recipient) {
  const trimmed = recipient.trim();
  if (!trimmed) return null;

  const leftBracket = trimmed.indexOf('<');
  const rightBracket = trimmed.lastIndexOf('>');
  const hasAngleBrackets = leftBracket !== -1 || rightBracket !== -1;

  if (!hasAngleBrackets) {
    return trimmed;
  }

  if (
    leftBracket < 0 ||
    rightBracket < 0 ||
    rightBracket < leftBracket ||
    trimmed.indexOf('<', leftBracket + 1) !== -1 ||
    trimmed.indexOf('>', leftBracket + 1) !== rightBracket ||
    trimmed.slice(rightBracket + 1).trim() !== ''
  ) {
    return null;
  }

  const address = trimmed.slice(leftBracket + 1, rightBracket).trim();
  return address || null;
}

function isValidDomainLiteral(domain) {
  const literal = domain.slice(1, -1);
  if (!literal) return false;

  if (/^IPv6:[0-9A-Fa-f:.]+$/.test(literal)) {
    return true;
  }

  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(literal)) {
    return false;
  }

  return literal.split('.').every((segment) => {
    const value = Number(segment);
    return Number.isInteger(value) && value >= 0 && value <= 255;
  });
}

function isValidDomain(domain) {
  if (!domain || domain.length > 253) return false;

  if (domain.startsWith('[') && domain.endsWith(']')) {
    return isValidDomainLiteral(domain);
  }

  if (domain.includes('..') || !domain.includes('.')) return false;

  const labels = domain.split('.');
  return labels.every((label) => DOMAIN_LABEL_PATTERN.test(label));
}

function isValidLocalPart(localPart) {
  if (!localPart || localPart.length > 64) return false;
  return ATOM_TEXT_PATTERN.test(localPart) || QUOTED_LOCAL_PART_PATTERN.test(localPart);
}

function isValidAddressSpec(address) {
  if (!address || address.length > 254 || /\s/.test(address)) {
    return false;
  }

  const atIndex = address.lastIndexOf('@');
  if (atIndex <= 0 || atIndex !== address.indexOf('@') || atIndex === address.length - 1) {
    return false;
  }

  const localPart = address.slice(0, atIndex);
  const domain = address.slice(atIndex + 1);

  return isValidLocalPart(localPart) && isValidDomain(domain);
}

export function parseRecipientList(value) {
  return normalizeRecipientInput(value);
}

export function validateRecipientFields(fields = {}) {
  const recipients = {
    to: parseRecipientList(fields.to),
    cc: parseRecipientList(fields.cc),
    bcc: parseRecipientList(fields.bcc),
  };
  const invalidByField = {};
  const invalid = [];

  for (const [field, values] of Object.entries(recipients)) {
    const invalidRecipients = values.filter((recipient) => {
      const addressSpec = extractAddressSpec(recipient);
      return !addressSpec || !isValidAddressSpec(addressSpec);
    });

    if (invalidRecipients.length > 0) {
      invalidByField[field] = invalidRecipients;
      invalid.push(...invalidRecipients);
    }
  }

  return { recipients, invalid, invalidByField };
}
