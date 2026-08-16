<!-- Copyright (c) 2026 OLOBOLO ApS -->

# @olobolo-com/chain

Canonical serialization, hashing and verification for OLOBOLO evidence
chains — the reference implementation of the frozen chain format
(`schema_version "0"`, see [FORMAT.md](./FORMAT.md)). The exact same code
runs in the collector CLI, the server and the public verifier: one
implementation, zero drift, **no trust in OLOBOLO required**.

## Layout

- **Pure core** (`verifyLines`, `canonicalize`, `payloadHash`, `entryHash`,
  event/envelope types) — no filesystem, no environment. Everything a
  third-party verifier needs.
- **File layer** (`readChain`, `appendEntry`, `chainHead`,
  `verifyChainFile`) — the append-only JSONL chain file on top of the core.

## Verify a chain

```ts
import { verifyChainFile } from '@olobolo-com/chain';

const result = verifyChainFile('evidence/chain.jsonl');
// { ok, entryCount, countsByType, head, failures }
```

Every line is checked byte-exactly: canonical JSON form, `payload_hash`,
`entry_hash`, and the `prev_entry_hash` linkage from genesis (64×"0").
Any tampering — a changed byte, a reordered key, a removed entry — surfaces
as a failure with the entry number.

## Append an entry

```ts
import { appendEntry } from '@olobolo-com/chain';

appendEntry('evidence/chain.jsonl', 'change.authored', occurredAt, payload, {
  org_id: 'org_…',
  repo_id: 'repo_…',
});
```

Payloads are metadata only — hashes, references and counts. Source code,
prompts, spec text, review comments and test output never enter a chain.

## Test vectors

[`test-vectors.json`](./test-vectors.json) contains 15 chained vectors
(three per event type) with canonical strings and expected hashes. Any
independent implementation must reproduce every hash from the
`payload`/`envelope` objects alone — `bun test` proves this package does.

## Format stability

`schema_version "0"` is frozen: serialization and hashing never change.
Format evolution happens only through new schema versions; old entries are
always verified against their own version. Entries you write today must
verify in ten years.
