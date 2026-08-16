#!/usr/bin/env node
// Copyright (c) 2026 OLOBOLO ApS
//
// olobolo-verify — verify an OLOBOLO evidence chain without trusting
// OLOBOLO. Thin CLI over @olobolo-com/chain; argument parsing is
// hand-rolled so the entire supply chain stays auditable in a minute.

import { formatVerdict, runSelftest, runVerify } from './lib.js';

const VERSION = '0.1.0';
const USAGE = `olobolo-verify ${VERSION} — verify an OLOBOLO evidence chain, no trust required

Usage:
  olobolo-verify verify <chain.jsonl> [--json]   verify a chain export
  olobolo-verify selftest [--json]               verify the verifier itself
  olobolo-verify --help | --version

Exit codes: 0 = intact, 1 = broken, 2 = could not read / usage error`;

const args = process.argv.slice(2);
const json = args.includes('--json');
const positional = args.filter((a) => !a.startsWith('--'));
const command = positional[0];

if (args.includes('--help') || args.includes('-h') || command === 'help' || args.length === 0) {
  console.log(USAGE);
  process.exit(command || args.length ? 0 : 2);
}
if (args.includes('--version') || args.includes('-v')) {
  console.log(VERSION);
  process.exit(0);
}

let verdict: ReturnType<typeof runVerify>;
if (command === 'verify') {
  const file = positional[1];
  if (!file) {
    console.error('error: verify requires a chain file argument\n');
    console.error(USAGE);
    process.exit(2);
  }
  verdict = runVerify(file);
} else if (command === 'selftest') {
  verdict = runSelftest();
} else {
  console.error(`error: unknown command "${command}"\n`);
  console.error(USAGE);
  process.exit(2);
}

if (json) {
  console.log(JSON.stringify(verdict, null, 2));
} else {
  console.log(formatVerdict(verdict));
}
process.exit(verdict.exitCode);
