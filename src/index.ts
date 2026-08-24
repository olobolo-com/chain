// Copyright (c) 2026 OLOBOLO ApS
//
// @olobolo-com/chain — canonical serialization, hashing and verification
// for OLOBOLO evidence chains (SPEC-001 schema_version "0", frozen).
// Pure core (no fs) + a JSONL file layer. The exact same code runs in the
// collector CLI, the server and the public verifier — one implementation,
// zero drift, no trust in OLOBOLO required.

export {
  ALGO,
  CURRENT_SCHEMA_VERSION,
  EVENT_TYPES,
  EVENT_TYPES_V1,
  GENESIS_PREV_ENTRY_HASH,
  SCHEMA_VERSION,
  assertValidEnvelope,
  canonicalize,
  entryHash,
  eventTypesFor,
  payloadHash,
  sha256Hex,
} from './core/canonical.js';
export type { CanonicalValue, Envelope, EventType, EventTypeV0 } from './core/canonical.js';

export type {
  Actor,
  ActorRef,
  AdminActioned,
  ChangeAuthored,
  ChangeReviewed,
  EventPayload,
  ReleaseSealed,
  SpecLinked,
  TestEvidenced,
} from './core/events.js';

export { verifyEntries, verifyLines } from './core/verify.js';
export type { ChainEntry, VerifyFailure, VerifyResult } from './core/verify.js';

export { appendEntry, chainHead, readChain, verifyChainFile } from './file.js';
export type { ChainIdentity } from './file.js';
