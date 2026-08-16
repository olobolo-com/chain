// Copyright (c) 2026 OLOBOLO ApS
//
// The five event payload shapes of schema_version "0" (SPEC-001 K1), mapped
// 1:1 from the OLOBOLO datamodel. Metadata only: hashes, references and
// counts — never source code, prompts, spec text, review comments or test
// output. Optional fields are omitted when absent (never null).

export interface Actor {
  actor_id: string;
  actor_type: 'human' | 'agent';
  git_identity: string;
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

export type EventPayload =
  | ChangeAuthored
  | SpecLinked
  | ChangeReviewed
  | TestEvidenced
  | ReleaseSealed;
