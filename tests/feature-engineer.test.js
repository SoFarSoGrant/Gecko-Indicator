/**
 * Feature Engineer Tests
 *
 * Comprehensive test suite for feature extraction, normalization, and validation.
 * Tests all 62 features across 5 categories:
 * 1. Price action features
 * 2. EMA features
 * 3. Consolidation pattern features
 * 4. Trend alignment features
 * 5. Support/resistance & momentum features
 *
 * @test
 */

const { FeatureEngineer } = require('../src/data/feature-engineer.js');

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

describe('FeatureEngineer', () => {
  let featureEngineer;

  beforeEach(() => {
    featureEngineer = new FeatureEngineer(mockConfig, mockLogger);
    jest.clearAllMocks();
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Create a mock candle with OHLCV data
   */
  const createMockCandle = (overrides = {}) => ({
    time: Date.now(),
    open: 40000,
    high: 41000,
    low: 39000,
    close: 40500,
    volume: 1000000,
    indicators: {
      ema_5: 40300,
      ema_8: 40200,
      ema_21: 40100,
      ema_50: 40000,
      ema_200: 39800,
      atr: 500,
    },
    ...overrides,
  });

  /**
   * Create mock multi-timeframe data with historical candles
   */
  const createMockMultiTimeframeData = (overrides = {}) => {
    const baseCandle = createMockCandle();

    // Create 20 historical candles with incrementing prices
    const createHistory = (basePrice) => {
      const history = [];
      for (let i = 20; i > 0; i--) {
        const price = basePrice - (i * 50);
        history.push({
          time: Date.now() - (i * 60000), // 60 sec per bar
          open: price,
          high: price + 200,
          low: price - 100,
          close: price + 75,
          volume: 900000 + (Math.random() * 200000),
          indicators: {
            ema_5: price + 50,
            ema_8: price + 40,
            ema_21: price + 20,
            ema_50: price,
            ema_200: price - 200,
            atr: 450 + (Math.random() * 100),
          },
        });
      }
      return [baseCandle, ...history]; // Most recent first
    };

    return {
      lf: {
        candles: createHistory(40000),
        indicators: { ema_8: 40200 },
      },
      mf: {
        candles: createHistory(40100),
        indicators: { ema_8: 40300 },
      },
      hf: {
        candles: createHistory(40200),
        indicators: { ema_8: 40400 },
      },
      ...overrides,
    };
  };

  /**
   * Create a mock Gecko pattern
   */
  const createMockPattern = (overrides = {}) => ({
    consolidation: {
      basePrice: 40000,
      range: 300,
      startBar: 10,
      endBar: 20,
    },
    testBar: {
      formed: true,
      range: 800,
      close: 40500,
      low: 39900,
      volume: 2000000,
    },
    momentumMove: {
      size: 2000,
      direction: 'UP',
    },
    ...overrides,
  });

  // ============================================================================
  // BASIC FUNCTIONALITY TESTS
  // ============================================================================

  describe('constructor', () => {
    test('should initialize with config and logger', () => {
      const engineer = new FeatureEngineer(mockConfig, mockLogger);
      expect(engineer.config).toBe(mockConfig);
      expect(engineer.logger).toBe(mockLogger);
    });
  });

  // ============================================================================
  // FEATURE ENGINEERING TESTS
  // ============================================================================

  describe('engineerFeatures()', () => {
    test('should return feature object with all required properties', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern();

      const result = await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);

      expect(result).toHaveProperty('raw');
      expect(result).toHaveProperty('normalized');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('timestamp');
    });

    test('should extract exactly 62 features', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern();

      const result = await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);

      expect(result.count).toBe(62);
      expect(Object.keys(result.raw).length).toBe(62);
      expect(Object.keys(result.normalized).length).toBe(62);
    });

    test('should throw error if missing candle data', async () => {
      const incompleteData = {
        lf: { candles: [] },
        mf: { candles: [] },
        hf: { candles: [] },
      };

      await expect(
        featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), incompleteData)
      ).rejects.toThrow('Missing candle data');
    });

    test('should log debug message when engineering features', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern();

      await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);

      expect(mockLogger.debug).toHaveBeenCalledWith('Engineering features for BTCUSDT');
    });

    test('should handle missing pattern gracefully', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();

      const result = await featureEngineer.engineerFeatures('BTCUSDT', {}, multiTimeframeData);

      expect(result).toHaveProperty('raw');
      expect(result.count).toBe(62);
    });
  });

  // ============================================================================
  // PRICE FEATURES TESTS
  // ============================================================================

  describe('Price Action Features (12 features)', () => {
    test('should extract all price features correctly', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      const { priceFeatures } = result.categories;

      expect(priceFeatures).toHaveProperty('open');
      expect(priceFeatures).toHaveProperty('high');
      expect(priceFeatures).toHaveProperty('low');
      expect(priceFeatures).toHaveProperty('close');
      expect(priceFeatures).toHaveProperty('volume');
      expect(priceFeatures).toHaveProperty('range');
      expect(priceFeatures).toHaveProperty('body');
      expect(priceFeatures).toHaveProperty('upper_wick');
      expect(priceFeatures).toHaveProperty('lower_wick');
      expect(priceFeatures).toHaveProperty('hl2');
      expect(priceFeatures).toHaveProperty('hlc3');
      expect(priceFeatures).toHaveProperty('body_percent');
    });

    test('should calculate range correctly (high - low)', async () => {
      const candle = createMockCandle({
        high: 41000,
        low: 39000,
      });
      const features = featureEngineer._extractPriceFeatures(candle);

      expect(features.range).toBe(2000);
    });

    test('should calculate body correctly (|close - open|)', async () => {
      const candle = createMockCandle({
        open: 40000,
        close: 40500,
      });
      const features = featureEngineer._extractPriceFeatures(candle);

      expect(features.body).toBe(500);
    });

    test('should calculate wicks correctly', async () => {
      const candle = createMockCandle({
        open: 40000,
        high: 41000,
        low: 39000,
        close: 40500,
      });
      const features = featureEngineer._extractPriceFeatures(candle);

      expect(features.upper_wick).toBe(500); // 41000 - 40500
      expect(features.lower_wick).toBe(1000); // 40000 - 39000
    });

    test('should calculate HLC3 average correctly', async () => {
      const candle = createMockCandle({
        high: 42000,
        low: 38000,
        close: 40000,
      });
      const features = featureEngineer._extractPriceFeatures(candle);

      expect(features.hlc3).toBe(40000); // (42000 + 38000 + 40000) / 3
    });

    test('should handle zero range without division error', async () => {
      const candle = createMockCandle({
        open: 40000,
        high: 40000,
        low: 40000,
        close: 40000,
      });
      const features = featureEngineer._extractPriceFeatures(candle);

      expect(features.body_percent).toBe(0);
      expect(isFinite(features.body_percent)).toBe(true);
    });
  });

  // ============================================================================
  // EMA FEATURES TESTS
  // ============================================================================

  describe('EMA Features (15 features)', () => {
    test('should extract all EMA features from all timeframes', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      const { emaFeatures } = result.categories;

      // Low Frame (4 EMAs)
      expect(emaFeatures).toHaveProperty('ema8_lf');
      expect(emaFeatures).toHaveProperty('ema21_lf');
      expect(emaFeatures).toHaveProperty('ema50_lf');
      expect(emaFeatures).toHaveProperty('ema200_lf');

      // Mid Frame (4 EMAs)
      expect(emaFeatures).toHaveProperty('ema8_mf');
      expect(emaFeatures).toHaveProperty('ema21_mf');
      expect(emaFeatures).toHaveProperty('ema50_mf');
      expect(emaFeatures).toHaveProperty('ema200_mf');

      // High Frame (5 EMAs + 2 ATR)
      expect(emaFeatures).toHaveProperty('ema5_hf');
      expect(emaFeatures).toHaveProperty('ema8_hf');
      expect(emaFeatures).toHaveProperty('ema21_hf');
      expect(emaFeatures).toHaveProperty('ema50_hf');
      expect(emaFeatures).toHaveProperty('ema200_hf');

      // ATR features
      expect(emaFeatures).toHaveProperty('atr_lf');
      expect(emaFeatures).toHaveProperty('atr_hf');
    });

    test('should use indicator values from candle data', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      const { emaFeatures } = result.categories;

      expect(emaFeatures.ema8_lf).toBe(40200);
      expect(emaFeatures.ema21_lf).toBe(40100);
      expect(emaFeatures.atr_lf).toBe(500);
    });

    test('should handle missing indicators gracefully (default to 0)', async () => {
      const multiTimeframeData = createMockMultiTimeframeData({
        lf: {
          candles: [createMockCandle({ indicators: {} })],
        },
      });

      const features = featureEngineer._extractEMAFeatures(
        multiTimeframeData.lf.candles[0],
        createMockCandle(),
        createMockCandle()
      );

      expect(features.ema8_lf).toBe(0);
      expect(features.atr_lf).toBe(0);
    });
  });

  // ============================================================================
  // CONSOLIDATION PATTERN FEATURES TESTS
  // ============================================================================

  describe('Consolidation Pattern Features (12 features)', () => {
    test('should extract all consolidation features', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);

      const { consolidationFeatures } = result.categories;

      expect(consolidationFeatures).toHaveProperty('consolidation_level');
      expect(consolidationFeatures).toHaveProperty('consolidation_range');
      expect(consolidationFeatures).toHaveProperty('price_distance_from_base');
      expect(consolidationFeatures).toHaveProperty('touches_to_level');
      expect(consolidationFeatures).toHaveProperty('touch_density');
      expect(consolidationFeatures).toHaveProperty('range_ratio');
      expect(consolidationFeatures).toHaveProperty('volatility_squeeze');
      expect(consolidationFeatures).toHaveProperty('avg_range_last_10');
      expect(consolidationFeatures).toHaveProperty('has_test_bar');
      expect(consolidationFeatures).toHaveProperty('test_bar_strength');
      expect(consolidationFeatures).toHaveProperty('test_bar_volume_ratio');
    });

    test('should use consolidation level from pattern', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern({
        consolidation: { basePrice: 39800, range: 400 },
      });

      const result = await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);

      expect(result.categories.consolidationFeatures.consolidation_level).toBe(39800);
      expect(result.categories.consolidationFeatures.consolidation_range).toBe(400);
    });

    test('should detect test bar presence', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern({
        testBar: { formed: true },
      });

      const result = await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);

      expect(result.categories.consolidationFeatures.has_test_bar).toBe(1);
    });

    test('should set has_test_bar to 0 when not formed', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern({
        testBar: { formed: false },
      });

      const result = await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);

      expect(result.categories.consolidationFeatures.has_test_bar).toBe(0);
    });
  });

  // ============================================================================
  // TREND ALIGNMENT FEATURES TESTS
  // ============================================================================

  describe('Trend Alignment Features (12 features)', () => {
    test('should extract all trend features', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      const { trendFeatures } = result.categories;

      expect(trendFeatures).toHaveProperty('lf_ema_order_long');
      expect(trendFeatures).toHaveProperty('lf_ema_order_short');
      expect(trendFeatures).toHaveProperty('lf_above_200sma');
      expect(trendFeatures).toHaveProperty('mf_ema_order_long');
      expect(trendFeatures).toHaveProperty('mf_ema_order_short');
      expect(trendFeatures).toHaveProperty('mf_above_200sma');
      expect(trendFeatures).toHaveProperty('hf_ema_order_long');
      expect(trendFeatures).toHaveProperty('hf_ema_order_short');
      expect(trendFeatures).toHaveProperty('hf_above_200sma');
      expect(trendFeatures).toHaveProperty('all_tf_aligned_long');
      expect(trendFeatures).toHaveProperty('all_tf_aligned_short');
      expect(trendFeatures).toHaveProperty('lf_mf_aligned');
    });

    test('should detect COMA uptrend (8 > 21 > 50 > 200)', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      expect(result.categories.trendFeatures.lf_ema_order_long).toBe(1);
    });
  });

  // ============================================================================
  // SUPPORT/RESISTANCE & MOMENTUM FEATURES TESTS
  // ============================================================================

  describe('Support/Resistance & Momentum Features (11 features)', () => {
    test('should extract all support/momentum features', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      const { supportMomentumFeatures } = result.categories;

      expect(supportMomentumFeatures).toHaveProperty('distance_to_ema21_mf');
      expect(supportMomentumFeatures).toHaveProperty('distance_to_ema5_hf');
      expect(supportMomentumFeatures).toHaveProperty('distance_to_ema200_mf');
      expect(supportMomentumFeatures).toHaveProperty('close_above_ema21_mf');
      expect(supportMomentumFeatures).toHaveProperty('close_above_ema5_hf');
      expect(supportMomentumFeatures).toHaveProperty('close_above_ema200_mf');
      expect(supportMomentumFeatures).toHaveProperty('bars_higher_highs');
      expect(supportMomentumFeatures).toHaveProperty('bars_higher_lows');
      expect(supportMomentumFeatures).toHaveProperty('bars_lower_highs');
      expect(supportMomentumFeatures).toHaveProperty('volume_ratio');
      expect(supportMomentumFeatures).toHaveProperty('return_last_5_bars');
      expect(supportMomentumFeatures).toHaveProperty('return_last_10_bars');
    });

    test('should detect close above/below EMA levels (1 or 0)', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      const { supportMomentumFeatures } = result.categories;

      expect([0, 1]).toContain(supportMomentumFeatures.close_above_ema21_mf);
      expect([0, 1]).toContain(supportMomentumFeatures.close_above_ema5_hf);
      expect([0, 1]).toContain(supportMomentumFeatures.close_above_ema200_mf);
    });

    test('should calculate volume ratio', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      const volumeRatio = result.categories.supportMomentumFeatures.volume_ratio;

      expect(volumeRatio).toBeGreaterThan(0);
      expect(volumeRatio).toBeLessThan(5);
    });
  });

  // ============================================================================
  // NORMALIZATION TESTS
  // ============================================================================

  describe('normalizeFeatures()', () => {
    test('should normalize features using minmax method', () => {
      const features = {
        close: 40500,
        range: 500,
        volume_ratio: 1.5,
        lf_ema_order_long: 1,
      };

      const normalized = featureEngineer.normalizeFeatures(features, 'minmax');

      for (const value of Object.values(normalized)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    test('should normalize features using zscore method', () => {
      const features = {
        close: 40500,
        range: 500,
        volume_ratio: 1.5,
      };

      const normalized = featureEngineer.normalizeFeatures(features, 'zscore');

      for (const value of Object.values(normalized)) {
        expect(isFinite(value)).toBe(true);
      }
    });

    test('should return features as-is for unknown normalization method', () => {
      const features = { close: 40500, range: 500 };

      const result = featureEngineer.normalizeFeatures(features, 'unknown');

      expect(result).toEqual(features);
    });
  });

  // ============================================================================
  // FEATURE VALIDATION TESTS
  // ============================================================================

  describe('Feature Validation', () => {
    test('should validate that all features are numbers', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      for (const [key, value] of Object.entries(result.raw)) {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      }
    });

    test('should not contain NaN values in raw features', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      for (const [key, value] of Object.entries(result.raw)) {
        expect(isNaN(value)).toBe(false);
        expect(isFinite(value)).toBe(true);
      }
    });

    test('should not contain Infinity values in normalized features', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const result = await featureEngineer.engineerFeatures('BTCUSDT', createMockPattern(), multiTimeframeData);

      for (const [key, value] of Object.entries(result.normalized)) {
        expect(isFinite(value)).toBe(true);
      }
    });

    test('should return true for valid features', () => {
      const features = { close: 40500, volume: 1000000 };

      const isValid = featureEngineer._validateFeatures(features);

      expect(isValid).toBe(true);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    test('should engineer features end-to-end with realistic data', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern();

      const result = await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);

      expect(result.count).toBe(62);
      expect(result.raw).toBeDefined();
      expect(result.normalized).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(Object.keys(result.categories)).toHaveLength(5);
    });

    test('should produce consistent results across multiple runs', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern();

      const result1 = await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);
      const result2 = await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);

      for (const key of Object.keys(result1.raw)) {
        expect(result1.raw[key]).toBe(result2.raw[key]);
      }
    });

    test('should handle different symbols without issues', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'EURUSD', 'GBPUSD', 'SPY'];
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern();

      for (const symbol of symbols) {
        const result = await featureEngineer.engineerFeatures(symbol, pattern, multiTimeframeData);
        expect(result.count).toBe(62);
        expect(result.raw).toBeDefined();
      }
    });

    test('should complete feature engineering in reasonable time', async () => {
      const multiTimeframeData = createMockMultiTimeframeData();
      const pattern = createMockPattern();

      const startTime = Date.now();
      await featureEngineer.engineerFeatures('BTCUSDT', pattern, multiTimeframeData);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1000);
    });
  });
});
