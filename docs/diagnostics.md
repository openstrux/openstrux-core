# Diagnostic Code Reference

All diagnostic codes emitted by the openstrux-core pipeline, by stage.

## Parser (`@openstrux/parser`)

| Code | Severity | Description |
|---|---|---|
| E000 | error | Generic parse error (syntax violations, unexpected tokens) |
| E001 | error | Unclosed brace in type or panel declaration |
| E002 | error | Unknown rod type (not in KNOWN_ROD_TYPES) |
| E003 | error | Malformed type path (e.g., trailing dot) |
| W001 | warning | Missing @access block on panel |

## Config (`@openstrux/config`)

| Code | Severity | Description |
|---|---|---|
| E_CERT_IN_CONTEXT | error | @cert block found in strux.context file (ADR-011) |
| E_CONTEXT_PARSE | error | Parse error in strux.context |
| E_ACCESS_WIDENING | error | @access scope widening detected in context merge |

## Validator (`@openstrux/validator`)

### Type resolution

| Code | Severity | Description |
|---|---|---|
| V001 | error | Unresolved type reference in rod configuration |
| V002 | error | Rod knot type mismatch (snap chain break) |
| V003 | error | Scope field/resource type not declared |
| V004 | error | Snap chain break (disconnected rod) |
| W002 | warning | Missing @access block (warning in v0.6, error in v0.7) |
| W003 | warning | Non-PascalCase type name |

### Certification

| Code | Severity | Description |
|---|---|---|
| E_CERT_HASH_MISMATCH | error | @cert hash does not match compiled output |
| W_CERT_SCOPE_UNCOVERED | warning | Panel uses type path not covered by @cert scope |

### Policy / scope

| Code | Severity | Description |
|---|---|---|
| W_POLICY_OPAQUE | warning | Guard references external or unreachable hub policy |
| W_SCOPE_UNVERIFIED | warning | Scope fields in policy cannot be statically confirmed |

### @ops validation

| Code | Severity | Description |
|---|---|---|
| E_OPS_UNKNOWN_FIELD | error | Unrecognised field in @ops decorator block |
| E_OPS_TYPE_MISMATCH | error | @ops field value has wrong type |

### Schema validation

| Code | Severity | Description |
|---|---|---|
| E_SCHEMA_STRING | error | validate.schema uses string literal instead of identifier |
| E_SCHEMA_UNRESOLVED | error | validate.schema identifier not declared as @type |

### Stream config

| Code | Severity | Description |
|---|---|---|
| E_STREAM_MISSING_FIELD | error | Required field missing in stream adapter config |
| E_STREAM_UNKNOWN_ADAPTER | error | Unrecognised stream adapter type |

### Privacy (GDPR / BDSG)

| Code | Severity | Description |
|---|---|---|
| E_GDPR_PURPOSE_REQUIRED | error | cfg.purpose missing on private-data rod (Art. 5(1)(b)) |
| E_GDPR_RETENTION_REQUIRED | error | cfg.retention missing on private-data rod (Art. 5(1)(e)) |
| E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY | error | Invalid lawful basis for special category data (Art. 9) |
| W_GDPR_LI_DPIA_RECOMMENDED | warning | legitimate_interest without dpia_ref (Art. 35) |
| E_PRIVACY_BYPASS | error | @privacy panel has no private-data rod |
| E_PRIVATE_DATA_BYPASS | error | PrivateData\<T\> bypasses private-data rod before sink |
| E_BDSG_EMPLOYEE_CATEGORY | error | employee_data:true without employee_category (BDSG 26) |

## Manifest (`@openstrux/manifest`)

| Code | Severity | Description |
|---|---|---|
| I_MANIFEST_GENERATED | info | Manifest generated successfully |
| E_MANIFEST_HASH_CHANGED | error | Content hash changed since last manifest generation |

## Lock (`@openstrux/lock`)

| Code | Severity | Description |
|---|---|---|
| W_NO_LOCK | warning | No snap.lock found; build proceeds without determinism guarantee |
| E_LOCK_MISMATCH | error | Resolved dependency state differs from snap.lock |
| I_LOCK_CREATED | info | snap.lock created successfully |
| E_LOCK_STALE | error | snap.lock references different spec version |

## Summary

36 diagnostic codes total: 24 errors, 10 warnings, 2 info.
