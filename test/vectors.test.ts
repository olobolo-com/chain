// Copyright (c) 2026 OLOBOLO ApS
//
// SPEC-005 K2: the 15 frozen SPEC-001 test vectors must pass byte-exactly
// through the package — canonical strings, payload hashes, entry hashes and
// the chain linkage from genesis.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type CanonicalValue,
  type Envelope,
  GENESIS_PREV_ENTRY_HASH,
  canonicalize,
  entryHash,
  payloadHash,
  verifyLines,
} from '../src/index.js';

const data = JSON.parse(readFileSync(join(import.meta.dir, '..', 'test-vectors.json'), 'utf8')) as {
  vectors: {
    seq: number;
    payload: CanonicalValue;
    canonical_payload: string;
    payload_hash: string;
    envelope: Envelope;
    canonical_envelope: string;
    entry_hash: string;
  }[];
};

describe('SPEC-001 test vectors (frozen)', () => {
  test('has 15 vectors', () => {
    expect(data.vectors.length).toBe(15);
  });

  for (const v of data.vectors) {
    test(`vector ${v.seq}: canonical strings and hashes reproduce`, () => {
      expect(canonicalize(v.payload)).toBe(v.canonical_payload);
      expect(payloadHash(v.payload)).toBe(v.payload_hash);
      expect(canonicalize(v.envelope as unknown as CanonicalValue)).toBe(v.canonical_envelope);
      expect(entryHash(v.envelope)).toBe(v.entry_hash);
    });
  }

  test('vectors form an unbroken chain from genesis', () => {
    let prev = GENESIS_PREV_ENTRY_HASH;
    for (const v of data.vectors) {
      expect(v.envelope.prev_entry_hash).toBe(prev);
      prev = v.entry_hash;
    }
  });

  test('verifyLines accepts the vectors as a chain', () => {
    const lines = data.vectors.map((v) =>
      canonicalize({
        entry_hash: v.entry_hash,
        envelope: v.envelope,
        payload: v.payload,
      } as unknown as CanonicalValue),
    );
    const result = verifyLines(lines);
    expect(result.ok).toBe(true);
    expect(result.entryCount).toBe(15);
    expect(Object.keys(result.countsByType).length).toBe(5);
  });
});
