# Multi-User Support

Uptime Kuma now supports multiple users with role-based access control.

## User Roles

The system supports three roles:

### Admin
- Full access to all features
- Can create, edit, and delete users
- Can manage all monitors, notifications, and settings
- At least one admin user must exist at all times

### User (Default)
- Can create and manage own monitors
- Can create and manage own notifications
- Cannot access user management or system settings
- This is the default role for new users

### Read Only
- View-only access to monitors and dashboards
- Cannot create or modify any resources
- Useful for stakeholders who need visibility without edit access

## Getting Started

### First Time Setup
When you first install Uptime Kuma, you'll be prompted to create an admin account. This user automatically receives the **Admin** role.

### Upgrading from Single-User
If you're upgrading from a version without multi-user support:
1. Your existing user is automatically upgraded to **Admin** role
2. No action required - everything continues to work as before
3. You can now add additional users through Settings > Users

## Managing Users

Only users with the **Admin** role can manage other users.

### Adding a User
1. Navigate to **Settings** > **Users**
2. Click **Add User** button
3. Enter username and password
4. Select a role (User, Admin, or Read Only)
5. Click **Save**

### Editing a User
1. Navigate to **Settings** > **Users**
2. Click **Edit** button next to the user
3. Update username, password (optional), role, or active status
4. Click **Save**

**Note**: You cannot change the role of the last admin user.

### Deleting a User
1. Navigate to **Settings** > **Users**
2. Click **Delete** button next to the user
3. Confirm the deletion

**Restrictions**:
- You cannot delete your own account
- You cannot delete the last admin user
- Deleted users are deactivated but not removed from the database to preserve data integrity

## Security Considerations

1. **Strong Passwords**: Always use strong passwords for all user accounts
2. **Least Privilege**: Assign users the minimum role necessary for their tasks
3. **Regular Review**: Periodically review user accounts and deactivate unused ones
4. **Admin Access**: Limit the number of admin users to trusted individuals only

## API and Authentication

Multi-user support is fully integrated with:
- **Socket.IO**: All real-time communications respect user roles
- **API Keys**: Continue to work as before
- **JWT Tokens**: Automatically include user role information

## Migration Details

The database migration (`2025-12-23-0000-add-user-roles.js`) adds:
- `role` column to the `user` table (default: "user")
- Automatic upgrade of the first user to "admin" role
- Backward compatibility for existing installations

## Troubleshooting

### Cannot Access User Management
- Verify you are logged in as an admin user
- Only admin users can see the "Users" menu in Settings

### Cannot Delete User
- You cannot delete your own account (log in as another admin)
- You cannot delete the last admin user (promote another user to admin first)

### Role Not Showing
- Refresh the page after login
- Clear browser cache if issue persists
- Check browser console for errors

## Technical Implementation

### Backend
- Socket handler: `server/socket-handlers/user-management-socket-handler.js`
- User model: `server/model/user.js`
- Authorization: Role checks in socket event handlers

### Frontend
- Component: `src/components/settings/Users.vue`
- Route: `/settings/users` (admin only)
- Menu: Settings > Users (visible only to admins)

### Database
- Migration: `db/knex_migrations/2025-12-23-0000-add-user-roles.js`
- Schema: Adds `role` VARCHAR(50) column to `user` table

## Future Enhancements

Potential future improvements:
1. **Granular Permissions**: Fine-grained permissions per resource
2. **User Groups**: Organize users into teams or departments
3. **Audit Logging**: Track user actions and changes
4. **SSO Integration**: Support for SAML, OAuth, LDAP
5. **Monitor Sharing**: Share specific monitors between users
6. **Role Customization**: Create custom roles with specific permissions
