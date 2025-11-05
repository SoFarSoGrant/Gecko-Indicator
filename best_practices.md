# Gecko Indicator Best Practices

## Purpose
- Provide a single reference for the system's architecture, technology stack, and engineering standards.
- Ensure every contribution reinforces consistency, scalability, performance, and reliability targets.

## Project Structure Overview
- **Core Application (`src/`)**  
  - `config/`: Central environment loading and validation (`src/config/index.js`).  
  - `core/`: Orchestration layer; `GeckoIndicator` coordinates trend detection, pattern detection, feature engineering, and ML inference (`src/core/gecko-indicator.js`).  
  - `data/`: Market data ingestion, normalization, and feature engineering modules.  
  - `indicators/`: Technical analysis components, including COMA trend logic and Gecko pattern detection.  
  - `models/`: TensorFlow.js predictor, model loading, and inference utilities.  
  - `index.js`: Application entry point that wires logging, configuration, and long-running services.
- **Automation & Tooling (`scripts/`)**  
  - Operational scripts for data collection, backtests, training, and validation. Prefer script usage over ad-hoc commands.
- **Testing (`tests/`, `__mocks__/`)**  
  - Comprehensive Jest suites with TradingView mocks. Keep unit, integration, and regression tests co-located with related modules.
- **Documentation (`docs/`)**  
  - Architecture, API integration, specifications, and historical reports. Archive completed phase docs in `docs/archive/` to keep active guidance discoverable.
- **Data Assets (`data/`)**  
  - `raw/`, `processed/`, `models/` for lifecycle management. Treat contents as generated artifacts; never hard-code secrets into data files.
- **Supporting Resources**  
  - `logs/` for Winston output, `coverage/` for Jest reports, `examples/` for minimal flows.

## Technology Stack
- **Runtime & Language**: Node.js >=18 with ECMAScript modules; optional Babel transpilation for tooling parity.
- **Core Libraries**:
  1. `@mathieuc/tradingview` (API client, WebSocket streaming, replay mode)
  2. `@tensorflow/tfjs` and `@tensorflow/tfjs-node` (model definition, training, inference)
  3. `winston` (structured logging), `dotenv` (config loading), `axios` (HTTP utilities)
- **Optional Services**: `pg` for PostgreSQL persistence, `redis` for caching/backpressure control.
- **Quality & Tooling**:
  - `jest` for tests, `eslint` for static analysis, `prettier` for formatting, `nodemon` for dev live reload.
  - Scripts exposed via `npm` (`collect:data`, `train:model`, `backtest`, `validate:env`) form the operational command surface.

## Technical Standards
- **Architecture Principles**
  1. Maintain clear separation of concerns between data ingestion, signal processing, ML operations, and orchestration layers.
  2. Keep multi-timeframe coordination deterministic: LF/MF/HF data must be synchronized before analysis; surface explicit validation errors when data skew is detected.
  3. Treat the system as event-driven; prefer asynchronous handlers and queues over blocking loops for streaming workloads.
- **Configuration & Secrets**
  - Use `.env` only for non-committed secrets; validate with `npm run validate:env` before runtime.
  - Default values belong in `src/config/index.js`; avoid duplicating configuration logic in downstream modules.
- **Data Management**
  - Persist raw market data exactly as received; derived artifacts (features, labels, models) must record provenance metadata (symbol, timeframe, generation timestamp).
  - Avoid synchronous filesystem writes in streaming paths; batch or offload heavy I/O to worker jobs.
- **Model Lifecycle**
  - Version models via `data/models/` subdirectories; include manifest files capturing training dataset hashes, hyperparameters, and evaluation metrics.
  - Enforce win-rate and Sharpe thresholds before promoting a model to production usage.
- **Performance & Scalability**
  - Short-lived services (scripts) should exit cleanly and dispose tensors to prevent memory leaks.
  - For long-running processes, monitor latency budgets: data ingestion <250 ms per event, ML inference <10 ms per pattern (current benchmark).
  - Use Redis or in-memory caches when replaying large datasets; respect TradingView rate limits with backoff strategies.
- **Observability & Reliability**
  - Leverage Winston JSON logs for machine consumption; maintain separate transports for errors vs combined output (`src/index.js`).
  - Propagate structured error objects; never swallow exceptions-log and rethrow unless explicitly handled.
  - Instrument key pipelines (data collection, feature engineering, model inference) with counters and timings to aid alerting.
- **Security**
  - Never log raw cookies, secrets, or personally identifiable information.
  - Audit third-party dependencies quarterly; pin versions and record upgrades in `CHANGELOG.md`.

## Coding Standards
- **General Style**
  - Follow ESLint defaults for Node.js with Prettier formatting; run `npm run lint` and `npm run format` before commits.
  - Prefer modern language features (optional chaining, `async/await`, object destructuring) to keep code expressive and concise.
  - Maintain concise, descriptive function names; avoid abbreviations unless industry-standard (EMA, ATR, COMA).
  - Use upper camel case for classes (`GeckoIndicator`), lower camel case for variables/functions, SCREAMING_SNAKE_CASE for constants.
- **Modularity**
  - Export a single class or factory per file where possible; group related helper functions under internal modules.
  - When a module exceeds ~300 lines, evaluate splitting into cohesive units to preserve readability.
- **Documentation & Comments**
  - Provide JSDoc headers for public classes and methods, including parameter/return types; align with existing conventions in `src/core/gecko-indicator.js`.
  - Reserve inline comments for non-obvious logic (e.g., trading heuristics, numerical stability safeguards).
- **Error Handling**
  - Always surface contextual metadata (symbol, timeframe, operation) in error messages.
  - Convert external library errors into domain-specific exceptions before propagating to the core.
- **Testing**
  - Require Jest coverage for every new module; mimic the approach used in `tests/` leveraging mocks from `__mocks__/`.
  - For streaming and async workflows, prefer deterministic fixtures over network calls; gate integration tests that require credentials.
  - Update or add regression tests whenever fixing bugs or altering model features.
- **Git Workflow**
  - Branch per feature/fix; rebase frequently to avoid divergence.
  - Capture meaningful summaries in `CHANGELOG.md` for notable changes (infrastructure, data pipeline, model upgrades).
- **Tooling Discipline**
  - Run `npm run validate:env` prior to starting long-running jobs.
  - Capture performance baselines before and after significant refactors (feature engineering, model architecture changes).

## Continuous Improvement Checklist
- [ ] Project structure changes documented in `ROOT_DIRECTORY_STRUCTURE.md`.
- [ ] New technologies evaluated for compatibility with Node.js 18 runtime and TensorFlow.js ecosystem.
- [ ] Coding standards revisited quarterly to incorporate lessons from production usage.
- [ ] Performance, reliability, and win-rate targets tracked and reported in phase completion documents.
- [ ] Security posture (dependencies, secrets handling, data retention) reviewed after each major release.

Adhering to these practices preserves the integrity of the Gecko Indicator platform while enabling rapid iteration on data, modeling, and trading logic.
