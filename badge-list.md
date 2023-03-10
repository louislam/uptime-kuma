```
    label,
    upLabel = "Up",
    downLabel = "Down",
    pendingLabel = "Pending",
    maintenanceLabel = "Maintenance",
    upColor = badgeConstants.defaultUpColor,
    downColor = badgeConstants.defaultDownColor,
    pendingColor = badgeConstants.defaultPendingColor,
    maintenanceColor = badgeConstants.defaultMaintenanceColor,
    style = badgeConstants.defaultStyle,
    value, // for demo purpose only
```

```
/api/badge/:id/uptime/:duration?
    label,
    labelPrefix,
    labelSuffix = badgeConstants.defaultUptimeLabelSuffix,
    prefix,
    suffix = badgeConstants.defaultUptimeValueSuffix,
    color,
    labelColor,
    style = badgeConstants.defaultStyle,
    value, // for demo purpose only
```

```
/api/badge/:id/ping/:duration?
    label,
    labelPrefix,
    labelSuffix = badgeConstants.defaultPingLabelSuffix,
    prefix,
    suffix = badgeConstants.defaultPingValueSuffix,
    color = badgeConstants.defaultPingColor,
    labelColor,
    style = badgeConstants.defaultStyle,
    value, // for demo purpose only
```

```
/api/badge/:id/avg-response/:duration?
    label,
    labelPrefix,
    labelSuffix,
    prefix,
    suffix = badgeConstants.defaultPingValueSuffix,
    color = badgeConstants.defaultPingColor,
    labelColor,
    style = badgeConstants.defaultStyle,
    value, // for demo purpose only
```

```
/api/badge/:id/cert-exp
    label,
    labelPrefix,
    labelSuffix,
    prefix,
    suffix = date ? "" : badgeConstants.defaultCertExpValueSuffix,
    upColor = badgeConstants.defaultUpColor,
    warnColor = badgeConstants.defaultWarnColor,
    downColor = badgeConstants.defaultDownColor,
    warnDays = badgeConstants.defaultCertExpireWarnDays,
    downDays = badgeConstants.defaultCertExpireDownDays,
    labelColor,
    style = badgeConstants.defaultStyle,
    value, // for demo purpose only
```

```
/api/badge/:id/response
    label,
    labelPrefix,
    labelSuffix,
    prefix,
    suffix = badgeConstants.defaultPingValueSuffix,
    color = badgeConstants.defaultPingColor,
    labelColor,
    style = badgeConstants.defaultStyle,
    value, // for demo purpose only
```

```
Use in all routes
    label
    prefix
    suffix,
    labelColor
    style = badgeConstants.defaultStyle,
    value // for demo purpose only
```

```
Use in all routes except status and cert-exp
    color
```

```
Use in all routes except status
    labelPrefix
    labelSuffix
```

```
Use in routes status and cert-exp
    upColor = badgeConstants.defaultUpColor,
    downColor = badgeConstants.defaultDownColor,
```

```
Use in status route only
    pendingColor = badgeConstants.defaultPendingColor,
    maintenanceColor = badgeConstants.defaultMaintenanceColor,
```

```
Use in cert-exp route only
    warnColor = badgeConstants.defaultWarnColor,
    warnDays = badgeConstants.defaultCertExpireWarnDays,
    downDays = badgeConstants.defaultCertExpireDownDays,
```