# Add Notification Center (Bell Icon)

## Description

This PR adds a persistent notification center to replace ephemeral toast notifications for monitor status changes. Users can now review all notifications via a bell icon in the header, with an unread count badge.

## Changes

### New Files
- **`src/components/NotificationBell.vue`** - Bell icon component with dropdown panel
  - Shows unread notification count badge (up to 99+)
  - Shake animation on new notifications
  - Responsive design (mobile overlay)
  - Accessibility features (ARIA labels, keyboard navigation)
  - Clear all functionality with confirmation

- **`src/modules/notificationStore.js`** - Centralized notification store
  - Reactive Vue 3 store using `reactive()` and `computed()`
  - Automatic duplicate detection (5-second window)
  - Max 100 notifications limit
  - Optional TTL for auto-expiring notifications
  - Support for success/error/warning/info types

### Modified Files

#### Frontend
- **`src/layouts/Layout.vue`**
  - Added NotificationBell component to desktop and mobile headers
  - Changed `<object>` to `<img>` for icon (better accessibility)
  - Improved dropdown menu accessibility (ARIA attributes)
  - Fixed active route detection for maintenance page

- **`src/mixins/socket.js`**
  - Replaced toast notifications with notificationStore for heartbeat events
  - Fixed status route regex to properly match `/status/` paths
  - Changed `remember` logic to explicit opt-in (`=== "1"` instead of `!== "0"`)
  - Fixed localStorage access patterns (consistent use of `getItem()`/`setItem()`)
  - Added cleanup lifecycle hooks (`beforeUnmount`, `beforeDestroy`)
  - Limited heartbeatList to last 150 items (memory optimization)
  - Added null check for socket in login method

- **`src/icon.js`**
  - Added `faBell` icon import and registration

- **`src/lang/en.json`**
  - Added translation keys:
    - `"Notifications"`
    - `"No notifications"`
    - `"Clear all"`
    - `"Clear all notifications?"`
    - `"Dismiss"`
    - `"unread"`
    - `"User menu"`

#### Config
- **`tsconfig.json`**
  - Formatting: multi-line `lib` array
  - Removed trailing newline

## Type of Change
- [x] New feature (non-breaking change which adds functionality)
- [x] UI/UX improvement
- [x] Code refactoring

## Testing
- [x] Tested desktop layout (bell icon appears in header)
- [x] Tested mobile layout (bell icon in mobile header)
- [x] Tested notification creation on monitor DOWN events
- [x] Tested notification creation on monitor UP events
- [x] Tested unread badge counter
- [x] Tested "Clear all" functionality
- [x] Tested individual notification dismissal
- [x] Tested shake animation on new notifications
- [x] Tested mark-as-read on panel open
- [x] Verified duplicate detection works
- [x] Verified accessibility (keyboard navigation, ARIA labels)
- [x] Tested responsive behavior on mobile

## Checklist
- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas (JSDoc)
- [x] My changes generate no new warnings
- [x] New and existing unit tests pass locally with my changes
- [x] I have only modified `src/lang/en.json` for translations (other languages via Weblate)

## Screenshots

### Desktop - Bell Icon with Unread Badge
[Add screenshot here showing bell icon with badge in header]

### Desktop - Notification Panel Open
[Add screenshot here showing dropdown notification panel]

### Mobile - Bell Icon
[Add screenshot here showing bell icon in mobile header]

### Notification Types
[Add screenshot showing different notification types: success, error, warning, info]

## Notes

- Replaced toasts with persistent notifications for better user experience
- Users can now review past notifications instead of losing them
- Improved memory usage by limiting heartbeatList and notification count
- Enhanced accessibility throughout the changes
- German translations intentionally excluded from this PR (will be added via Weblate)

## Related Issues
<!-- If this fixes any issues, link them here -->
Fixes #[issue_number]
