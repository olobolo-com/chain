// Copyright (c) 2026 OLOBOLO ApS
//
// Deterministic generator for test-vectors.json (SPEC-001 K6): three fully
// worked events per event type, chained from genesis, with the canonical
// strings and expected hashes any independent implementation must reproduce.
// Everything here is fixed data — running it twice gives identical bytes.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALGO,
  CURRENT_SCHEMA_VERSION,
  type Envelope,
  type EventType,
  GENESIS_PREV_ENTRY_HASH,
  SCHEMA_VERSION,
  canonicalize,
  entryHash,
  payloadHash,
  sha256Hex,
} from '../src/core/canonical.js';
import type { Actor, ActorRef, EventPayload } from '../src/core/events.js';

const ORG_ID = 'org_01J5ZX3D8LQV9W2K4M6N8P0R2T';
const REPO_ID = 'repo_01J5ZX3EHM4B6D8F0H2K4M6P8R';

const agent: Actor = {
  actor_id: 'act_01J5ZX3F0AGENT00000000000001',
  actor_type: 'agent',
  git_identity: 'bolosolo',
  agent_tool: 'claude-code',
  agent_model: 'claude-fable-5',
  agent_version: '2.x',
};

const human: Actor = {
  actor_id: 'act_01J5ZX3F0HUMAN00000000000001',
  actor_type: 'human',
  git_identity: 'bolosolo',
};

/** Deterministic pseudo content hash: sha-256 of a labelled fixture string. */
const fx = (label: string) => sha256Hex(`olobolo-test-vector-fixture:${label}`);

const t = (minute: number) => `2026-08-16T10:${String(minute).padStart(2, '0')}:00.000Z`;

// v1 actors (SPEC-031): pseudonymous — fixed UUIDs (deterministic fixture
// data; real ids are randomly generated), no git_identity anywhere.
const agentV1: ActorRef = {
  actor_id: 'a7f3b2c1-4d5e-4f60-8a9b-0c1d2e3f4a5b',
  actor_type: 'agent',
  agent_tool: 'claude-code',
  agent_model: 'claude-fable-5',
  agent_version: '2.x',
};

const humanV1: ActorRef = {
  actor_id: 'e1d2c3b4-a596-4877-b958-a39b8c7d6e5f',
  actor_type: 'human',
};

// Three rounds of the full story: authored → linked → reviewed → evidenced
// → sealed. Seal payloads reference entry hashes, so they are filled in
// while the chain is built.
interface Fixture {
  event_type: EventType;
  occurred_at: string;
  schema_version?: string; // default '0' — the frozen original vectors
  payload: EventPayload | ((entryHashes: string[]) => EventPayload);
}

const round = (n: number, author: Actor, version: string): Fixture[] => {
  const base = (n - 1) * 5;
  const sha = fx(`commit-${n}`).slice(0, 40);
  return [
    {
      event_type: 'change.authored',
      occurred_at: t(base),
      payload: {
        commit_sha: sha,
        diff_fingerprint: fx(`diff-${n}`),
        file_paths: [`src/module${n}.ts`, `test/module${n}.test.ts`],
        actor: author,
        ...(author.actor_type === 'agent'
          ? { session_ref: `ses_0000000000000000000000000${n}`, session_hash: fx(`session-${n}`) }
          : {}),
        loc_added: 40 + n,
        loc_removed: 5 * n,
      },
    },
    {
      event_type: 'spec.linked',
      occurred_at: t(base + 1),
      payload: {
        change_ref: sha,
        spec_ref: `SPEC-00${n}`,
        spec_version: '1.0',
        spec_hash: fx(`spec-${n}`),
        linked_at: t(base + 1),
      },
    },
    {
      event_type: 'change.reviewed',
      occurred_at: t(base + 2),
      payload: {
        change_ref: sha,
        reviewer: author.actor_type === 'agent' ? human : agent,
        decision: n === 2 ? 'changes' : 'approved',
        thread_ref: `https://github.com/olobolo-com/olobolo/pull/${n}`,
        decided_at: t(base + 2),
      },
    },
    {
      event_type: 'test.evidenced',
      occurred_at: t(base + 3),
      payload: {
        change_ref: sha,
        result: n === 2 ? 'failed' : 'passed',
        tests_passed: 100 + n,
        tests_failed: n === 2 ? 3 : 0,
        coverage_pct: n === 3 ? '91.4' : '87.5',
        ci_run_ref: `https://github.com/olobolo-com/olobolo/actions/runs/${1000 + n}`,
        artifact_hashes: [fx(`artifact-${n}-a`), fx(`artifact-${n}-b`)],
      },
    },
    {
      event_type: 'release.sealed',
      occurred_at: t(base + 4),
      payload: (hashes: string[]) => ({
        version,
        first_entry_hash: hashes[0],
        last_entry_hash: hashes[hashes.length - 1],
        chain_hash: sha256Hex(hashes.join('')),
        sealed_at: t(base + 4),
      }),
    },
  ];
};

// v1 rounds (SPEC-031/ADR-005): the five types with pseudonymous actors,
// plus admin.actioned. Chained directly onto the v0 head — one continuous
// chain across the version bump, exactly as a real migrated chain looks.
const roundV1 = (n: number, author: ActorRef, version: string): Fixture[] => {
  const m = n + 3; // continue the minute/fixture numbering after v0's rounds
  const base = (m - 1) * 6;
  const sha = fx(`commit-${m}`).slice(0, 40);
  const v1 = { schema_version: CURRENT_SCHEMA_VERSION };
  return [
    {
      ...v1,
      event_type: 'change.authored',
      occurred_at: t(base),
      payload: {
        commit_sha: sha,
        diff_fingerprint: fx(`diff-${m}`),
        file_paths: [`src/module${m}.ts`, `test/module${m}.test.ts`],
        actor: author,
        ...(author.actor_type === 'agent'
          ? { session_ref: `ses_0000000000000000000000000${m}`, session_hash: fx(`session-${m}`) }
          : {}),
        loc_added: 40 + m,
        loc_removed: 5 * m,
      } as never,
    },
    {
      ...v1,
      event_type: 'spec.linked',
      occurred_at: t(base + 1),
      payload: {
        change_ref: sha,
        spec_ref: `SPEC-00${m}`,
        spec_version: '1.0',
        spec_hash: fx(`spec-${m}`),
        linked_at: t(base + 1),
      },
    },
    {
      ...v1,
      event_type: 'change.reviewed',
      occurred_at: t(base + 2),
      payload: {
        change_ref: sha,
        reviewer: author.actor_type === 'agent' ? humanV1 : agentV1,
        decision: n === 2 ? 'changes' : 'approved',
        thread_ref: `https://github.com/olobolo-com/olobolo/pull/${m}`,
        decided_at: t(base + 2),
      } as never,
    },
    {
      ...v1,
      event_type: 'test.evidenced',
      occurred_at: t(base + 3),
      payload: {
        change_ref: sha,
        result: n === 2 ? 'failed' : 'passed',
        tests_passed: 100 + m,
        tests_failed: n === 2 ? 3 : 0,
        coverage_pct: n === 3 ? '93.1' : '88.2',
        ci_run_ref: `https://github.com/olobolo-com/olobolo/actions/runs/${1000 + m}`,
        artifact_hashes: [fx(`artifact-${m}-a`), fx(`artifact-${m}-b`)],
      },
    },
    {
      ...v1,
      event_type: 'admin.actioned',
      occurred_at: t(base + 4),
      payload: {
        action: n === 2 ? 'actor.deleted' : n === 3 ? 'badge.revoked' : 'plan.changed',
        subject_ref: n === 2 ? 'e1d2c3b4-a596-4877-b958-a39b8c7d6e5f' : n === 3 ? REPO_ID : ORG_ID,
        actor: agentV1,
        details_hash: fx(`admin-${m}`),
        actioned_at: t(base + 4),
      },
    },
    {
      ...v1,
      event_type: 'release.sealed',
      occurred_at: t(base + 5),
      payload: (hashes: string[]) => ({
        version,
        first_entry_hash: hashes[0],
        last_entry_hash: hashes[hashes.length - 1],
        chain_hash: sha256Hex(hashes.join('')),
        sealed_at: t(base + 5),
      }),
    },
  ];
};

const fixtures: Fixture[] = [
  ...round(1, agent, '0.0.1'),
  ...round(2, human, '0.0.2'),
  ...round(3, agent, '0.1.0'),
  ...roundV1(1, agentV1, '1.0.0'),
  ...roundV1(2, humanV1, '1.0.1'),
  ...roundV1(3, agentV1, '1.1.0'),
];

const entryHashes: string[] = [];
let prev = GENESIS_PREV_ENTRY_HASH;

const vectors = fixtures.map((f, i) => {
  const payload = (typeof f.payload === 'function' ? f.payload(entryHashes) : f.payload) as never;
  const canonicalPayload = canonicalize(payload);
  const pHash = payloadHash(payload);
  const envelope: Envelope = {
    algo: ALGO,
    schema_version: f.schema_version ?? SCHEMA_VERSION,
    event_type: f.event_type,
    payload_hash: pHash,
    prev_entry_hash: prev,
    occurred_at: f.occurred_at,
    org_id: ORG_ID,
    repo_id: REPO_ID,
  };
  const canonicalEnvelope = canonicalize(envelope);
  const eHash = entryHash(envelope);
  entryHashes.push(eHash);
  prev = eHash;
  return {
    seq: i + 1,
    event_type: f.event_type,
    payload,
    canonical_payload: canonicalPayload,
    payload_hash: pHash,
    envelope,
    canonical_envelope: canonicalEnvelope,
    entry_hash: eHash,
  };
});

const out = {
  $schema_note:
    'SPEC-001 test vectors. Any implementation must reproduce every payload_hash and entry_hash from the payload/envelope objects alone; the canonical_* strings show the exact hash input (UTF-8, no BOM). Vectors 1-15 are the frozen v0 originals (byte-identical forever); vectors 16-33 are schema_version 1 (SPEC-031: pseudonymous actors + admin.actioned), chained onto the v0 head as one continuous chain.',
  schema_versions: [SCHEMA_VERSION, CURRENT_SCHEMA_VERSION],
  algo: ALGO,
  genesis_prev_entry_hash: GENESIS_PREV_ENTRY_HASH,
  vector_count: vectors.length,
  v0_vector_count: 15,
  vectors,
};

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-vectors.json');
writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Wrote ${vectors.length} vectors to ${file}`);
console.log(`Chain head: ${prev}`);
