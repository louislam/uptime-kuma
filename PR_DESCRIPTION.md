# Pull Request: Add OIDC/SSO Authentication Support

## Type of Change
- [x] New feature (non-breaking change that adds functionality)
- [ ] Breaking change
- [x] Documentation Update Required

---

## Description

This PR implements comprehensive OpenID Connect (OIDC) / Single Sign-On (SSO) authentication for Uptime Kuma, providing enterprise-grade authentication capabilities.

### Features Added

**Authentication & Security:**
- ✅ Complete OAuth 2.0 / OIDC authorization code flow
- ✅ Multi-provider support (PingFederate, Google, Microsoft, Auth0, Okta, Generic OIDC)
- ✅ CSRF protection via state parameter validation
- ✅ Nonce verification for ID tokens
- ✅ Secure token storage with AES-256-GCM encryption
- ✅ Session management with express-session
- ✅ httpOnly, secure cookies with SameSite protection

**User Management:**
- ✅ Automatic user provisioning on first login
- ✅ Account linking by username match
- ✅ OIDC user to local user mapping
- ✅ Token refresh and expiration tracking
- ✅ Complete logout with token invalidation

**Admin Interface:**
- ✅ Settings > SSO Provider configuration page
- ✅ CRUD operations for provider management
- ✅ Provider enable/disable toggle
- ✅ Visual feedback and validation
- ✅ Secure secret handling (encrypted storage)

**User Interface:**
- ✅ SSO LOGIN button on login page
- ✅ "or continue with" divider
- ✅ Provider-specific icons and styling
- ✅ Loading states and error handling
- ✅ Graceful fallback to standard login

---

## Implementation Details

### Backend (7 files)

#### Database Migrations
- `db/knex_migrations/2025-01-22-0000-create-oidc-provider.js`
  - Creates `oidc_provider` table for storing provider configurations
  - Encrypted client secrets, OAuth endpoints, scopes
  
- `db/knex_migrations/2025-01-22-0001-create-oidc-user.js`
  - Creates `oidc_user` table for user mapping
  - Links OIDC identities to local accounts
  - Stores encrypted OAuth tokens

#### Services
- `server/services/oidc-db-service.js`
  - Complete CRUD operations for providers and users
  - AES-256-GCM encryption/decryption for secrets
  - Token management and invalidation
  - User provisioning logic

- `server/oidc-config.js`
  - Provider configuration templates
  - Validation and metadata helpers
  - Support for 6+ provider types

#### Routers
- `server/routers/oidc-auth-router.js`
  - OAuth 2.0 authorization code flow
  - Login initiation (`/oidc/login/:provider`)
  - Callback handler (`/oidc/callback`)
  - Token exchange and user info retrieval
  - JWT generation for Socket.IO authentication
  - Complete logout flow (`/oidc/logout`)
  - User status endpoint (`/oidc/user-status`)

- `server/routers/oidc-admin-router.js`
  - Admin API for provider management
  - GET/POST/PUT/DELETE endpoints
  - Input validation middleware
  - Statistics endpoints

#### Server Integration
- `server/server.js` (modified)
  - Added `express-session` middleware
  - Mounted OIDC routers
  - Session configuration (10-minute timeout for OAuth flow)

### Frontend (5 files)

#### Mixin
- `src/mixins/oidc.js`
  - Provider fetching and caching
  - Login initiation helper
  - Provider icon and styling helpers
  - Error state management

#### Components
- `src/components/Login.vue` (modified)
  - SSO LOGIN button with provider list
  - Conditional rendering when providers available
  - Loading states and error handling
  - Divider: "or continue with"

- `src/components/settings/SsoProvider.vue` (new)
  - Complete provider configuration form
  - Provider type selection (6 options)
  - OIDC endpoint configuration
  - OAuth credentials management
  - Enable/disable toggle
  - Validation and error handling

#### Settings Integration
- `src/pages/Settings.vue` (modified)
  - Added "SSO Provider" menu item
  - Positioned between Security and API Keys

- `src/router.js` (modified)
  - Route: `/settings/sso-provider`
  - Component: `SsoProvider.vue`

### Translations
- `src/lang/en.json` (modified)
  - Added 46 translation keys
  - All user-facing strings translatable
  - Ready for weblate community translation

### Dependencies
- `package.json` (modified)
  - Added `express-session@~1.17.3`
  - Required for OAuth state management

### Documentation
- `README.md` (modified)
  - Added OIDC/SSO to features list

---

## Security Measures

1. **CSRF Protection:**
   - State parameter generation and validation
   - Session-based state storage

2. **Token Security:**
   - AES-256-GCM encryption for secrets and tokens
   - Unique IV per encryption
   - Encrypted storage in database

3. **Cookie Security:**
   - httpOnly: true (prevents XSS)
   - secure: true (production with HTTPS)
   - sameSite: "lax" (CSRF protection)
   - Short-lived sessions (10 minutes for OAuth flow)

4. **Input Validation:**
   - URL validation for endpoints
   - Required field validation
   - Type validation

5. **Session Management:**
   - Automatic cleanup after OAuth flow
   - Token expiration tracking
   - Complete logout with token invalidation

---

## Testing Performed

### Manual Testing
- [x] Provider configuration (all 6 types tested)
- [x] OAuth login flow (PingFederate, Google tested)
- [x] User provisioning on first login
- [x] Account linking by username
- [x] Token encryption/decryption
- [x] Session management
- [x] Logout flow
- [x] Error handling (invalid credentials, network errors)
- [x] First-time setup (empty state)

### Code Quality
- [x] ESLint: 0 errors, 0 warnings
- [x] Build: Successful compilation
- [x] Module loading: No runtime errors
- [x] JSDoc: Comprehensive documentation

### CI/CD Status
- ✅ **Build:** Passed (exit code 0)
- ✅ **ESLint:** Passed (0 errors, 0 warnings)
- ✅ **Module Loading:** Passed
- ⚠️ **Backend Tests:** Pre-existing test configuration issue (unrelated to OIDC)

**Note on Tests:** The backend test suite has a pre-existing configuration issue where `node --test test/backend-test` expects a file but the codebase has a directory structure. This issue exists independently of OIDC changes and does not affect OIDC functionality.

### Automated Tests
Per CONTRIBUTING.md: *"My code needed automated testing. I have added them (this is an optional task)."*

**Status:** Automated tests are **optional** and not included in this PR.

**Comprehensive manual testing completed and documented** (see Testing Performed section above).

**If requested during review**, automated tests can be added for:
- Encryption/decryption functions
- State/nonce generation
- Provider configuration validation

This approach is consistent with Uptime Kuma's contribution standards where manual testing is acceptable.

---

## Screenshots

### Login Page with SSO
[TODO: Add screenshot of login page showing SSO LOGIN button]

### SSO Provider Settings Page
[TODO: Add screenshot of Settings > SSO Provider configuration page]

### Provider Configuration Form
[TODO: Add screenshot of filled provider form]

### Successful Login Flow
[TODO: Add screenshot of successful SSO login]

---

## Environment Variables (Optional)

For production deployments, the following environment variables can be set:

```bash
# Session secret for OIDC state management (recommended)
UPTIME_KUMA_SESSION_SECRET="your-secure-random-secret"

# Encryption key for client secrets and tokens (recommended)
UPTIME_KUMA_ENCRYPTION_KEY="your-32-character-key"

# Enable HTTPS cookie security (optional)
UPTIME_KUMA_ENABLE_HTTPS="true"
```

If not set, secure defaults are used.

---

## Breaking Changes

**None.** This is a purely additive feature that:
- Does not modify existing authentication
- Standard login still works
- No changes to existing database tables
- No changes to existing APIs
- Fully backward compatible

---

## Migration Required

Yes, database migrations are required:

```bash
npm run setup
```

This will create two new tables:
- `oidc_provider` - Stores OIDC provider configurations
- `oidc_user` - Maps OIDC users to local accounts

---

## How to Use

### For Administrators

1. **Configure a Provider:**
   - Navigate to Settings > SSO Provider
   - Fill in provider details (issuer, endpoints, client ID/secret)
   - Select provider type (PingFederate, Google, Microsoft, etc.)
   - Click "Save Provider"

2. **Test SSO Login:**
   - Logout from Uptime Kuma
   - Click the "SSO LOGIN" button on login page
   - Complete authentication with your OIDC provider
   - Login successful!

### For Users

- **SSO Login:** Click "SSO LOGIN" button on login page
- **Standard Login:** Username/password still works as before

---

## Files Changed

### Created (10 files)
- `db/knex_migrations/2025-01-22-0000-create-oidc-provider.js`
- `db/knex_migrations/2025-01-22-0001-create-oidc-user.js`
- `server/services/oidc-db-service.js`
- `server/oidc-config.js`
- `server/routers/oidc-auth-router.js`
- `server/routers/oidc-admin-router.js`
- `src/mixins/oidc.js`
- `src/components/settings/SsoProvider.vue`
- Documentation files (FINAL_SETUP_GUIDE.md, etc.)

### Modified (6 files)
- `server/server.js` - Added session middleware and routers
- `src/components/Login.vue` - Added SSO login button
- `src/pages/Settings.vue` - Added SSO Provider menu item
- `src/router.js` - Added SSO Provider route
- `src/lang/en.json` - Added 46 translation keys
- `package.json` - Added express-session dependency
- `README.md` - Added OIDC to features list

**Total: 16 files**

---

## Checklist

- [x] Code adheres to style guidelines
- [x] Ran ESLint on modified files (0 errors, 0 warnings)
- [x] Code reviewed and tested
- [x] Code commented (JSDoc for all methods)
- [x] No new warnings
- [ ] Tests added (optional - manual testing completed)
- [x] Documentation included
- [x] Security impacts considered and mitigated
- [x] Dependencies listed and explained (express-session)
- [x] Read PR guidelines

---

## Additional Notes

### Design Decisions

1. **Single Provider Approach:**
   - Current implementation supports one active provider at a time
   - Simplifies configuration for typical enterprise use cases
   - Can be extended to multiple providers in future if needed

2. **Session Middleware:**
   - Required for OAuth state management
   - Short-lived (10 minutes) to minimize security exposure
   - Separate session cookie (`uptime-kuma-oidc-session`)

3. **Encryption:**
   - Client secrets and tokens encrypted at rest
   - AES-256-GCM with unique IVs
   - Follows security best practices

4. **User Provisioning:**
   - Automatically creates local accounts on first login
   - Links by username match to existing accounts
   - No duplicate accounts created

### Future Enhancements (Out of Scope)

- Multiple simultaneous providers
- Group/role mapping from OIDC claims
- Custom attribute mapping
- SAML support
- Advanced token refresh logic

---

## Related Issues

- Closes #XXXX (if applicable)
- Implements feature request #XXXX (if applicable)

---

## Questions for Maintainers

1. Should automated tests be added before merging? (Manual testing is comprehensive)
2. Any concerns about the session middleware approach?
3. Should this target `master` or a feature branch?
4. Any additional documentation needed?

---

## Acknowledgments

This implementation follows the existing Uptime Kuma patterns and architecture, integrating seamlessly with:
- RedBean ORM for database operations
- Socket.IO for authentication
- Vue 3 for frontend components
- Express.js for routing

Thank you for considering this contribution! 🙏
