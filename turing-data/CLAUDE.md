# Interview Prep Project

## Overview
Static HTML interview guide for Turing DevOps position (Pulumi + TypeScript).

## Structure
```
turing-interview-prep/
├── index.html              # Main application (2,900+ lines)
├── assets/                 # CSS and JS used by index.html
│   ├── css/
│   └── js/
├── content/                # Reference markdown files
│   ├── TURING_INTERVIEW_GUIDE.md
│   ├── TURING_JOB_DESCRIPTION.md
│   └── PULUMI_*.md
├── tests/                  # Playwright test suite
│   ├── test-config.js      # Shared path configuration
│   ├── specs/              # Test specifications (5 files)
│   └── utils/              # Test utilities (4 files)
└── test-output/            # Test results (generated)
```

## Test Commands
```bash
npm test              # Run all Playwright tests
npm run test:headed   # Run tests with browser visible
npm run test:report   # View HTML test report
```

## Playwright Configuration
- Test directory: `tests/`
- Workers: 10 (parallel test execution)
- Trace: Only on failure
- Screenshots: Only on failure
- Uses file:// URLs for testing (no web server required)

## Key Features
- 18 technical interview questions with answers
- Syntax-highlighted code examples (30+)
- Dark/light mode toggle
- Full-text search with highlighting
- Copy code buttons
- Mobile responsive design
- Progress tracking
