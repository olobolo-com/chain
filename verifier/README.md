<!-- Copyright (c) 2026 OLOBOLO ApS -->

# @olobolo-com/verifier

**Verify an OLOBOLO evidence chain without trusting OLOBOLO.** No account,
no network access, no third-party dependencies — just the frozen chain
format and sha-256. If the math holds, the chain holds.

```
npx @olobolo-com/verifier verify chain.jsonl
```

```
chain intact — 41 entries verified.
by type: change.authored=15 spec.linked=15 test.evidenced=7 change.reviewed=3 release.sealed=1
head 2bd5943d2662c71cdf427e38d124ff19672b7c3c823a18994e0ad970059f0c7f
```

Every line of the export is checked byte-exactly: canonical JSON form,
payload hash, entry hash, and the `prev_entry_hash` linkage from genesis.
A changed byte, a reordered key, a removed entry — anything surfaces as a
failure with its entry number, and the exit code says it plainly:
`0` intact · `1` broken · `2` unreadable.

## Trust nothing, including this tool

- **`olobolo-verify selftest`** proves the verifier against the 15 frozen
  test vectors — and proves it *rejects* a deliberately tampered copy —
  before you let it judge anything.
- **Zero dependencies** beyond `@olobolo-com/chain` (itself dependency-
  free): the entire supply chain is auditable in a minute.
- Don't want to run our code at all? The chain format is fully documented
  (canonical JSON, sha-256, linked hashes) — reimplement verification in
  any language and the test vectors will tell you if you got it right.

## What this verifies — and what it does not

Verification proves the chain is internally consistent: every entry's
hashes recompute and the linkage is unbroken from genesis. It proves the
recorded metadata existed unchanged when its hashes were taken. It does
not prove the metadata was truthful when recorded — that is what review
gates, CI evidence and external RFC 3161 anchoring add on top (anchor
receipts verify with plain `openssl ts`, documented in the Verify guide).
