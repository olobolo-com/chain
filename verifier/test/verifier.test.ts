// Copyright (c) 2026 OLOBOLO ApS
//
// SPEC-010 K3/K4: the verifier judges the live chain green, judges
// tampered fixtures broken with the right entry number and exit code,
// and proves itself via selftest. CLI exit codes tested end-to-end.

import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CanonicalValue, canonicalize } from '@olobolo-com/chain';
import { runSelftest, runVerify } from '../src/lib.js';

const LIVE_CHAIN = join(import.meta.dir, '..', '..', '..', 'evidence', 'chain.jsonl');
const CLI = join(import.meta.dir, '..', 'src', 'cli.ts');

function cli(...args: string[]): { code: number; out: string } {
  const r = spawnSync('bun', [CLI, ...args], { encoding: 'utf8' });
  return { code: r.status ?? -1, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

function tamperedCopy(): string {
  const lines = readFileSync(LIVE_CHAIN, 'utf8').split('\n').filter(Boolean);
  const entry = JSON.parse(lines[2] as string) as { payload: Record<string, unknown> };
  entry.payload.loc_added = 9999;
  lines[2] = canonicalize(entry as unknown as CanonicalValue);
  const file = join(mkdtempSync(join(tmpdir(), 'verifier-test-')), 'tampered.jsonl');
  writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
  return file;
}

describe('runVerify', () => {
  test('live chain verifies green', () => {
    const v = runVerify(LIVE_CHAIN);
    expect(v.ok).toBe(true);
    expect(v.exitCode).toBe(0);
    expect(Object.keys(v.result?.countsByType ?? {}).length).toBe(5);
  });
  test('tampered copy is judged broken at the right entry', () => {
    const v = runVerify(tamperedCopy());
    expect(v.ok).toBe(false);
    expect(v.exitCode).toBe(1);
    expect(v.result?.failures.some((f) => f.index === 3)).toBe(true);
  });
  test('unreadable file exits 2', () => {
    expect(runVerify('does-not-exist.jsonl').exitCode).toBe(2);
  });
});

describe('runSelftest', () => {
  test('proves the vectors and catches the tampered variant', () => {
    const v = runSelftest();
    expect(v.ok).toBe(true);
    expect(v.exitCode).toBe(0);
  });
});

describe('CLI end-to-end', () => {
  test('verify live chain: exit 0, mentions head', () => {
    const r = cli('verify', LIVE_CHAIN);
    expect(r.code).toBe(0);
    expect(r.out).toContain('chain intact');
    expect(r.out).toContain('head:');
  });
  test('verify tampered: exit 1, names the entry', () => {
    const r = cli('verify', tamperedCopy());
    expect(r.code).toBe(1);
    expect(r.out).toContain('FAIL entry 3');
  });
  test('verify --json is machine-readable', () => {
    const r = cli('verify', LIVE_CHAIN, '--json');
    const parsed = JSON.parse(r.out);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.entryCount).toBeGreaterThan(0);
  });
  test('selftest: exit 0', () => {
    expect(cli('selftest').code).toBe(0);
  });
  test('unknown command: exit 2', () => {
    expect(cli('frobnicate').code).toBe(2);
  });
});
