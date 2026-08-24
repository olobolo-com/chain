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

describe('SPEC-001 test vectors (v0 frozen + v1 additions)', () => {
  test('has 33 vectors: 15 frozen v0 + 18 v1 (SPEC-031/ADR-005)', () => {
    expect(data.vectors.length).toBe(33);
    expect(data.vectors.slice(0, 15).every((v) => v.envelope.schema_version === '0')).toBe(true);
    expect(data.vectors.slice(15).every((v) => v.envelope.schema_version === '1')).toBe(true);
  });

  test('v0 vectors are the frozen originals (head unchanged forever)', () => {
    expect(data.vectors[14]?.entry_hash).toBe(
      '155288257afe338b96dbcde55e8290065f821d9576df8e4471966e7c1cd98fa0',
    );
  });

  test('v1 payloads carry no identity fields (SPEC-031 K1)', () => {
    for (const v of data.vectors.slice(15)) {
      expect(JSON.stringify(v.payload)).not.toContain('git_identity');
    }
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
    expect(result.entryCount).toBe(33);
    expect(Object.keys(result.countsByType).length).toBe(6);
    expect(result.countsByType['admin.actioned']).toBe(3);
  });
});
