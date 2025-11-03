# Agent Deployment Quick Start Guide

**Purpose**: Fast reference for deploying specialized agents to handle project phases 4-7.

---

## Current Agent Status

### ✅ Already Configured (In Use)
1. **gecko-trading-pm** — Project manager (active)
2. **gecko-data-collector** — Data pipeline (active)
3. **gecko-doc-writer** — Technical writer (partial)

### ⏳ Ready to Deploy (Phases 4-7)
4. **gecko-model-trainer** — Phase 4 (Model Training)
5. **gecko-feature-analyst** — Phase 3-4 (Feature Analysis)
6. **gecko-backtester** — Phase 5 (Backtesting)
7. **gecko-deployment-ops** — Phase 6-7 (Production)

---

## Deployment Checklist

### Phase 4 Deployment (Dec 8, 2025)

**Before Starting Phase 4**:

```bash
# 1. Verify Phase 3 completion
✅ FeatureEngineer module complete
✅ 35 tests passing
✅ 96.89% code coverage
✅ Feature engineering documentation complete

# 2. Activate agents
- gecko-trading-pm (already active)
- gecko-data-collector (already active)
- gecko-model-trainer (NEW - activate below)
- gecko-feature-analyst (NEW - activate below)
- gecko-doc-writer (already active)

# 3. Prepare data
- 6+ months historical OHLCV data ready
- Multi-timeframe synchronization verified
- Indicator parity confirmed (±0.01% with TradingView)
```

**Activate gecko-model-trainer**:

```
Command: /agents create gecko-model-trainer

Prompt:
"You are the ML Engineer for the Gecko ML Indicator project.
Your focus is Phase 4: Model Training (Dec 8-26, 2025).

Responsibilities:
1. Design TensorFlow.js neural network architecture
2. Implement training pipeline with validation
3. Tune hyperparameters for optimal performance
4. Evaluate model (accuracy, AUC, F1 score)
5. Prevent overfitting (dropout, regularization)
6. Serialize trained model for inference

Input: 62 normalized features from FeatureEngineer
Output: Trained TensorFlow.js model

Phase 4 Success Criteria:
- Validation accuracy ≥ 70%
- Test AUC ≥ 0.75%
- Inference latency < 50ms
- Model reproducible from saved weights

Refer to: /docs/guides/FEATURE-ENGINEERING.md for feature specs
Refer to: /CLAUDE.md for Phase 4 requirements"

Tokens: 15-20k
Schedule: Dec 8-26, 2025
```

**Activate gecko-feature-analyst**:

```
Command: /agents create gecko-feature-analyst

Prompt:
"You are the Analytics Engineer for the Gecko ML Indicator.
Your focus is feature analysis in Phases 3-4.

Responsibilities:
1. Analyze feature importance from trained models
2. Identify redundant or correlated features
3. Recommend feature optimization
4. Profile feature extraction performance
5. Document feature interactions

Input: 62 features, training dataset, trained model weights
Output: Feature importance rankings, optimization recommendations

Success Criteria:
- Top 10 important features identified
- Redundant features flagged
- Feature optimization recommendations made
- Statistical analysis complete

Refer to: /docs/guides/FEATURE-ENGINEERING.md for feature specs"

Tokens: 10-15k
Schedule: Dec 8-20, 2025 (parallel with training)
```

---

### Phase 5 Deployment (Dec 27, 2025)

**Before Starting Phase 5**:

```bash
# 1. Verify Phase 4 completion
✅ Model trained and validated
✅ Accuracy ≥ 70%
✅ AUC ≥ 0.75
✅ Model serialized

# 2. Prepare for backtesting
- Historical data for 6+ months ready
- Trading rules defined
- Risk metrics targets set

# 3. Activate backtester
```

**Activate gecko-backtester**:

```
Command: /agents create gecko-backtester

Prompt:
"You are the Backtesting Specialist for Gecko ML Indicator.
Your focus is Phase 5: Backtesting (Dec 27 - Jan 9, 2026).

Responsibilities:
1. Implement walk-forward backtesting framework
2. Simulate trades based on model signals
3. Calculate risk metrics (Sharpe, max drawdown, win rate)
4. Detect curve fitting (Monte Carlo analysis)
5. Generate comprehensive backtest reports
6. Model slippage and commission costs

Input: Trained model, 6+ months historical data, trading rules
Output: Backtest results, risk metrics, trade logs

Phase 5 Success Criteria:
- Sharpe ratio ≥ 1.5
- Win rate ≥ 65%
- Max drawdown < 20%
- Consistent across multiple symbols

Symbols to test:
- BTCUSDT, ETHUSDT, EURUSD, GBPUSD, SPY

Refer to: /CLAUDE.md for Phase 5 requirements"

Tokens: 25-30k
Schedule: Dec 27 - Jan 9, 2026
```

---

### Phase 6 Deployment (Jan 10, 2026)

**Before Starting Phase 6**:

```bash
# 1. Verify Phase 5 completion
✅ Backtest Sharpe ≥ 1.5
✅ Backtest win rate ≥ 65%
✅ Model generalizes (no curve fitting)

# 2. Prepare production environment
- Server infrastructure ready
- Real-time data feed available
- Monitoring stack configured

# 3. Activate deployment agent
```

**Activate gecko-deployment-ops**:

```
Command: /agents create gecko-deployment-ops

Prompt:
"You are the DevOps Engineer for Gecko ML Indicator.
Your focus is Phase 6-7: Deployment & Production (Jan 10 - Feb 3, 2026).

Responsibilities:
1. Deploy TensorFlow.js model to production
2. Implement real-time inference server (Node.js/Express)
3. Handle multi-symbol streaming data
4. Generate trading signals from predictions
5. Monitor model and system performance
6. Set up alerting (Slack, email, webhooks)
7. Manage paper trading validation
8. Implement error handling and recovery

Input: Trained model, real-time market data, trading config
Output: Trading signals, alerts, monitoring data

Phase 6-7 Success Criteria:
- Inference latency < 50ms
- 99%+ system uptime
- Accurate signal generation
- Paper trading validated
- Comprehensive monitoring in place

Symbols to deploy:
- BTCUSDT, ETHUSDT, EURUSD, GBPUSD, SPY

Refer to: /CLAUDE.md for Phase 6-7 requirements"

Tokens: 20-25k
Schedule: Jan 10 - Feb 3, 2026
```

---

## Agent Communication Protocol

### How to Delegate Work

**Format**:
```
User → gecko-trading-pm (coordinator)
        ↓
        Delegates to specialized agents:
        ├→ gecko-model-trainer (Phase 4)
        ├→ gecko-feature-analyst (Phase 3-4)
        ├→ gecko-backtester (Phase 5)
        ├→ gecko-deployment-ops (Phase 6-7)
        ├→ gecko-data-collector (all phases)
        └→ gecko-doc-writer (all phases)
        ↓
Results consolidated and reported to user
```

**Example**:
```
User: "Let's start Phase 4. We have 6 months of data ready."

→ gecko-trading-pm:
  1. Creates Phase 4 sprint plan (4 weeks)
  2. Breaks into weekly tasks
  3. Assigns to gecko-model-trainer (primary)
  4. Assigns to gecko-feature-analyst (secondary)
  5. Assigns to gecko-doc-writer (documentation)
  6. Sets success criteria and milestones

→ gecko-model-trainer:
  1. Designs network (64-32 units, dropout 0.2)
  2. Trains on data
  3. Validates: 72% accuracy, 0.76 AUC
  4. Reports results

→ gecko-feature-analyst:
  1. Analyzes trained model
  2. Ranks features by importance
  3. Identifies redundancy
  4. Recommends optimizations

→ gecko-doc-writer:
  1. Documents model architecture
  2. Creates training guide
  3. Writes performance report
  4. Creates inference examples

→ gecko-trading-pm:
  1. Verifies all gates passed
  2. Approves Phase 5 start
  3. Updates project timeline
```

---

## Quick Reference: What Each Agent Does

| Agent | Primary Phase | Key Tasks | Success Metric |
|-------|---------------|-----------|---|
| **gecko-trading-pm** | All | Plan, coordinate, track milestones | On-time phase completion |
| **gecko-data-collector** | 2-5 | Collect data, validate quality | 6+ months clean data |
| **gecko-model-trainer** | 4 | Design & train neural network | 70% accuracy, 0.75 AUC |
| **gecko-feature-analyst** | 3-4 | Analyze feature importance | Top 10 features identified |
| **gecko-backtester** | 5 | Validate model historically | Sharpe ≥ 1.5, Win rate ≥ 65% |
| **gecko-deployment-ops** | 6-7 | Deploy to production | <50ms latency, 99%+ uptime |
| **gecko-doc-writer** | All | Create documentation | Comprehensive guides & examples |

---

## Token Budget Allocation

**Total Budget**: ~200k tokens/session

**Phase 4 Allocation** (Dec 8-26):
- gecko-trading-pm: 15k (coordination)
- gecko-data-collector: 25k (finalize dataset)
- gecko-model-trainer: 35k (intensive training)
- gecko-feature-analyst: 15k (analysis)
- gecko-doc-writer: 15k (documentation)
- **Reserve**: 30k (contingency)
- **Free space**: 50k (buffer)

**Phase 5 Allocation** (Dec 27 - Jan 9):
- gecko-trading-pm: 15k
- gecko-backtester: 40k (simulations)
- gecko-doc-writer: 10k
- **Reserve**: 30k
- **Free space**: 75k

**Phase 6 Allocation** (Jan 10-23):
- gecko-trading-pm: 15k
- gecko-deployment-ops: 40k (production setup)
- gecko-doc-writer: 10k
- gecko-backtester: 10k (paper trading)
- **Reserve**: 30k
- **Free space**: 75k

---

## Parallel Execution Strategy

**To maximize efficiency, run agents in parallel**:

```
Week 1-2 of Phase 4 (Dec 8-21):
├─ gecko-data-collector: Finalize dataset
├─ gecko-model-trainer: Design architecture
├─ gecko-feature-analyst: Analyze feature importance
└─ gecko-doc-writer: Create training guide

Week 3-4 of Phase 4 (Dec 22-Jan 2):
├─ gecko-model-trainer: Train models
├─ gecko-feature-analyst: Optimize features
└─ gecko-doc-writer: Document results

Week 1 of Phase 5 (Jan 3-9):
├─ gecko-backtester: Run walk-forward analysis
├─ gecko-deployment-ops: Prepare production
└─ gecko-doc-writer: Create backtest report
```

**Benefit**: Reduces Phase 4 from sequential 4 weeks to ~2 weeks effective time.

---

## Monitoring Agent Health

### Check Agent Status

```bash
# Verify all agents active
/agents list

# Check active agents:
- gecko-trading-pm ✅
- gecko-data-collector ✅
- gecko-model-trainer ✅
- gecko-feature-analyst ✅
- gecko-doc-writer ✅
- gecko-backtester ⏳ (Phase 5)
- gecko-deployment-ops ⏳ (Phase 6)
```

### Redirect Work if Bottleneck

**If gecko-model-trainer overloaded**:
```
→ Assign gecko-feature-analyst to do more work
→ Create sub-tasks for gecko-doc-writer
→ Delegate to gecko-trading-pm for load balancing
```

**If gecko-data-collector slow**:
```
→ Cache partial results
→ Run in parallel batches
→ Use gecko-backtester for synthetic data testing
```

---

## Common Pitfalls to Avoid

### ❌ Don't
- Overload single agent with all work
- Skip intermediate validations
- Ignore blockers/dependencies
- Change scopes mid-phase
- Skip documentation
- Forget to reserve tokens

### ✅ Do
- Distribute work across agents
- Verify gates before phase transitions
- Surface blockers immediately
- Keep phases focused and scoped
- Document everything
- Monitor token usage carefully

---

## Success Indicators

### Phase 4 Success
```
✅ Model trained with ≥70% accuracy
✅ AUC ≥0.75 on test set
✅ Inference latency <50ms
✅ All documentation complete
✅ Feature analysis done
✅ On schedule (Dec 8-26)
```

### Phase 5 Success
```
✅ Sharpe ratio ≥1.5
✅ Win rate ≥65%
✅ Max drawdown <20%
✅ Consistent across symbols
✅ On schedule (Dec 27 - Jan 9)
```

### Phase 6-7 Success
```
✅ Production operational
✅ <50ms inference latency
✅ 99%+ uptime
✅ Paper trading validated
✅ Monitoring in place
✅ On schedule (Jan 10 - Feb 3)
```

---

## Contact & Escalation

**For Phase 4 Questions**:
- Model architecture → gecko-model-trainer
- Feature issues → gecko-feature-analyst
- Data problems → gecko-data-collector
- Documentation gaps → gecko-doc-writer
- Overall coordination → gecko-trading-pm

**For Blockers**:
→ Escalate to gecko-trading-pm immediately
→ Will coordinate team response
→ Surface to user for decision

---

## Next Steps

1. **Review** `/docs/AGENT-LIST.md` for detailed descriptions
2. **Bookmark** this quick-start guide
3. **Pre-Phase-4**: Dec 8 activation checklist
4. **Monitor** agent status weekly
5. **Escalate** blockers immediately

---

**Document Status**: Ready to Use
**Last Updated**: November 3, 2025
**Next Review**: December 1, 2025 (pre-Phase 4)
