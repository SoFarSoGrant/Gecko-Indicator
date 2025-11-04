/**
 * EMA Calculator Test Suite
 *
 * Comprehensive unit tests for EMA calculation, validation, and COMA status checking.
 * Phase 6 Priority 1 Day 1 - Gecko ML Indicator Project
 *
 * @jest-environment node
 */

const { EMACalculator, EMA_CONFIG } = require('../src/indicators/ema-calculator.cjs');

describe('EMACalculator', () => {
  // Test data: Simple uptrend
  const createUptrendCandles = (count = 100, start = 100) => {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: Date.now() + i * 60000,
      open: start + i * 0.5,
      high: start + i * 0.5 + 1,
      low: start + i * 0.5 - 0.5,
      close: start + i * 0.5,
      volume: 1000
    }));
  };

  // Test data: Simple downtrend
  const createDowntrendCandles = (count = 100, start = 200) => {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: Date.now() + i * 60000,
      open: start - i * 0.5,
      high: start - i * 0.5 + 0.5,
      low: start - i * 0.5 - 1,
      close: start - i * 0.5,
      volume: 1000
    }));
  };

  // Test data: Flat market
  const createFlatCandles = (count = 100, price = 150) => {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: Date.now() + i * 60000,
      open: price,
      high: price + 0.1,
      low: price - 0.1,
      close: price,
      volume: 1000
    }));
  };

  describe('calculateEMA - Basic Functionality', () => {
    test('should calculate EMA for simple uptrend', () => {
      const candles = createUptrendCandles(50, 100);
      const period = 8;
      const emaValues = EMACalculator.calculateEMA(candles, period);

      // Check length
      expect(emaValues.length).toBe(candles.length);

      // Check first period-1 values are NaN
      for (let i = 0; i < period - 1; i++) {
        expect(Number.isNaN(emaValues[i])).toBe(true);
      }

      // Check EMA starts at period-1
      expect(Number.isFinite(emaValues[period - 1])).toBe(true);

      // Check EMA is increasing (uptrend)
      for (let i = period; i < candles.length - 1; i++) {
        expect(emaValues[i + 1]).toBeGreaterThan(emaValues[i]);
      }
    });

    test('should calculate EMA for simple downtrend', () => {
      const candles = createDowntrendCandles(50, 200);
      const period = 8;
      const emaValues = EMACalculator.calculateEMA(candles, period);

      // Check EMA is decreasing (downtrend)
      for (let i = period; i < candles.length - 1; i++) {
        expect(emaValues[i + 1]).toBeLessThan(emaValues[i]);
      }
    });

    test('should calculate EMA for flat market', () => {
      const candles = createFlatCandles(50, 150);
      const period = 8;
      const emaValues = EMACalculator.calculateEMA(candles, period);

      // Check EMA is stable (approximately equal to price)
      for (let i = period; i < candles.length; i++) {
        expect(emaValues[i]).toBeCloseTo(150, 1);
      }
    });

    test('should handle different periods correctly', () => {
      const candles = createUptrendCandles(250, 100);

      const ema8 = EMACalculator.calculateEMA(candles, 8);
      const ema21 = EMACalculator.calculateEMA(candles, 21);
      const ema50 = EMACalculator.calculateEMA(candles, 50);
      const ema200 = EMACalculator.calculateEMA(candles, 200);

      // Check EMA starts at correct index
      expect(Number.isFinite(ema8[7])).toBe(true);
      expect(Number.isFinite(ema21[20])).toBe(true);
      expect(Number.isFinite(ema50[49])).toBe(true);
      expect(Number.isFinite(ema200[199])).toBe(true);

      // In uptrend, shorter EMA should be higher than longer EMA
      const lastIndex = candles.length - 1;
      expect(ema8[lastIndex]).toBeGreaterThan(ema21[lastIndex]);
      expect(ema21[lastIndex]).toBeGreaterThan(ema50[lastIndex]);
      expect(ema50[lastIndex]).toBeGreaterThan(ema200[lastIndex]);
    });

    test('should handle empty candles array', () => {
      const emaValues = EMACalculator.calculateEMA([], 8);
      expect(emaValues).toEqual([]);
    });

    test('should handle invalid period', () => {
      const candles = createUptrendCandles(50);
      const emaValues = EMACalculator.calculateEMA(candles, -5);
      expect(emaValues.every(v => Number.isNaN(v))).toBe(true);
    });

    test('should handle insufficient candles', () => {
      const candles = createUptrendCandles(5);
      const emaValues = EMACalculator.calculateEMA(candles, 10);
      expect(emaValues.every(v => Number.isNaN(v))).toBe(true);
    });
  });

  describe('addEMAsToCandles - Multiple Periods', () => {
    test('should add multiple EMA columns to candles', () => {
      const candles = createUptrendCandles(250, 100);
      const periods = [8, 21, 50, 200];

      EMACalculator.addEMAsToCandles(candles, periods);

      // Check all EMA columns added
      periods.forEach(period => {
        expect(candles[0]).toHaveProperty(`ema_${period}`);
      });

      // Check EMAs are valid after warmup
      const lastCandle = candles[candles.length - 1];
      periods.forEach(period => {
        expect(Number.isFinite(lastCandle[`ema_${period}`])).toBe(true);
      });
    });

    test('should handle high frame periods (with EMA 5)', () => {
      const candles = createUptrendCandles(250, 100);
      const periods = [5, 8, 21, 50, 200];

      EMACalculator.addEMAsToCandles(candles, periods);

      // Check all periods including EMA 5
      periods.forEach(period => {
        expect(candles[0]).toHaveProperty(`ema_${period}`);
      });
    });

    test('should handle empty periods array', () => {
      const candles = createUptrendCandles(50);
      const result = EMACalculator.addEMAsToCandles(candles, []);
      expect(result).toBe(candles);
    });

    test('should skip invalid periods', () => {
      const candles = createUptrendCandles(50);
      const periods = [8, -5, 21, null, 50];

      EMACalculator.addEMAsToCandles(candles, periods);

      // Valid periods should be added
      expect(candles[0]).toHaveProperty('ema_8');
      expect(candles[0]).toHaveProperty('ema_21');
      expect(candles[0]).toHaveProperty('ema_50');

      // Invalid periods should not be added
      expect(candles[0]).not.toHaveProperty('ema_-5');
      expect(candles[0]).not.toHaveProperty('ema_null');
    });
  });

  describe('validateWarmup - Warmup Requirements', () => {
    test('should pass validation with sufficient candles (strict mode)', () => {
      const candles = createUptrendCandles(500);
      const validation = EMACalculator.validateWarmup(candles, 200, true);

      expect(validation.isValid).toBe(true);
      expect(validation.candleCount).toBe(500);
      expect(validation.minRequired).toBe(500); // 200 × 2.5
    });

    test('should fail validation with insufficient candles (strict mode)', () => {
      const candles = createUptrendCandles(300);
      const validation = EMACalculator.validateWarmup(candles, 200, true);

      expect(validation.isValid).toBe(false);
      expect(validation.candleCount).toBe(300);
      expect(validation.minRequired).toBe(500);
      expect(validation.message).toContain('Insufficient');
    });

    test('should pass validation with minimum candles (non-strict mode)', () => {
      const candles = createUptrendCandles(300);
      const validation = EMACalculator.validateWarmup(candles, 200, false);

      expect(validation.isValid).toBe(true);
      expect(validation.candleCount).toBe(300);
      expect(validation.minRequired).toBe(300); // 200 × 1.5
    });

    test('should fail validation with insufficient candles (non-strict mode)', () => {
      const candles = createUptrendCandles(250);
      const validation = EMACalculator.validateWarmup(candles, 200, false);

      expect(validation.isValid).toBe(false);
      expect(validation.candleCount).toBe(250);
      expect(validation.minRequired).toBe(300);
    });
  });

  describe('validateEMAValues - Value Validation', () => {
    test('should validate correct EMA values', () => {
      // Use flat candles to avoid large EMA lag causing deviation warnings
      const candles = createFlatCandles(250, 150);
      const periods = [8, 21, 50, 200];

      EMACalculator.addEMAsToCandles(candles, periods);
      const validation = EMACalculator.validateEMAValues(candles, periods);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.stats).toHaveProperty('8');
      expect(validation.stats).toHaveProperty('21');
      expect(validation.stats).toHaveProperty('50');
      expect(validation.stats).toHaveProperty('200');
    });

    test('should detect NaN values after warmup', () => {
      const candles = createUptrendCandles(50);
      const periods = [8];

      EMACalculator.addEMAsToCandles(candles, periods);

      // Manually introduce NaN after warmup
      candles[20].ema_8 = NaN;

      const validation = EMACalculator.validateEMAValues(candles, periods);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0].issue).toContain('NaN');
    });

    test('should detect infinite values', () => {
      const candles = createUptrendCandles(50);
      const periods = [8];

      EMACalculator.addEMAsToCandles(candles, periods);

      // Manually introduce Infinity
      candles[20].ema_8 = Infinity;

      const validation = EMACalculator.validateEMAValues(candles, periods);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0].issue).toContain('Infinite');
    });

    test('should handle empty candles array', () => {
      const validation = EMACalculator.validateEMAValues([], [8, 21]);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('validateEMAAccuracy - Accuracy Validation', () => {
    test('should validate accuracy against reference values', () => {
      const candles = createUptrendCandles(50, 100);
      const period = 8;

      EMACalculator.addEMAsToCandles(candles, [period]);

      // Use calculated values as reference (should match exactly)
      const referenceValues = candles.map(c => c.ema_8);

      const validation = EMACalculator.validateEMAAccuracy(candles, period, referenceValues);

      expect(validation.isAccurate).toBe(true);
      expect(validation.meanError).toBeCloseTo(0, 10);
      expect(validation.maxError).toBeCloseTo(0, 10);
      expect(validation.passThreshold).toBe(true);
    });

    test('should detect inaccurate values', () => {
      const candles = createUptrendCandles(50, 100);
      const period = 8;

      EMACalculator.addEMAsToCandles(candles, [period]);

      // Create inaccurate reference values (5% higher)
      const referenceValues = candles.map(c => {
        const ema = c.ema_8;
        return Number.isFinite(ema) ? ema * 1.05 : ema;
      });

      const validation = EMACalculator.validateEMAAccuracy(candles, period, referenceValues);

      expect(validation.isAccurate).toBe(false);
      expect(validation.meanError).toBeGreaterThan(EMA_CONFIG.ACCURACY_THRESHOLD);
      expect(validation.passThreshold).toBe(false);
    });

    test('should handle missing reference values', () => {
      const candles = createUptrendCandles(50);
      const validation = EMACalculator.validateEMAAccuracy(candles, 8, null);

      expect(validation.isAccurate).toBe(true);
      expect(validation.message).toContain('No reference values');
    });
  });

  describe('getCOMAStatus - COMA Validation', () => {
    test('should detect uptrend COMA status', () => {
      const candles = createUptrendCandles(250, 100);
      const periods = [8, 21, 50, 200];

      EMACalculator.addEMAsToCandles(candles, periods);

      const lastIndex = candles.length - 1;
      const comaStatus = EMACalculator.getCOMAStatus(candles, lastIndex, lastIndex, lastIndex);

      expect(comaStatus.lf.uptrend).toBe(true);
      expect(comaStatus.lf.downtrend).toBe(false);
      expect(comaStatus.lf.confirmed).toBe(true);
    });

    test('should detect downtrend COMA status', () => {
      const candles = createDowntrendCandles(250, 200);
      const periods = [8, 21, 50, 200];

      EMACalculator.addEMAsToCandles(candles, periods);

      const lastIndex = candles.length - 1;
      const comaStatus = EMACalculator.getCOMAStatus(candles, lastIndex, lastIndex, lastIndex);

      expect(comaStatus.lf.uptrend).toBe(false);
      expect(comaStatus.lf.downtrend).toBe(true);
      expect(comaStatus.lf.confirmed).toBe(true);
    });

    test('should handle no COMA (flat/choppy market)', () => {
      const candles = createFlatCandles(250, 150);
      const periods = [8, 21, 50, 200];

      EMACalculator.addEMAsToCandles(candles, periods);

      const lastIndex = candles.length - 1;
      const comaStatus = EMACalculator.getCOMAStatus(candles, lastIndex, lastIndex, lastIndex);

      // In flat market, EMAs converge but may not be in perfect order
      expect(comaStatus.lf.confirmed).toBe(comaStatus.lf.uptrend || comaStatus.lf.downtrend);
    });

    test('should handle high frame COMA (with EMA 5)', () => {
      const candles = createUptrendCandles(250, 100);
      const periods = [5, 8, 21, 50, 200];

      EMACalculator.addEMAsToCandles(candles, periods);

      const lastIndex = candles.length - 1;
      const comaStatus = EMACalculator.getCOMAStatus(candles, lastIndex, lastIndex, lastIndex);

      expect(comaStatus.hf.uptrend).toBe(true);
      expect(comaStatus.hf.downtrend).toBe(false);
      expect(comaStatus.hf.confirmed).toBe(true);
    });

    test('should handle missing candles', () => {
      const candles = createUptrendCandles(10);
      const comaStatus = EMACalculator.getCOMAStatus(candles, 999, 999, 999);

      expect(comaStatus.lf.uptrend).toBe(false);
      expect(comaStatus.lf.downtrend).toBe(false);
      expect(comaStatus.lf.confirmed).toBe(false);
    });
  });

  describe('processPatternCandles - Integration', () => {
    test('should process pattern candles for all timeframes', () => {
      const calculator = new EMACalculator();

      const patternData = {
        lf_candles: createUptrendCandles(250, 100),
        mf_candles: createUptrendCandles(250, 100),
        hf_candles: createUptrendCandles(250, 100)
      };

      const enhanced = calculator.processPatternCandles(patternData);

      // Check EMAs added to all timeframes
      expect(enhanced.lf_candles[249]).toHaveProperty('ema_8');
      expect(enhanced.lf_candles[249]).toHaveProperty('ema_21');
      expect(enhanced.lf_candles[249]).toHaveProperty('ema_50');
      expect(enhanced.lf_candles[249]).toHaveProperty('ema_200');

      expect(enhanced.mf_candles[249]).toHaveProperty('ema_8');
      expect(enhanced.hf_candles[249]).toHaveProperty('ema_5'); // HF includes EMA 5
    });

    test('should handle missing timeframe candles', () => {
      const calculator = new EMACalculator();

      const patternData = {
        lf_candles: createUptrendCandles(250),
        mf_candles: [],
        hf_candles: null
      };

      const enhanced = calculator.processPatternCandles(patternData);

      // LF should be processed
      expect(enhanced.lf_candles[249]).toHaveProperty('ema_8');

      // MF/HF should be unchanged
      expect(enhanced.mf_candles).toEqual([]);
      expect(enhanced.hf_candles).toBeNull();
    });
  });

  describe('Performance', () => {
    test('should calculate 500 candles with 5 periods in < 10ms', () => {
      const candles = createUptrendCandles(500);
      const periods = [5, 8, 21, 50, 200];

      const startTime = Date.now();
      EMACalculator.addEMAsToCandles(candles, periods);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('Consistency', () => {
    test('should produce identical results for same input', () => {
      const candles1 = createUptrendCandles(100, 100);
      const candles2 = createUptrendCandles(100, 100);

      const ema1 = EMACalculator.calculateEMA(candles1, 21);
      const ema2 = EMACalculator.calculateEMA(candles2, 21);

      expect(ema1).toEqual(ema2);
    });
  });

  describe('Edge Cases', () => {
    test('should handle single candle', () => {
      const candles = createUptrendCandles(1);
      const emaValues = EMACalculator.calculateEMA(candles, 8);
      expect(emaValues.every(v => Number.isNaN(v))).toBe(true);
    });

    test('should handle period larger than candles', () => {
      const candles = createUptrendCandles(10);
      const emaValues = EMACalculator.calculateEMA(candles, 50);
      expect(emaValues.every(v => Number.isNaN(v))).toBe(true);
    });

    test('should handle candles with missing close values', () => {
      const candles = createUptrendCandles(50);
      candles[25].close = undefined;
      candles[26].close = null;

      const emaValues = EMACalculator.calculateEMA(candles, 8);

      // EMA should forward fill through missing values
      expect(Number.isFinite(emaValues[30])).toBe(true);
    });
  });
});
