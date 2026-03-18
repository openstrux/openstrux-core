# Test Fixtures

Fixtures are shared with `openstrux-spec/conformance/` and must stay in sync.

| Folder | Purpose |
|---|---|
| `valid/` | Inputs that must parse and validate without errors |
| `invalid/` | Inputs that must fail with specific error codes |
| `golden/` | Expected compiled manifest outputs for valid inputs |

Fixture format follows `openstrux-spec/conformance/` naming convention:
`B001-minimal-panel/`, `B002-two-rod-pipeline/`, etc.
