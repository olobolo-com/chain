<!-- Copyright (c) 2026 OLOBOLO ApS -->

# OLOBOLO chain format — schema_version "0"

Normative definition of the OLOBOLO evidence-chain entry format (SPEC-001).
This format is frozen: the serialization of `schema_version: "0"` never
changes. Format evolution happens only by introducing a new schema version;
old entries are always verified against their own version.

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

## Test vectors

[`test-vectors.json`](./test-vectors.json) holds 15 chained vectors — three
per event type — with the exact canonical strings and expected hashes. Any
implementation must reproduce every `payload_hash` and `entry_hash` from the
`payload`/`envelope` objects alone.

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
Python implementation (stdlib `json` + `hashlib`) reproducing all 15
`entry_hash` values and the same chain head.
