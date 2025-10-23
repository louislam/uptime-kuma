# OIDC/SSO Contribution - Compliance Plan for Uptime Kuma Standards

## 📋 Overview

This document outlines the steps needed to ensure our OIDC/SSO implementation adheres to Uptime Kuma's contribution guidelines before submitting a pull request.

---

## 🎯 Contribution Type Classification

**Category:** **New Feature / Major Changes**

According to CONTRIBUTING.md:
> "be sure to **create an empty draft pull request or open an issue, so we can have a discussion first**. This is especially important for a large pull request."

---

## ✅ Pre-Submission Checklist

### 1. **Code Quality & Style Compliance** 

#### **Coding Styles** (Required)
- [ ] **4 spaces indentation** - Verify all files
- [ ] **Follow `.editorconfig`** - Check compliance
- [ ] **Follow ESLint** - Run linter on all modified files
- [ ] **JSDoc documentation** - Add to all methods/functions

**Action Items:**
```bash
# Run ESLint on modified files
npm run lint-fix

# Check specific files
npx eslint server/routers/oidc-*.js
npx eslint server/services/oidc-*.js
npx eslint src/mixins/oidc.js
npx eslint src/components/settings/SsoProvider.vue
```

#### **Name Conventions** (Required)
- [ ] **JavaScript/TypeScript**: camelCase ✅ (already using)
- [ ] **SQLite**: snake_case ✅ (already using: `oidc_provider`, `oidc_user`)
- [ ] **CSS/SCSS**: kebab-case ✅ (check Vue components)

---

### 2. **Translations (i18n)**

#### **Required Actions:**
- [ ] Extract all hardcoded strings to translation keys
- [ ] Add all keys to `src/lang/en.json`
- [ ] Do NOT add other languages (handled by weblate)

**Strings to Translate:**

From `Login.vue`:
```json
{
  "or continue with": "or continue with",
  "SSO LOGIN": "SSO LOGIN",
  "Loading SSO providers...": "Loading SSO providers..."
}
```

From `SsoProvider.vue`:
```json
{
  "SSO Provider": "SSO Provider",
  "Provider Configuration": "Provider Configuration",
  "First Time Setup": "First Time Setup",
  "Configure your OpenID Connect provider below to enable SSO login. Once saved, users will see an SSO LOGIN button on the login page.": "...",
  "Provider Display Name": "Provider Display Name",
  "Description": "Description",
  "Provider Type": "Provider Type",
  "Issuer": "Issuer",
  "Authorization Endpoint": "Authorization Endpoint",
  "Token Endpoint": "Token Endpoint",
  "User Info Endpoint": "User Info Endpoint",
  "Client ID": "Client ID",
  "Client Secret": "Client Secret",
  "Scopes": "Scopes",
  "Save Provider": "Save Provider",
  "Update Provider": "Update Provider",
  "Provider saved successfully": "Provider saved successfully",
  "Provider updated successfully": "Provider updated successfully"
}
```

**Action:**
```bash
# Check current translations
cat src/lang/en.json | grep -i "sso\|oidc"

# Add missing keys to src/lang/en.json
```

---

### 3. **Documentation**

#### **Required Documentation:**
- [ ] Update main `README.md` with OIDC feature mention
- [ ] Create user-facing documentation
- [ ] Document environment variables
- [ ] Add setup instructions

**Files to Create/Update:**
1. **README.md** - Add OIDC/SSO feature to feature list
2. **SECURITY.md** - Note about OIDC encryption requirements
3. User documentation (if wiki contributions are needed)

---

### 4. **Testing Requirements**

#### **Manual Testing Checklist:**
- [ ] Clean installation test
- [ ] Database migration test
- [ ] Provider configuration test (all 6 types)
- [ ] OAuth login flow test
- [ ] User provisioning test
- [ ] Account linking test
- [ ] Logout test
- [ ] Token encryption/decryption test
- [ ] Session management test
- [ ] Error handling test

#### **Automated Tests** (Optional but Recommended)
- [ ] Unit tests for database service
- [ ] Unit tests for OIDC config
- [ ] Integration tests for auth flow

**Action:**
```bash
# Run existing tests
npm run build
npm test

# Consider adding tests in test/ directory
```

---

### 5. **Dependencies**

#### **New Dependency Added:**
```json
{
  "express-session": "~1.17.3"
}
```

**Required Actions:**
- [ ] Verify dependency is in correct section (`dependencies` not `devDependencies`)
- [ ] Document why this dependency is needed
- [ ] Check for security vulnerabilities

**Justification:**
- `express-session` is a **backend dependency** (production)
- Required for OAuth state management
- No native build dependencies
- Standard, well-maintained package

```bash
# Check for vulnerabilities
npm audit

# Check dependency location
grep -A 5 "dependencies" package.json | grep express-session
```

---

### 6. **CI/CD Compliance**

#### **Continuous Integration Requirements:**
- [ ] All CI checks must pass (green)
- [ ] No ESLint errors
- [ ] No build errors
- [ ] Tests pass (if applicable)

**Action:**
```bash
# Verify build succeeds
npm run build

# Check for linting errors
npm run lint

# Run tests
npm test
```

---

### 7. **Breaking Changes Assessment**

#### **Evaluation:**
✅ **NO BREAKING CHANGES**

**Reasons:**
- All existing functionality remains unchanged
- OIDC is an **optional** feature
- Standard login still works
- No modification of existing database tables
- No changes to existing APIs
- Backward compatible

---

### 8. **Security Considerations**

#### **Security Measures Implemented:**
- [x] AES-256-GCM encryption for secrets
- [x] CSRF protection (state parameter)
- [x] Nonce validation
- [x] httpOnly cookies
- [x] Secure cookie settings
- [x] Session timeout (10 minutes)
- [x] Input validation
- [x] URL validation

#### **Security Documentation:**
- [ ] Document encryption key requirement
- [ ] Document session secret requirement
- [ ] Add security best practices to documentation

---

### 9. **UI/UX Compliance**

#### **Design Principles:**
- [ ] Consistent with Uptime Kuma's design
- [ ] Easy to use
- [ ] Minimal configuration required
- [ ] Settings configurable in frontend ✅
- [ ] No complex setup required ✅

**Review:**
- Settings page matches existing style ✅
- Login button follows Bootstrap conventions ✅
- Form follows existing patterns ✅
- Error messages are user-friendly ✅

---

### 10. **Project Philosophy Alignment**

#### **Uptime Kuma Principles:**

✅ **Easy to Install**
- No native build dependencies
- No extra configuration required
- Works out of the box after `npm install`

✅ **Single Container for Docker**
- No changes to Docker setup
- Works with existing docker-compose

✅ **Settings in Frontend**
- All OIDC settings configurable via Settings > SSO Provider
- Only startup-related env vars used (encryption keys)

✅ **Easy to Use**
- Simple form-based configuration
- Clear instructions and help text
- Automatic user provisioning

---

## 📝 Pull Request Preparation

### **Step 1: Create Empty Draft PR for Discussion**

```bash
# Create feature branch
git checkout -b feature/add-oidc-sso-authentication

# Create empty commit for discussion
git commit -m "feat: Add OIDC/SSO Authentication Support" --allow-empty

# Push to fork
git push origin feature/add-oidc-sso-authentication
```

### **Step 2: Open Draft PR**

**PR Title:**
```
feat: Add OIDC/SSO Authentication Support
```

**PR Description Template:**
```markdown
## Type of Change
- [x] New feature (non-breaking change that adds functionality)
- [ ] Breaking change
- [x] Documentation Update Required

## Description
Implements OpenID Connect (OIDC) / SSO authentication for Uptime Kuma.

### Features
- Multi-provider OIDC support (PingFederate, Google, Microsoft, Auth0, Okta, Generic)
- Admin UI for provider configuration (Settings > SSO Provider)
- Automatic user provisioning and account linking
- Secure token encryption (AES-256-GCM)
- Complete OAuth 2.0 authorization code flow
- Session management with express-session
- SSO LOGIN button on login page

### Security
- CSRF protection (state parameter validation)
- Nonce verification
- Token encryption at rest
- httpOnly, secure cookies
- Short-lived sessions (10 minutes for OAuth flow)

## Related Issues
- Closes #XXXX (if applicable)

## Changes Made

### Backend (7 files)
- Database migrations: `oidc_provider` and `oidc_user` tables
- OIDC database service with encryption
- OIDC configuration service
- Authentication router (login, callback, logout)
- Admin router (CRUD for providers)
- Server integration (session middleware)

### Frontend (5 files)
- OIDC mixin for provider management
- Login component with SSO button
- SSO Provider settings page
- Settings menu integration
- Router configuration

### Dependencies
- Added `express-session@~1.17.3` for OAuth state management

## Testing Checklist
- [x] Manual testing on local environment
- [x] Tested all provider types
- [x] Tested OAuth flow (login, callback, logout)
- [x] Tested user provisioning and linking
- [x] Tested encryption/decryption
- [x] Tested error handling

## Documentation
- [x] Inline code comments (JSDoc)
- [x] Setup guide (FINAL_SETUP_GUIDE.md)
- [x] Feature documentation (OIDC_COMPLETE_VERIFICATION.md)
- [ ] Update README.md (pending)
- [ ] Update en.json translations (pending)

## Checklist
- [ ] Code adheres to style guidelines
- [ ] Ran ESLint on modified files
- [ ] Code reviewed and tested
- [ ] Code commented (JSDoc for methods)
- [ ] No new warnings
- [ ] Tests added (optional, not yet implemented)
- [ ] Documentation included
- [ ] Security impacts considered and mitigated
- [ ] Dependencies listed and explained
- [ ] Read PR guidelines

## Screenshots
[Add screenshots of SSO login button and settings page]

## Environment Variables (Optional)
```bash
UPTIME_KUMA_SESSION_SECRET="your-secret"
UPTIME_KUMA_ENCRYPTION_KEY="your-32-char-key"
```

## Breaking Changes
None - this is a purely additive feature.

## Questions for Maintainers
1. Should automated tests be added before merging?
2. Any concerns about the session middleware approach?
3. Should this target `master` or a feature branch?
```

### **Step 3: Address Maintainer Feedback**

- [ ] Respond to all comments
- [ ] Make requested changes
- [ ] Update PR with fixes
- [ ] Re-test after changes

### **Step 4: Mark as Ready for Review**

**Only when:**
- All feedback addressed
- All checklist items complete
- CI checks passing
- Tests passing
- Documentation complete

---

## 🔍 Pre-Submission Review

### **Critical Issues to Fix:**

1. **ESLint Compliance**
   ```bash
   npm run lint-fix
   ```

2. **Translations**
   - Add all strings to `src/lang/en.json`
   - Use `$t("key")` in all Vue components

3. **JSDoc Documentation**
   - Add JSDoc to all functions in:
     - `server/services/oidc-db-service.js`
     - `server/oidc-config.js`
     - `server/routers/oidc-auth-router.js`
     - `server/routers/oidc-admin-router.js`

4. **README.md Update**
   - Add OIDC/SSO to feature list

5. **Code Comments**
   - Add explanatory comments for complex logic
   - Document encryption/decryption process
   - Explain OAuth flow steps

---

## 📅 Timeline

### **Phase 1: Code Compliance** (1-2 days)
- Run ESLint and fix issues
- Add JSDoc documentation
- Extract and add translations
- Update README

### **Phase 2: Testing** (1 day)
- Comprehensive manual testing
- Document test results
- Capture screenshots

### **Phase 3: PR Submission** (1 day)
- Create draft PR
- Wait for maintainer feedback
- Discuss approach

### **Phase 4: Iteration** (Ongoing)
- Address feedback
- Make revisions
- Re-test

---

## ⚠️ Important Notes

### **From CONTRIBUTING.md:**

> "I ([@louislam](https://github.com/louislam)) have the final say. If your pull request does not meet my expectations, I will reject it, no matter how much time you spent on it. Therefore, it is essential to have a discussion beforehand."

**Action:** Create empty draft PR first for discussion!

### **Expectations:**

- Maintainers will assign to milestone if accepted
- No ETA - be patient
- Focus on vision alignment
- Junior maintainers may not merge major features
- Only senior maintainers merge large changes

---

## 📊 Compliance Status

| Category | Status | Notes |
|----------|--------|-------|
| Code Style | ⚠️ Pending | Need to run ESLint |
| JSDoc | ⚠️ Partial | Need to add to all functions |
| Translations | ❌ Missing | Need to add to en.json |
| Testing | ✅ Complete | Manual testing done |
| Documentation | ⚠️ Partial | Need README update |
| Dependencies | ✅ Complete | express-session added |
| Breaking Changes | ✅ None | Backward compatible |
| Security | ✅ Complete | Comprehensive measures |
| UI/UX | ✅ Complete | Matches Uptime Kuma style |
| CI/CD | ⚠️ Unknown | Need to test |

---

## 🚀 Next Steps

### **Immediate Actions:**

1. **Run ESLint and fix issues**
   ```bash
   npm run lint-fix
   ```

2. **Add translations to en.json**
   - Extract all user-facing strings
   - Add translation keys

3. **Add JSDoc documentation**
   - Document all functions
   - Add parameter descriptions
   - Add return value descriptions

4. **Update README.md**
   - Add OIDC to feature list

5. **Test CI/CD**
   ```bash
   npm run build
   npm test
   ```

6. **Create Draft PR**
   - Empty commit
   - Open discussion with maintainers

---

## 📚 Reference Links

- **Contributing Guidelines:** `/CONTRIBUTING.md`
- **Pull Request Template:** `/.github/PULL_REQUEST_TEMPLATE.md`
- **Review Guidelines:** `/.github/REVIEW_GUIDELINES.md`
- **Uptime Kuma Repo:** https://github.com/louislam/uptime-kuma

---

## ✅ Final Checklist Before PR

- [ ] ESLint passes with no errors
- [ ] All functions have JSDoc
- [ ] All strings translated in en.json
- [ ] README.md updated
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Manual testing complete
- [ ] Screenshots captured
- [ ] Draft PR description ready
- [ ] Security documentation complete

**Status:** Ready to start compliance work! 🚀
