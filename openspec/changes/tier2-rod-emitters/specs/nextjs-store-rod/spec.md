## ADDED Requirements

### Requirement: Store rod generates state management calls
The Next.js adapter SHALL generate `stateStore` method calls for the store rod. The `cfg.mode` knot SHALL select the operation from: get (default), put, delete, cas, increment. The `cfg.backend` knot SHALL specify the backend type (emitted as a comment). The `cfg.namespace` knot SHALL specify the state namespace (defaults to rod name). The output variable SHALL be named `storeResult` with type `unknown`.

#### Scenario: Get mode (default)
- **WHEN** a store rod has no `cfg.mode` specified
- **THEN** the emitter generates `stateStore.get(namespace, key)` call

#### Scenario: Put mode with namespace
- **WHEN** a store rod has `cfg.mode` set to `"put"` and `cfg.namespace` set to `"sessions"`
- **THEN** the emitter generates `stateStore.put("sessions", key, value)` call

#### Scenario: Backend comment
- **WHEN** a store rod has `cfg.backend` set to `"redis"`
- **THEN** the generated code includes a comment indicating `backend=redis`

#### Scenario: Increment mode
- **WHEN** a store rod has `cfg.mode` set to `"increment"`
- **THEN** the emitter generates `stateStore.increment(namespace, key)` call

#### Scenario: Unrecognised mode
- **WHEN** a store rod has `cfg.mode` set to an unknown value
- **THEN** the emitter generates a STRUX-STUB comment and passes input through
