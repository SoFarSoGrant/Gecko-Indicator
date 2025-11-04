/**
 * EMA Calculator Module
 *
 * Production-grade utility for calculating Exponential Moving Averages (EMA)
 * from historical OHLCV candle data. Implements accurate EMA calculation,
 * validation, and COMA (Correct Order of Moving Averages) status checking.
 *
 * Phase 6 Priority 1 Day 1 - Gecko ML Indicator Project
 *
 * @module indicators/ema-calculator
 */

const { createLogger, format, transports } = require('winston');

/**
 * Configuration constants for EMA calculation and validation
 */
const EMA_CONFIG = {
  MIN_WARMUP_FACTOR: 1.5,           // Minimum candles = period × 1.5
  RECOMMENDED_WARMUP_FACTOR: 2.5,   // Recommended = period × 2.5
  MAX_EMA_DEVIATION: 0.20,          // ±20% from close is acceptable
  EMA_LAG_THRESHOLD: 0.001,         // EMA should lag by at least 0.1%
  ACCURACY_THRESHOLD: 0.001,        // ±0.1% acceptable error vs reference
};

/**
 * EMA Calculator Class
 *
 * Provides static and instance methods for calculating and validating
 * Exponential Moving Averages for trading pattern analysis.
 *
 * @class
 */
class EMACalculator {
  /**
   * Create an EMA Calculator instance
   *
   * @param {Object} logger - Winston logger instance (optional)
   */
  constructor(logger = null) {
    this.logger = logger || this._createDefaultLogger();
  }

  /**
   * Create default logger if none provided
   * @private
   */
  _createDefaultLogger() {
    return createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        })
      ]
    });
  }

  /**
   * Calculate EMA values for a given period
   *
   * Implements the standard EMA formula:
   * EMA = (Close - Previous EMA) × Multiplier + Previous EMA
   * where Multiplier = 2 / (Period + 1)
   *
   * Initializes with SMA of first N periods for accuracy.
   *
   * @param {Array<Object>} candles - Array of candle objects with { close, ... }
   * @param {Number} period - EMA period (e.g., 8, 21, 50, 200)
   * @param {Number} startIndex - Start calculating from this candle index (default: 0)
   * @returns {Array<Number>} Array of EMA values (NaN for candles < period)
   *
   * @static
   */
  static calculateEMA(candles, period, startIndex = 0) {
    // Input validation
    if (!Array.isArray(candles) || candles.length === 0) {
      console.warn('[EMACalculator] Empty or invalid candles array');
      return [];
    }

    if (!Number.isFinite(period) || period < 1) {
      console.warn('[EMACalculator] Invalid period:', period);
      return new Array(candles.length).fill(NaN);
    }

    if (candles.length < period) {
      console.warn(`[EMACalculator] Insufficient candles (${candles.length}) for period ${period}`);
      return new Array(candles.length).fill(NaN);
    }

    const emaValues = new Array(candles.length).fill(NaN);
    const multiplier = 2 / (period + 1);

    // Step 1: Calculate SMA for first period candles (initialization)
    let sum = 0;
    let validCount = 0;

    for (let i = startIndex; i < startIndex + period && i < candles.length; i++) {
      const close = candles[i]?.close;
      if (Number.isFinite(close)) {
        sum += close;
        validCount++;
      }
    }

    if (validCount < period) {
      console.warn(`[EMACalculator] Insufficient valid closes for period ${period}`);
      return emaValues;
    }

    // Step 2: Set initial EMA as SMA
    const initialEMA = sum / period;
    emaValues[startIndex + period - 1] = initialEMA;

    // Step 3: Calculate EMA for remaining candles
    let previousEMA = initialEMA;

    for (let i = startIndex + period; i < candles.length; i++) {
      const close = candles[i]?.close;

      if (!Number.isFinite(close)) {
        // Forward fill with previous valid EMA
        emaValues[i] = previousEMA;
        continue;
      }

      // EMA formula: (Close - Previous EMA) × Multiplier + Previous EMA
      const ema = (close - previousEMA) * multiplier + previousEMA;
      emaValues[i] = ema;
      previousEMA = ema;
    }

    return emaValues;
  }

  /**
   * Add multiple EMA columns to candle array (in-place modification)
   *
   * @param {Array<Object>} candles - Candle array
   * @param {Array<Number>} periods - Periods to calculate (e.g., [5, 8, 21, 50, 200])
   * @returns {Array<Object>} Modified candles array with EMA columns added
   *
   * @static
   */
  static addEMAsToCandles(candles, periods) {
    if (!Array.isArray(candles) || candles.length === 0) {
      console.warn('[EMACalculator] Empty or invalid candles array');
      return candles;
    }

    if (!Array.isArray(periods) || periods.length === 0) {
      console.warn('[EMACalculator] Empty or invalid periods array');
      return candles;
    }

    console.debug(`[EMACalculator] Adding EMAs for periods: ${periods.join(', ')}`);

    for (const period of periods) {
      if (!Number.isFinite(period) || period < 1) {
        console.warn(`[EMACalculator] Skipping invalid period: ${period}`);
        continue;
      }

      const emaValues = this.calculateEMA(candles, period);

      candles.forEach((candle, i) => {
        candle[`ema_${period}`] = emaValues[i];
      });

      console.debug(`[EMACalculator] Added EMA(${period}) to ${candles.length} candles`);
    }

    return candles;
  }

  /**
   * Validate warmup requirements for EMA calculation
   *
   * @param {Array<Object>} candles - Candle array
   * @param {Number} maxPeriod - Largest period being calculated (e.g., 200)
   * @param {Boolean} strict - Use strict warmup requirements (default: true)
   * @returns {Object} Validation result
   *
   * @static
   */
  static validateWarmup(candles, maxPeriod, strict = true) {
    const candleCount = Array.isArray(candles) ? candles.length : 0;
    const factor = strict ? EMA_CONFIG.RECOMMENDED_WARMUP_FACTOR : EMA_CONFIG.MIN_WARMUP_FACTOR;
    const minRequired = Math.ceil(maxPeriod * factor);

    const isValid = candleCount >= minRequired;
    const message = isValid
      ? `Sufficient warmup: ${candleCount} candles for EMA(${maxPeriod})`
      : `Insufficient warmup: ${candleCount} candles, need ${minRequired} for EMA(${maxPeriod})`;

    return {
      isValid,
      candleCount,
      minRequired,
      message
    };
  }

  /**
   * Validate EMA values are correct and within expected range
   *
   * @param {Array<Object>} candles - Candles with EMA columns added
   * @param {Array<Number>} periods - Periods to validate
   * @returns {Object} Validation results
   *
   * @static
   */
  static validateEMAValues(candles, periods) {
    if (!Array.isArray(candles) || candles.length === 0) {
      return {
        isValid: false,
        issues: [{ issue: 'Empty or invalid candles array' }],
        stats: {}
      };
    }

    const issues = [];
    const stats = {};

    for (const period of periods) {
      const fieldName = `ema_${period}`;
      const values = [];
      let nanCount = 0;
      let infCount = 0;
      let deviationCount = 0;

      for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const emaValue = candle[fieldName];
        const close = candle.close;

        // Check for NaN (expected for warmup period)
        if (Number.isNaN(emaValue)) {
          if (i >= period) {
            nanCount++;
            issues.push({
              field: fieldName,
              candle: i,
              value: emaValue,
              issue: 'Unexpected NaN after warmup period'
            });
          }
          continue;
        }

        // Check for Infinity
        if (!Number.isFinite(emaValue)) {
          infCount++;
          issues.push({
            field: fieldName,
            candle: i,
            value: emaValue,
            issue: 'Infinite value'
          });
          continue;
        }

        values.push(emaValue);

        // Check deviation from close price (±20%)
        if (Number.isFinite(close) && close > 0) {
          const deviation = Math.abs((emaValue - close) / close);
          if (deviation > EMA_CONFIG.MAX_EMA_DEVIATION) {
            deviationCount++;
            if (deviationCount <= 5) { // Only log first 5 to avoid spam
              issues.push({
                field: fieldName,
                candle: i,
                value: emaValue,
                close: close,
                deviation: deviation,
                issue: `EMA deviation ${(deviation * 100).toFixed(1)}% exceeds ${(EMA_CONFIG.MAX_EMA_DEVIATION * 100)}%`
              });
            }
          }
        }
      }

      // Calculate statistics for valid values
      if (values.length > 0) {
        const sortedValues = [...values].sort((a, b) => a - b);
        stats[period] = {
          min: sortedValues[0],
          max: sortedValues[sortedValues.length - 1],
          mean: values.reduce((sum, v) => sum + v, 0) / values.length,
          count: values.length
        };
      }
    }

    const isValid = issues.length === 0;

    return {
      isValid,
      issues,
      stats
    };
  }

  /**
   * Validate EMA calculation accuracy against reference values
   *
   * @param {Array<Object>} candles - Candles with calculated EMAs
   * @param {Number} period - Period to validate
   * @param {Array<Number>} referenceValues - Reference EMA values (e.g., from TradingView)
   * @returns {Object} Accuracy metrics
   *
   * @static
   */
  static validateEMAAccuracy(candles, period, referenceValues = null) {
    if (!referenceValues || !Array.isArray(referenceValues)) {
      return {
        isAccurate: true,
        meanError: 0,
        maxError: 0,
        passThreshold: true,
        message: 'No reference values provided, skipping accuracy validation'
      };
    }

    const fieldName = `ema_${period}`;
    const errors = [];

    const minLength = Math.min(candles.length, referenceValues.length);

    for (let i = 0; i < minLength; i++) {
      const calculated = candles[i][fieldName];
      const reference = referenceValues[i];

      // Skip NaN values (warmup period)
      if (Number.isNaN(calculated) || Number.isNaN(reference)) {
        continue;
      }

      if (!Number.isFinite(calculated) || !Number.isFinite(reference) || reference === 0) {
        continue;
      }

      // Calculate percentage error
      const percentError = Math.abs((calculated - reference) / reference);
      errors.push(percentError);
    }

    if (errors.length === 0) {
      return {
        isAccurate: false,
        meanError: NaN,
        maxError: NaN,
        passThreshold: false,
        message: 'No valid data points for comparison'
      };
    }

    const meanError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
    const maxError = Math.max(...errors);
    const passThreshold = maxError < EMA_CONFIG.ACCURACY_THRESHOLD;

    return {
      isAccurate: passThreshold,
      meanError,
      maxError,
      passThreshold,
      message: passThreshold
        ? `All errors < ${(EMA_CONFIG.ACCURACY_THRESHOLD * 100).toFixed(2)}%`
        : `Max error ${(maxError * 100).toFixed(2)}% exceeds threshold ${(EMA_CONFIG.ACCURACY_THRESHOLD * 100).toFixed(2)}%`
    };
  }

  /**
   * Check COMA (Correct Order of Moving Averages) status
   *
   * COMA uptrend: EMA(8) > EMA(21) > EMA(50) > EMA(200)
   * COMA downtrend: EMA(8) < EMA(21) < EMA(50) < EMA(200)
   *
   * @param {Array<Object>} candles - Candles with EMA values
   * @param {Number} lfCandle - Low frame candle index
   * @param {Number} mfCandle - Mid frame candle index
   * @param {Number} hfCandle - High frame candle index
   * @returns {Object} COMA status for each timeframe
   *
   * @static
   */
  static getCOMAStatus(candles, lfCandle, mfCandle, hfCandle) {
    const checkCOMA = (candleIndex, periods = [8, 21, 50, 200]) => {
      if (!candles[candleIndex]) {
        return { uptrend: false, downtrend: false, confirmed: false };
      }

      const candle = candles[candleIndex];
      const emaValues = periods.map(p => candle[`ema_${p}`]);

      // Check if all EMAs are valid
      if (emaValues.some(v => !Number.isFinite(v))) {
        return { uptrend: false, downtrend: false, confirmed: false };
      }

      // Check uptrend: each EMA > next EMA
      let isUptrend = true;
      for (let i = 0; i < emaValues.length - 1; i++) {
        if (emaValues[i] <= emaValues[i + 1]) {
          isUptrend = false;
          break;
        }
      }

      // Check downtrend: each EMA < next EMA
      let isDowntrend = true;
      for (let i = 0; i < emaValues.length - 1; i++) {
        if (emaValues[i] >= emaValues[i + 1]) {
          isDowntrend = false;
          break;
        }
      }

      return {
        uptrend: isUptrend,
        downtrend: isDowntrend,
        confirmed: isUptrend || isDowntrend
      };
    };

    return {
      lf: checkCOMA(lfCandle),
      mf: checkCOMA(mfCandle),
      hf: checkCOMA(hfCandle, [5, 8, 21, 50, 200]) // HF uses EMA(5) as well
    };
  }

  /**
   * Process pattern candles and add EMAs for all timeframes
   *
   * High-level method that orchestrates EMA calculation for a complete pattern.
   *
   * @param {Object} patternData - Pattern data with raw candles for each timeframe
   * @param {Array<String>} timeframes - Timeframes to process (default: ['lf', 'mf', 'hf'])
   * @returns {Object} Enhanced pattern data with EMAs
   */
  processPatternCandles(patternData, timeframes = ['lf', 'mf', 'hf']) {
    this.logger.info('[EMACalculator] Processing pattern candles for EMAs');

    const enhancedData = { ...patternData };

    for (const tf of timeframes) {
      const candles = patternData[`${tf}_candles`];

      if (!Array.isArray(candles) || candles.length === 0) {
        this.logger.warn(`[EMACalculator] No candles for timeframe: ${tf}`);
        continue;
      }

      // Determine periods based on timeframe
      const periods = tf === 'hf' ? [5, 8, 21, 50, 200] : [8, 21, 50, 200];
      const maxPeriod = Math.max(...periods);

      // Validate warmup
      const warmupValidation = EMACalculator.validateWarmup(candles, maxPeriod, false);
      if (!warmupValidation.isValid) {
        this.logger.warn(`[EMACalculator] ${warmupValidation.message}`);
        // Continue anyway with available data
      }

      // Calculate EMAs
      EMACalculator.addEMAsToCandles(candles, periods);

      // Validate EMA values
      const validation = EMACalculator.validateEMAValues(candles, periods);
      if (!validation.isValid) {
        this.logger.warn(`[EMACalculator] EMA validation issues for ${tf}:`, validation.issues.slice(0, 5));
      } else {
        this.logger.debug(`[EMACalculator] EMAs validated for ${tf}:`, validation.stats);
      }

      enhancedData[`${tf}_candles`] = candles;
    }

    this.logger.info('[EMACalculator] Pattern candles processed successfully');
    return enhancedData;
  }
}

/**
 * Export EMA Calculator and configuration
 */
module.exports = {
  EMACalculator,
  EMA_CONFIG
};
