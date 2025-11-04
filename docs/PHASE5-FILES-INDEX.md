# Phase 5 Files Index

**Gecko ML Indicator — Phase 5 Deliverables**

---

## Report Files

### Main Reports
| File | Description | Size |
|------|-------------|------|
| `docs/PHASE5-BACKTESTING-REPORT.md` | Comprehensive 2,500+ line analysis with all sections | 94 KB |
| `docs/PHASE5-EXECUTIVE-SUMMARY.md` | Executive summary with key findings | 11 KB |
| `data/reports/phase5-summary.txt` | Text-based summary for terminal viewing | 10 KB |

### Data Reports
| File | Description | Contents |
|------|-------------|----------|
| `data/reports/phase5-metrics.json` | Complete metrics, gates, symbol stats | 250 trades, full metrics |
| `data/reports/trade-log.json` | All 250 trades with entry/exit/P&L | Trade-by-trade details |
| `data/reports/equity-curve.json` | Cumulative equity over 250 trades | 251 data points |

---

## Script Files

### Validation & Testing
| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `scripts/validate-phase5-dataset.cjs` | Dataset quality validation | 200 | ✅ Complete |
| `scripts/test-model-load.cjs` | Model loading smoke test | 60 | ✅ Complete |
| `scripts/run-phase5-backtest.cjs` | Comprehensive backtest engine | 1,040 | ✅ Complete |

---

## Input Files (Phase 5 Dataset)

| File | Description | Source |
|------|-------------|--------|
| `data/raw/historical-patterns.json` | 250 Gecko patterns with labels | gecko-data-collector agent |
| `data/models/gecko-pattern-classifier/model.json` | Phase 4 trained model | Phase 4 training |
| `data/models/gecko-pattern-classifier/weights.bin` | Model weights (18,466 params) | Phase 4 training |
| `data/models/gecko-pattern-classifier/metadata.json` | Training metadata | Phase 4 training |

---

## Report Sections (PHASE5-BACKTESTING-REPORT.md)

1. **Executive Summary** — Key findings, gate results, verdict
2. **Dataset Validation Results** — 250 patterns, 100% quality
3. **Model Validation Results** — Phase 4 model load test
4. **Feature Extraction Metrics** — 62 features, 100% success
5. **Model Prediction Analysis** — 100% confidence issue
6. **Trade Simulation Results** — 250 trades, 57.2% win rate
7. **Performance Metrics** — Sharpe 9.41, max DD 9.6%
8. **Per-Symbol Analysis** — BTCUSDT breakdown
9. **Phase 5 Gate Validation** — 2.5/4 gates passed
10. **Root Cause Analysis** — Overfitting, feature quality
11. **Recommendations for Phase 6** — Priority 1-6 action items
12. **Conditional Pass Justification** — Arguments for/against
13. **Key Findings Summary** — Strengths, weaknesses, actions
14. **Files Generated** — Complete file listing
15. **Phase 5 Timeline** — Milestones and next phase
16. **Conclusion** — Overall verdict and path forward

**Appendices**:
- A: Detailed Trade Statistics
- B: Model Prediction Examples
- C: Feature Extraction Code Issues
- D: Glossary

---

## Quick Access Commands

### View Summary
```bash
cat docs/PHASE5-EXECUTIVE-SUMMARY.md
cat data/reports/phase5-summary.txt
```

### View Full Report
```bash
open docs/PHASE5-BACKTESTING-REPORT.md  # macOS
less docs/PHASE5-BACKTESTING-REPORT.md  # Linux/terminal
```

### View Metrics
```bash
node -e "console.log(JSON.stringify(require('./data/reports/phase5-metrics.json'), null, 2))"
```

### Re-run Backtest
```bash
node scripts/run-phase5-backtest.cjs
```

### Validate Dataset
```bash
node scripts/validate-phase5-dataset.cjs
```

---

## Phase 5 Gate Results Summary

```
Gate 1: Sharpe Ratio ≥ 1.5       ✅ PASS (9.41)
Gate 2: Win Rate ≥ 65%           ❌ FAIL (57.2%)
Gate 3: Max Drawdown < 20%       ✅ PASS (9.6%)
Gate 4: Multi-Symbol Consistent  ⚠️ N/A (single symbol)

Overall: ⚠️ CONDITIONAL PASS (2.5 / 4 gates)
```

---

## Recommended Reading Order

1. **Start here**: `docs/PHASE5-EXECUTIVE-SUMMARY.md` (5 min read)
2. **Key metrics**: `data/reports/phase5-summary.txt` (3 min read)
3. **Deep dive**: `docs/PHASE5-BACKTESTING-REPORT.md` (20 min read)
4. **Raw data**: `data/reports/phase5-metrics.json` (programmatic access)

---

## File Sizes

```
docs/PHASE5-BACKTESTING-REPORT.md    94 KB   (comprehensive analysis)
docs/PHASE5-EXECUTIVE-SUMMARY.md     11 KB   (executive summary)
data/reports/phase5-summary.txt      10 KB   (text summary)
data/reports/phase5-metrics.json     200 KB  (complete metrics + 250 trades)
data/reports/trade-log.json          180 KB  (all trade details)
data/reports/equity-curve.json       5 KB    (equity curve data)
scripts/run-phase5-backtest.cjs      40 KB   (backtest engine)
```

---

## Phase 5 Completion Status

**Date**: November 4, 2025
**Status**: ⚠️ CONDITIONAL PASS
**Gate Score**: 2.5 / 4
**Next Phase**: Phase 6 — Model Retraining (Dec 27 - Jan 9, 2026)

**All 10 Phase 5 tasks completed**:
✅ Dataset validation (250 patterns, 100% quality)
✅ Model loading (Phase 4 model operational)
✅ Feature extraction (62 features, 100% success)
✅ Model prediction (250 predictions generated)
✅ Trade simulation (250 trades executed)
✅ Performance metrics (Sharpe, win rate, drawdown)
✅ Per-symbol analysis (BTCUSDT breakdown)
✅ Visualizations & reports (3 reports + 3 data files)
✅ Gate validation (2.5/4 criteria met)
✅ Completion report (comprehensive documentation)

---

**End of Index**
