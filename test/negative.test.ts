// Copyright (c) 2026 OLOBOLO ApS
//
// SPEC-005 K4 negative cases: what the format forbids must throw, and what
// tampering produces must be detected — loudly, with the entry number.

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type CanonicalValue,
  type Envelope,
  appendEntry,
  canonicalize,
  entryHash,
  verifyChainFile,
  verifyLines,
} from '../src/index.js';

const T = '2026-08-16T10:00:00.000Z';
const ID = { org_id: 'org_test', repo_id: 'repo_test' };

describe('canonicalize rejects forbidden values', () => {
  test('null', () => {
    expect(() => canonicalize({ a: null } as unknown as CanonicalValue)).toThrow(/null/);
  });
  test('floats', () => {
    expect(() => canonicalize({ a: 1.5 })).toThrow(/integers/);
  });
  test('undefined object values', () => {
    expect(() => canonicalize({ a: undefined } as unknown as CanonicalValue)).toThrow(/undefined/);
  });
  test('non-JSON values', () => {
    expect(() => canonicalize({ a: () => 1 } as unknown as CanonicalValue)).toThrow(/not allowed/);
  });
});

describe('entryHash rejects invalid envelopes', () => {
  const valid: Envelope = {
    algo: 'sha256',
    schema_version: '0',
    event_type: 'change.authored',
    payload_hash: 'a'.repeat(64),
    prev_entry_hash: '0'.repeat(64),
    occurred_at: T,
    org_id: 'o',
    repo_id: 'r',
  };
  test('wrong algo', () => {
    expect(() => entryHash({ ...valid, algo: 'md5' as never })).toThrow(/algo/);
  });
  test('bad timestamp precision', () => {
    expect(() => entryHash({ ...valid, occurred_at: '2026-08-16T10:00:00Z' })).toThrow(/RFC 3339/);
  });
  test('unknown event type', () => {
    expect(() => entryHash({ ...valid, event_type: 'change.deleted' as never })).toThrow(
      /event_type/,
    );
  });
});

describe('verification detects tampering', () => {
  function chainOf(n: number): string {
    const dir = mkdtempSync(join(tmpdir(), 'chain-test-'));
    const file = join(dir, 'chain.jsonl');
    for (let i = 0; i < n; i++) {
      appendEntry(file, 'change.authored', T, { commit_sha: `c${i}`, n: i }, ID);
    }
    return file;
  }

  test('a clean chain verifies', () => {
    const file = chainOf(3);
    const r = verifyChainFile(file);
    expect(r.ok).toBe(true);
    expect(r.entryCount).toBe(3);
    rmSync(join(file, '..'), { recursive: true, force: true });
  });

  test('tampered payload is detected', () => {
    const file = chainOf(3);
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const entry = JSON.parse(lines[1]);
    entry.payload.n = 999;
    lines[1] = canonicalize(entry);
    const r = verifyLines(lines);
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.index === 2 && /payload_hash/.test(f.message))).toBe(true);
    rmSync(join(file, '..'), { recursive: true, force: true });
  });

  test('removed entry breaks the linkage', () => {
    const file = chainOf(3);
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    lines.splice(1, 1);
    const r = verifyLines(lines);
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => /prev_entry_hash/.test(f.message))).toBe(true);
    rmSync(join(file, '..'), { recursive: true, force: true });
  });

  test('non-canonical line is rejected even with correct hashes', () => {
    const file = chainOf(1);
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const entry = JSON.parse(lines[0]);
    const pretty = JSON.stringify(entry); // key order preserved but not canonical ordering guarantees
    const r = verifyLines([`${pretty} `]); // trailing space breaks byte-exactness
    expect(r.ok).toBe(false);
    rmSync(join(file, '..'), { recursive: true, force: true });
  });
});
