/**
 * Mock TradingView-API for testing
 * Provides stub implementations for DataCollector tests
 */

export class TradingView {
  constructor(config) {
    this.session = config.session;
    this.signature = config.signature;
  }

  async getChart(options) {
    return new Chart(options);
  }
}

export class Chart {
  constructor(options) {
    this.symbol = options.symbol;
    this.timeframe = options.timeframe;
    this.periods = [];
    this.readyCallback = null;
    this.updateCallback = null;
    this.errorCallback = null;

    // Simulate chart ready after a short delay
    setTimeout(() => {
      if (this.readyCallback) {
        this.readyCallback();
      }
    }, 100);
  }

  onReady(callback) {
    this.readyCallback = callback;
  }

  onUpdate(callback) {
    this.updateCallback = callback;
  }

  onError(callback) {
    this.errorCallback = callback;
  }

  disconnect() {
    // No-op
  }

  startReplay(timestamp) {
    // No-op
  }

  stopReplay() {
    // No-op
  }

  replayTo(timestamp) {
    // No-op
  }
}

export class BuiltInIndicator {
  constructor(options, chart) {
    this.options = options;
    this.chart = chart;
    this.periods = [];
  }
}

export class BuiltInStudy extends BuiltInIndicator {
  constructor(options, chart) {
    super(options, chart);
  }
}
