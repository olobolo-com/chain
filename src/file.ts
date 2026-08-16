// Copyright (c) 2026 OLOBOLO ApS
//
// File layer: the append-only JSONL chain file on top of the pure core.
// Generic — the caller supplies the file path and chain identity; nothing
// here knows about a specific repo, config or workflow.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  ALGO,
  type CanonicalValue,
  type Envelope,
  type EventType,
  GENESIS_PREV_ENTRY_HASH,
  SCHEMA_VERSION,
  canonicalize,
  entryHash,
  payloadHash,
} from './core/canonical.js';
import { type ChainEntry, type VerifyResult, verifyLines } from './core/verify.js';

export interface ChainIdentity {
  org_id: string;
  repo_id: string;
}

export function readChain(file: string): ChainEntry[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as ChainEntry);
}

export function chainHead(file: string): string {
  return readChain(file).at(-1)?.entry_hash ?? GENESIS_PREV_ENTRY_HASH;
}

/** Build, hash and append one entry to the chain file. Returns the entry. */
export function appendEntry(
  file: string,
  eventType: EventType,
  occurredAt: string,
  payload: CanonicalValue,
  identity: ChainIdentity,
): ChainEntry {
  const envelope: Envelope = {
    algo: ALGO,
    schema_version: SCHEMA_VERSION,
    event_type: eventType,
    payload_hash: payloadHash(payload),
    prev_entry_hash: chainHead(file),
    occurred_at: occurredAt,
    org_id: identity.org_id,
    repo_id: identity.repo_id,
  };
  const entry: ChainEntry = { entry_hash: entryHash(envelope), envelope, payload };
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, canonicalize(entry as unknown as CanonicalValue) + '\n', 'utf8');
  return entry;
}

/** Verify a chain file end-to-end (strict, byte-exact). */
export function verifyChainFile(file: string): VerifyResult {
  if (!existsSync(file)) {
    return {
      ok: true,
      entryCount: 0,
      countsByType: {},
      head: GENESIS_PREV_ENTRY_HASH,
      failures: [],
    };
  }
  return verifyLines(readFileSync(file, 'utf8').split('\n'));
}
