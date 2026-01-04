const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const {
    STATUS_PAGE_ALL_DOWN,
    STATUS_PAGE_ALL_UP,
    STATUS_PAGE_PARTIAL_DOWN,
    MAINTENANCE,
    UP,
    DOWN,
    PENDING
} = require("../util-server");

// Image dimensions (Open Graph standard)
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

// Display limits
const MAX_TITLE_LENGTH = 40;
const MAX_MONITOR_NAME_LENGTH = 40;
const MAX_INDIVIDUAL_MONITORS = 3;

/**
 * Get status color based on status code
 * @param {number} status Status code
 * @returns {string} Hex color code
 */
function getStatusColor(status) {
    switch (status) {
        case STATUS_PAGE_ALL_UP:
            return "#10b981"; // green
        case STATUS_PAGE_PARTIAL_DOWN:
            return "#f59e0b"; // amber
        case STATUS_PAGE_ALL_DOWN:
            return "#ef4444"; // red
        case MAINTENANCE:
            return "#3b82f6"; // blue
        default:
            return "#6b7280"; // grey
    }
}

/**
 * Get monitor status color
 * @param {number} status Monitor status code
 * @returns {string} Hex color code
 */
function getMonitorStatusColor(status) {
    switch (status) {
        case UP:
            return "#10b981"; // green
        case DOWN:
            return "#ef4444"; // red
        case MAINTENANCE:
            return "#3b82f6"; // blue
        case PENDING:
            return "#f59e0b"; // amber
        default:
            return "#6b7280"; // grey
    }
}

/**
 * Escape XML special characters
 * @param {string} text Text to escape
 * @returns {string} Escaped text
 */
function escapeXml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * Truncate text with ellipsis if too long
 * @param {string} text Text to truncate
 * @param {number} maxLength Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + "...";
}

/**
 * Count monitors by status
 * @param {Array} monitors Array of monitor objects
 * @returns {object} Status counts
 */
function countMonitorsByStatus(monitors) {
    const counts = { up: 0,
        down: 0,
        pending: 0,
        maintenance: 0 };

    monitors.forEach((monitor) => {
        if (monitor.status === UP) {
            counts.up++;
        } else if (monitor.status === DOWN) {
            counts.down++;
        } else if (monitor.status === PENDING) {
            counts.pending++;
        } else if (monitor.status === MAINTENANCE) {
            counts.maintenance++;
        }
    });

    return counts;
}

/**
 * Generate SVG for monitor status summary (when more than 3 monitors)
 * @param {object} statusCounts Status counts object
 * @param {number} startY Starting Y coordinate
 * @returns {string} SVG markup
 */
function generateMonitorStatusSummary(statusCounts, startY) {
    let y = startY;
    let svg = "<!-- Monitor Status Summary -->";

    if (statusCounts.up > 0) {
        svg += `
    <circle cx="60" cy="${y - 8}" r="8" fill="#10b981"/>
    <text x="80" y="${y}" font-family="Arial, sans-serif" font-size="22" fill="#d1d5db">${statusCounts.up} Up</text>`;
        y += 35;
    }

    if (statusCounts.down > 0) {
        svg += `
    <circle cx="60" cy="${y - 8}" r="8" fill="#ef4444"/>
    <text x="80" y="${y}" font-family="Arial, sans-serif" font-size="22" fill="#d1d5db">${statusCounts.down} Down</text>`;
        y += 35;
    }

    if (statusCounts.maintenance > 0) {
        svg += `
    <circle cx="60" cy="${y - 8}" r="8" fill="#3b82f6"/>
    <text x="80" y="${y}" font-family="Arial, sans-serif" font-size="22" fill="#d1d5db">${statusCounts.maintenance} Maintenance</text>`;
        y += 35;
    }

    if (statusCounts.pending > 0) {
        svg += `
    <circle cx="60" cy="${y - 8}" r="8" fill="#f59e0b"/>
    <text x="80" y="${y}" font-family="Arial, sans-serif" font-size="22" fill="#d1d5db">${statusCounts.pending} Pending</text>`;
    }

    return svg;
}

/**
 * Generate SVG for individual monitor details (3 or fewer monitors)
 * @param {Array} monitors Array of monitor objects
 * @param {number} startY Starting Y coordinate
 * @returns {string} SVG markup
 */
function generateIndividualMonitorDetails(monitors, startY) {
    let svg = "<!-- Monitor Details -->";
    const displayMonitors = monitors.slice(0, MAX_INDIVIDUAL_MONITORS);

    displayMonitors.forEach((monitor, index) => {
        const y = startY + (index * 35);
        const statusColor = getMonitorStatusColor(monitor.status);
        const monitorName = truncateText(monitor.name, MAX_MONITOR_NAME_LENGTH);

        svg += `
    <circle cx="60" cy="${y - 8}" r="8" fill="${statusColor}"/>
    <text x="80" y="${y}" font-family="Arial, sans-serif" font-size="22" fill="#d1d5db">${escapeXml(monitorName)}</text>`;
    });

    return svg;
}

/**
 * Generate monitor details section based on monitor data
 * @param {Array} monitors Array of monitor objects
 * @returns {string} SVG markup
 */
function generateMonitorDetailsSection(monitors) {
    const startY = 420;

    // No monitors or monitors without names - show count
    if (monitors.length === 0 || !monitors[0].name) {
        const plural = monitors.length !== 1 ? "s" : "";
        return `<!-- Monitor count -->
    <text x="80" y="${startY}" font-family="Arial, sans-serif" font-size="28" fill="#9ca3af">${monitors.length} Monitor${plural} tracked</text>`;
    }

    // Show summary for more than 3 monitors
    if (monitors.length > MAX_INDIVIDUAL_MONITORS) {
        const statusCounts = countMonitorsByStatus(monitors);
        return generateMonitorStatusSummary(statusCounts, startY);
    }

    // Show individual monitors for 3 or fewer
    return generateIndividualMonitorDetails(monitors, startY);
}

/**
 * Load and embed icon SVG
 * @param {string|null} icon Icon URL or path
 * @returns {string} SVG markup for icon
 */
function generateIconSection(icon) {
    if (!icon) {
        return "";
    }

    try {
        let filePath = "";

        if (icon.startsWith("/upload/")) {
            filePath = path.join(__dirname, "../../data", icon);
        } else {
            filePath = path.join(__dirname, "../../public/icon.svg");
        }

        if (!fs.existsSync(filePath) || !icon.endsWith(".svg")) {
            return "";
        }

        const iconContent = fs.readFileSync(filePath, "utf8");
        const svgMatch = iconContent.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);

        if (!svgMatch) {
            return "";
        }

        // Embed icon scaled to ~80px at top right
        return `
    <!-- Custom Icon -->
    <g transform="translate(1100, 180) scale(0.125) translate(-320, -320)">
        ${svgMatch[1]}
    </g>`;
    } catch (error) {
        // Silently fail - OG image will generate without icon
        return "";
    }
}

/**
 * Generate SVG for Open Graph image
 * @param {string} title Status page title
 * @param {string} statusDescription Status description text
 * @param {string} statusColor Status color hex code
 * @param {string|null} icon Custom icon URL
 * @param {boolean} showPoweredBy Whether to show "Powered by Uptime Kuma" branding
 * @param {number} timestamp Last updated timestamp (Unix timestamp in milliseconds)
 * @param {Array} monitors Array of monitor objects with name and status
 * @returns {string} SVG markup
 */
function generateOGImageSVG(title, statusDescription, statusColor, icon, showPoweredBy, timestamp, monitors) {
    const displayTitle = truncateText(title, MAX_TITLE_LENGTH);
    const iconSVG = generateIconSection(icon);
    const monitorDetailsSVG = generateMonitorDetailsSection(monitors);

    // Footer
    const date = new Date(timestamp);
    const timestampText = `UPDATED AT ${date.toISOString()}`;
    let footerSVG = "<!-- Footer -->";

    if (showPoweredBy) {
        footerSVG += `
    <text x="60" y="570" font-family="Arial, sans-serif" font-size="18" fill="#6b7280">POWERED BY UPTIME KUMA</text>`;
    }

    footerSVG += `
    <text x="1140" y="570" font-family="Arial, sans-serif" font-size="18" fill="#6b7280" text-anchor="end">${timestampText}</text>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="#1f2937"/>

    <!-- Status indicator bar at top -->
    <rect width="${OG_IMAGE_WIDTH}" height="8" fill="${statusColor}"/>
${iconSVG}
    <!-- Title -->
    <text x="60" y="180" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="#ffffff">${escapeXml(displayTitle)}</text>

    <!-- Status circle -->
    <circle cx="60" cy="320" r="24" fill="${statusColor}"/>

    <!-- Status text -->
    <text x="100" y="335" font-family="Arial, sans-serif" font-size="42" fill="#ffffff">${escapeXml(statusDescription)}</text>

${monitorDetailsSVG}${footerSVG}
</svg>`;
}

/**
 * Generate an Open Graph image for the status page
 * @param {object} statusPageData Status page data object containing title, status info, monitors, etc.
 * @param {string} statusPageData.title Status page title
 * @param {string} statusPageData.statusDescription Status description text
 * @param {string} statusPageData.statusColor Status color hex code
 * @param {string|null} statusPageData.icon Custom icon URL
 * @param {boolean} statusPageData.showPoweredBy Whether to show "Powered by Uptime Kuma" branding
 * @param {Array} statusPageData.monitors Array of monitor objects
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateOGImage(statusPageData) {
    const {
        title,
        statusDescription,
        statusColor,
        icon,
        showPoweredBy,
        monitors
    } = statusPageData;

    const svg = generateOGImageSVG(
        title,
        statusDescription,
        statusColor,
        icon,
        !!showPoweredBy,
        Date.now(),
        monitors
    );

    const pngBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();

    return pngBuffer;
}

module.exports = {
    generateOGImageSVG,
    generateOGImage,
    getStatusColor,
    escapeXml,
};
