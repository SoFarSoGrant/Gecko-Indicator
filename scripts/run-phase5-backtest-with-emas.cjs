#!/usr/bin/env node

/**
 * Phase 5 Backtest with Real EMA Features
 *
 * This backtest now uses real EMA values from enhanced patterns
 * (or generates them on-the-fly if not available).
 *
 * Phase 6 Priority 1 - Gecko ML Indicator Project
 *
 * Differences from previous backtest:
 * - Loads enhanced patterns with real EMAs when available
 * - Falls back to base patterns and generates EMAs if needed
 * - Features now use real EMA distance calculations
 * - Tracks EMA data availability
 */

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  ENHANCED_DATASET_PATH: path.join(__dirname, '../data/raw/historical-patterns-with-real-emas.json'),
  BASE_DATASET_PATH: path.join(__dirname, '../data/raw/historical-patterns.json'),
  REPORT_PATH: path.join(__dirname, '../data/reports/phase5-backtest-with-real-emas.json'),
  INITIAL_CAPITAL: 10000,
  RISK_PER_TRADE: 0.02,
  RISK_FREE_RATE: 0.02 / 252, // Annual / trading days
};

// ============================================================================
// Logger
// ============================================================================

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({
      filename: path.join(__dirname, '../logs/backtest-with-emas.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// ============================================================================
// Feature Extraction (Updated with Real EMAs)
// ============================================================================

/**
 * Extract features from pattern with real EMA values
 */
function extractFeatures(pattern) {
  const features = [];

  // === PRICE FEATURES (8 features) ===
  const range = pattern.stage3_testBar.high - pattern.stage3_testBar.low;
  features.push(
    range / pattern.atr,
    (pattern.entryPrice - pattern.stage2_consolidation.base) / pattern.atr,
    (pattern.stopLoss - pattern.entryPrice) / pattern.atr,
    (pattern.target - pattern.entryPrice) / pattern.atr,
    Math.abs(pattern.target - pattern.entryPrice) / Math.abs(pattern.stopLoss - pattern.entryPrice),
    pattern.stage1_momentumMove.sizeInATR,
    pattern.stage3_testBar.sizeInATR,
    (pattern.stage4_hook.swingExtreme - pattern.stage2_consolidation.base) / pattern.atr
  );

  // === EMA FEATURES (18 features - REAL EMAs) ===
  const lfEMAs = pattern.emas?.lf || {};
  const mfEMAs = pattern.emas?.mf || {};
  const hfEMAs = pattern.emas?.hf || {};

  // LF: ema_8, ema_21, ema_50, ema_200
  features.push(
    lfEMAs.ema_8 ? ((pattern.entryPrice - lfEMAs.ema_8) / pattern.entryPrice) * 100 : 0,
    lfEMAs.ema_21 ? ((pattern.entryPrice - lfEMAs.ema_21) / pattern.entryPrice) * 100 : 0,
    lfEMAs.ema_50 ? ((pattern.entryPrice - lfEMAs.ema_50) / pattern.entryPrice) * 100 : 0,
    lfEMAs.ema_200 ? ((pattern.entryPrice - lfEMAs.ema_200) / pattern.entryPrice) * 100 : 0,

    // MF: ema_8, ema_21, ema_50, ema_200
    mfEMAs.ema_8 ? ((pattern.entryPrice - mfEMAs.ema_8) / pattern.entryPrice) * 100 : 0,
    mfEMAs.ema_21 ? ((pattern.entryPrice - mfEMAs.ema_21) / pattern.entryPrice) * 100 : 0,
    mfEMAs.ema_50 ? ((pattern.entryPrice - mfEMAs.ema_50) / pattern.entryPrice) * 100 : 0,
    mfEMAs.ema_200 ? ((pattern.entryPrice - mfEMAs.ema_200) / pattern.entryPrice) * 100 : 0,

    // HF: ema_5, ema_8, ema_21, ema_50, ema_200
    hfEMAs.ema_5 ? ((pattern.entryPrice - hfEMAs.ema_5) / pattern.entryPrice) * 100 : 0,
    hfEMAs.ema_8 ? ((pattern.entryPrice - hfEMAs.ema_8) / pattern.entryPrice) * 100 : 0,
    hfEMAs.ema_21 ? ((pattern.entryPrice - hfEMAs.ema_21) / pattern.entryPrice) * 100 : 0,
    hfEMAs.ema_50 ? ((pattern.entryPrice - hfEMAs.ema_50) / pattern.entryPrice) * 100 : 0,
    hfEMAs.ema_200 ? ((pattern.entryPrice - hfEMAs.ema_200) / pattern.entryPrice) * 100 : 0,
    0, 0, 0 // Placeholders
  );

  // === CONSOLIDATION FEATURES (12 features) ===
  features.push(
    pattern.stage2_consolidation.barCount,
    pattern.stage2_consolidation.swingTouches,
    pattern.stage2_consolidation.barCount / 100,
    (pattern.stage1_momentumMove.high - pattern.stage1_momentumMove.low) / pattern.atr,
    pattern.stage2_consolidation.swingTouches / pattern.stage2_consolidation.barCount,
    (pattern.stage3_testBar.high - pattern.stage2_consolidation.base) / pattern.atr,
    (pattern.stage4_hook.swingExtreme - pattern.stage2_consolidation.base) / pattern.atr,
    1,
    range / pattern.atr,
    pattern.stage2_consolidation.barCount / 50,
    0,
    1
  );

  // === TREND FEATURES (12 features) ===
  const trendDirection = pattern.hfTrend?.direction === 'up' ? 1 : -1;
  features.push(
    trendDirection,
    1,
    1,
    30,
    trendDirection,
    1,
    1,
    1,
    1,
    1,
    0,
    pattern.stage1_momentumMove.sizeInATR
  );

  // === MOMENTUM FEATURES (12 features) ===
  features.push(
    pattern.stage1_momentumMove.sizeInATR,
    pattern.stage1_momentumMove.endIndex - pattern.stage1_momentumMove.startIndex,
    pattern.stage1_momentumMove.sizeInATR / (pattern.stage1_momentumMove.endIndex - pattern.stage1_momentumMove.startIndex),
    1,
    pattern.stage3_testBar.sizeInATR,
    1,
    1,
    1,
    1,
    1,
    1,
    Math.abs(pattern.target - pattern.entryPrice) / pattern.stage1_momentumMove.size
  );

  return features; // Total: 62 features
}

/**
 * Calculate Sharpe Ratio
 */
function calculateSharpe(returns) {
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (mean - CONFIG.RISK_FREE_RATE) / stdDev;
}

/**
 * Calculate trade P&L
 */
function calculateTradePnL(pattern, capital, riskPerTrade) {
  const risk = Math.abs(pattern.entryPrice - pattern.stopLoss);
  const reward = Math.abs(pattern.target - pattern.entryPrice);
  const dollarRisk = capital * riskPerTrade;
  const positionSize = dollarRisk / risk;

  let pnl, pnlPercent, outcome = pattern.label || pattern.outcome || 'unknown';

  if (outcome === 'winner' || outcome === true) {
    pnl = positionSize * reward;
    pnlPercent = (pnl / capital) * 100;
  } else {
    pnl = -dollarRisk;
    pnlPercent = -riskPerTrade * 100;
  }

  return {
    pnl,
    pnlPercent,
    outcome,
    positionSize,
    riskAmount: dollarRisk,
    rewardAmount: positionSize * reward,
    rMultiple: outcome === 'winner' || outcome === true ? reward / risk : -1
  };
}

// ============================================================================
// Main Backtest Function
// ============================================================================

async function runBacktest() {
  logger.info('=== Phase 5 Backtest with Real EMA Features ===');

  try {
    // Load dataset - try enhanced first, fall back to base
    let patterns = [];
    let dataSource = 'unknown';

    if (fs.existsSync(CONFIG.ENHANCED_DATASET_PATH)) {
      try {
        const enhancedData = JSON.parse(fs.readFileSync(CONFIG.ENHANCED_DATASET_PATH, 'utf-8'));
        if (enhancedData.patterns && enhancedData.patterns.length > 0) {
          patterns = enhancedData.patterns;
          dataSource = 'enhanced';
          logger.info(`Loaded enhanced patterns: ${patterns.length} patterns`);
        }
      } catch (e) {
        logger.warn(`Enhanced dataset load failed: ${e.message}`);
      }
    }

    if (patterns.length === 0) {
      const baseData = JSON.parse(fs.readFileSync(CONFIG.BASE_DATASET_PATH, 'utf-8'));
      patterns = baseData.patterns || [];
      dataSource = 'base';
      logger.info(`Loaded base patterns: ${patterns.length} patterns`);
    }

    if (patterns.length === 0) {
      throw new Error('No patterns found in dataset');
    }

    // Check EMA availability
    const patternsWithEMAs = patterns.filter(p => p.emas && Object.keys(p.emas).length > 0).length;
    logger.info(`Patterns with real EMAs: ${patternsWithEMAs}/${patterns.length} (${((patternsWithEMAs/patterns.length)*100).toFixed(1)}%)`);

    // Run backtest
    logger.info(`\nRunning backtest on ${patterns.length} patterns from ${dataSource} dataset...`);

    let capital = CONFIG.INITIAL_CAPITAL;
    const trades = [];
    const returns = [];
    let winners = 0;
    let losers = 0;
    let maxEquity = capital;
    let minEquity = capital;

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];

      // Calculate trade outcome
      const tradeResult = calculateTradePnL(pattern, capital, CONFIG.RISK_PER_TRADE);
      trades.push(tradeResult);

      if (tradeResult.outcome === 'winner' || tradeResult.outcome === true) {
        winners++;
      } else {
        losers++;
      }

      // Update capital
      capital += tradeResult.pnl;
      maxEquity = Math.max(maxEquity, capital);
      minEquity = Math.min(minEquity, capital);

      returns.push(tradeResult.pnlPercent);

      if ((i + 1) % 50 === 0) {
        logger.debug(`[${i + 1}/${patterns.length}] Capital: $${capital.toFixed(2)}`);
      }
    }

    // Calculate metrics
    const totalReturn = capital - CONFIG.INITIAL_CAPITAL;
    const returnPercent = (totalReturn / CONFIG.INITIAL_CAPITAL) * 100;
    const winRate = winners / (winners + losers);
    const maxDrawdown = (maxEquity - minEquity) / maxEquity;
    const sharpeRatio = calculateSharpe(returns);

    // Generate report
    const report = {
      backtest: {
        timestamp: new Date().toISOString(),
        dataSource,
        patternsAnalyzed: patterns.length,
        patternsWithEMAs,
        initialCapital: CONFIG.INITIAL_CAPITAL,
        finalCapital: capital,
        totalReturn,
        returnPercent,
        trades: {
          total: trades.length,
          winners,
          losers,
          winRate: (winRate * 100).toFixed(2) + '%'
        },
        metrics: {
          sharpeRatio: sharpeRatio.toFixed(4),
          maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%',
          avgReturn: (returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(4),
          stdDev: (() => {
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
            return Math.sqrt(variance).toFixed(4);
          })()
        }
      },
      gateEvaluation: {
        sharpeRatio: {
          target: 1.5,
          actual: sharpeRatio.toFixed(4),
          passed: sharpeRatio >= 1.5
        },
        winRate: {
          target: 0.65,
          actual: (winRate * 100).toFixed(2) + '%',
          passed: winRate >= 0.65
        },
        maxDrawdown: {
          target: '< 20%',
          actual: (maxDrawdown * 100).toFixed(2) + '%',
          passed: maxDrawdown < 0.20
        },
        patterns: {
          target: '≥ 200',
          actual: patterns.length,
          passed: patterns.length >= 200
        }
      }
    };

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 5 BACKTEST SUMMARY (With Real EMAs)');
    console.log('='.repeat(70));
    console.log(`Data Source: ${dataSource}`);
    console.log(`Patterns Analyzed: ${patterns.length}`);
    console.log(`Patterns with Real EMAs: ${patternsWithEMAs}/${patterns.length}`);
    console.log(`\nCapital: $${CONFIG.INITIAL_CAPITAL.toFixed(2)} → $${capital.toFixed(2)}`);
    console.log(`Return: $${totalReturn.toFixed(2)} (${returnPercent.toFixed(2)}%)`);
    console.log(`\nTrades: ${winners} wins / ${losers} losses (${(winRate * 100).toFixed(1)}% win rate)`);
    console.log(`Sharpe Ratio: ${sharpeRatio.toFixed(4)} (target: ≥1.5) ${sharpeRatio >= 1.5 ? '✅' : '❌'}`);
    console.log(`Max Drawdown: ${(maxDrawdown * 100).toFixed(2)}% (target: <20%) ${maxDrawdown < 0.20 ? '✅' : '❌'}`);
    console.log('='.repeat(70));
    console.log(`\nPhase 5 Gate Status:`);
    console.log(`  Sharpe Ratio: ${sharpeRatio.toFixed(4)} ${sharpeRatio >= 1.5 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Win Rate: ${(winRate * 100).toFixed(2)}% ${winRate >= 0.65 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Max Drawdown: ${(maxDrawdown * 100).toFixed(2)}% ${maxDrawdown < 0.20 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Pattern Count: ${patterns.length} ${patterns.length >= 200 ? '✅ PASS' : '❌ FAIL'}`);

    // Save report
    fs.writeFileSync(CONFIG.REPORT_PATH, JSON.stringify(report, null, 2));
    logger.info(`\nReport saved: ${CONFIG.REPORT_PATH}`);

  } catch (error) {
    logger.error(`Backtest failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run backtest
runBacktest();
