import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveToCache,
  loadFromCache,
  clearCache,
  saveCacheEnabled,
  loadCacheEnabled,
} from './cache-helpers';
import { Loan } from '../models/loan-model';
import { Investment, CompoundingFrequency } from '../models/investment-model';

describe('cache-helpers', () => {
  const testLoan: Loan = {
    Id: 'loan-1',
    Provider: 'Test Bank',
    Name: 'Test Loan',
    InterestRate: 5.0,
    Principal: 100000,
    CurrentAmount: 95000,
    MonthlyPayment: 500,
    StartDate: new Date('2024-01-01'),
    EndDate: new Date('2044-01-01'),
    AmortizationSchedule: [],
  };

  const testInvestment: Investment = {
    Id: 'investment-1',
    Provider: 'Test Fund',
    Name: 'Test Investment',
    StartDate: new Date('2024-01-01'),
    StartingBalance: 10000,
    AverageReturnRate: 7.0,
    CompoundingPeriod: CompoundingFrequency.Monthly,
    ProjectedGrowth: [],
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('saveToCache and loadFromCache', () => {
    it('should save and load loans and investments', () => {
      saveToCache([testLoan], [testInvestment]);
      const result = loadFromCache();

      expect(result).not.toBeNull();
      expect(result?.loans).toHaveLength(1);
      expect(result?.investments).toHaveLength(1);

      expect(result?.loans[0].Id).toBe('loan-1');
      expect(result?.loans[0].Name).toBe('Test Loan');
      expect(result?.loans[0].StartDate).toBeInstanceOf(Date);

      expect(result?.investments[0].Id).toBe('investment-1');
      expect(result?.investments[0].Name).toBe('Test Investment');
    });

    it('should handle empty arrays', () => {
      saveToCache([], []);
      const result = loadFromCache();

      expect(result).not.toBeNull();
      expect(result?.loans).toHaveLength(0);
      expect(result?.investments).toHaveLength(0);
    });

    it('should return null when no cached data exists', () => {
      const result = loadFromCache();
      expect(result).toBeNull();
    });

    it('should return null when cached data is invalid', () => {
      localStorage.setItem('pathwise-cached-data', 'invalid json');
      const result = loadFromCache();
      expect(result).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Mock localStorage.setItem to throw an error
      const setItemSpy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('Storage quota exceeded');
        });

      saveToCache([testLoan], [testInvestment]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error saving to cache:',
        expect.any(Error)
      );

      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('clearCache', () => {
    it('should clear cached data', () => {
      saveToCache([testLoan], [testInvestment]);
      expect(loadFromCache()).not.toBeNull();

      clearCache();
      expect(loadFromCache()).toBeNull();
    });

    it('should handle clearing when no data exists', () => {
      clearCache();
      expect(loadFromCache()).toBeNull();
    });
  });

  describe('saveCacheEnabled and loadCacheEnabled', () => {
    it('should save and load cache enabled setting as true', () => {
      saveCacheEnabled(true);
      expect(loadCacheEnabled()).toBe(true);
    });

    it('should save and load cache enabled setting as false', () => {
      saveCacheEnabled(false);
      expect(loadCacheEnabled()).toBe(false);
    });

    it('should return false by default when not set', () => {
      expect(loadCacheEnabled()).toBe(false);
    });

    it('should handle localStorage errors gracefully when saving', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const setItemSpy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('Storage quota exceeded');
        });

      saveCacheEnabled(true);
      expect(consoleErrorSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle localStorage errors gracefully when loading', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const getItemSpy = vi
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new Error('Storage access denied');
        });

      const result = loadCacheEnabled();
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      getItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
