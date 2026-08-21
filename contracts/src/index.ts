import { CompiledContract } from '@midnight-ntwrk/compact-js';

// Re-export managed contract (generated after: npm run compact)
export * as SealedBid from '../managed/sealed-bid/contract/index.js';
export {
  createWitnesses,
  createSealedBidPrivateState,
  generateSalt,
  encodeBid,
} from './witnesses.js';
export type { SealedBidPrivateState } from './witnesses.js';

import * as SealedBidContract from '../managed/sealed-bid/contract/index.js';
import { createWitnesses } from './witnesses.js';

export const CompiledSealedBidContract = CompiledContract.make(
  'sealed-bid',
  SealedBidContract.Contract,
).pipe(
  CompiledContract.withWitnesses(createWitnesses()),
  CompiledContract.withCompiledFileAssets('./managed/sealed-bid'),
);
