// Copyright (c) 2026 OLOBOLO ApS
//
// The verifier's working parts, separated from the CLI shell so tests can
// call them directly. All verification logic lives in @olobolo-com/chain —
// this file only adds reading, self-testing and presentation.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  type CanonicalValue,
  type ChainEntry,
  type VerifyResult,
  canonicalize,
  verifyLines,
} from '@olobolo-com/chain';

export interface Verdict {
  command: 'verify' | 'selftest';
  ok: boolean;
  exitCode: 0 | 1 | 2;
  result?: VerifyResult;
  error?: string;
}

/** Verify a chain file. Exit 0 = intact, 1 = broken, 2 = unreadable. */
export function runVerify(file: string): Verdict {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    return {
      command: 'verify',
      ok: false,
      exitCode: 2,
      error: `could not read ${file}: ${(err as Error).message}`,
    };
  }
  const result = verifyLines(raw.split('\n'));
  if (result.entryCount === 0) {
    return {
      command: 'verify',
      ok: false,
      exitCode: 2,
      error: `${file} contains no chain entries`,
    };
  }
  return { command: 'verify', ok: result.ok, exitCode: result.ok ? 0 : 1, result };
}

interface VectorFile {
  vectors: { entry_hash: string; envelope: ChainEntry['envelope']; payload: CanonicalValue }[];
}

function loadVectors(): VectorFile {
  const require = createRequire(import.meta.url);
  return JSON.parse(readFileSync(require.resolve('@olobolo-com/chain/test-vectors.json'), 'utf8'));
}

/** The verifier proves itself before judging others: the bundled SPEC-001
 *  vectors must verify, and a deliberately tampered copy must NOT. */
export function runSelftest(): Verdict {
  const { vectors } = loadVectors();
  const lines = vectors.map((v) =>
    canonicalize({
      entry_hash: v.entry_hash,
      envelope: v.envelope,
      payload: v.payload,
    } as unknown as CanonicalValue),
  );

  const clean = verifyLines(lines);
  // 33 vectors: 15 frozen v0 + 18 v1 (SPEC-031), across all six event types.
  if (!clean.ok || clean.entryCount !== 33 || Object.keys(clean.countsByType).length !== 6) {
    return {
      command: 'selftest',
      ok: false,
      exitCode: 1,
      result: clean,
      error: 'bundled test vectors did NOT verify — this verifier build is broken',
    };
  }

  const tamperedEntry = JSON.parse(lines[7] as string) as {
    payload: Record<string, unknown>;
  };
  tamperedEntry.payload.tampered = 'yes';
  const tampered = [...lines];
  tampered[7] = canonicalize(tamperedEntry as unknown as CanonicalValue);
  const caught = verifyLines(tampered);
  if (caught.ok || !caught.failures.some((f) => f.index === 8)) {
    return {
      command: 'selftest',
      ok: false,
      exitCode: 1,
      error: 'tampered vector was NOT detected — this verifier build is broken',
    };
  }

  return { command: 'selftest', ok: true, exitCode: 0, result: clean };
}

/** Human-readable verdict (calm, precise — the report's section 6 voice). */
export function formatVerdict(v: Verdict): string {
  const out: string[] = [];
  if (v.error && !v.result) {
    out.push(`error: ${v.error}`);
    return out.join('\n');
  }
  const r = v.result as VerifyResult;
  if (v.command === 'selftest') {
    out.push(
      v.ok
        ? 'selftest: OK — 33 bundled vectors (v0+v1) verify, and a tampered copy is correctly rejected.'
        : `selftest: FAILED — ${v.error ?? 'unknown reason'}`,
    );
    return out.join('\n');
  }
  if (v.ok) {
    out.push(`chain intact — ${r.entryCount} entries verified.`);
  } else {
    for (const f of r.failures) out.push(`FAIL entry ${f.index}: ${f.message}`);
    out.push(`chain BROKEN — ${r.failures.length} failure(s) across ${r.entryCount} entries.`);
  }
  const types = Object.entries(r.countsByType)
    .map(([t, c]) => `${t}=${c}`)
    .join(' ');
  out.push(`by type: ${types}`);
  out.push(`head: ${r.head}`);
  return out.join('\n');
}
