// Plain CommonJS (not compiled from TypeScript, unlike util.ts/util.js) so
// it can be require()'d directly by the server and imported directly by the
// Vite frontend build without needing a working `npm run tsc` step.

/**
 * Breadth-first search over dependency edges: is `target` reachable from
 * `start`? Shared by the server-side cycle check (MonitorDependency.wouldCreateCycle)
 * and the client-side dependency graph editor (DependencyGraph.vue), so both
 * agree on the exact same traversal rule.
 * @param {{monitorID: number, dependsOnMonitorID: number}[]} edges All dependency edges to search over
 * @param {number} start Starting monitor ID
 * @param {number} target Monitor ID to look for
 * @returns {boolean} True if target is reachable from start
 */
function canReach(edges, start, target) {
    const visited = new Set();
    const queue = [ start ];

    while (queue.length > 0) {
        const currentID = queue.shift();

        if (currentID === target) {
            return true;
        }

        if (visited.has(currentID)) {
            continue;
        }
        visited.add(currentID);

        for (const edge of edges) {
            if (edge.monitorID === currentID) {
                queue.push(edge.dependsOnMonitorID);
            }
        }
    }

    return false;
}

module.exports = { canReach };
