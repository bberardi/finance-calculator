import { describe, it, expect } from 'vitest';
import { generateId } from './id-helpers';

describe('ID Helpers', () => {
  describe('generateId', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateId();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(id).toMatch(uuidRegex);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();

      // All IDs should be different
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });

    it('should always generate IDs with correct length', () => {
      const id = generateId();
      // UUID v4 is always 36 characters (32 hex digits + 4 hyphens)
      expect(id.length).toBe(36);
    });

    it('should generate many unique IDs', () => {
      const ids = new Set<string>();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        ids.add(generateId());
      }

      // All IDs should be unique
      expect(ids.size).toBe(count);
    });
  });
});
