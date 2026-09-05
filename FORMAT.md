<!-- Copyright (c) 2026 OLOBOLO ApS -->

# OLOBOLO chain format — schema_version "0" and "1"

Normative definition of the OLOBOLO evidence-chain entry format (SPEC-001;
version 1 per SPEC-031). Every shipped version is frozen: its serialization
never changes. Format evolution happens only by introducing a new schema
version; old entries are always verified against their own version. The
sections below define version 0; [Version 1](#schema_version-1) lists
exactly what changed.

## Event types

Five event types, metadata only — hashes, references and counts. Source
code, prompts, spec text, review comments and test output never enter the
chain. Payload field shapes are defined in [`events.ts`](./events.ts):

| Event type | Meaning |
|---|---|
| `change.authored` | A commit came into being (who/what wrote it) |
| `spec.linked` | A change is tied to the spec that authorized it |
| `change.reviewed` | A decision was made about a change |
| `test.evidenced` | A CI run produced evidence for a change |
| `release.sealed` | A version is bound to a chain segment, forever |

## Canonical serialization

Canonical form is JSON, compatible with RFC 8785 (JCS) restricted to a
stricter subset:

1. Object keys sorted by their UTF-8 byte sequence, ascending (bytewise).
2. UTF-8 without BOM; no insignificant whitespace.
3. Numbers must be safe integers. Floats never enter hash input — decimal
   values (e.g. coverage percentages) are carried as strings.
4. `null` is forbidden. An absent field is omitted entirely; omitted ≠ null.
5. Timestamps are RFC 3339 UTC with exactly millisecond precision:
   `2026-08-16T10:00:00.000Z`.
6. String escaping is standard minimal JSON escaping (as JCS): only `"`,
   `\` and control characters are escaped; no unicode normalization.

## Hashing and chaining

```
payload_hash = sha256( canonicalize(payload) )
entry_hash   = sha256( canonicalize(envelope) )
```

The envelope contains exactly:

```json
{
  "algo": "sha256",
  "schema_version": "0",
  "event_type": "change.authored",
  "payload_hash": "<64 hex>",
  "prev_entry_hash": "<64 hex>",
  "occurred_at": "2026-08-16T10:00:00.000Z",
  "org_id": "org_…",
  "repo_id": "repo_…"
}
```

- The chain is append-only. Corrections are new events referencing the
  flawed entry — never edits.
- The genesis entry's `prev_entry_hash` is 64 × `"0"`.
- `algo` and `schema_version` are part of the hash input; both are frozen
  per version, and `algo` keeps the door open for future hash algorithms
  without breaking history.

## schema_version "1"

Version 1 keeps the envelope, the canonical serialization and the hashing
rules above unchanged — an implementation of v0 hashes v1 entries without
modification. What changed is the payload rules (`events.ts`, the `V1`
schemas):

1. **Pseudonymous actors.** `actor` / `reviewer` carry `actor_id` (a random
   v4 UUID assigned on first appearance), `actor_type` and optional
   `agent_tool` / `agent_model` / `agent_version` — never a git identity,
   username, e-mail or display name. Identities live outside the chain in a
   deletable register.
2. **Whitelisted shapes.** Free-text references (`change_ref`, `spec_ref`,
   `session_ref`, `ci_run_ref`, `thread_ref`, `subject_ref`) match
   `^[\w./:#?=&%+-]+$`; `commit_sha` is 7-40 hex; `version` matches
   `^[\w.+-]+$`; `file_paths` exclude `<`, `>` and control characters. Identity-
   looking content is rejected by the contract, not by convention.
3. **New event type `admin.actioned`** (v1 only): an administrative act —
   `actor.deleted`, `plan.changed`, `badge.revoked`, `content.published`,
   `price.changed` — with `subject_ref`, a pseudonymous `actor`, optional
   `details_hash` and `actioned_at`. An envelope with `schema_version: "0"`
   and `event_type: admin.actioned` is invalid.

A chain may contain entries of both versions in one sequence; each entry's
envelope names the version its payload is validated against.

## Test vectors

[`test-vectors.json`](./test-vectors.json) holds 33 chained vectors: 1-15
are the frozen v0 originals (three per event type, byte-identical forever)
and 16-33 are schema_version "1" (three per v1 event type, `admin.actioned`
included), chained onto the v0 head as one continuous chain — with the
exact canonical strings and expected hashes. Any implementation must
reproduce every `payload_hash` and `entry_hash` from the `payload`/`envelope`
objects alone.

```
node generate-vectors.ts   # regenerate (deterministic, byte-identical)
node verify-vectors.ts     # recompute everything, exit 1 on any mismatch
```

Verify a single vector by hand (independent of any code here) — hash the
`canonical_envelope` string exactly as UTF-8 without a trailing newline:

```
printf '%s' '<canonical_envelope>' | openssl dgst -sha256
```

or in PowerShell:

```powershell
$s = '<canonical_envelope>'
[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($s))).Replace('-','').ToLower()
```

The reference implementation has been cross-checked by an independent
Python implementation (stdlib `json` + `hashlib`) reproducing all
`entry_hash` values and the same chain head.
