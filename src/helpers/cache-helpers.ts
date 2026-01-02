import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { exportToJson, importFromJson } from './data-helpers';

const CACHE_KEY_DATA = 'pathwise-cached-data';
const CACHE_KEY_ENABLED = 'pathwise-cache-enabled';

/**
 * Save loans and investments to localStorage
 */
export const saveToCache = (
  loans: Loan[],
  investments: Investment[]
): void => {
  try {
    const jsonData = exportToJson(loans, investments);
    localStorage.setItem(CACHE_KEY_DATA, jsonData);
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
};

/**
 * Load loans and investments from localStorage
 * Returns null if no cached data exists or if parsing fails
 */
export const loadFromCache = (): {
  loans: Loan[];
  investments: Investment[];
} | null => {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY_DATA);
    if (!cachedData) {
      return null;
    }
    return importFromJson(cachedData);
  } catch (error) {
    console.error('Error loading from cache:', error);
    return null;
  }
};

/**
 * Clear cached data from localStorage
 */
export const clearCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY_DATA);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Save cache enabled setting to localStorage
 */
export const saveCacheEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(CACHE_KEY_ENABLED, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving cache enabled setting:', error);
  }
};

/**
 * Load cache enabled setting from localStorage
 * Returns false by default if not set
 */
export const loadCacheEnabled = (): boolean => {
  try {
    const enabled = localStorage.getItem(CACHE_KEY_ENABLED);
    return enabled === 'true';
  } catch (error) {
    console.error('Error loading cache enabled setting:', error);
    return false;
  }
};
