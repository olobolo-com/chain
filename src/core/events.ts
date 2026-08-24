// Copyright (c) 2026 OLOBOLO ApS
//
// The five event payload shapes of schema_version "0" (SPEC-001 K1), mapped
// 1:1 from the OLOBOLO datamodel. Metadata only: hashes, references and
// counts — never source code, prompts, spec text, review comments or test
// output. Optional fields are omitted when absent (never null).
//
// schema_version "1" (SPEC-031 / ADR-005): actors become pseudonymous —
// ActorRef carries a random UUID and non-personal tool metadata only;
// identities live in the deletable actor register, never in the chain.
// v1 also adds the admin.actioned event type (SPEC-024 K3 / SPEC-031 K5).

/** v0 actor — carries git_identity. Frozen; valid only in v0 entries. */
export interface Actor {
  actor_id: string;
  actor_type: 'human' | 'agent';
  git_identity: string;
  agent_tool?: string;
  agent_model?: string;
  agent_version?: string;
}

/** v1 actor — a pseudonymous reference. actor_id is a random UUID with no
 *  mathematical link to any identity (SPEC-031 ✅1); tool metadata is not
 *  personal data. Never a username, email or display name. */
export interface ActorRef {
  actor_id: string; // UUID v4
  actor_type: 'human' | 'agent';
  agent_tool?: string;
  agent_model?: string;
  agent_version?: string;
}

/** change.authored — a commit came into being. */
export interface ChangeAuthored {
  commit_sha: string;
  diff_fingerprint: string; // sha-256 of the diff, computed at the source
  file_paths: string[];
  actor: Actor;
  session_ref?: string; // id of the archived prompt-log, never its text
  session_hash?: string; // sha-256 of the archived prompt-log
  loc_added: number;
  loc_removed: number;
}

/** spec.linked — a change is tied to the spec that authorized it. */
export interface SpecLinked {
  change_ref: string; // commit_sha of the authored change
  spec_ref: string; // id/url in the customer's own system
  spec_version?: string;
  spec_hash: string; // sha-256 of the spec document at link time
  linked_at: string;
}

/** change.reviewed — a decision was made about a change. */
export interface ChangeReviewed {
  change_ref: string;
  reviewer: Actor;
  decision: 'approved' | 'rejected' | 'changes';
  thread_ref?: string; // e.g. GitHub PR review url/id
  decided_at: string;
}

/** test.evidenced — a CI run produced evidence for a change. */
export interface TestEvidenced {
  change_ref: string;
  result: 'passed' | 'failed';
  tests_passed: number;
  tests_failed: number;
  coverage_pct?: string; // decimal as string — floats never enter hash input
  ci_run_ref?: string;
  artifact_hashes: string[];
}

/** release.sealed — a version is bound to a chain segment, forever. */
export interface ReleaseSealed {
  version: string;
  first_entry_hash: string;
  last_entry_hash: string;
  chain_hash: string; // sha-256 over the sealed segment's entry hashes
  sealed_at: string;
}

/** admin.actioned (v1 only) — an administrative act on the platform itself
 *  (SPEC-024 K3 / SPEC-031 K5). The deletion of an actor-register entry is
 *  recorded with the pseudonymous actor_id alone — never the deleted
 *  identity. details_hash may reference an archived internal record. */
export interface AdminActioned {
  action:
    | 'actor.deleted'
    | 'plan.changed'
    | 'badge.revoked'
    | 'content.published'
    | 'price.changed';
  subject_ref: string; // what was acted on: an actor_id, org/repo id, version, …
  actor: ActorRef; // who performed the admin action
  details_hash?: string; // sha-256 of an archived internal record, never its text
  actioned_at: string;
}

export type EventPayload =
  | ChangeAuthored
  | SpecLinked
  | ChangeReviewed
  | TestEvidenced
  | ReleaseSealed
  | AdminActioned;
