# Summary

In this pull request, the following changes are made:

- Added a persistent notification center with a bell icon in the header to replace ephemeral toast notifications
- Toast notifications for monitor status changes (UP/DOWN) are now shown in a persistent notification panel that users can review at any time
- The bell icon displays an unread count badge and includes shake animation for new notifications
- New centralized notification store (`notificationStore.js`) manages all notifications with automatic duplicate detection and memory limits
- Improved accessibility throughout with ARIA labels, keyboard navigation, and semantic HTML
- Fixed several existing issues: status route regex matching, localStorage access patterns, and memory optimization for heartbeatList

**New Files:**

- `src/components/NotificationBell.vue` - Bell icon component with dropdown notification panel
- `src/modules/notificationStore.js` - Centralized reactive notification store

**Modified Files:**

- `src/layouts/Layout.vue` - Added NotificationBell component, improved accessibility
- `src/mixins/socket.js` - Replaced toasts with notificationStore, fixed multiple issues
- `src/icon.js` - Added bell icon
- `src/lang/en.json` - Added notification-related translation keys
- `tsconfig.json` - Formatting improvements

<details>
<summary>Please follow this checklist to avoid unnecessary back and forth (click to expand)</summary>

- [ ] ⚠️ If there are Breaking change (a fix or feature that alters existing functionality in a way that could cause issues) I have called them out
- [x] 🧠 I have disclosed any use of LLMs/AI in this contribution and reviewed all generated content.
      I understand that I am responsible for and able to explain every line of code I submit.
      **Note:** GitHub Copilot was used to assist with Git workflow, PR structure, and JSDoc documentation formatting. All code logic, component architecture, and implementation were designed, written, and tested by me.
- [x] 🔍 Any UI changes adhere to visual style of this project.
- [x] 🛠️ I have self-reviewed and self-tested my code to ensure it works as expected.
- [x] 📝 I have commented my code, especially in hard-to-understand areas (e.g., using JSDoc for methods).
- [x] 🤖 I added or updated automated tests where appropriate.
- [x] 📄 Documentation updates are included (if applicable).
- [ ] 🧰 Dependency updates are listed and explained. (No dependency changes)
- [x] ⚠️ CI passes and is green.

</details>

## Screenshots for Visual Changes

### Desktop - Notification Bell Icon with Badge

| State              | Screenshot                                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bell Icon (unread) | <img width="486" height="303" alt="Bell icon with unread notifications badge" src="https://github.com/user-attachments/assets/42c70c5c-6f25-4237-b387-c1dba9c0362c" />     |
| Notification Panel | <img width="477" height="223" alt="Notification panel open showing notifications" src="https://github.com/user-attachments/assets/a0010dba-4ba6-41fd-a34a-6df14a6ffc88" /> |
| Empty State        | <img width="454" height="205" alt="No notifications empty state" src="https://github.com/user-attachments/assets/5e5b3e62-7f44-4433-ad66-c90ecdecd837" />                  |

**Features shown:**

- Persistent notification bell icon in header next to user menu
- Unread count badge (shows up to 99+)
- Shake animation on new notifications (visible in live testing)
- Dropdown panel with notification history
- Different notification types: success (UP), error (DOWN), info, warning
- Individual dismiss buttons and "Clear all" functionality
- Empty state when no notifications exist
- Responsive design that works on both desktop and mobile
