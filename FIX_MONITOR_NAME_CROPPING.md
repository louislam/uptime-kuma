# Fix for Monitor Name Cropping in Nested Groups

## Issue Description

Monitor names were getting cropped in nested groups due to CSS styling that prevented text wrapping and overflow. This was particularly problematic in deeply nested groups where the indentation reduced available space.

## Root Cause

The global CSS in `src/assets/app.scss` had the following style for `.info` class:

```scss
.info {
    white-space: nowrap;
    overflow: hidden;
}
```

This caused monitor names to be truncated without showing ellipsis or allowing text wrapping.

## Solution

### 1. Fixed MonitorListItem.vue

-   **File**: `src/components/MonitorListItem.vue`
-   **Changes**:
    -   Added CSS override for `.info` class to allow text wrapping
    -   Added `.monitor-name` class with proper text overflow ellipsis
    -   Wrapped monitor name in `<span>` with `monitor-name` class and `title` attribute
    -   Added `title` attribute for tooltip on hover

### 2. Fixed PublicGroupList.vue

-   **File**: `src/components/PublicGroupList.vue`
-   **Changes**:
    -   Enhanced `.item-name` class with text overflow ellipsis
    -   Added `title` attributes to monitor name elements for better UX

### 3. Fixed DashboardHome.vue

-   **File**: `src/pages/DashboardHome.vue`
-   **Changes**:
    -   Added text overflow ellipsis to `.name-column` class
    -   Enhanced responsive design for different screen sizes
    -   Added `title` attributes to monitor name links

## Technical Details

### CSS Changes

```scss
// MonitorListItem.vue
.info {
    white-space: normal !important;
    overflow: visible !important;

    .monitor-name {
        display: inline-block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        vertical-align: middle;
    }
}

// PublicGroupList.vue
.item-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
}

// DashboardHome.vue
.name-column {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    a {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}
```

### Template Changes

-   Added `title` attributes to monitor name elements for tooltip functionality
-   Wrapped monitor names in appropriate span elements with CSS classes

## Benefits

1. **Better UX**: Long monitor names now show ellipsis instead of being completely cropped
2. **Tooltip Support**: Hovering over truncated names shows the full name
3. **Responsive Design**: Works well on different screen sizes
4. **Nested Group Support**: Properly handles deeply nested monitor groups
5. **Consistent Behavior**: Applied across all monitor display components

## Testing

-   Test with long monitor names in nested groups
-   Verify tooltip functionality on hover
-   Check responsive behavior on different screen sizes
-   Ensure no breaking changes to existing functionality

## Related Issue

This fix addresses GitHub issue #5981: "Cropped monitor names in nested groups"
