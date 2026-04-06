## ADDED Requirements

### Requirement: Group rod generates key-based partitioning code
The Next.js adapter SHALL generate a `reduce`-based grouping statement that partitions an input array by a configurable key field. The output variable SHALL be named `grouped` with type `Record<string, unknown[]>`. The key field SHALL default to `id` when `cfg.key` is not specified.

#### Scenario: Group with default key
- **WHEN** a group rod has no `cfg.key` specified
- **THEN** the emitter generates code partitioning by `"id"` field

#### Scenario: Group with configured key
- **WHEN** a group rod has `cfg.key` set to `"category"`
- **THEN** the emitter generates code partitioning by `"category"` field

### Requirement: Aggregate rod generates associative reduction code
The Next.js adapter SHALL generate reduction code for the aggregate rod. The `cfg.fn` knot SHALL select the reduction function from: count, sum, avg, min, max. The output variable SHALL be named `aggregated` with type `number`. The `cfg.field` knot SHALL specify which field to aggregate over.

#### Scenario: Count aggregation
- **WHEN** an aggregate rod has `cfg.fn` set to `"count"`
- **THEN** the emitter generates code using `.length`

#### Scenario: Sum aggregation with field
- **WHEN** an aggregate rod has `cfg.fn` set to `"sum"` and `cfg.field` set to `"amount"`
- **THEN** the emitter generates code using `.reduce()` accessing the `"amount"` field

#### Scenario: Unrecognised aggregation function
- **WHEN** an aggregate rod has `cfg.fn` set to an unknown value
- **THEN** the emitter generates a STRUX-STUB comment and passes input through

### Requirement: Merge rod generates array concatenation code
The Next.js adapter SHALL generate spread-concat code that ensures the upstream output is wrapped in an array. The output variable SHALL be named `merged` with the same type as the input.

#### Scenario: Merge with array input
- **WHEN** a merge rod receives array input
- **THEN** the emitter generates code spreading the input into a new array

### Requirement: Join rod generates key-based join code
The Next.js adapter SHALL generate a named helper function `join{PascalName}()` that builds a right-side index via Map and performs the join. The `cfg.mode` knot SHALL select the join mode from: inner (default), left, outer. The `cfg.key` knot SHALL specify the join key (default: `id`).

#### Scenario: Inner join (default)
- **WHEN** a join rod has no `cfg.mode` specified
- **THEN** the emitter generates an inner join filtering left items that have matching right keys

#### Scenario: Left join
- **WHEN** a join rod has `cfg.mode` set to `"left"`
- **THEN** the emitter generates a left join including all left items with optional right matches

#### Scenario: Join helper function naming
- **WHEN** a join rod is named `"join-op"`
- **THEN** the generated helper function is named `joinJoinOp`

### Requirement: Window rod generates timestamp-based batch windowing code
The Next.js adapter SHALL generate bucket-assignment code that groups items by timestamp field into fixed-size time windows. The `cfg.type` knot SHALL specify the window type (default: `fixed`). The `cfg.size` knot SHALL specify window duration using duration syntax (ms, s, m, h, d; default: `1h`). The `cfg.field` knot SHALL specify the timestamp field (default: `timestamp`).

#### Scenario: Default fixed window
- **WHEN** a window rod has no configuration
- **THEN** the emitter generates 1-hour fixed windows bucketing by `"timestamp"` field

#### Scenario: Custom duration parsing
- **WHEN** a window rod has `cfg.size` set to `"30m"`
- **THEN** the emitter generates windows with 1800000ms bucket size

#### Scenario: Window output shape
- **WHEN** a window rod generates output
- **THEN** the output variable is `windowed` with type `Record<string, unknown[]>`
