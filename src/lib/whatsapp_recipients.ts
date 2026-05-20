import type { RecipientSummary } from "../types/whatsapp_campaign";

export const MAX_WHATSAPP_RECIPIENTS = 10;

export const sanitizeRecipientNumber = (value: string) => value.replace(/\D/g, "").slice(0, 11);

export const createRecipientState = (rawValue: string) => {
  const parsedNumbers = rawValue
    .split(";")
    .map((item) => sanitizeRecipientNumber(item.trim()))
    .filter(Boolean)
    .slice(0, MAX_WHATSAPP_RECIPIENTS);

  return parsedNumbers.length > 0
    ? [...parsedNumbers, ""].slice(0, MAX_WHATSAPP_RECIPIENTS)
    : [""];
};

export const normalizeRecipientState = (values: string[]) => {
  const limitedValues = values
    .map((value) => sanitizeRecipientNumber(value))
    .slice(0, MAX_WHATSAPP_RECIPIENTS);

  while (
    limitedValues.length > 1 &&
    limitedValues[limitedValues.length - 1] === "" &&
    limitedValues[limitedValues.length - 2] === ""
  ) {
    limitedValues.pop();
  }

  if (limitedValues.length === 0) {
    return [""];
  }

  if (
    limitedValues.length < MAX_WHATSAPP_RECIPIENTS &&
    limitedValues[limitedValues.length - 1] !== ""
  ) {
    return [...limitedValues, ""];
  }

  return limitedValues;
};

export const getRecipientSummary = (values: string[]): RecipientSummary => {
  const filledNumbers = values.map((value) => sanitizeRecipientNumber(value)).filter(Boolean);

  return {
    filledNumbers,
    validNumbers: filledNumbers.filter((number) => number.length === 11),
    invalidNumbers: filledNumbers.filter((number) => number.length !== 11),
  };
};

export const replaceRecipientAt = (values: string[], index: number, rawValue: string) => {
  const nextValues = [...values];
  nextValues[index] = sanitizeRecipientNumber(rawValue);
  return normalizeRecipientState(nextValues);
};

export const removeRecipientAt = (values: string[], index: number) => {
  const nextValues = [...values];
  nextValues.splice(index, 1);
  return normalizeRecipientState(nextValues);
};
