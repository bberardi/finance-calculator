// Holdings & property context (ROADMAP 9.4). A user pastes research/reference
// links onto a holding (company research for an investment, local-market links
// for a property); the app stores them on-device and renders them as clickable
// anchors, but never fetches them. Because the URL is untrusted user input that
// ends up in an <a href>, these two pure helpers keep it safe. Framework-free
// (D7): no forecast engine, just string handling.

// Add a scheme when the user omits one, so a pasted bare "zillow.com" becomes a
// real "https://zillow.com" link instead of a broken relative reference. A value
// that already carries a scheme — including a dangerous "javascript:" — is left
// untouched for isSafeResearchUrl to judge; an empty string stays empty.
export const normalizeResearchUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  // RFC 3986 scheme: an ASCII letter followed by letters/digits/+/-/. and a colon.
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
};

// A link is safe to render as an <a href> only when it parses to an http(s) URL.
// Anything else is rejected: an unparseable string, or a scheme that could
// execute or exfiltrate when clicked (javascript:, data:, file:, …).
export const isSafeResearchUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};
