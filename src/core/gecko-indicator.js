/**
 * Gecko Indicator Core Module
 *
 * Main orchestrator for the Gecko pattern detection system.
 * Coordinates multi-timeframe analysis, pattern detection, and signal generation.
 *
 * @module src/core/gecko-indicator
 */

import { TrendDetector } from '../indicators/trend-detector.js';
import { GeckoPatternDetector } from '../indicators/pattern-detector.js';
import { FeatureEngineer } from '../data/feature-engineer.js';
import { ModelPredictor } from '../models/predictor.js';

export class GeckoIndicator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isInitialized = false;
    this.trendDetector = null;
    this.patternDetector = null;
    this.featureEngineer = null;
    this.modelPredictor = null;
    this.detectedPatterns = [];
    this.tradingSignals = [];
  }

  /**
   * Initialize the Gecko Indicator system
   */
  async initialize() {
    try {
      this.logger.info('Initializing Gecko Indicator Core');

      // Initialize components
      this.trendDetector = new TrendDetector(this.config, this.logger);
      this.patternDetector = new GeckoPatternDetector(this.config, this.logger);
      this.featureEngineer = new FeatureEngineer(this.config, this.logger);
      this.modelPredictor = new ModelPredictor(this.config, this.logger);

      // Load pre-trained model if available
      await this.modelPredictor.loadModel();

      this.isInitialized = true;
      this.logger.info('Gecko Indicator Core initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Gecko Indicator Core:', error);
      throw error;
    }
  }

  /**
   * Analyze a symbol across multiple timeframes
   *
   * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
   * @param {Object} multiTimeframeData - Data for LF, MF, HF
   * @returns {Promise<Object>} Analysis result with patterns and signals
   */
  async analyzeSymbol(symbol, multiTimeframeData) {
    if (!this.isInitialized) {
      throw new Error('GeckoIndicator not initialized');
    }

    try {
      // Step 1: Detect High Frame (HF) trend
      const hfTrendAnalysis = await this.trendDetector.detectTrend(
        symbol,
        multiTimeframeData.highFrame
      );

      if (!hfTrendAnalysis.confirmed) {
        this.logger.debug(`No confirmed HF trend for ${symbol}`);
        return {
          symbol,
          timestamp: new Date(),
          hfTrend: hfTrendAnalysis,
          geckoPatterns: [],
          tradingSignals: [],
        };
      }

      this.logger.info(`HF Trend confirmed for ${symbol}: ${hfTrendAnalysis.direction}`);

      // Step 2: Detect Gecko patterns on Low Frame (LF)
      const geckoPatterns = await this.patternDetector.detectPatterns(
        symbol,
        multiTimeframeData.lowFrame,
        hfTrendAnalysis
      );

      // Step 3: Feature engineering for detected patterns
      const engineeredFeatures = [];
      for (const pattern of geckoPatterns) {
        const features = await this.featureEngineer.engineerFeatures(
          symbol,
          pattern,
          multiTimeframeData
        );
        engineeredFeatures.push({ pattern, features });
      }

      // Step 4: ML model prediction for pattern quality
      const predictedPatterns = [];
      for (const { pattern, features } of engineeredFeatures) {
        const prediction = await this.modelPredictor.predictPattern(features);
        if (prediction.confidence >= this.config.model.minConfidence) {
          predictedPatterns.push({
            ...pattern,
            mlConfidence: prediction.confidence,
            mlScore: prediction.score,
            recommendation: prediction.recommendation,
          });
        }
      }

      // Step 5: Generate trading signals
      const signals = this.generateSignals(symbol, predictedPatterns, hfTrendAnalysis);

      return {
        symbol,
        timestamp: new Date(),
        hfTrend: hfTrendAnalysis,
        geckoPatterns: predictedPatterns,
        tradingSignals: signals,
      };
    } catch (error) {
      this.logger.error(`Error analyzing ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Generate trading signals from detected and validated patterns
   *
   * @param {string} symbol - Trading symbol
   * @param {Array} patterns - Validated Gecko patterns
   * @param {Object} hfTrend - High Frame trend analysis
   * @returns {Array} Trading signals
   */
  generateSignals(symbol, patterns, hfTrend) {
    const signals = [];

    for (const pattern of patterns) {
      const signal = {
        id: `${symbol}_${pattern.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        timestamp: new Date(),
        patternType: 'GECKO_CONSOLIDATION_BREAKOUT',
        direction: hfTrend.direction === 'UP' ? 'LONG' : 'SHORT',
        confidence: pattern.mlConfidence,
        entryPrice: pattern.entry,
        stopLoss: pattern.stopLoss,
        targetPrice: pattern.target,
        riskReward: pattern.riskReward,
        patternDetails: {
          momentumMove: pattern.momentumMove,
          consolidationBars: pattern.consolidationBars,
          testBar: pattern.testBar,
          hook: pattern.hook,
        },
        metadata: {
          hfTrendConfirmed: hfTrend.confirmed,
          hfTrendBars: hfTrend.barsInCOMA,
          mlScore: pattern.mlScore,
          recommendation: pattern.recommendation,
        },
      };

      signals.push(signal);
      this.tradingSignals.push(signal);
    }

    return signals;
  }

  /**
   * Get recent detected patterns
   *
   * @param {number} limit - Maximum number of patterns to return
   * @returns {Array} Recent patterns
   */
  getRecentPatterns(limit = 10) {
    return this.detectedPatterns.slice(-limit);
  }

  /**
   * Get recent trading signals
   *
   * @param {number} limit - Maximum number of signals to return
   * @returns {Array} Recent signals
   */
  getRecentSignals(limit = 10) {
    return this.tradingSignals.slice(-limit);
  }

  /**
   * Get system statistics
   *
   * @returns {Object} System stats
   */
  getStatistics() {
    return {
      isInitialized: this.isInitialized,
      totalPatternsDetected: this.detectedPatterns.length,
      totalSignalsGenerated: this.tradingSignals.length,
      averagePatternConfidence: this.calculateAverageConfidence(),
      upcomingExpirations: this.getUpcomingExpirations(),
    };
  }

  /**
   * Calculate average ML confidence across all signals
   *
   * @returns {number} Average confidence (0-1)
   */
  calculateAverageConfidence() {
    if (this.tradingSignals.length === 0) return 0;
    const sum = this.tradingSignals.reduce((acc, s) => acc + s.confidence, 0);
    return sum / this.tradingSignals.length;
  }

  /**
   * Get signals that are about to expire
   *
   * @returns {Array} Expiring signals
   */
  getUpcomingExpirations() {
    const now = new Date();
    const expirationWindow = 24 * 60 * 60 * 1000; // 24 hours
    return this.tradingSignals.filter(signal => {
      const age = now - signal.timestamp;
      return age < expirationWindow;
    });
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Gecko Indicator');
      // Cleanup logic here
      this.isInitialized = false;
      this.logger.info('Gecko Indicator shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }
}
