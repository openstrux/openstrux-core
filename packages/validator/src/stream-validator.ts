/**
 * Stream config field validator.
 *
 * For write-data rods with stream targets, validates that required fields
 * are present. Also recognizes DataTarget type paths.
 *
 * Emits:
 *   E_STREAM_MISSING_FIELD — required field missing for stream adapter
 *   E_STREAM_UNKNOWN_ADAPTER — unrecognized stream adapter type
 *
 * Recognized DataTarget type paths:
 *   stream.kafka    requires: brokers, topic  (credentials optional)
 *   stream.pubsub   requires: project, topic
 *   stream.kinesis  requires: region, stream_name  (credentials optional)
 *   db.sql.postgres, db.sql.mysql, db.sql.bigquery  (DB targets — no deep field check)
 *   db.nosql.mongodb, db.nosql.dynamodb, db.nosql.firestore
 */

import type { KnotValue, PanelNode } from "@openstrux/parser";
import type { ValidationDiagnostic } from "./diagnostics.js";

/** Known DataTarget type paths and their required fields. */
const STREAM_REQUIRED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  "stream.kafka":   ["brokers", "topic"],
  "stream.pubsub":  ["project", "topic"],
  "stream.kinesis": ["region", "stream_name"],
};

/** All recognized DataTarget top-level paths (stream.* and db.*). */
const KNOWN_DATA_TARGET_PREFIXES = new Set(["stream", "db"]);

/** Known stream adapter names. */
const KNOWN_STREAM_ADAPTERS = new Set(["kafka", "pubsub", "kinesis"]);

export function validateStreamConfigs(panels: readonly PanelNode[]): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const panel of panels) {
    for (const rod of panel.rods) {
      if (rod.rodType !== "write-data") continue;

      const targetValue = rod.knots["target"];
      if (targetValue === undefined || targetValue.kind !== "path") continue;

      const segments = targetValue.segments;
      if (segments.length < 2) continue;

      const top = segments[0];
      if (!KNOWN_DATA_TARGET_PREFIXES.has(top ?? "")) continue;

      // Only deep-validate stream targets
      if (top !== "stream") continue;

      const adapter = segments[1];
      if (adapter === undefined) continue;

      if (!KNOWN_STREAM_ADAPTERS.has(adapter)) {
        diagnostics.push({
          code: "E_STREAM_UNKNOWN_ADAPTER",
          message: `Unknown stream adapter '${adapter}' in rod '${rod.name}' of panel '${panel.name}'. Known: ${[...KNOWN_STREAM_ADAPTERS].join(", ")}`,
          severity: "error",
          line: rod.loc?.line,
          col: rod.loc?.col,
          panel: panel.name,
          rod: rod.name,
        });
        continue;
      }

      const pathKey = `stream.${adapter}`;
      const requiredFields = STREAM_REQUIRED_FIELDS[pathKey];
      if (requiredFields === undefined) continue;

      const config: Record<string, KnotValue> = targetValue.config ?? {};
      for (const field of requiredFields) {
        if (!(field in config)) {
          diagnostics.push({
            code: "E_STREAM_MISSING_FIELD",
            message: `stream.${adapter} target in rod '${rod.name}' of panel '${panel.name}' is missing required field '${field}'`,
            severity: "error",
            line: rod.loc?.line,
            col: rod.loc?.col,
            panel: panel.name,
            rod: rod.name,
          });
        }
      }
    }
  }

  return diagnostics;
}
