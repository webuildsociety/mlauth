/**
 * MLAuth Identity Utilities
 * Generate ECDSA keypairs and dumbnames for agent registration.
 *
 * All cryptographic operations use Node.js built-in `crypto` — no external deps.
 */

import { generateKeyPairSync } from 'crypto';

// Word list for dumbname generation (adjective-noun-verb format)
// Ported from mloverflow/src/lib/words.mjs
const ADJECTIVES = [
  'bright', 'swift', 'calm', 'bold', 'quiet', 'sharp', 'dark', 'free',
  'kind', 'vast', 'warm', 'cold', 'deep', 'fair', 'glad', 'hard',
  'just', 'keen', 'lean', 'mild', 'neat', 'open', 'pure', 'rare',
  'safe', 'tall', 'true', 'wide', 'wise', 'agile', 'brave', 'crisp',
  'dense', 'eager', 'frank', 'grand', 'happy', 'ideal', 'jazzy', 'large',
  'noble', 'proud', 'quick', 'ready', 'solid', 'tidy', 'ultra', 'vivid',
  'witty', 'young', 'zesty', 'amber', 'brisk', 'clean', 'dusty', 'early',
  'fuzzy', 'glowing', 'husky', 'icy', 'jumpy', 'kinky', 'lively', 'misty',
  'noisy', 'oaken', 'perky', 'quirky', 'rusty', 'silky', 'tiny', 'urban',
  'vague', 'wavy', 'exact', 'young', 'zippy'
];

const NOUNS = [
  'agent', 'node', 'wave', 'core', 'flux', 'mesh', 'beam', 'gate',
  'grid', 'hive', 'iris', 'jump', 'key', 'loop', 'mode', 'nest',
  'orbit', 'path', 'query', 'root', 'seed', 'task', 'unit', 'void',
  'wire', 'apex', 'base', 'cell', 'data', 'edge', 'fork', 'heap',
  'icon', 'jade', 'kite', 'leaf', 'mind', 'null', 'pack', 'ring',
  'slot', 'tree', 'user', 'vein', 'zone', 'arch', 'bolt', 'chip',
  'disk', 'echo', 'flag', 'graph', 'hook', 'ink', 'joint', 'knot',
  'line', 'mask', 'nerve', 'object', 'pulse', 'rack', 'stack', 'tag',
  'url', 'vault', 'web', 'byte', 'clock', 'draft', 'event', 'frame',
  'hash', 'index', 'block', 'proxy', 'queue', 'relay', 'state', 'token'
];

const VERBS = [
  'runs', 'maps', 'logs', 'reads', 'writes', 'builds', 'calls', 'caches',
  'checks', 'clears', 'clones', 'codes', 'copies', 'counts', 'cuts', 'drops',
  'dumps', 'edits', 'emits', 'encodes', 'ends', 'exports', 'fails', 'fetches',
  'fills', 'finds', 'fires', 'flags', 'flips', 'flows', 'forks', 'gets',
  'gives', 'glues', 'grabs', 'grows', 'guards', 'guides', 'halts', 'handles',
  'hashes', 'hides', 'hints', 'hooks', 'imports', 'indexes', 'inits', 'joins',
  'jumps', 'keeps', 'kills', 'links', 'lists', 'loads', 'loops', 'marks',
  'merges', 'mounts', 'moves', 'mutes', 'names', 'opens', 'packs', 'parses',
  'patches', 'pauses', 'pings', 'pipes', 'polls', 'prints', 'probes', 'pulls',
  'pushes', 'puts', 'queues', 'reads', 'resets', 'routes', 'runs', 'saves',
  'scans', 'seeks', 'sends', 'sets', 'signs', 'sorts', 'spawns', 'splits',
  'starts', 'stops', 'stores', 'streams', 'tags', 'tests', 'tracks', 'wraps'
];

/**
 * Generate a random three-word dumbname in adjective-noun-verb format.
 * @returns {string} e.g. "swift-core-maps"
 */
export function generateDumbname() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${pick(VERBS)}`.toLowerCase();
}

/**
 * Generate a new ECDSA secp256k1 keypair for agent registration.
 *
 * @returns {{ privateKeyPem: string, publicKeyPem: string }}
 */
export function generateKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey
  };
}

/**
 * Generate a full agent identity: keypair + dumbname.
 *
 * @param {string} [preferredDumbname] - Optional preferred dumbname (will be auto-generated if omitted)
 * @returns {{ privateKeyPem: string, publicKeyPem: string, dumbname: string }}
 */
export function generateIdentity(preferredDumbname) {
  const { privateKeyPem, publicKeyPem } = generateKeypair();
  const dumbname = preferredDumbname
    ? preferredDumbname.toLowerCase().trim()
    : generateDumbname();

  return { privateKeyPem, publicKeyPem, dumbname };
}
