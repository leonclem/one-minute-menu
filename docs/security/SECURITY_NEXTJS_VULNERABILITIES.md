# Next.js Security Vulnerabilities - Action Required

**Date Identified**: January 30, 2026  
**Current Next.js Version**: 14.2.32  
**Severity**: Moderate (DoS vulnerabilities)  
**Timeline**: Address within 1-2 weeks

---

## Summary

Two high-severity Denial of Service (DoS) vulnerabilities have been identified in Next.js 14.2.32. Both vulnerabilities apply to our application as we use the affected features.

---

## Vulnerability 1: Image Optimizer DoS

**CVE**: GHSA-9g9p-9gw9-jx7f  
**Severity**: High  
**Component**: Next.js Image Optimizer with `remotePatterns`

### Description
An attacker can send specially crafted image requests that overwhelm the server's image optimization process, causing high CPU usage and making the application unresponsive.

### Our Exposure
✅ **AFFECTED** - We use this feature:
- `next/image` component is used in multiple components
- External images allowed from Supabase domain: `uztyljbiqyrykzwtdbpa.supabase.co`
- Configuration in `next.config.js`:
  ```javascript
  images: {
    domains: ['uztyljbiqyrykzwtdbpa.supabase.co', 'localhost'],
  }
  ```

### Impact
- Server becomes slow or unresponsive
- Legitimate users cannot access the site
- Temporary disruption (no data breach)

---

## Vulnerability 2: Server Components Deserialization DoS

**CVE**: GHSA-h25m-26qc-wcjf  
**Severity**: High  
**Component**: React Server Components (App Router)

### Description
An attacker can send malformed data to React Server Components that causes excessive CPU usage during deserialization, leading to server overload and unresponsiveness.

### Our Exposure
✅ **AFFECTED** - We use this feature extensively:
- Entire application uses Next.js 13+ App Router (`src/app/` directory)
- Multiple async server components, including public-facing pages
- Example: `src/app/u/[userId]/[slug]/page.tsx` (public menu pages)
- API routes using App Router pattern

### Impact
- Server CPU spikes
- Application becomes unresponsive
- Temporary disruption (no data breach)

---

## Risk Assessment

### Likelihood of Exploitation: LOW
- Small user base makes us an unlikely target
- Requires attacker to specifically target our application
- Most automated scanners won't exploit these vulnerabilities
- No financial incentive for attackers

### Impact if Exploited: MODERATE
- Temporary service disruption
- No data breach or data loss
- Simple server restart resolves the issue
- Affects small number of users

### Overall Risk: MODERATE 🟡

---

## Recommended Action

### Primary Solution: Upgrade Next.js

**Command:**
```bash
npm install next@latest
```

**Expected Version**: 15.x or later (includes fixes)

### Testing Checklist
- [ ] Install latest Next.js version
- [ ] Run `npm test` to verify tests pass
- [ ] Test locally: `npm run dev`
- [ ] Test build: `npm run build`
- [ ] Deploy to staging environment
- [ ] Verify image loading works correctly
- [ ] Verify public menu pages load correctly
- [ ] Verify API routes function properly
- [ ] Deploy to production during low-traffic period

### Timeline
- **Target**: Within 1-2 weeks
- **Priority**: Medium (not urgent, but important)
- **Effort**: 1-2 hours (testing + deployment)

---

## Temporary Mitigation (If Upgrade Delayed)

If the upgrade must be delayed:

1. **Monitor server metrics**:
   - Watch CPU usage for unusual spikes
   - Set up alerts for high resource usage
   - Monitor response times

2. **Prepare incident response**:
   - Document server restart procedure
   - Have deployment rollback plan ready
   - Keep team informed

3. **Leverage existing protections**:
   - Vercel has built-in DDoS protection
   - Rate limiting may already mitigate some attacks

---

## Additional Context

### Why These Vulnerabilities Exist
- DoS vulnerabilities are common in web frameworks
- Next.js team actively patches security issues
- These are known and fixed in newer versions

### Why We're Not in Immediate Danger
- Small user base = not a target
- No sensitive data at risk
- Temporary impact only
- Easy recovery (restart)

### Related Files
- `next.config.js` - Image optimizer configuration
- `src/app/**/*.tsx` - Server components
- `package.json` - Current Next.js version

---

## References

- [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) - Image Optimizer DoS
- [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) - Server Components DoS
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)

---

## Status

- [ ] Next.js upgrade completed
- [ ] Tests passed
- [ ] Deployed to staging
- [ ] Deployed to production
- [ ] Vulnerabilities resolved (run `npm audit` to verify)

**Last Updated**: January 30, 2026
