<!-- Copyright (c) 2026 OLOBOLO ApS -->

# OLOBOLO provenance as an in-toto attestation

**Predicate type:** `https://olobolo.com/attestation/provenance/v0`
**Statement layer:** [in-toto Attestation Framework v1](https://github.com/in-toto/attestation) (`https://in-toto.io/Statement/v1`)
**Status:** v0 — a *projection* of the frozen OLOBOLO chain format
([FORMAT.md](FORMAT.md)); the chain remains the source of truth, and
this mapping never carries more than the chain itself. Metadata only:
no source code, prompts, review text or test output — fingerprints and
references throughout.

## Why

Supply-chain tooling in the SLSA/in-toto ecosystem consumes
attestations, not vendor formats. This predicate lets that tooling read
OLOBOLO's development-provenance evidence — who (human or AI agent)
authored each change, what was reviewed and tested, and which sealed
segment of the chain covers it — without knowing anything about
OLOBOLO. It makes **no** SLSA-level or conformance claims: it delivers
evidence for *your* tooling to judge.

## Statement shape

One Statement is emitted per sealed release, generated
deterministically from the chain segment the seal binds (same seal ⇒
byte-identical Statement — there is no generation timestamp inside).

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    {
      "name": "git+https://github.com/<org>/<repo>@<version>",
      "digest": {
        "sha256": "<chain_hash of the sealed segment>",
        "gitCommit": "<last authored commit sha in the segment>"
      }
    }
  ],
  "predicateType": "https://olobolo.com/attestation/provenance/v0",
  "predicate": { ... }
}
```

The subject identifies the sealed release; its `sha256` digest is the
chain hash of the sealed segment (SHA-256 over the segment's entry
hashes, per FORMAT.md), so the subject itself is recomputable from a
chain export.

## Predicate fields (v0)

| Field | Meaning |
|---|---|
| `organization`, `repository`, `version` | The sealed release's identity |
| `sealed_at` | Seal timestamp (RFC 3339 UTC, from the seal payload) |
| `seal_entry_hash` | Entry hash of the `release.sealed` chain entry |
| `segment.first_entry_hash` / `last_entry_hash` | Sealed segment boundaries |
| `segment.entry_count` | Entries in the segment |
| `segment.chain_hash` | SHA-256 over the segment's entry hashes |
| `totals.changes` | `change.authored` entries in the segment |
| `totals.ai_changes` | ...authored by actors with `actor_type: agent` |
| `totals.reviewed_changes` | ...covered by a `change.reviewed` entry |
| `totals.tested_changes` | ...covered by a `test.evidenced` entry |
| `totals.spec_linked_changes` | ...covered by a `spec.linked` entry |
| `actors[]` | Per-agent identity (tool · model) + aggregated humans, with change counts and spec-link counts |
| `tests` | Recorded test runs / passed / failed in the segment |
| `disclosed_exceptions` | Count of disclosed exceptions at seal time |
| `external_anchor` | RFC 3161 anchor covering the seal (`tsa`, `gen_time`, `reference`), or `null` — pending is stated, never omitted |
| `agent_trace` | Reserved: `{"schema_version": 0, "refs": []}` — a future AI-agent-trace standard can be referenced here without a format break |
| `source` | `{"format": "olobolo-chain/v0", "verifier": "olobolo-verify"}` |

## Verifying without OLOBOLO

1. **Statement layer:** validate against the in-toto Attestation
   Framework v1 statement schema with any standard JSON-schema or
   in-toto tooling — nothing OLOBOLO-specific is needed to parse it.
2. **Predicate contents:** request the chain export for the seal, run
   `olobolo-verify verify <export.jsonl>` (zero-dependency, in this
   repository) to confirm the chain is intact, then recompute every
   predicate figure from the raw entries — counts, the segment
   `chain_hash`, and the subject digest must match exactly.
3. **Time:** the `external_anchor` reference resolves to an RFC 3161
   token verifiable with `openssl ts -verify` against the TSA's
   certificates.

## Integrity without signatures (v0)

Statements are published **unsigned** in v0. Integrity comes from the
chain itself: the attestation's SHA-256 is recorded in the chain as a
`test.evidenced` entry on the seal it describes, and the chain head is
anchored with RFC 3161 timestamps. A DSSE envelope (and the key
infrastructure it deserves) is deliberately deferred to the external
anchoring work — an unsigned statement whose figures anyone can
recompute beats a signed one with an unmanaged key.
