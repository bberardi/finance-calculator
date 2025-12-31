/**
 * Generate a unique identifier using the Web Crypto API
 * @returns A UUID v4 string
 */
export const generateId = (): string => {
  return crypto.randomUUID();
};
