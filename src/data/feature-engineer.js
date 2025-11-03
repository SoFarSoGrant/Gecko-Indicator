/**
 * Feature Engineering Module
 *
 * Extracts and prepares features from price data and indicators
 * for use in ML model training and prediction.
 *
 * Implements 50+ features across 5 categories:
 * 1. Price action features (OHLCV, wicks, ranges)
 * 2. EMA features (all timeframes, all lengths)
 * 3. Consolidation pattern features (touches, compression, test bar)
 * 4. Trend alignment features (COMA validation, multi-timeframe alignment)
 * 5. Support/resistance & momentum features (distances, volume, momentum)
 *
 * @module src/data/feature-engineer
 */

class FeatureEngineer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Engineer features from pattern and multi-timeframe data
   *
   * @param {string} symbol - Trading symbol
   * @param {Object} pattern - Detected Gecko pattern with consolidation/test bar info
   * @param {Object} multiTimeframeData - Data for LF, MF, HF with OHLCV + indicators
   *   Format: {
   *     lf: { candles: Array, indicators: Object },
   *     mf: { candles: Array, indicators: Object },
   *     hf: { candles: Array, indicators: Object }
   *   }
   * @returns {Promise<Object>} Engineered features object
   */
  async engineerFeatures(symbol, pattern, multiTimeframeData) {
    this.logger.debug(`Engineering features for ${symbol}`);

    try {
      // Extract data from each timeframe
      const lfData = multiTimeframeData.lf || {};
      const mfData = multiTimeframeData.mf || {};
      const hfData = multiTimeframeData.hf || {};

      // Get current candles (index 0 = most recent)
      const lfCandle = lfData.candles?.[0];
      const mfCandle = mfData.candles?.[0];
      const hfCandle = hfData.candles?.[0];

      // Get historical candles for momentum/volatility calculations
      const lfHistory = lfData.candles || [];
      const mfHistory = mfData.candles || [];
      const hfHistory = hfData.candles || [];

      if (!lfCandle || !mfCandle || !hfCandle) {
        throw new Error('Missing candle data for feature engineering');
      }

      // 1. PRICE ACTION FEATURES (12 features)
      const priceFeatures = this._extractPriceFeatures(lfCandle);

      // 2. EMA FEATURES (15 features)
      const emaFeatures = this._extractEMAFeatures(lfCandle, mfCandle, hfCandle);

      // 3. CONSOLIDATION PATTERN FEATURES (12 features)
      const consolidationFeatures = this._extractConsolidationFeatures(
        pattern,
        lfCandle,
        lfHistory
      );

      // 4. TREND ALIGNMENT FEATURES (12 features)
      const trendFeatures = this._extractTrendFeatures(
        lfCandle,
        mfCandle,
        hfCandle
      );

      // 5. SUPPORT/RESISTANCE & MOMENTUM FEATURES (11 features)
      const supportMomentumFeatures = this._extractSupportMomentumFeatures(
        lfCandle,
        mfCandle,
        hfCandle,
        lfHistory,
        mfHistory
      );

      // Combine all features (52 total)
      const allFeatures = {
        ...priceFeatures,
        ...emaFeatures,
        ...consolidationFeatures,
        ...trendFeatures,
        ...supportMomentumFeatures,
      };

      // Validate features (check for NaN/Inf)
      this._validateFeatures(allFeatures);

      return {
        raw: allFeatures,
        normalized: this.normalizeFeatures(allFeatures, 'minmax'),
        categories: {
          priceFeatures,
          emaFeatures,
          consolidationFeatures,
          trendFeatures,
          supportMomentumFeatures,
        },
        count: Object.keys(allFeatures).length,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Feature engineering failed for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract price action features from current candle (12 features)
   * @private
   */
  _extractPriceFeatures(candle) {
    const { open, high, low, close, volume } = candle;

    const range = high - low;
    const body = Math.abs(close - open);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;

    return {
      // Raw OHLCV
      close,
      open,
      high,
      low,
      volume,

      // Range metrics
      range,
      body,
      upper_wick: upperWick,
      lower_wick: lowerWick,

      // Composite metrics
      hl2: (high + low) / 2,
      hlc3: (high + low + close) / 3,
      body_percent: range > 0 ? (body / range) * 100 : 0,
    };
  }

  /**
   * Extract EMA features from all timeframes (15 features)
   * Includes EMA(8, 21, 50, 200) for LF/MF and EMA(5, 8, 21, 50, 200) for HF
   * @private
   */
  _extractEMAFeatures(lfCandle, mfCandle, hfCandle) {
    return {
      // Low Frame EMAs
      ema8_lf: lfCandle.indicators?.ema_8 || 0,
      ema21_lf: lfCandle.indicators?.ema_21 || 0,
      ema50_lf: lfCandle.indicators?.ema_50 || 0,
      ema200_lf: lfCandle.indicators?.ema_200 || 0,

      // Mid Frame EMAs
      ema8_mf: mfCandle.indicators?.ema_8 || 0,
      ema21_mf: mfCandle.indicators?.ema_21 || 0,
      ema50_mf: mfCandle.indicators?.ema_50 || 0,
      ema200_mf: mfCandle.indicators?.ema_200 || 0,

      // High Frame EMAs (includes 5 EMA for HF)
      ema5_hf: hfCandle.indicators?.ema_5 || 0,
      ema8_hf: hfCandle.indicators?.ema_8 || 0,
      ema21_hf: hfCandle.indicators?.ema_21 || 0,
      ema50_hf: hfCandle.indicators?.ema_50 || 0,
      ema200_hf: hfCandle.indicators?.ema_200 || 0,

      // ATR features (volatility)
      atr_lf: lfCandle.indicators?.atr || 0,
      atr_hf: hfCandle.indicators?.atr || 0,
    };
  }

  /**
   * Extract consolidation pattern features (12 features)
   * Analyzes consolidation base, compression, test bar characteristics
   * @private
   */
  _extractConsolidationFeatures(pattern, lfCandle, lfHistory) {
    const consolidation = pattern?.consolidation || {};
    const testBar = pattern?.testBar || {};

    // Count touches to consolidation level (if pattern exists)
    let touches = 0;
    let compressionRatio = 1;
    let volatilitySqueeze = 0;

    if (consolidation.basePrice && lfHistory.length >= 10) {
      // Count bars within consolidation tolerance
      const tolerance = consolidation.range ? consolidation.range * 0.1 : 0;
      touches = lfHistory.filter(c =>
        Math.abs(c.close - consolidation.basePrice) <= tolerance
      ).length;

      // Calculate compression (recent range vs average)
      const recentRange = lfHistory
        .slice(0, 10)
        .map(c => c.high - c.low)
        .reduce((a, b) => a + b, 0) / 10;
      const avgRange = lfHistory
        .map(c => c.high - c.low)
        .reduce((a, b) => a + b, 0) / lfHistory.length;
      compressionRatio = avgRange > 0 ? recentRange / avgRange : 1;

      // Calculate volatility squeeze (standard deviation)
      volatilitySqueeze = this._standardDeviation(
        lfHistory.slice(0, 10).map(c => c.close)
      );
    }

    return {
      // Consolidation base metrics
      consolidation_level: consolidation.basePrice || 0,
      consolidation_range: consolidation.range || 0,
      price_distance_from_base: Math.abs(lfCandle.close - (consolidation.basePrice || 0)),

      // Touch detection
      touches_to_level: touches,
      touch_density: lfHistory.length > 0 ? touches / lfHistory.length : 0,

      // Compression metrics
      range_ratio: compressionRatio,
      volatility_squeeze: volatilitySqueeze,
      avg_range_last_10: lfHistory.length >= 10
        ? lfHistory.slice(0, 10).reduce((sum, c) => sum + (c.high - c.low), 0) / 10
        : 0,

      // Test bar analysis
      has_test_bar: testBar.formed ? 1 : 0,
      test_bar_strength: testBar.range > 0
        ? (testBar.close - testBar.low) / testBar.range
        : 0,
      test_bar_volume_ratio: lfHistory.length > 0
        ? testBar.volume / (lfHistory.reduce((sum, c) => sum + c.volume, 0) / lfHistory.length)
        : 0,
    };
  }

  /**
   * Extract trend alignment features - COMA validation and multi-timeframe alignment (12 features)
   * @private
   */
  _extractTrendFeatures(lfCandle, mfCandle, hfCandle) {
    const lf = lfCandle.indicators || {};
    const mf = mfCandle.indicators || {};
    const hf = hfCandle.indicators || {};

    // COMA checks
    const lfLongCOMA = lf.ema_8 > lf.ema_21 && lf.ema_21 > lf.ema_50 && lf.ema_50 > lf.ema_200 ? 1 : 0;
    const lfShortCOMA = lf.ema_8 < lf.ema_21 && lf.ema_21 < lf.ema_50 && lf.ema_50 < lf.ema_200 ? 1 : 0;

    const mfLongCOMA = mf.ema_8 > mf.ema_21 && mf.ema_21 > mf.ema_50 && mf.ema_50 > mf.ema_200 ? 1 : 0;
    const mfShortCOMA = mf.ema_8 < mf.ema_21 && mf.ema_21 < mf.ema_50 && mf.ema_50 < mf.ema_200 ? 1 : 0;

    const hfLongCOMA = hf.ema_5 > hf.ema_8 && hf.ema_8 > hf.ema_21 && hf.ema_21 > hf.ema_50 && hf.ema_50 > hf.ema_200 ? 1 : 0;
    const hfShortCOMA = hf.ema_5 < hf.ema_8 && hf.ema_8 < hf.ema_21 && hf.ema_21 < hf.ema_50 && hf.ema_50 < hf.ema_200 ? 1 : 0;

    return {
      // Low Frame trend
      lf_ema_order_long: lfLongCOMA,
      lf_ema_order_short: lfShortCOMA,
      lf_above_200sma: lfCandle.close > lf.ema_200 ? 1 : 0,

      // Mid Frame trend
      mf_ema_order_long: mfLongCOMA,
      mf_ema_order_short: mfShortCOMA,
      mf_above_200sma: mfCandle.close > mf.ema_200 ? 1 : 0,

      // High Frame trend
      hf_ema_order_long: hfLongCOMA,
      hf_ema_order_short: hfShortCOMA,
      hf_above_200sma: hfCandle.close > hf.ema_200 ? 1 : 0,

      // Multi-timeframe alignment (CRITICAL for Gecko)
      all_tf_aligned_long: (lfLongCOMA && mfLongCOMA && hfLongCOMA) ? 1 : 0,
      all_tf_aligned_short: (lfShortCOMA && mfShortCOMA && hfShortCOMA) ? 1 : 0,
      lf_mf_aligned: (lfLongCOMA === mfLongCOMA && lfShortCOMA === mfShortCOMA) ? 1 : 0,
    };
  }

  /**
   * Extract support/resistance distance and momentum features (11 features)
   * @private
   */
  _extractSupportMomentumFeatures(lfCandle, mfCandle, hfCandle, lfHistory, mfHistory) {
    const lf = lfCandle.indicators || {};
    const mf = mfCandle.indicators || {};
    const hf = hfCandle.indicators || {};

    // Support/resistance distances (normalized by price)
    const distanceToEMA21MF = mfCandle.close > 0 ? (lfCandle.close - mf.ema_21) / lfCandle.close : 0;
    const distanceToEMA5HF = hfCandle.close > 0 ? (lfCandle.close - hf.ema_5) / lfCandle.close : 0;
    const distanceToEMA200MF = mfCandle.close > 0 ? (lfCandle.close - mf.ema_200) / lfCandle.close : 0;

    // Momentum metrics from recent price action
    let barsHigherHighs = 0;
    let barsHigherLows = 0;
    let barsLowerHighs = 0;
    let barsLowerLows = 0;

    if (lfHistory.length >= 20) {
      for (let i = 1; i < Math.min(20, lfHistory.length); i++) {
        if (lfHistory[i - 1].high < lfHistory[i].high) barsHigherHighs++;
        if (lfHistory[i - 1].low < lfHistory[i].low) barsHigherLows++;
        if (lfHistory[i - 1].high > lfHistory[i].high) barsLowerHighs++;
        if (lfHistory[i - 1].low > lfHistory[i].low) barsLowerLows++;
      }
    }

    // Volume analysis
    const avgVolume = lfHistory.length > 0
      ? lfHistory.reduce((sum, c) => sum + c.volume, 0) / lfHistory.length
      : 1;
    const volumeRatio = avgVolume > 0 ? lfCandle.volume / avgVolume : 0;

    // Returns
    const return5bars = lfHistory.length >= 5
      ? (lfCandle.close - lfHistory[4].close) / lfHistory[4].close
      : 0;
    const return10bars = lfHistory.length >= 10
      ? (lfCandle.close - lfHistory[9].close) / lfHistory[9].close
      : 0;

    return {
      // Support/resistance distances
      distance_to_ema21_mf: distanceToEMA21MF,
      distance_to_ema5_hf: distanceToEMA5HF,
      distance_to_ema200_mf: distanceToEMA200MF,

      // Close above key levels
      close_above_ema21_mf: lfCandle.close > mf.ema_21 ? 1 : 0,
      close_above_ema5_hf: lfCandle.close > hf.ema_5 ? 1 : 0,
      close_above_ema200_mf: lfCandle.close > mf.ema_200 ? 1 : 0,

      // Momentum (swing counts)
      bars_higher_highs: barsHigherHighs / 20,
      bars_higher_lows: barsHigherLows / 20,
      bars_lower_highs: barsLowerHighs / 20,

      // Volume and returns
      volume_ratio: volumeRatio,
      return_last_5_bars: return5bars,
      return_last_10_bars: return10bars,
    };
  }

  /**
   * Normalize feature values using minmax or zscore
   *
   * @param {Object} features - Raw features object
   * @param {string} method - Normalization method ('minmax' or 'zscore')
   * @returns {Object} Normalized features (values between 0-1 for minmax)
   */
  normalizeFeatures(features, method = 'minmax') {
    const normalized = {};

    // Define reasonable bounds for each feature type
    // These are used for minmax normalization
    const bounds = {
      // Price features - normalize by typical price ranges
      close: [0, 50000],  // Placeholder, should be set per symbol
      open: [0, 50000],
      high: [0, 50000],
      low: [0, 50000],
      volume: [0, 100000000],
      range: [0, 1000],
      body: [0, 1000],
      upper_wick: [0, 1000],
      lower_wick: [0, 1000],
      hl2: [0, 50000],
      hlc3: [0, 50000],
      body_percent: [0, 100],

      // EMA features - typically same scale as price
      ema8_lf: [0, 50000],
      ema21_lf: [0, 50000],
      ema50_lf: [0, 50000],
      ema200_lf: [0, 50000],
      ema8_mf: [0, 50000],
      ema21_mf: [0, 50000],
      ema50_mf: [0, 50000],
      ema200_mf: [0, 50000],
      ema5_hf: [0, 50000],
      ema8_hf: [0, 50000],
      ema21_hf: [0, 50000],
      ema50_hf: [0, 50000],
      ema200_hf: [0, 50000],
      atr_lf: [0, 1000],
      atr_hf: [0, 1000],

      // Consolidation features
      consolidation_level: [0, 50000],
      consolidation_range: [0, 1000],
      price_distance_from_base: [0, 1000],
      touches_to_level: [0, 50],
      touch_density: [0, 1],
      range_ratio: [0, 2],
      volatility_squeeze: [0, 1000],
      avg_range_last_10: [0, 1000],
      has_test_bar: [0, 1],
      test_bar_strength: [0, 1],
      test_bar_volume_ratio: [0, 5],

      // Trend features (binary 0-1)
      lf_ema_order_long: [0, 1],
      lf_ema_order_short: [0, 1],
      lf_above_200sma: [0, 1],
      mf_ema_order_long: [0, 1],
      mf_ema_order_short: [0, 1],
      mf_above_200sma: [0, 1],
      hf_ema_order_long: [0, 1],
      hf_ema_order_short: [0, 1],
      hf_above_200sma: [0, 1],
      all_tf_aligned_long: [0, 1],
      all_tf_aligned_short: [0, 1],
      lf_mf_aligned: [0, 1],

      // Support/momentum features
      distance_to_ema21_mf: [-0.1, 0.1],
      distance_to_ema5_hf: [-0.1, 0.1],
      distance_to_ema200_mf: [-0.1, 0.1],
      close_above_ema21_mf: [0, 1],
      close_above_ema5_hf: [0, 1],
      close_above_ema200_mf: [0, 1],
      bars_higher_highs: [0, 1],
      bars_higher_lows: [0, 1],
      bars_lower_highs: [0, 1],
      volume_ratio: [0, 5],
      return_last_5_bars: [-0.1, 0.1],
      return_last_10_bars: [-0.1, 0.1],
    };

    if (method === 'minmax') {
      for (const [key, value] of Object.entries(features)) {
        const [min, max] = bounds[key] || [0, 1];
        const range = max - min;

        if (range === 0) {
          normalized[key] = 0.5; // Center if no range
        } else {
          normalized[key] = Math.max(0, Math.min(1, (value - min) / range));
        }
      }
    } else if (method === 'zscore') {
      // Calculate mean and std dev from features
      const values = Object.values(features);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      for (const [key, value] of Object.entries(features)) {
        normalized[key] = stdDev > 0 ? (value - mean) / stdDev : 0;
      }
    } else {
      return features; // Return as-is if method not recognized
    }

    return normalized;
  }

  /**
   * Calculate standard deviation of array
   * @private
   */
  _standardDeviation(values) {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Validate features for NaN, Infinity, or invalid values
   * @private
   */
  _validateFeatures(features) {
    const issues = [];

    for (const [key, value] of Object.entries(features)) {
      if (isNaN(value)) {
        issues.push(`${key}: NaN`);
      } else if (!isFinite(value)) {
        issues.push(`${key}: Infinity`);
      } else if (typeof value !== 'number') {
        issues.push(`${key}: Not a number (${typeof value})`);
      }
    }

    if (issues.length > 0) {
      this.logger.warn(`Feature validation issues: ${issues.join(', ')}`);
    }

    return issues.length === 0;
  }
}

module.exports = { FeatureEngineer };
