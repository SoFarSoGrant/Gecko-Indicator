/**
 * Trend Detector Integration Tests
 *
 * Tests for COMA (Correct Order of Moving Averages) trend detection
 * Validates:
 * - COMA algorithm correctness for uptrends and downtrends
 * - Consecutive bar counting
 * - Trend confirmation logic
 * - EMA gradient analysis
 * - Edge cases and data validation
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { TrendDetector } from '../src/indicators/trend-detector.js';

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock config
const mockConfig = {
  geckoPattern: {
    comaBarRequired: 30,
  },
};

describe('TrendDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new TrendDetector(mockConfig, mockLogger);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct COMA bar requirement', () => {
      expect(detector.requiredComaBarCount).toBe(30);
    });

    it('should use default COMA bar count when config missing', () => {
      const customDetector = new TrendDetector({}, mockLogger);
      expect(customDetector.requiredComaBarCount).toBe(30);
    });

    it('should use custom COMA bar count from config', () => {
      const customConfig = { geckoPattern: { comaBarRequired: 50 } };
      const customDetector = new TrendDetector(customConfig, mockLogger);
      expect(customDetector.requiredComaBarCount).toBe(50);
    });
  });

  describe('COMA check - uptrend', () => {
    it('should detect uptrend: EMA8 > EMA21 > EMA50', () => {
      const data = Array.from({ length: 35 }, (_, i) => ({
        time: i * 1000,
        close: 100 + i,
        indicators: {
          ema_8: 105 + i * 0.5, // Highest
          ema_21: 103 + i * 0.4, // Middle
          ema_50: 101 + i * 0.3, // Lowest
        },
      }));

      const result = detector.checkCOMA(data);

      expect(result.isValid).toBe(true);
      expect(result.direction).toBe('UP');
      expect(result.consecutiveBars).toBeGreaterThanOrEqual(35);
      expect(result.validationDetails.uptrends).toBe(35);
      expect(result.validationDetails.downtrends).toBe(0);
    });

    it('should count consecutive uptrend bars correctly', () => {
      const data = [
        // 20 uptrend bars
        ...Array.from({ length: 20 }, (_, i) => ({
          time: i * 1000,
          indicators: {
            ema_8: 105 + i,
            ema_21: 103 + i,
            ema_50: 101 + i,
          },
        })),
        // 1 mixed bar
        {
          time: 20000,
          indicators: {
            ema_8: 125,
            ema_21: 126, // Not in order
            ema_50: 124,
          },
        },
        // 15 more uptrend bars
        ...Array.from({ length: 15 }, (_, i) => ({
          time: (21 + i) * 1000,
          indicators: {
            ema_8: 127 + i,
            ema_21: 125 + i,
            ema_50: 123 + i,
          },
        })),
      ];

      const result = detector.checkCOMA(data);

      expect(result.direction).toBe('UP');
      expect(result.consecutiveBars).toBe(20); // Max consecutive uptrend (first 20 bars before mixed bar)
    });
  });

  describe('COMA check - downtrend', () => {
    it('should detect downtrend: EMA8 < EMA21 < EMA50', () => {
      const data = Array.from({ length: 35 }, (_, i) => ({
        time: i * 1000,
        close: 100 - i,
        indicators: {
          ema_8: 95 - i * 0.5, // Lowest
          ema_21: 97 - i * 0.4, // Middle
          ema_50: 99 - i * 0.3, // Highest
        },
      }));

      const result = detector.checkCOMA(data);

      expect(result.isValid).toBe(true);
      expect(result.direction).toBe('DOWN');
      expect(result.consecutiveBars).toBeGreaterThanOrEqual(35);
      expect(result.validationDetails.downtrends).toBe(35);
      expect(result.validationDetails.uptrends).toBe(0);
    });
  });

  describe('COMA check - edge cases', () => {
    it('should handle empty data', () => {
      const result = detector.checkCOMA([]);

      expect(result.isValid).toBe(false);
      expect(result.direction).toBeNull();
      expect(result.consecutiveBars).toBe(0);
    });

    it('should handle null data', () => {
      const result = detector.checkCOMA(null);

      expect(result.isValid).toBe(false);
      expect(result.direction).toBeNull();
      expect(result.consecutiveBars).toBe(0);
    });

    it('should handle missing indicators', () => {
      const data = [
        { time: 1000, close: 100 }, // Missing indicators
        { time: 2000, close: 101 }, // Missing indicators
      ];

      const result = detector.checkCOMA(data);

      expect(result.isValid).toBe(false);
      expect(result.validationDetails.incomplete).toBe(2);
    });

    it('should handle incomplete indicator sets', () => {
      const data = [
        {
          time: 1000,
          indicators: {
            ema_8: 105,
            ema_21: 103,
            // Missing ema_50
          },
        },
      ];

      const result = detector.checkCOMA(data);

      expect(result.isValid).toBe(false);
      expect(result.validationDetails.incomplete).toBe(1);
    });

    it('should handle mixed trend data', () => {
      const data = [
        // Some uptrend
        ...Array.from({ length: 10 }, (_, i) => ({
          time: i * 1000,
          indicators: {
            ema_8: 105 + i,
            ema_21: 103 + i,
            ema_50: 101 + i,
          },
        })),
        // Some downtrend
        ...Array.from({ length: 10 }, (_, i) => ({
          time: (10 + i) * 1000,
          indicators: {
            ema_8: 95 - i,
            ema_21: 97 - i,
            ema_50: 99 - i,
          },
        })),
      ];

      const result = detector.checkCOMA(data);

      expect(result.isValid).toBe(true);
      expect(result.consecutiveBars).toBe(10); // Most recent downtrend
      expect(result.direction).toBe('DOWN');
    });

    it('should handle single bar uptrend', () => {
      const data = [
        {
          time: 1000,
          indicators: {
            ema_8: 105,
            ema_21: 103,
            ema_50: 101,
          },
        },
      ];

      const result = detector.checkCOMA(data);

      expect(result.isValid).toBe(true);
      expect(result.direction).toBe('UP');
      expect(result.consecutiveBars).toBe(1);
    });
  });

  describe('trend detection - full flow', () => {
    it('should return unconfirmed trend for insufficient bars', async () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        time: i * 1000,
        close: 100 + i,
        high: 105 + i,
        low: 99 + i,
        indicators: {
          ema_8: 105 + i,
          ema_21: 103 + i,
          ema_50: 101 + i,
        },
      }));

      const result = await detector.detectTrend('BTCUSDT', data);

      expect(result.confirmed).toBe(false);
      expect(result.direction).toBeNull();
    });

    it('should return confirmed uptrend when COMA bars >= required', async () => {
      const data = Array.from({ length: 40 }, (_, i) => ({
        time: i * 1000,
        close: 100 + i,
        high: 105 + i,
        low: 99 + i,
        indicators: {
          ema_8: 105 + i,
          ema_21: 103 + i,
          ema_50: 101 + i,
        },
      }));

      const result = await detector.detectTrend('BTCUSDT', data);

      expect(result.confirmed).toBe(true);
      expect(result.direction).toBe('UP');
      expect(result.barsInCOMA).toBeGreaterThanOrEqual(30);
      expect(result.trend.strength).toBeGreaterThan(0);
    });

    it('should calculate trend strength correctly', async () => {
      const data = Array.from({ length: 60 }, (_, i) => ({
        time: i * 1000,
        close: 100 + i,
        high: 105 + i,
        low: 99 + i,
        indicators: {
          ema_8: 105 + i,
          ema_21: 103 + i,
          ema_50: 101 + i,
        },
      }));

      const result = await detector.detectTrend('BTCUSDT', data);

      expect(result.trend.strength).toBeGreaterThan(0);
      expect(result.trend.strength).toBeLessThanOrEqual(1);
      expect(result.trend.percentageStrength).toBeGreaterThan(0);
      expect(result.trend.percentageStrength).toBeLessThanOrEqual(100);
    });

    it('should extract current bar values', async () => {
      const data = [
        {
          time: 1000,
          close: 101,
          high: 105,
          low: 99,
          indicators: {
            ema_8: 105,
            ema_21: 103,
            ema_50: 101,
          },
        },
        ...Array.from({ length: 35 }, (_, i) => ({
          time: (2 + i) * 1000,
          close: 102 + i,
          high: 106 + i,
          low: 100 + i,
          indicators: {
            ema_8: 106 + i,
            ema_21: 104 + i,
            ema_50: 102 + i,
          },
        })),
      ];

      const result = await detector.detectTrend('BTCUSDT', data);

      expect(result.currentBar).toBeDefined();
      expect(result.currentBar.time).toBe(36000);
      expect(result.currentBar.close).toBe(136); // 102 + 34 (since last index is 35 which goes 0-34)
      expect(result.latestEMA.ema8).toBe(140); // 106 + 34
      expect(result.latestEMA.ema21).toBe(138); // 104 + 34
      expect(result.latestEMA.ema50).toBe(136); // 102 + 34
    });
  });

  describe('helper methods', () => {
    it('should return correct strength description', () => {
      expect(detector.getStrengthDescription(0.95)).toBe('VERY_STRONG');
      expect(detector.getStrengthDescription(0.75)).toBe('STRONG');
      expect(detector.getStrengthDescription(0.55)).toBe('MODERATE');
      expect(detector.getStrengthDescription(0.35)).toBe('WEAK');
      expect(detector.getStrengthDescription(0.15)).toBe('VERY_WEAK');
    });

    it('should validate trend confirmation correctly', async () => {
      const data = Array.from({ length: 40 }, (_, i) => ({
        time: i * 1000,
        close: 100 + i,
        high: 105 + i,
        low: 99 + i,
        indicators: {
          ema_8: 105 + i,
          ema_21: 103 + i,
          ema_50: 101 + i,
        },
      }));

      const trendData = await detector.detectTrend('BTCUSDT', data);

      expect(detector.isTrendConfirmed(trendData)).toBe(true);
    });

    it('should return false for unconfirmed trend', () => {
      const unconfirmedTrend = {
        confirmed: false,
        barsInCOMA: 20,
      };

      expect(detector.isTrendConfirmed(unconfirmedTrend)).toBe(false);
    });
  });

  describe('EMA gradient analysis', () => {
    it('should analyze EMA gradient for recent data', () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        time: i * 1000,
        indicators: {
          ema_8: 100 + i * 0.5,
          ema_21: 99 + i * 0.4,
          ema_50: 98 + i * 0.3,
        },
      }));

      const gradient = detector.analyzeEMAGradient(data, 10);

      expect(gradient).toHaveProperty('ema8Slope');
      expect(gradient).toHaveProperty('ema21Slope');
      expect(gradient).toHaveProperty('ema50Slope');
      expect(gradient).toHaveProperty('alignmentTightness');
    });

    it('should return zero gradients for insufficient data', () => {
      const data = [
        {
          time: 1000,
          indicators: {
            ema_8: 100,
            ema_21: 99,
            ema_50: 98,
          },
        },
      ];

      const gradient = detector.analyzeEMAGradient(data, 10);

      expect(gradient.ema8Slope).toBe(0);
      expect(gradient.ema21Slope).toBe(0);
      expect(gradient.ema50Slope).toBe(0);
    });

    it('should calculate alignment tightness correctly', () => {
      const data = [
        {
          time: 1000,
          indicators: {
            ema_8: 100,
            ema_21: 99,
            ema_50: 98,
          },
        },
        {
          time: 2000,
          indicators: {
            ema_8: 101,
            ema_21: 100,
            ema_50: 99,
          },
        },
      ];

      const gradient = detector.analyzeEMAGradient(data, 2);

      expect(gradient.alignmentTightness).toBeGreaterThan(0);
      // Spread = 101 - 99 = 2, avg = (101 + 100 + 99) / 3 = 100
      // Tightness = 2 / 100 = 0.02
      expect(gradient.alignmentTightness).toBeCloseTo(0.02, 2);
    });
  });

  describe('data validation', () => {
    it('should handle null input gracefully', async () => {
      const result = await detector.detectTrend('BTCUSDT', null);

      expect(result.confirmed).toBe(false);
      expect(result.direction).toBeNull();
    });

    it('should warn when data has insufficient bars', async () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        time: i * 1000,
        indicators: {
          ema_8: 105 + i,
          ema_21: 103 + i,
          ema_50: 101 + i,
        },
      }));

      await detector.detectTrend('BTCUSDT', data);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient data for trend detection')
      );
    });
  });
});
