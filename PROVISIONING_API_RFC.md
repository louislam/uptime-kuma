# Draft: Proposal for optional provisioning / IaC-friendly API

## Problem Statement

Uptime Kuma currently lacks official support for Infrastructure as Code (IaC) tools like Terraform, Ansible, or Pulumi. This creates challenges for users who want to:

- Reproduce configurations across multiple environments (homelab clusters, development/staging/production)
- Implement disaster recovery strategies with predictable recreation
- Use GitOps workflows for configuration management
- Migrate between instances systematically

While users can currently export/import configurations through the UI, this approach is manual, error-prone, and doesn't integrate well with automated tooling. This proposal explores adding an optional, minimal provisioning API that would enable IaC workflows without breaking existing functionality or requiring changes from current users.

## Design Goals & Non-Goals

### Goals
- **Stable, versioned API surface**: Well-defined endpoints that won't break between minor versions
- **Minimal scope**: Cover the most common provisioning use cases without feature creep
- **Idempotent operations**: Safe to run multiple times with consistent results
- **No UI changes required**: Existing web interface remains unchanged
- **No direct database access**: API goes through existing business logic layers

### Non-Goals
- Replacing the existing web UI or user workflows
- Managing historical uptime data or metrics
- Providing dynamic runtime control (start/stop monitoring)
- Full CRUD operations for every internal object in Uptime Kuma
- Schema introspection or database-level operations

## High-Level Architecture

```
+------------------+
|  Terraform / IaC |
+--------+---------+
         |
         v
+--------------------------+
| Provisioning API (opt-in)|
|  /api/provisioning/*     |
+--------+-----------------+
         |
         v
+--------------------------+
|  Internal Service Layer  |
|  (existing Kuma logic)   |
+--------+-----------------+
         |
         v
+--------------------------+
|   Database (SQLite / DB) |
+--------------------------+
```

**Key Design Decisions:**
- API is **disabled by default** and must be explicitly enabled in configuration
- Leverages existing domain logic and validation rules
- No direct database schema exposure to clients
- Clean separation between provisioning operations and runtime monitoring

## API Surface (Pseudo-Spec)

The API follows RESTful conventions with a minimal v1 surface:

### JSON Schema

To ensure consistency and enable tooling support, all API payloads will be validated against published JSON schemas:

- **Schema Location**: `/api/provisioning/v1/schema/{resource}` (GET endpoint)
- **Validation**: All POST/PUT requests validated against corresponding schema
- **Versioning**: Schemas versioned alongside API (v1, v2, etc.)
- **Tooling**: Enables IDE autocompletion, validation, and IaC tool integration

Example schema endpoint: `GET /api/provisioning/v1/schema/monitor` returns the JSON schema for monitor objects.

### Resources
- **Monitors**: Core monitoring configurations
- **Groups**: Monitor grouping for organization
- **Status Pages**: Public status page configurations
- **Notifications**: Alert/notification settings (phase 2, optional)

### Endpoints

#### Monitors
```
GET  /api/provisioning/v1/monitors     # List all provisioned monitors
POST /api/provisioning/v1/monitors     # Create new monitor
PUT  /api/provisioning/v1/monitors/{id} # Update existing monitor
DELETE /api/provisioning/v1/monitors/{id} # Delete monitor
```

#### Groups
```
GET  /api/provisioning/v1/groups
POST /api/provisioning/v1/groups
PUT  /api/provisioning/v1/groups/{id}
DELETE /api/provisioning/v1/groups/{id}
```

#### Status Pages
```
GET  /api/provisioning/v1/status-pages
POST /api/provisioning/v1/status-pages
PUT  /api/provisioning/v1/status-pages/{id}
DELETE /api/provisioning/v1/status-pages/{id}
```

### Example JSON Payloads

**Monitor Creation/Update:**
```json
{
  "external_id": "homeassistant-http",
  "name": "Home Assistant",
  "type": "http",
  "url": "http://homeassistant:8123",
  "interval": 60,
  "timeout": 30,
  "max_retries": 3,
  "accepted_statuscodes": ["200-299"],
  "group_id": "infrastructure"
}
```

**Group Creation:**
```json
{
  "external_id": "infrastructure",
  "name": "Infrastructure Services",
  "weight": 1
}
```

**Status Page Creation:**
```json
{
  "external_id": "public-status",
  "title": "Service Status",
  "description": "Current service availability",
  "theme": "light",
  "show_tags": true,
  "monitor_ids": ["homeassistant-http", "database-ping"]
}
```

## Idempotency Model

The API uses client-supplied `external_id` fields for idempotent operations:

- **External IDs**: Client-provided unique identifiers (strings) that are meaningful in the IaC context
- **Internal IDs**: Server-assigned numeric IDs used for API operations and references
- **Matching Logic**: Updates target existing resources by `external_id`, creates new resources if no match exists
- **Drift Detection**: Clients can detect configuration drift by comparing returned state with desired state

**Example Flow:**
1. Client sends monitor config with `external_id: "web-server"`
2. Server checks if monitor with that external_id exists
3. If exists: updates fields, preserves internal relationships
4. If not exists: creates new monitor, assigns internal ID
5. Returns full resource state including both external_id and internal ID

This allows IaC tools to safely re-run configurations while maintaining referential integrity.

## Auth & Security Model

- **Token-based authentication**: Uses bearer tokens in Authorization header
- **Scoped tokens**: Separate permission scope `provisioning:write` (distinct from admin access)
- **Explicit opt-in**: API endpoints return 404 unless explicitly enabled in server configuration
- **No session state**: Stateless operations, no reliance on cookies or UI sessions
- **Rate limiting**: Standard rate limiting applies to prevent abuse

**Configuration Example:**
```yaml
# uptime-kuma.yml
provisioning:
  enabled: true
  tokens:
    - name: "terraform"
      token: "prov_abc123..."
      scopes: ["provisioning:write"]
```

## Migration & Backwards Compatibility

This proposal ensures **zero impact** on existing users and workflows:

- **No database migrations required**: All changes are additive
- **Existing UI unchanged**: Web interface continues working exactly as before
- **API is opt-in**: Disabled by default, must be explicitly enabled
- **No breaking changes**: Existing endpoints and functionality preserved
- **Backward compatible**: Future versions can safely remove the feature if unwanted

Current users can continue using Uptime Kuma exactly as they always have, with this API being purely additive functionality.

## Alternatives Considered

**Direct Database Manipulation:**
- Rejected due to tight coupling with internal schema changes
- Would break with any database refactoring
- Security risks from exposing internal data structures

**Using Undocumented Internal APIs:**
- Fragile and likely to break between versions
- No guarantees of stability or correctness
- Poor developer experience for IaC tool authors

**External Sidecar Only:**
- While possible, upstream support provides better integration
- Ensures API stability and proper validation
- Allows for official documentation and examples

## Open Questions for Maintainers

I'd love to get your thoughts on this direction before investing significant time:

1. Is this general API surface acceptable, or should we reduce scope further (e.g., monitors-only initially)?

2. Would you prefer starting with a sidecar approach first, or is upstream API integration preferable?

3. Are there any specific areas that are hard "no" areas we should avoid entirely?

4. Should we consider a different authentication approach (OAuth, API keys, etc.)?

5. Would providing JSON schemas for API validation be valuable, and should they be served as API endpoints?

6. Any concerns about maintenance burden or testing complexity?

I'm happy to implement this if it aligns with the project's direction - I just want to make sure we're on the same page before diving in. Would you prefer to discuss this in a GitHub Discussion first, or should I proceed with a more detailed implementation plan?
