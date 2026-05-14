function looksLikeUtf8Mojibake(value) {
  return /(?:Ã.|Â.|â.|ðÅ¸|ï¿½)/.test(value);
}

export function normalizeUtf8Text(value = '') {
  const text = String(value ?? '');
  if (!text || !looksLikeUtf8Mojibake(text)) return text;

  try {
    const decoded = Buffer.from(text, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? text : decoded;
  } catch {
    return text;
  }
}

export function normalizeUploadedFiles(files = []) {
  return files.map((file) => ({
    ...file,
    originalname: normalizeUtf8Text(file.originalname || ''),
  }));
}
