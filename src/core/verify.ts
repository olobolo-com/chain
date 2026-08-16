// Copyright (c) 2026 OLOBOLO ApS
//
// Pure chain verification (no filesystem, no environment): given the raw
// JSONL lines of a chain, recompute every hash and the linkage from genesis.
// This is the code path "no trust in OLOBOLO required" rests on — the same
// function runs in core, the CLI and the public verifier.

import {
  type CanonicalValue,
  type Envelope,
  GENESIS_PREV_ENTRY_HASH,
  assertValidEnvelope,
  canonicalize,
  entryHash,
  payloadHash,
  sha256Hex,
} from './canonical.js';

export interface ChainEntry {
  entry_hash: string;
  envelope: Envelope;
  payload: CanonicalValue;
}

export interface VerifyFailure {
  index: number; // 1-based entry number
  message: string;
}

export interface VerifyResult {
  ok: boolean;
  entryCount: number;
  countsByType: Record<string, number>;
  head: string;
  failures: VerifyFailure[];
}

/** Strict verification of raw JSONL lines: each line must be byte-exact
 *  canonical JSON, every hash must recompute, and prev_entry_hash must link
 *  unbroken from genesis. Tolerates trailing CR (checkout safety) and blank
 *  lines only. */
export function verifyLines(rawLines: string[]): VerifyResult {
  const lines = rawLines.map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() !== '');
  const failures: VerifyFailure[] = [];
  const counts: Record<string, number> = {};
  let prev = GENESIS_PREV_ENTRY_HASH;

  lines.forEach((line, i) => {
    const n = i + 1;
    let entry: ChainEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      failures.push({ index: n, message: 'not valid JSON' });
      return;
    }
    if (canonicalize(entry as unknown as CanonicalValue) !== line) {
      failures.push({ index: n, message: 'line is not canonical JSON' });
    }
    try {
      assertValidEnvelope(entry.envelope);
    } catch (err) {
      failures.push({ index: n, message: `invalid envelope: ${(err as Error).message}` });
      return;
    }
    if (payloadHash(entry.payload) !== entry.envelope.payload_hash) {
      failures.push({ index: n, message: 'payload_hash mismatch' });
    }
    if (entry.envelope.prev_entry_hash !== prev) {
      failures.push({ index: n, message: 'chain broken: prev_entry_hash mismatch' });
    }
    if (entryHash(entry.envelope) !== entry.entry_hash) {
      failures.push({ index: n, message: 'entry_hash mismatch' });
    }
    prev = entry.entry_hash;
    counts[entry.envelope.event_type] = (counts[entry.envelope.event_type] ?? 0) + 1;
  });

  return {
    ok: failures.length === 0,
    entryCount: lines.length,
    countsByType: counts,
    head: prev,
    failures,
  };
}

/** Convenience: verify already-parsed entries by re-serializing them. */
export function verifyEntries(entries: ChainEntry[]): VerifyResult {
  return verifyLines(entries.map((e) => canonicalize(e as unknown as CanonicalValue)));
}

export { sha256Hex };
