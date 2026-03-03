# Tests

Playwright test suite for the Interview Preparation Guide.

## Structure

```
tests/
├── test-config.js      # Shared config with dynamic paths
├── specs/              # Playwright test specifications (5 files)
└── utils/              # Standalone utility scripts (4 files)
```

## Spec Files

| File | Purpose |
|------|---------|
| `extreme-test.spec.js` | Comprehensive test - validates all 18 questions, 30+ code blocks |
| `test-search.spec.js` | Search functionality with highlighting, filtering |
| `test-copy-buttons.spec.js` | Copy button functionality and feedback |
| `test-responsive.spec.js` | Mobile/tablet responsive design tests |
| `quick-parallel-test.spec.js` | Fast smoke tests for CI |

## Utility Scripts

| File | Purpose | Usage |
|------|---------|-------|
| `final-check.js` | Comprehensive verification using JSDOM | `node tests/utils/final-check.js` |
| `check-structure.js` | HTML structure validation | `node tests/utils/check-structure.js` |
| `count-codeblocks.js` | Code block analysis by section | `node tests/utils/count-codeblocks.js` |
| `fab_analysis.js` | Floating Action Button analysis | `node tests/utils/fab_analysis.js` |

## Running Tests

```bash
# Run all tests
npm test

# Run with browser visible
npm run test:headed

# Run specific test
npx playwright test tests/specs/test-search.spec.js

# View HTML report
npm run test:report
```

## Test Coverage

- All 18 technical questions
- 30+ code blocks with syntax highlighting
- Copy button functionality
- Search with highlighting
- Dark mode toggle
- Responsive design (mobile/tablet)
- Navigation sidebar
- Progress bar
