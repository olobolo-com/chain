// Copyright (c) 2026 OLOBOLO ApS
//
// Canonical serialization and hashing for OLOBOLO chain entries — the
// reference implementation of SPEC-001 (schema_version "0"). This exact
// byte-for-byte behaviour is frozen: any change requires a schema_version
// bump, and old entries are always verified against their own version.
//
// Canonical form is RFC 8785 (JCS) restricted to a safer subset:
//   - object keys sorted by their UTF-8 byte sequence (bytewise, ascending)
//   - UTF-8, no BOM, no insignificant whitespace
//   - numbers must be safe integers; floats are rejected (use strings)
//   - null is rejected: an absent field is omitted, never null
//   - timestamps are RFC 3339 UTC with exactly millisecond precision

import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = '0';
export const ALGO = 'sha256';
export const GENESIS_PREV_ENTRY_HASH = '0'.repeat(64);

export const EVENT_TYPES = [
  'change.authored',
  'spec.linked',
  'change.reviewed',
  'test.evidenced',
  'release.sealed',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

/** JSON value admissible in hash input (no null, no floats). */
export type CanonicalValue =
  | string
  | number
  | boolean
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function byteCompare(a: string, b: string): number {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return Buffer.compare(ba, bb);
}

/** Serialize a value to its canonical JSON string (SPEC-001 K2). Throws on
 *  null, floats, non-finite numbers and non-JSON values. */
export function canonicalize(value: unknown, path = '$'): string {
  if (value === null) {
    throw new Error(`Canonical form forbids null at ${path} — omit the field instead.`);
  }
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isSafeInteger(value)) {
        throw new Error(
          `Canonical form allows only safe integers at ${path} — use a string for ${value}.`,
        );
      }
      return String(value);
    case 'object': {
      if (Array.isArray(value)) {
        return '[' + value.map((v, i) => canonicalize(v, `${path}[${i}]`)).join(',') + ']';
      }
      const keys = Object.keys(value as object).sort(byteCompare);
      const parts = keys.map((k) => {
        const v = (value as Record<string, unknown>)[k];
        if (v === undefined) {
          throw new Error(
            `Canonical form forbids undefined at ${path}.${k} — omit the field instead.`,
          );
        }
        return JSON.stringify(k) + ':' + canonicalize(v, `${path}.${k}`);
      });
      return '{' + parts.join(',') + '}';
    }
    default:
      throw new Error(`Value of type ${typeof value} at ${path} is not allowed in hash input.`);
  }
}

export function sha256Hex(canonical: string): string {
  return createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest('hex');
}

export function payloadHash(payload: CanonicalValue): string {
  return sha256Hex(canonicalize(payload));
}

/** The entry envelope (SPEC-001 K3). The `algo` field keeps the door open
 *  for future hash algorithms without breaking history (decided question ✅2). */
export interface Envelope {
  algo: typeof ALGO;
  schema_version: string;
  event_type: EventType;
  payload_hash: string;
  prev_entry_hash: string;
  occurred_at: string;
  org_id: string;
  repo_id: string;
  [key: string]: CanonicalValue;
}

export function assertValidEnvelope(env: Envelope): void {
  if (env.algo !== ALGO) throw new Error(`Unsupported algo "${env.algo}".`);
  if (env.schema_version !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema_version "${env.schema_version}".`);
  }
  if (!EVENT_TYPES.includes(env.event_type)) {
    throw new Error(`Unknown event_type "${env.event_type}".`);
  }
  if (!SHA256_HEX_RE.test(env.payload_hash))
    throw new Error('payload_hash must be 64 lowercase hex chars.');
  if (!SHA256_HEX_RE.test(env.prev_entry_hash))
    throw new Error('prev_entry_hash must be 64 lowercase hex chars.');
  if (!TIMESTAMP_RE.test(env.occurred_at)) {
    throw new Error(`occurred_at "${env.occurred_at}" is not RFC 3339 UTC with milliseconds.`);
  }
  if (!env.org_id) throw new Error('org_id is required.');
  if (!env.repo_id) throw new Error('repo_id is required.');
}

export function entryHash(env: Envelope): string {
  assertValidEnvelope(env);
  return sha256Hex(canonicalize(env));
}
