#!/usr/bin/env node

/**
 * Gecko Pattern Collection Script (Phase 5)
 *
 * Collects historical Gecko patterns from TradingView data for model retraining.
 * Implements the 5-stage Gecko pattern detection and retroactive labeling.
 *
 * Pattern Structure:
 * 1. Momentum Move (MM): Strong impulsive leg (≥1.5×ATR) matching HF trend
 * 2. Consolidation: 20-100 bars sideways with ~3 swing touches
 * 3. Test Bar (TB): Single large bar (>1.5×ATR) closing beyond base
 * 4. Hook (FTB): Failed breakout (price breaks back through TB extreme)
 * 5. Re-entry: Price re-breaks consolidation in HF trend direction
 *
 * Labels:
 * - Winner: Target hit before stop loss
 * - Loser: Stop loss hit before target
 *
 * Usage: node scripts/collect-gecko-patterns.js [symbol] [options]
 *        node scripts/collect-gecko-patterns.js BTCUSDT
 *        node scripts/collect-gecko-patterns.js BTCUSDT --days=180 --min-patterns=200
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

const configModule = await import('../src/config/index.js');
const { config } = configModule;

const { DataCollector } = await import('../src/data/collector.js');
const { TrendDetector } = await import('../src/indicators/trend-detector.js');

// Parse command line arguments
const args = process.argv.slice(2);
const symbolArg = args.find(arg => !arg.startsWith('--'));
const SYMBOL = symbolArg || 'BTCUSDT';

const daysArg = args.find(arg => arg.startsWith('--days='));
const COLLECTION_DAYS = daysArg ? parseInt(daysArg.split('=')[1]) : 180;

const minPatternsArg = args.find(arg => arg.startsWith('--min-patterns='));
const MIN_PATTERNS = minPatternsArg ? parseInt(minPatternsArg.split('=')[1]) : 200;

// Timeframe configuration (LF, MF, HF)
const LF = '5m';   // Low Frame (pattern detection)
const MF = '15m';  // Mid Frame (dynamic support)
const HF = '1h';   // High Frame (trend confirmation)

// Data directories
const DATA_DIR = './data/raw';
const OUTPUT_FILE = path.join(DATA_DIR, 'historical-patterns.json');

// Configure logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/pattern-collection.log' }),
  ],
});

/**
 * GeckoPatternDetector
 * Implements the 5-stage Gecko pattern detection algorithm
 */
class GeckoPatternDetector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.atrLength = config.indicators?.atrLength || 14;
  }

  /**
   * Detect Gecko patterns in historical data
   * @param {Array} lfData - Low Frame OHLCV data with indicators
   * @param {Array} mfData - Mid Frame OHLCV data with indicators
   * @param {Array} hfData - High Frame OHLCV data with indicators
   * @param {Object} hfTrend - High Frame trend analysis from TrendDetector
   * @returns {Array} Array of detected pattern candidates
   */
  detectPatterns(lfData, mfData, hfData, hfTrend) {
    this.logger.info('Detecting Gecko patterns...');
    this.logger.debug(`Data lengths: LF=${lfData.length}, MF=${mfData.length}, HF=${hfData.length}`);

    const patterns = [];

    // Minimum data requirement: need at least 200 bars for pattern analysis
    if (lfData.length < 200) {
      this.logger.warn(`Insufficient data: ${lfData.length} bars (need 200+)`);
      return patterns;
    }

    // Track detection stats
    let noHFTrend = 0;
    let noMM = 0;
    let noConsolidation = 0;
    let noTestBar = 0;
    let noHook = 0;
    let noReentry = 0;

    // Scan through LF data looking for patterns
    // Start from bar 100 to ensure we have history, end 100 bars before end for forward labeling
    for (let i = 100; i < lfData.length - 100; i++) {
      const pattern = this.analyzePatternAtIndex(i, lfData, mfData, hfData, hfTrend);

      if (pattern) {
        patterns.push(pattern);
        this.logger.debug(`Pattern found at index ${i}, time ${new Date(pattern.entryTime * 1000).toISOString()}`);
      } else {
        // Track why patterns are failing (sample every 1000 bars to avoid log spam)
        if (i % 1000 === 0) {
          const currentBar = lfData[i];
          const hfBar = this.getAlignedHFBar(currentBar.time, hfData);
          if (!hfBar || !hfBar.indicators.comaConfirmed) noHFTrend++;
        }
      }
    }

    this.logger.info(`Detected ${patterns.length} pattern candidates`);
    this.logger.debug(`Detection failures sampled: HF trend issues: ${noHFTrend}`);

    return patterns;
  }

  /**
   * Analyze potential pattern starting at given index
   * @param {number} currentIndex - Current bar index in LF data
   * @param {Array} lfData - Low Frame data
   * @param {Array} mfData - Mid Frame data
   * @param {Array} hfData - High Frame data
   * @param {Object} hfTrend - High Frame trend
   * @returns {Object|null} Pattern object or null if not valid
   */
  analyzePatternAtIndex(currentIndex, lfData, mfData, hfData, hfTrend) {
    const currentBar = lfData[currentIndex];

    // Check if we're in a valid HF trend period
    const hfBar = this.getAlignedHFBar(currentBar.time, hfData);
    if (!hfBar || !hfBar.indicators.comaConfirmed) {
      return null; // No valid HF trend
    }

    const isUptrend = hfBar.indicators.comaDirection === 'up';

    // Stage 1: Look for Momentum Move (look back 20-50 bars)
    const mmRange = this.findMomentumMove(currentIndex, lfData, isUptrend);
    if (!mmRange) return null;

    // Stage 2: Look for Consolidation (current position should be in consolidation)
    const consolidation = this.findConsolidation(mmRange.endIndex, currentIndex, lfData);
    if (!consolidation) return null;

    // Stage 3: Look for Test Bar (current bar or recent bars)
    const testBar = this.findTestBar(consolidation.endIndex, currentIndex, lfData, consolidation, isUptrend);
    if (!testBar) return null;

    // Stage 4: Look for Hook (failed breakout after test bar)
    const hook = this.findHook(testBar.index, currentIndex, lfData, testBar, isUptrend);
    if (!hook) return null;

    // Stage 5: Look for Re-entry setup (current bar should be re-entry)
    const reentry = this.detectReentry(hook.index, currentIndex, lfData, consolidation, isUptrend);
    if (!reentry) return null;

    // Calculate entry, stop, and target
    const atr = currentBar.indicators.atr || this.calculateATR(lfData, currentIndex);
    const entry = consolidation.base + (0.2 * atr) * (isUptrend ? 1 : -1);
    const stop = hook.swingExtreme + (0.0001 * (isUptrend ? -1 : 1)); // 1 tick beyond hook
    const mmSize = Math.abs(mmRange.high - mmRange.low);
    const target = entry + (mmSize * (isUptrend ? 1 : -1)); // 100% extension of MM

    return {
      symbol: currentBar.symbol || 'UNKNOWN',
      timeframe: LF,
      entryTime: currentBar.time,
      entryPrice: entry,
      stopLoss: stop,
      target: target,
      atr: atr,
      direction: isUptrend ? 'long' : 'short',

      // Pattern stages with bar ranges
      stage1_momentumMove: {
        startIndex: mmRange.startIndex,
        endIndex: mmRange.endIndex,
        high: mmRange.high,
        low: mmRange.low,
        size: mmSize,
        sizeInATR: mmSize / atr,
      },
      stage2_consolidation: {
        startIndex: consolidation.startIndex,
        endIndex: consolidation.endIndex,
        base: consolidation.base,
        barCount: consolidation.endIndex - consolidation.startIndex,
        swingTouches: consolidation.swingTouches,
      },
      stage3_testBar: {
        index: testBar.index,
        high: testBar.high,
        low: testBar.low,
        close: testBar.close,
        sizeInATR: testBar.sizeInATR,
      },
      stage4_hook: {
        index: hook.index,
        swingExtreme: hook.swingExtreme,
        closesBeyondTB: hook.closesBeyondTB,
      },
      stage5_reentry: {
        index: reentry.index,
        breaksConsolidation: reentry.breaksConsolidation,
      },

      // High Frame confirmation
      hfTrend: {
        direction: isUptrend ? 'up' : 'down',
        comaConfirmed: true,
        barTime: hfBar.time,
      },

      // Label will be assigned later in labelPattern()
      label: null,
      labelDetails: null,
    };
  }

  /**
   * Find Momentum Move: Strong impulsive leg ≥1.5×ATR
   * Look back 20-50 bars for a strong directional move
   */
  findMomentumMove(currentIndex, lfData, isUptrend) {
    const lookbackStart = Math.max(0, currentIndex - 50);
    const lookbackEnd = Math.max(0, currentIndex - 20);

    for (let start = lookbackStart; start <= lookbackEnd; start++) {
      for (let end = start + 10; end <= currentIndex - 10; end++) {
        const startBar = lfData[start];
        const endBar = lfData[end];

        const moveSize = isUptrend
          ? endBar.high - startBar.low
          : startBar.high - endBar.low;

        const atr = endBar.indicators.atr || this.calculateATR(lfData, end);

        if (moveSize >= 1.5 * atr) {
          return {
            startIndex: start,
            endIndex: end,
            high: Math.max(startBar.high, endBar.high),
            low: Math.min(startBar.low, endBar.low),
            size: moveSize,
          };
        }
      }
    }

    return null;
  }

  /**
   * Find Consolidation: 20-100 bars sideways with ~3 swing touches
   */
  findConsolidation(startIndex, currentIndex, lfData) {
    const length = currentIndex - startIndex;

    if (length < 20 || length > 100) {
      return null;
    }

    // Calculate consolidation range
    let high = -Infinity;
    let low = Infinity;

    for (let i = startIndex; i <= currentIndex; i++) {
      high = Math.max(high, lfData[i].high);
      low = Math.min(low, lfData[i].low);
    }

    const base = (high + low) / 2;
    const range = high - low;

    // Count swing touches (bars that touch near high or low)
    let swingTouches = 0;
    const touchThreshold = range * 0.1; // Within 10% of extreme

    for (let i = startIndex; i <= currentIndex; i++) {
      const bar = lfData[i];
      if (Math.abs(bar.high - high) <= touchThreshold || Math.abs(bar.low - low) <= touchThreshold) {
        swingTouches++;
      }
    }

    // Require at least 3 swing touches
    if (swingTouches < 3) {
      return null;
    }

    return {
      startIndex,
      endIndex: currentIndex,
      base,
      high,
      low,
      range,
      swingTouches,
    };
  }

  /**
   * Find Test Bar: Single large bar >1.5×ATR closing beyond consolidation base
   */
  findTestBar(startIndex, currentIndex, lfData, consolidation, isUptrend) {
    // Look in the last 10 bars for a test bar
    const searchStart = Math.max(startIndex, currentIndex - 10);

    for (let i = searchStart; i <= currentIndex; i++) {
      const bar = lfData[i];
      const atr = bar.indicators.atr || this.calculateATR(lfData, i);
      const barSize = bar.high - bar.low;

      if (barSize > 1.5 * atr) {
        // Check if closes beyond consolidation base
        const closesBeyond = isUptrend
          ? bar.close > consolidation.base
          : bar.close < consolidation.base;

        if (closesBeyond) {
          return {
            index: i,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            sizeInATR: barSize / atr,
          };
        }
      }
    }

    return null;
  }

  /**
   * Find Hook: Failed breakout (price breaks back through test bar extreme)
   */
  findHook(testBarIndex, currentIndex, lfData, testBar, isUptrend) {
    // Look for hook in bars after test bar (up to 10 bars)
    for (let i = testBarIndex + 1; i <= Math.min(testBarIndex + 10, currentIndex); i++) {
      const bar = lfData[i];

      // Check if price breaks back through test bar extreme
      const breaksBack = isUptrend
        ? bar.low < testBar.high  // Price breaks back below test bar high
        : bar.high > testBar.low; // Price breaks back above test bar low

      if (breaksBack) {
        return {
          index: i,
          swingExtreme: isUptrend ? bar.low : bar.high,
          closesBeyondTB: breaksBack,
        };
      }
    }

    return null;
  }

  /**
   * Detect Re-entry: Price re-breaks consolidation base in HF trend direction
   */
  detectReentry(hookIndex, currentIndex, lfData, consolidation, isUptrend) {
    // Current bar should be the re-entry
    const bar = lfData[currentIndex];

    const breaksConsolidation = isUptrend
      ? bar.close > consolidation.base
      : bar.close < consolidation.base;

    if (breaksConsolidation) {
      return {
        index: currentIndex,
        breaksConsolidation: true,
      };
    }

    return null;
  }

  /**
   * Calculate ATR manually if not available in indicators
   */
  calculateATR(data, index) {
    const length = Math.min(this.atrLength, index);
    let sum = 0;

    for (let i = index - length + 1; i <= index; i++) {
      const bar = data[i];
      const prevBar = i > 0 ? data[i - 1] : bar;

      const tr = Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - prevBar.close),
        Math.abs(bar.low - prevBar.close)
      );

      sum += tr;
    }

    return sum / length;
  }

  /**
   * Get aligned HF bar for given LF timestamp
   */
  getAlignedHFBar(lfTime, hfData) {
    // Find HF bar that contains this LF timestamp
    // Use a more flexible approach: find the closest HF bar
    let closestBar = null;
    let minDiff = Infinity;

    for (const hfBar of hfData) {
      const diff = Math.abs(hfBar.time - lfTime);

      // If difference is within 1 hour, this bar covers the LF time
      if (diff < 3600 && diff < minDiff) {
        closestBar = hfBar;
        minDiff = diff;
      }
    }

    return closestBar;
  }
}

/**
 * PatternLabeler
 * Labels patterns as winner/loser based on retroactive price action
 */
class PatternLabeler {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Label a pattern as winner or loser
   * @param {Object} pattern - Pattern to label
   * @param {Array} lfData - Low Frame data
   * @param {number} patternIndex - Index of pattern entry bar in lfData
   * @returns {Object} Updated pattern with label and details
   */
  labelPattern(pattern, lfData, patternIndex) {
    const { entryPrice, stopLoss, target, direction } = pattern;

    const isLong = direction === 'long';

    // Look forward from entry to determine outcome
    // Max lookforward: 100 bars (to ensure pattern completes)
    const maxLookforward = Math.min(100, lfData.length - patternIndex - 1);

    let targetHit = false;
    let stopHit = false;
    let targetBar = null;
    let stopBar = null;

    for (let i = patternIndex + 1; i <= patternIndex + maxLookforward; i++) {
      const bar = lfData[i];

      // Check target hit
      if (isLong) {
        if (bar.high >= target) {
          targetHit = true;
          targetBar = i;
        }
        if (bar.low <= stopLoss) {
          stopHit = true;
          stopBar = i;
        }
      } else {
        if (bar.low <= target) {
          targetHit = true;
          targetBar = i;
        }
        if (bar.high >= stopLoss) {
          stopHit = true;
          stopBar = i;
        }
      }

      // Determine label: whichever was hit first
      if (targetHit && !stopHit) {
        pattern.label = 'winner';
        pattern.labelDetails = {
          targetHitBar: targetBar,
          targetHitTime: lfData[targetBar].time,
          barsToTarget: targetBar - patternIndex,
        };
        return pattern;
      } else if (stopHit && !targetHit) {
        pattern.label = 'loser';
        pattern.labelDetails = {
          stopHitBar: stopBar,
          stopHitTime: lfData[stopBar].time,
          barsToStop: stopBar - patternIndex,
        };
        return pattern;
      } else if (targetHit && stopHit) {
        // Both hit, determine which was first
        if (targetBar < stopBar) {
          pattern.label = 'winner';
          pattern.labelDetails = {
            targetHitBar: targetBar,
            targetHitTime: lfData[targetBar].time,
            barsToTarget: targetBar - patternIndex,
          };
        } else {
          pattern.label = 'loser';
          pattern.labelDetails = {
            stopHitBar: stopBar,
            stopHitTime: lfData[stopBar].time,
            barsToStop: stopBar - patternIndex,
          };
        }
        return pattern;
      }
    }

    // Neither hit within lookforward window - label as loser (inconclusive)
    pattern.label = 'loser';
    pattern.labelDetails = {
      reason: 'inconclusive',
      barsAnalyzed: maxLookforward,
    };

    return pattern;
  }
}

/**
 * Load or collect historical data
 */
async function loadHistoricalData(symbol, timeframe, days, collector, trendDetector) {
  const filename = `${symbol.toLowerCase()}_${timeframe}_${days}d.json`;
  const filepath = path.join(DATA_DIR, filename);

  // Try loading from file first
  if (fs.existsSync(filepath)) {
    logger.info(`Loading cached data: ${filename}`);
    const fileData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

    if (fileData.data && fileData.data.length > 0) {
      logger.info(`  Loaded ${fileData.data.length} candles from cache`);
      return fileData.data;
    }
  }

  // Collect fresh data
  logger.info(`Collecting fresh data for ${symbol} ${timeframe}...`);
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const data = await collector.collectHistoricalData(symbol, timeframe, startDate, endDate);
  logger.info(`  Collected ${data.length} candles`);

  // Save to file
  fs.writeFileSync(filepath, JSON.stringify({
    symbol,
    timeframe,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    durationDays: days,
    candleCount: data.length,
    data,
  }, null, 2));

  logger.info(`  Saved to ${filename}`);
  return data;
}

/**
 * Main execution
 */
async function main() {
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('    GECKO ML INDICATOR - HISTORICAL PATTERN COLLECTION (PHASE 5)');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info(`Symbol: ${SYMBOL}`);
  logger.info(`Timeframes: LF=${LF}, MF=${MF}, HF=${HF}`);
  logger.info(`Collection Period: ${COLLECTION_DAYS} days`);
  logger.info(`Minimum Patterns: ${MIN_PATTERNS}`);
  logger.info('');

  const collector = new DataCollector(config, logger);
  const trendDetector = new TrendDetector(config, logger);
  const patternDetector = new GeckoPatternDetector(config, logger);
  const patternLabeler = new PatternLabeler(logger);

  try {
    // Start collector
    logger.info('Starting DataCollector...');
    await collector.start();
    logger.info('✓ DataCollector started');
    logger.info('');

    // Step 1: Load historical data for all timeframes
    logger.info('Step 1: Loading historical data...');
    const lfData = await loadHistoricalData(SYMBOL, LF, COLLECTION_DAYS, collector, trendDetector);
    const mfData = await loadHistoricalData(SYMBOL, MF, COLLECTION_DAYS, collector, trendDetector);
    const hfData = await loadHistoricalData(SYMBOL, HF, COLLECTION_DAYS, collector, trendDetector);
    logger.info(`✓ Loaded: LF=${lfData.length}, MF=${mfData.length}, HF=${hfData.length} candles`);
    logger.info('');

    // Step 2: Analyze HF trend using TrendDetector
    logger.info('Step 2: Analyzing High Frame trends...');
    const hfTrend = await trendDetector.detectTrend(SYMBOL, hfData);
    logger.info(`✓ HF Trend: ${hfTrend.direction || 'NONE'}, COMA bars: ${hfTrend.barsInCOMA}/${hfTrend.requiredBars}`);
    logger.info('');

    // Step 3: Detect Gecko patterns
    logger.info('Step 3: Detecting Gecko patterns...');
    const patterns = patternDetector.detectPatterns(lfData, mfData, hfData, hfTrend);
    logger.info(`✓ Detected ${patterns.length} pattern candidates`);
    logger.info('');

    // Step 4: Label patterns retroactively
    logger.info('Step 4: Labeling patterns...');
    const labeledPatterns = [];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];

      // Find pattern entry index in lfData
      const entryIndex = lfData.findIndex(bar => bar.time === pattern.entryTime);

      if (entryIndex !== -1) {
        const labeled = patternLabeler.labelPattern(pattern, lfData, entryIndex);
        labeledPatterns.push(labeled);
      } else {
        logger.warn(`Could not find entry bar for pattern at time ${pattern.entryTime}`);
      }
    }

    const winners = labeledPatterns.filter(p => p.label === 'winner').length;
    const losers = labeledPatterns.filter(p => p.label === 'loser').length;
    const winRate = labeledPatterns.length > 0 ? (winners / labeledPatterns.length * 100).toFixed(2) : 0;

    logger.info(`✓ Labeled ${labeledPatterns.length} patterns: ${winners} winners, ${losers} losers (${winRate}% win rate)`);
    logger.info('');

    // Step 5: Validate and save
    logger.info('Step 5: Validating and saving patterns...');

    const validationErrors = [];

    // Check minimum pattern count
    if (labeledPatterns.length < MIN_PATTERNS) {
      validationErrors.push(`Insufficient patterns: ${labeledPatterns.length} (need ${MIN_PATTERNS}+)`);
    }

    // Check winner/loser ratio
    const ratio = losers > 0 ? winners / losers : Infinity;
    if (ratio < 0.8 || ratio > 1.5) {
      validationErrors.push(`Winner/loser ratio out of range: ${ratio.toFixed(2)} (need 0.8-1.5 for 50/50 to 60/40)`);
    }

    // Check for duplicates
    const uniqueTimes = new Set(labeledPatterns.map(p => p.entryTime));
    if (uniqueTimes.size < labeledPatterns.length) {
      validationErrors.push(`Duplicate patterns detected: ${labeledPatterns.length - uniqueTimes.size} duplicates`);
    }

    if (validationErrors.length > 0) {
      logger.warn('⚠ Validation warnings:');
      validationErrors.forEach(err => logger.warn(`  - ${err}`));
      logger.info('');
    }

    // Save patterns
    const output = {
      collectionDate: new Date().toISOString(),
      symbol: SYMBOL,
      timeframes: { lf: LF, mf: MF, hf: HF },
      collectionPeriod: {
        days: COLLECTION_DAYS,
        startDate: new Date(Date.now() - COLLECTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      },
      statistics: {
        totalPatterns: labeledPatterns.length,
        winners: winners,
        losers: losers,
        winRate: parseFloat(winRate),
        ratio: ratio,
      },
      patterns: labeledPatterns,
      validation: {
        passed: validationErrors.length === 0,
        errors: validationErrors,
      },
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    logger.info(`✓ Patterns saved to ${OUTPUT_FILE}`);
    logger.info('');

    // Print summary
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('COLLECTION SUMMARY');
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info(`Total Patterns: ${labeledPatterns.length}`);
    logger.info(`Winners: ${winners} (${winRate}%)`);
    logger.info(`Losers: ${losers} (${(100 - winRate).toFixed(2)}%)`);
    logger.info(`Ratio: ${ratio.toFixed(2)}`);
    logger.info(`Validation: ${validationErrors.length === 0 ? '✓ PASSED' : '⚠ WARNINGS'}`);
    logger.info(`Output File: ${OUTPUT_FILE}`);
    logger.info('');

    if (labeledPatterns.length >= MIN_PATTERNS && validationErrors.length === 0) {
      logger.info('✓ Phase 5 data collection COMPLETE');
      logger.info('✓ Ready for model retraining');
    } else {
      logger.warn('⚠ Additional data collection may be needed');
      logger.info('Consider:');
      logger.info('  - Increasing collection period (--days=365)');
      logger.info('  - Collecting from additional symbols');
      logger.info('  - Adjusting pattern detection thresholds');
    }

  } catch (error) {
    logger.error('Collection failed:', error);
    process.exit(1);
  } finally {
    logger.info('');
    logger.info('Stopping DataCollector...');
    await collector.stop();
    logger.info('✓ DataCollector stopped');
  }
}

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
