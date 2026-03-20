# @openstrux/config

OpenStrux config resolution — strux.context cascade.

Implements config inheritance (CI-001 through CI-009) from the OpenStrux specification:
walking ancestor directories to collect `strux.context` files, merging `@dp`, `@access`,
`@ops`, `@sec`, and named `@source`/`@target` endpoints with nearest-wins semantics.
