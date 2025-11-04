# Root Directory Structure Guide

**Last Updated**: November 3, 2025
**Purpose**: Document the clean root directory organization

## Root Level Files

### Core Documentation
- **README.md** — Project overview, quick start, key concepts
- **CLAUDE.md** — Development guidance, architecture, working instructions
- **CHANGELOG.md** — Version history and release notes
- **AGENTS.md** — Custom AI agent descriptions and capabilities
- **GEMINI.md** — Gemini AI context copy (for multi-AI collaboration)

### Configuration Files
- **.env** — Environment variables (TradingView credentials, settings)
- **.env.example** — Template for .env configuration
- **.gitignore** — Git ignore rules
- **jest.config.js** — Jest testing configuration
- **.babelrc.js** — Babel transpiler configuration

### Dependencies
- **package.json** — Node.js dependencies and scripts
- **package-lock.json** — Locked dependency versions

## Directory Structure

```
/
├── .claude/                          # AI agent configurations
├── .git/                             # Git version control
├── docs/                             # Documentation
│   ├── architecture/                 # Design and planning
│   ├── api/                          # API integration guides
│   ├── specification/                # Technical specifications
│   └── archive/                      # Historical session/phase docs
├── src/                              # Source code
│   ├── config/                       # Configuration
│   ├── core/                         # Core indicator logic
│   ├── data/                         # Data collection & features
│   ├── indicators/                   # Technical indicators
│   └── models/                       # ML models
├── scripts/                          # Utility scripts
│   ├── train-model.cjs               # Model training
│   ├── validate-features.js          # Feature validation
│   ├── collect-historical-data.js    # Data collection
│   ├── monitor-btcusdt.js            # BTC monitoring (archived)
│   └── test-connection.js            # Connection testing (archived)
├── tests/                            # Test suites
├── data/                             # Data files
│   ├── raw/                          # Raw historical data
│   ├── processed/                    # Normalized features
│   └── models/                       # Trained models
├── examples/                         # Example scripts
├── node_modules/                     # Dependencies
├── coverage/                         # Test coverage reports
├── logs/                             # Application logs
└── __mocks__/                        # Mock data for testing
```

## Archive Directory

**Location**: `/docs/archive/`
**Purpose**: Store historical phase completion documents

**Contents**:
- Phase 2 completion reports (4 files)
- Phase 3 handoff summary
- Phase 4 session summary
- Data collection reports
- Session closure checklists
- Setup documentation

**Access**: Reference these for historical context when needed

## Root Cleanup (Nov 3, 2025)

**Moved to archive** (11 files):
- All PHASE2-*.md files
- PHASE3-HANDOFF-SUMMARY.md
- PHASE4-SESSION-COMPLETE.md
- DATA-COLLECTION-REPORT.md
- SESSION-*.md files
- SETUP_COMPLETE.md

**Moved to scripts/** (2 files):
- monitor-btcusdt.js
- test-connection.js

**Benefit**: Cleaner root directory, focused on active development
**Discoverability**: Archive docs available in `/docs/archive/` if needed

## File Naming Conventions

### Root Level
- **README.md** — Project overview
- **CLAUDE.md** — AI development guidance
- **CHANGELOG.md** — Version history

### Documentation (docs/)
- **[Component]-guide.md** — How-to guides
- **[Component]-specification.md** — Technical specs
- **[Component]-report.md** — Analysis/completion reports
- **[Component]-PHASE*.md** — Phase-specific documentation

### Scripts (scripts/)
- **[action]-[target].js** — Utility scripts (e.g., train-model.js)

### Source Code (src/)
- **[module].js** — Module implementation
- **[module].test.js** — Unit tests

## Quick Navigation

**Getting Started**:
- Read `README.md` for project overview
- Check `CLAUDE.md` for development guidance
- Review `docs/specification/` for technical details

**Development**:
- Implementation: `src/`
- Tests: `tests/`
- Examples: `examples/`
- Utilities: `scripts/`

**Data & Models**:
- Data files: `data/raw/` and `data/processed/`
- Trained models: `data/models/`

**Historical Reference**:
- Phase documentation: `docs/archive/`
- Version history: `CHANGELOG.md`

## Maintenance

**When adding new files**:
1. Core code → `src/[module]/`
2. Utility scripts → `scripts/[name].js`
3. Documentation → `docs/[category]/[name].md`
4. Tests → `tests/[name].test.js`
5. Historical docs → `docs/archive/` (when phase complete)

**When cleaning up**:
- Move completed phase docs to `docs/archive/`
- Remove generated files (logs, coverage)
- Keep root focused on active development

---

**Status**: Root directory cleaned and organized
**Last Action**: Nov 3, 2025 — Archived 11 historical files, moved 2 scripts
