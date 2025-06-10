# Daily View Feature for Status Pages

## Overview

This feature adds the ability to show 3-month history on Uptime Kuma status pages with daily aggregation instead of the standard 100 recent heartbeats. Each monitor can be individually configured to use either the regular heartbeat view or the new daily view.

## Features

### ✅ **Per-Monitor Configuration**
- Each monitor on a status page can individually be set to use daily view or regular view
- Settings are stored in the database and persist across restarts
- Easy toggle in the monitor settings dialog
- **Fixed**: Daily view checkbox now properly saves and persists between page reloads

### ✅ **Daily Aggregation**
- Fetches 3 months of heartbeat data and aggregates by day
- Each day shows the overall status based on the majority of heartbeats
- Maintenance status takes priority over other statuses
- Average ping time is calculated for each day
- Daily uptime percentage is displayed

### ✅ **Missing Data Visualization**
- **New**: Days with missing data are displayed as grey bars instead of empty space
- Ensures visual consistency across all monitors
- New monitors show complete 3-month timeline with grey bars for days before monitoring started
- Maintains consistent width and alignment with older monitors

### ✅ **Smart Data Routing**
- Mixed mode: Some monitors can use daily view while others use regular view on the same status page
- Backend automatically determines data type needed per monitor
- Frontend components dynamically render appropriate visualization

### ✅ **Enhanced Tooltips**
- Daily view shows date, status, uptime percentage, and average ping
- Missing days show "No data" with the date
- Special handling for "Today" and "Yesterday"

## Technical Implementation

### Backend Changes

1. **Database Migration**: Added `daily_view` boolean column to `monitor_group` table
2. **API Endpoint**: `/api/status-page/heartbeat-daily/:slug` returns mixed data based on monitor settings
3. **Data Aggregation**: SQL queries group by date and calculate daily statistics
4. **Monitor Model**: Updated to include `dailyView` property in public JSON

### Frontend Changes

1. **DailyHeartbeatBar Component**: New component for 3-month daily timeline visualization
2. **Missing Data Generation**: Generates complete 3-month timeline with grey placeholders
3. **Conditional Rendering**: PublicGroupList dynamically chooses between components
4. **Settings Dialog**: Added toggle for daily view in monitor settings
5. **Persistence Fix**: Proper boolean conversion for database values

## Usage

### For Administrators

1. **Enable Daily View for a Monitor**:
   - Open the status page in edit mode
   - Click the settings icon next to any monitor
   - Toggle "Daily View" checkbox
   - Save the status page

2. **Visual Differences**:
   - **Regular View**: Shows last 100 individual heartbeats as small dots
   - **Daily View**: Shows up to 90 days as wider bars representing daily aggregates
   - **Missing Days**: Grey bars maintain visual consistency

### For Users

- Status pages automatically display the appropriate view for each monitor
- Daily view shows broader trends over months rather than minute-by-minute detail
- Hover over any day to see detailed statistics
- Grey bars indicate days when the monitor wasn't active or data is missing

## API Examples

### Daily Data Response
```json
{
  "heartbeatList": {
    "1": [
      {
        "status": 1,
        "time": "2025-06-10 09:40:26.626", 
        "ping": 177,
        "uptime": 1.0,
        "date": "2025-06-10",
        "dailyStats": {
          "total": 19,
          "up": 19, 
          "down": 0,
          "pending": 0,
          "maintenance": 0
        }
      }
    ]
  },
  "uptimeList": { "1": 1.0 },
  "dailyViewSettings": { "1": 1 },
  "hasMixedData": true
}
```

### Missing Day Placeholder
```json
{
  "status": -1,
  "time": null,
  "ping": null,
  "uptime": null,
  "date": "2025-06-09",
  "missing": true
}
```

## Configuration

- **Database**: Migration adds `daily_view` column with default `false`
- **Performance**: Daily data is cached for 5 minutes vs 1 minute for regular heartbeats
- **Timeline**: Fixed 3-month window (90 days) regardless of monitor check frequency
- **Compatibility**: Fully backward compatible - existing monitors continue to use regular view

## Benefits

1. **Better Long-term Visibility**: See patterns and trends over months
2. **Performance**: Fewer data points to load and render for long time periods
3. **Consistency**: All monitors show same time scale regardless of check frequency
4. **Flexibility**: Per-monitor configuration allows mixed usage
5. **Complete Timeline**: Missing data visualization prevents confusing gaps

## Database Schema

```sql
-- Migration: 2025-06-10-0000-add-daily-view.js
ALTER TABLE monitor_group ADD COLUMN daily_view BOOLEAN DEFAULT FALSE;
```

## Files Modified

### Backend
- `db/knex_migrations/2025-06-10-0000-add-daily-view.js` - Database migration
- `server/routers/status-page-router.js` - Mixed data API endpoint  
- `server/socket-handlers/status-page-socket-handler.js` - Save daily view setting
- `server/model/group.js` - Include daily_view in SQL queries
- `server/model/monitor.js` - Add dailyView to public JSON

### Frontend
- `src/components/DailyHeartbeatBar.vue` - New daily timeline component
- `src/components/PublicGroupList.vue` - Conditional component rendering
- `src/components/MonitorSettingDialog.vue` - Daily view toggle UI
- `src/pages/StatusPage.vue` - Mixed data handling
- `src/mixins/socket.js` - Additional data properties
- `src/lang/en.json` - New translation keys

## Troubleshooting

1. **Daily view not persisting**: Ensure the database migration has run successfully
2. **Missing grey bars**: Check that the monitor has `dailyView: true` in the API response
3. **Timeline not showing**: Verify the `/api/status-page/heartbeat-daily/:slug` endpoint returns data
4. **Performance issues**: Daily data is cached, but initial load may be slower for large datasets 