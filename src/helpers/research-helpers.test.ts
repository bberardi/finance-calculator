import { describe, it, expect } from 'vitest';
import { normalizeResearchUrl, isSafeResearchUrl } from './research-helpers';

describe('normalizeResearchUrl', () => {
  it('prepends https:// to a bare host so it becomes a real link', () => {
    expect(normalizeResearchUrl('zillow.com')).toBe('https://zillow.com');
    expect(normalizeResearchUrl('www.morningstar.com/stocks/xnas/aapl')).toBe(
      'https://www.morningstar.com/stocks/xnas/aapl'
    );
  });

  it('prepends https:// to a bare host:port too, not mistaking the port for a scheme', () => {
    // "localhost" / "example.com" up to the colon is itself a syntactically
    // valid RFC 3986 scheme name, so a naive "has a scheme?" check misreads
    // these as already-schemed ("localhost:", "example.com:") and never adds
    // https:// — which then makes isSafeResearchUrl reject them outright.
    expect(normalizeResearchUrl('localhost:3000')).toBe(
      'https://localhost:3000'
    );
    expect(normalizeResearchUrl('example.com:8080/path')).toBe(
      'https://example.com:8080/path'
    );
  });

  it('leaves an already-schemed URL untouched', () => {
    expect(normalizeResearchUrl('https://example.com')).toBe(
      'https://example.com'
    );
    expect(normalizeResearchUrl('http://example.com')).toBe(
      'http://example.com'
    );
  });

  it('does not "fix" a dangerous scheme — it is left for the safety check to reject', () => {
    // Already carries a scheme, so no https:// is prepended (which would have
    // masked it as a safe-looking link).
    expect(normalizeResearchUrl('javascript:alert(1)')).toBe(
      'javascript:alert(1)'
    );
  });

  it('trims surrounding whitespace, and an empty/blank value stays empty', () => {
    expect(normalizeResearchUrl('  zillow.com  ')).toBe('https://zillow.com');
    expect(normalizeResearchUrl('')).toBe('');
    expect(normalizeResearchUrl('   ')).toBe('');
  });
});

describe('isSafeResearchUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isSafeResearchUrl('https://example.com/research')).toBe(true);
    expect(isSafeResearchUrl('http://example.com')).toBe(true);
  });

  it('rejects schemes that can execute or exfiltrate when clicked', () => {
    expect(isSafeResearchUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeResearchUrl('data:text/html,<script>alert(1)</script>')).toBe(
      false
    );
    expect(isSafeResearchUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeResearchUrl('ftp://example.com')).toBe(false);
  });

  it('rejects a value that is not a parseable URL', () => {
    expect(isSafeResearchUrl('not a url')).toBe(false);
    expect(isSafeResearchUrl('')).toBe(false);
  });
});
