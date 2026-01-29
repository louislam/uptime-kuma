# Okta SSO Integration for Uptime Kuma

This guide explains how to configure Okta SAML SSO authentication for Uptime Kuma, enabling multi-user support where every user in your Arnica organization can access and manage monitoring configurations.

## Overview

With Okta SSO enabled:

- Users authenticate via Okta instead of local username/password
- Users are automatically created in Uptime Kuma when they first log in (if `OKTA_AUTO_CREATE_USERS=true`)
- Each user has their own isolated monitoring configurations (monitors, notifications, etc.)
- Existing local authentication continues to work alongside Okta SSO

## Prerequisites

1. An Okta account with admin access
2. A SAML application configured in Okta
3. Node.js dependencies installed (`npm install`)

## Configuration Steps

### 1. Configure Okta SAML Application

1. Log in to your Okta Admin Console
2. Navigate to **Applications** → **Applications**
3. Click **Create App Integration**
4. Choose **SAML 2.0** as the sign-in method
5. Configure the application:
   - **App name**: Uptime Kuma (or your preferred name)
   - **Single sign-on URL**: `https://your-uptime-kuma-domain.com/auth/okta/callback`
   - **Audience URI (SP Entity ID)**: `https://your-uptime-kuma-domain.com`
   - **Name ID format**: EmailAddress (or Unspecified)
   - **Attribute statements**:
     - `email` → `user.email`
     - `firstName` → `user.firstName` (optional)
     - `lastName` → `user.lastName` (optional)
     - `groups` → `user.groups` (optional, for role mapping)

6. Save the application
7. Note the following values from the **Sign On** tab:
   - **Identity Provider Single Sign-On URL** (Entry Point)
   - **Identity Provider Issuer** (Issuer)
   - **X.509 Certificate** (Cert)

### 2. Configure Environment Variables

Set the following environment variables in your Uptime Kuma deployment:

```bash
# Enable Okta authentication
AUTH_PROVIDER=okta

# Okta SAML Configuration (from Okta application settings)
OKTA_ENTRY_POINT=https://your-okta-domain.okta.com/app/your-app-id/sso/saml
OKTA_ISSUER=http://www.okta.com/exkxxxxxxxxxxxxx
OKTA_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"

# Callback URL (usually auto-detected, but can be overridden)
OKTA_CALLBACK_URL=https://your-uptime-kuma-domain.com/auth/okta/callback

# Session secret (change this in production!)
SESSION_SECRET=your-random-session-secret-change-this-in-production

# Auto-create users from Okta (optional, default: false)
OKTA_AUTO_CREATE_USERS=true
```

### 3. Install Dependencies

The required dependencies (`passport`, `passport-saml`, `express-session`) have been added to `package.json`. Install them:

```bash
npm install
```

### 4. Start Uptime Kuma

Start the server as usual:

```bash
npm start
# or
node server/server.js
```

## How It Works

### Authentication Flow

1. User visits Uptime Kuma login page
2. If Okta is enabled, they see a "Login with Okta" button
3. Clicking the button redirects to Okta for authentication
4. After successful Okta authentication, user is redirected back to Uptime Kuma
5. A session is created and the user is logged in
6. Socket.io connection checks for the Okta session and authenticates automatically

### User Management

- **First-time users**: If `OKTA_AUTO_CREATE_USERS=true`, users are automatically created in Uptime Kuma when they first log in via Okta
- **Existing users**: Users can continue using local authentication even when Okta is enabled
- **User isolation**: Each user's monitors, notifications, and other configurations are isolated by `user_id`

### Multi-User Support

Uptime Kuma already supports multi-user architecture:

- Each monitor has a `user_id` field
- Users can only see and manage their own monitors
- Notifications, proxies, API keys, and other resources are also user-scoped

## Troubleshooting

### Users Not Being Created

- Check that `OKTA_AUTO_CREATE_USERS=true` is set
- Verify the user's email is correctly mapped in Okta SAML attributes
- Check server logs for Okta authentication errors

### Session Not Persisting

- Ensure `SESSION_SECRET` is set and consistent across restarts
- Verify cookies are enabled in the browser
- Check that HTTPS is used in production (required for secure cookies)

### SAML Errors

- Verify all Okta configuration values are correct
- Check that the callback URL matches exactly in Okta
- Ensure the certificate is properly formatted (with `\n` for newlines)
- Review server logs for detailed SAML error messages

## Security Considerations

1. **Session Secret**: Use a strong, random `SESSION_SECRET` in production
2. **HTTPS**: Always use HTTPS in production for secure cookie transmission
3. **Certificate**: Keep your Okta certificate secure and rotate it periodically
4. **User Creation**: Consider disabling `OKTA_AUTO_CREATE_USERS` and pre-creating users if you need more control

## Disabling Okta

To disable Okta and return to local authentication only:

1. Remove or set `AUTH_PROVIDER` to something other than `okta`
2. Restart the server
3. Users will see the standard username/password login form

## API Endpoints

- `GET /api/okta-enabled` - Check if Okta is enabled (returns `{enabled: boolean, loginUrl?: string}`)
- `GET /auth/okta` - Initiate Okta login (redirects to Okta)
- `POST /auth/okta/callback` - Okta callback endpoint (handled by Passport)
- `GET /auth/logout` - Logout and clear session

## Support

For issues or questions:

1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test Okta SAML configuration independently if needed
