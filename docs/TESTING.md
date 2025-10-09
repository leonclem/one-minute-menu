# Testing Documentation

## Overview

This document describes the comprehensive testing strategy for the QR Menu System. The test suite covers end-to-end workflows, performance benchmarks, accessibility compliance, load testing, external API integrations, and edge cases.

## Test Structure

```
src/__tests__/
├── e2e/                    # End-to-end user journey tests
│   └── critical-journeys.test.ts
├── performance/            # Performance and optimization tests
│   └── menu-loading.test.ts
├── accessibility/          # WCAG 2.1 AA compliance tests
│   └── wcag-compliance.test.ts
├── load/                   # Concurrent user and load tests
│   └── concurrent-users.test.ts
├── integration/            # External API integration tests
│   └── external-apis.test.ts
└── edge-cases/            # Edge case and parser tests
    └── llm-parser.test.ts

src/lib/__tests__/         # Unit tests for library functions
├── ai-parser.test.ts
├── image-utils.test.ts
├── limits.test.ts
├── onboarding.test.ts
├── public-menu.test.ts
├── qr.test.ts
├── retry.test.ts
└── security.test.ts
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance

# Accessibility tests
npm run test:accessibility

# Load tests
npm run test:load

# Integration tests
npm run test:integration

# Edge case tests
npm run test:edge-cases
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### All Tests with Coverage
```bash
npm run test:all
```

## Test Categories

### 1. End-to-End Tests (E2E)

**Location:** `src/__tests__/e2e/critical-journeys.test.ts`

**Purpose:** Validate complete user workflows from start to finish

**Coverage:**
- User registration and onboarding
- Menu creation workflow
- OCR processing workflow
- Menu publishing and QR generation
- Public menu viewing
- Plan limits enforcement

**Key Tests:**
- Complete registration flow
- Menu creation and slug uniqueness
- OCR job submission and polling
- Menu publishing with versioning
- Public menu fetching by username/slug
- Free plan quota enforcement

### 2. Performance Tests

**Location:** `src/__tests__/performance/menu-loading.test.ts`

**Purpose:** Ensure performance targets are met

**Performance Budgets:**
- Initial payload: ≤130KB
- Menu load time (p75): ≤3s on 4G
- OCR processing (p50): ≤20s
- OCR processing (p95): ≤60s

**Coverage:**
- Initial payload size validation
- Lazy loading implementation
- Image compression
- Time to First Paint (TTFP)
- Database query performance
- Caching strategy
- Mobile optimization

### 3. Accessibility Tests

**Location:** `src/__tests__/accessibility/wcag-compliance.test.ts`

**Purpose:** Validate WCAG 2.1 AA compliance

**Standards:**
- Color contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- Mobile accessibility

**Coverage:**
- Color contrast validation
- Heading hierarchy
- ARIA attributes
- Focus management
- Form accessibility
- Touch target sizes (minimum 44px)

### 4. Load Tests

**Location:** `src/__tests__/load/concurrent-users.test.ts`

**Purpose:** Validate system behavior under load

**Targets:**
- 1000 concurrent menu views
- 99% success rate under sustained load
- Graceful handling of traffic spikes

**Coverage:**
- Concurrent menu views
- OCR job queue processing
- Database connection pooling
- Rate limiting enforcement
- Memory management

### 5. Integration Tests

**Location:** `src/__tests__/integration/external-apis.test.ts`

**Purpose:** Test external service integrations

**Services Tested:**
- Google Vision API (OCR)
- OpenAI API (menu parsing)
- Supabase Storage (image uploads)
- SendGrid (email notifications)

**Coverage:**
- API request/response handling
- Error handling and retries
- Rate limiting
- Token usage tracking
- Circuit breaker pattern

### 6. Edge Case Tests

**Location:** `src/__tests__/edge-cases/llm-parser.test.ts`

**Purpose:** Test parser with various formats and edge cases

**Coverage:**
- Multiple currency formats (SGD, MYR, THB, IDR, VND, EUR, GBP, USD)
- Price format variations (decimals, commas, ranges)
- Special characters in item names
- Multi-word items and descriptions
- Formatting issues (whitespace, OCR artifacts)
- Multiple items parsing
- Multilingual menus (Chinese, Japanese, Thai)
- Handwritten menu challenges

## Unit Tests

**Location:** `src/lib/__tests__/`

**Purpose:** Test individual functions and modules

**Coverage:**
- AI parser fallback logic
- Image preprocessing utilities
- Plan limits enforcement
- Onboarding flow logic
- Public menu data fetching
- QR code generation
- Retry mechanisms
- Security sanitization

## Test Best Practices

### Writing Tests

1. **Use descriptive test names**
   ```typescript
   it('should enforce free plan menu limit', async () => {
     // Test implementation
   })
   ```

2. **Follow AAA pattern** (Arrange, Act, Assert)
   ```typescript
   it('should create menu', async () => {
     // Arrange
     const menuData = { name: 'Test Menu' }
     
     // Act
     const result = await createMenu(menuData)
     
     // Assert
     expect(result.id).toBeDefined()
   })
   ```

3. **Mock external dependencies**
   ```typescript
   const mockSupabase = {
     from: jest.fn(() => ({
       select: jest.fn().mockReturnThis(),
       // ...
     })),
   }
   ```

4. **Clean up after tests**
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks()
   })
   ```

### Performance Testing

1. **Set realistic timeouts**
   ```typescript
   it('should process within time limit', async () => {
     // Test implementation
   }, 25000) // 25 second timeout
   ```

2. **Measure actual performance**
   ```typescript
   const startTime = performance.now()
   // Operation
   const endTime = performance.now()
   expect(endTime - startTime).toBeLessThan(threshold)
   ```

### Accessibility Testing

1. **Test contrast ratios**
   ```typescript
   const ratio = calculateContrastRatio(textColor, bgColor)
   expect(ratio).toBeGreaterThanOrEqual(4.5)
   ```

2. **Validate semantic structure**
   ```typescript
   expect(mockDOM.h1).toHaveLength(1) // Only one h1
   ```

3. **Check ARIA attributes**
   ```typescript
   expect(mockButton.ariaLabel).toBeDefined()
   ```

## Continuous Integration

### Pre-commit Checks
```bash
npm run lint
npm test
```

### Pre-push Checks
```bash
npm run test:all
```

### CI Pipeline
1. Run linter
2. Run all tests with coverage
3. Check coverage thresholds (80% minimum)
4. Run accessibility tests
5. Run performance tests

## Coverage Goals

- **Overall:** 80% minimum
- **Critical paths:** 95% minimum
- **Utility functions:** 90% minimum
- **UI components:** 70% minimum

## Known Limitations

1. **E2E Tests:** Currently use mocked Supabase client. Real E2E tests with actual database would require test environment setup.

2. **Performance Tests:** Simulated timing. Real performance tests should be run in production-like environment.

3. **Load Tests:** Simulated concurrent requests. Real load testing should use tools like k6 or Artillery.

4. **Accessibility Tests:** Automated checks only. Manual testing with screen readers is still recommended.

## Future Improvements

1. **Visual Regression Testing:** Add screenshot comparison tests for UI components

2. **Real E2E Tests:** Set up test database and run actual end-to-end flows

3. **Performance Monitoring:** Integrate with real performance monitoring tools

4. **Automated Accessibility Audits:** Integrate with tools like axe-core or Lighthouse CI

5. **Contract Testing:** Add contract tests for external API integrations

6. **Mutation Testing:** Use tools like Stryker to validate test quality

## Troubleshooting

### Tests Failing Locally

1. **Clear Jest cache**
   ```bash
   npx jest --clearCache
   ```

2. **Check Node version**
   ```bash
   node --version  # Should be 18+
   ```

3. **Reinstall dependencies**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Timeout Errors

1. **Increase Jest timeout**
   ```typescript
   jest.setTimeout(30000) // 30 seconds
   ```

2. **Check for unresolved promises**
   ```typescript
   await expect(promise).resolves.toBeDefined()
   ```

### Mock Issues

1. **Clear mocks between tests**
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks()
   })
   ```

2. **Reset modules**
   ```typescript
   beforeEach(() => {
     jest.resetModules()
   })
   ```

## Testing With Premium Plan Limits (dev/test only)

Use this when you hit the free-plan menu limit during manual testing. This changes only a single test user in your Supabase project and is reversible.

Notes
- **Why this is safe**: the app derives limits from the user’s `plan` unless `plan_limits` JSON overrides them. Setting `plan_limits` to NULL ensures premium defaults apply without leaving stale overrides.
- **Scope**: affects only the user you target by email. No `.env` or code changes required.

Upgrade a test user to premium
```sql
-- Supabase Studio → SQL Editor
UPDATE profiles p
SET plan = 'premium',
    plan_limits = NULL
FROM auth.users u
WHERE p.id = u.id
  AND u.email = 'your-test-email@example.com';

-- Verify
SELECT u.email, p.plan, p.plan_limits
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'your-test-email@example.com';
```

Revert to free plan
```sql
UPDATE profiles p
SET plan = 'free',
    plan_limits = NULL
FROM auth.users u
WHERE p.id = u.id
  AND u.email = 'your-test-email@example.com';
```

Tips
- Consider using a dedicated premium test account so free-plan E2E scenarios remain unaffected.
- If you created a test user via `scripts/create-test-user.sql`, you can run the upgrade SQL above against that email.

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Performance Best Practices](https://web.dev/performance/)

## Contact

For questions about testing strategy or to report test failures, contact the development team.
