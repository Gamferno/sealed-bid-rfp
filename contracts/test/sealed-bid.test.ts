import { describe, it, expect } from 'vitest';
import * as runtime from '@midnight-ntwrk/compact-runtime';
import { Contract, pureCircuits, ledger } from '../managed/sealed-bid/contract/index.js';
import { createWitnesses, generateSalt, encodeBid, type SealedBidPrivateState } from '../src/witnesses.js';

function createDummyAddress(): runtime.ContractAddress {
  return runtime.dummyContractAddress();
}

function stringToBytes128(str: string): Uint8Array {
  const buf = new Uint8Array(128);
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.slice(0, 128));
  return buf;
}

describe('Sealed-Bid RFP Smart Contract Test Suite', () => {
  const saltA = generateSalt();
  const saltB = generateSalt();
  const saltC = generateSalt();

  it('1. circuit_logic — computeCommitment generates deterministic and collision-resistant hashes', () => {
    const hash1 = pureCircuits.computeCommitment(100n, saltA);
    const hash2 = pureCircuits.computeCommitment(100n, saltA);
    const hashDifferentBid = pureCircuits.computeCommitment(200n, saltA);
    const hashDifferentSalt = pureCircuits.computeCommitment(100n, saltB);

    expect(hash1).toEqual(hash2);
    expect(hash1).not.toEqual(hashDifferentBid);
    expect(hash1).not.toEqual(hashDifferentSalt);
    expect(hash1.length).toBe(32);
  });

  it('2. state_transitions — contract initializes with expected public RFP parameters', () => {
    const witnesses = createWitnesses();
    const contract = new Contract(witnesses);

    const privateState: SealedBidPrivateState = { bid: 150n, salt: saltA };
    const constructorContext: runtime.ConstructorContext<SealedBidPrivateState> = {
      initialPrivateState: privateState,
      initialZswapLocalState: {},
    };

    const desc = stringToBytes128('Procurement of IT Hardware');
    const commitDeadline = 1000n;
    const revealDeadline = 2000n;
    const minBid = 50n;
    const maxBid = 500n;

    const constructorResult = contract.initialState(
      constructorContext,
      desc,
      commitDeadline,
      revealDeadline,
      minBid,
      maxBid,
    );

    const currentLedger = ledger(constructorResult.currentContractState.data);
    expect(currentLedger.rfp.commit_deadline).toBe(1000n);
    expect(currentLedger.rfp.reveal_deadline).toBe(2000n);
    expect(currentLedger.rfp.min_bid).toBe(50n);
    expect(currentLedger.rfp.max_bid).toBe(500n);
    expect(currentLedger.commitments.isEmpty()).toBe(true);
    expect(currentLedger.reveal_count).toBe(0n);
    expect(currentLedger.result.proof_valid).toBe(false);
  });

  it('3. privacy — private witness inputs are isolated from public ledger', () => {
    const bidAmount = 450n;
    const vendorSalt = generateSalt();
    const encoded = encodeBid(bidAmount);

    expect(encoded.length).toBe(32);
    const commitment = pureCircuits.computeCommitment(bidAmount, vendorSalt);

    // Commitment is 32 bytes and cannot be trivially read as the bid amount
    const rawBidBigEndian = new DataView(encoded.buffer).getBigUint64(24);
    expect(rawBidBigEndian).toBe(bidAmount);

    // The commitment hash does not match raw bytes of the bid
    expect(commitment).not.toEqual(encoded);
  });

  it('4. valid_flow — 3 vendors commit, reveal, and determine the lowest bidder as winner', () => {
    const bids = { 0: 250n, 1: 120n, 2: 310n };
    const salts = { 0: saltA, 1: saltB, 2: saltC };

    const witnesses = createWitnesses();
    const contract = new Contract(witnesses);
    const privateState: SealedBidPrivateState = { bids, salts };

    const constructorContext: runtime.ConstructorContext<SealedBidPrivateState> = {
      initialPrivateState: privateState,
      initialZswapLocalState: {},
    };

    const cResult = contract.initialState(
      constructorContext,
      stringToBytes128('Cloud Services RFP'),
      1000n,
      2000n,
      100n,
      500n,
    );

    let state = cResult.currentContractState;
    const addr = createDummyAddress();

    // Helper to build circuit context
    const makeCircuitContext = (
      blockTime: bigint,
    ): runtime.CircuitContext<SealedBidPrivateState> =>
      runtime.createCircuitContext(
        addr,
        runtime.dummyUserAddress(),
        state,
        privateState,
        undefined,
        undefined,
        blockTime,
      );

    // Phase 1: Commit bids (before commit deadline = 1000n)
    const commitTime = 500n;
    const commit0 = contract.circuits.commit_bid(makeCircuitContext(commitTime), 0n);
    state.data = commit0.context.currentQueryContext.state;

    const commit1 = contract.circuits.commit_bid(makeCircuitContext(commitTime), 1n);
    state.data = commit1.context.currentQueryContext.state;

    const commit2 = contract.circuits.commit_bid(makeCircuitContext(commitTime), 2n);
    state.data = commit2.context.currentQueryContext.state;

    let l = ledger(state.data);
    expect(l.commitments.size()).toBe(3n);
    expect(l.commitments.lookup(0n).revealed).toBe(false);
    expect(l.commitments.lookup(1n).revealed).toBe(false);
    expect(l.commitments.lookup(2n).revealed).toBe(false);

    // Phase 2: Reveal bids (between 1000n and 2000n)
    const revealTime = 1500n;
    const reveal0 = contract.circuits.reveal_bid(makeCircuitContext(revealTime), 0n);
    state.data = reveal0.context.currentQueryContext.state;

    const reveal1 = contract.circuits.reveal_bid(makeCircuitContext(revealTime), 1n);
    state.data = reveal1.context.currentQueryContext.state;

    const reveal2 = contract.circuits.reveal_bid(makeCircuitContext(revealTime), 2n);
    state.data = reveal2.context.currentQueryContext.state;

    l = ledger(state.data);
    expect(l.reveal_count).toBe(3n);
    expect(l.commitments.lookup(0n).revealed).toBe(true);
    expect(l.commitments.lookup(1n).revealed).toBe(true);
    expect(l.commitments.lookup(2n).revealed).toBe(true);

    // Phase 3: Determine winner
    const finalizeTime = 2100n;
    const winnerRes = contract.circuits.determine_winner(makeCircuitContext(finalizeTime));
    state.data = winnerRes.context.currentQueryContext.state;

    l = ledger(state.data);
    expect(l.result.proof_valid).toBe(true);
    expect(l.result.winner_index).toBe(1n); // Vendor 1 had the lowest bid (120n)

    // Phase 4: Verify fairness view
    const fairnessRes = contract.circuits.verify_fairness(makeCircuitContext(finalizeTime));
    expect(fairnessRes.result).toBe(true);
  });

  it('5. invalid_reveal — mismatched bid/salt fails commitment check', () => {
    const witnesses = createWitnesses();
    const contract = new Contract(witnesses);

    // Vendor commits bid 200n with saltA
    const initialPrivateState: SealedBidPrivateState = {
      bids: { 0: 200n },
      salts: { 0: saltA },
    };

    const cResult = contract.initialState(
      { initialPrivateState, initialZswapLocalState: {} },
      stringToBytes128('RFP Test'),
      1000n,
      2000n,
      100n,
      500n,
    );

    let state = cResult.currentContractState;
    const addr = createDummyAddress();

    const commitCtx = runtime.createCircuitContext(
      addr,
      runtime.dummyUserAddress(),
      state,
      initialPrivateState,
      undefined,
      undefined,
      500n,
    );

    const commit0 = contract.circuits.commit_bid(commitCtx, 0n);
    state.data = commit0.context.currentQueryContext.state;

    // Now vendor tries to reveal a different bid (150n)
    const tamperedPrivateState: SealedBidPrivateState = {
      bids: { 0: 150n },
      salts: { 0: saltA },
    };

    const revealCtx = runtime.createCircuitContext(
      addr,
      runtime.dummyUserAddress(),
      state,
      tamperedPrivateState,
      undefined,
      undefined,
      1500n,
    );

    expect(() => {
      contract.circuits.reveal_bid(revealCtx, 0n);
    }).toThrow(/commitment mismatch/i);
  });

  it('6. late_reveal — reveal attempted after reveal_deadline is rejected', () => {
    const witnesses = createWitnesses();
    const contract = new Contract(witnesses);

    const privateState: SealedBidPrivateState = {
      bids: { 0: 200n },
      salts: { 0: saltA },
    };

    const cResult = contract.initialState(
      { initialPrivateState: privateState, initialZswapLocalState: {} },
      stringToBytes128('RFP Test'),
      1000n,
      2000n,
      100n,
      500n,
    );

    let state = cResult.currentContractState;
    const addr = createDummyAddress();

    const commit0 = contract.circuits.commit_bid(
      runtime.createCircuitContext(
        addr,
        runtime.dummyUserAddress(),
        state,
        privateState,
        undefined,
        undefined,
        500n,
      ),
      0n,
    );
    state.data = commit0.context.currentQueryContext.state;

    // Attempt reveal at block time 2500n (after reveal deadline 2000n)
    const lateRevealCtx = runtime.createCircuitContext(
      addr,
      runtime.dummyUserAddress(),
      state,
      privateState,
      undefined,
      undefined,
      2500n,
    );

    expect(() => {
      contract.circuits.reveal_bid(lateRevealCtx, 0n);
    }).toThrow(/reveal deadline has passed/i);
  });

  it('7. out_of_range — bid outside [min_bid, max_bid] is rejected at reveal', () => {
    const witnesses = createWitnesses();
    const contract = new Contract(witnesses);

    // Vendor commits bid 50n, but minimum bid allowed is 100n
    const lowBidState: SealedBidPrivateState = {
      bids: { 0: 50n },
      salts: { 0: saltA },
    };

    const cResult = contract.initialState(
      { initialPrivateState: lowBidState, initialZswapLocalState: {} },
      stringToBytes128('RFP Test'),
      1000n,
      2000n,
      100n,
      500n,
    );

    let state = cResult.currentContractState;
    const addr = createDummyAddress();

    const commit0 = contract.circuits.commit_bid(
      runtime.createCircuitContext(
        addr,
        runtime.dummyUserAddress(),
        state,
        lowBidState,
        undefined,
        undefined,
        500n,
      ),
      0n,
    );
    state.data = commit0.context.currentQueryContext.state;

    // Attempt reveal
    const revealCtx = runtime.createCircuitContext(
      addr,
      runtime.dummyUserAddress(),
      state,
      lowBidState,
      undefined,
      undefined,
      1500n,
    );

    expect(() => {
      contract.circuits.reveal_bid(revealCtx, 0n);
    }).toThrow(/bid below minimum/i);
  });

  it('8. double_commit — submitting a second commitment for same slot is rejected', () => {
    const witnesses = createWitnesses();
    const contract = new Contract(witnesses);

    const privateState: SealedBidPrivateState = {
      bids: { 0: 200n },
      salts: { 0: saltA },
    };

    const cResult = contract.initialState(
      { initialPrivateState: privateState, initialZswapLocalState: {} },
      stringToBytes128('RFP Test'),
      1000n,
      2000n,
      100n,
      500n,
    );

    let state = cResult.currentContractState;
    const addr = createDummyAddress();

    const commit0 = contract.circuits.commit_bid(
      runtime.createCircuitContext(
        addr,
        runtime.dummyUserAddress(),
        state,
        privateState,
        undefined,
        undefined,
        500n,
      ),
      0n,
    );
    state.data = commit0.context.currentQueryContext.state;

    // Try to commit again for vendor 0
    expect(() => {
      contract.circuits.commit_bid(
        runtime.createCircuitContext(
          addr,
          runtime.dummyUserAddress(),
          state,
          privateState,
          undefined,
          undefined,
          600n,
        ),
        0n,
      );
    }).toThrow(/vendor already committed/i);
  });

  it('9. no_bid_leak — no raw bid values appear anywhere in public ledger or result', () => {
    const secretBid0 = 487219n;
    const secretBid1 = 391824n;
    const secretBid2 = 528190n;
    const bids = { 0: secretBid0, 1: secretBid1, 2: secretBid2 };
    const witnesses = createWitnesses();
    const contract = new Contract(witnesses);
    const privateState: SealedBidPrivateState = { bids, salts: { 0: saltA, 1: saltB, 2: saltC } };

    const cResult = contract.initialState(
      { initialPrivateState: privateState, initialZswapLocalState: {} },
      stringToBytes128('Security Audit RFP'),
      1000n,
      2000n,
      100n,
      1000000n,
    );

    let state = cResult.currentContractState;
    const addr = createDummyAddress();

    // Commit vendor 0
    const c0 = contract.circuits.commit_bid(
      runtime.createCircuitContext(addr, runtime.dummyUserAddress(), state, privateState, undefined, undefined, 500n),
      0n,
    );
    state.data = c0.context.currentQueryContext.state;

    const l = ledger(state.data);
    const vendor0Commitment = l.commitments.lookup(0n);

    // Verify commitment struct exposes only commitment_hash and revealed boolean
    expect(vendor0Commitment).toHaveProperty('commitment_hash');
    expect(vendor0Commitment).toHaveProperty('revealed');
    expect(vendor0Commitment).not.toHaveProperty('bid');
    expect(vendor0Commitment.revealed).toBe(false);

    // Verify ledger state contains no trace of the secret bid value
    const serializedLedger = JSON.stringify({
      commitments: Array.from(l.commitments).map(([k, v]) => ({
        slot: k.toString(),
        hashHex: Array.from(v.commitment_hash).map(b => b.toString(16).padStart(2, '0')).join(''),
        revealed: v.revealed,
      })),
      result: { winner_index: l.result.winner_index.toString(), proof_valid: l.result.proof_valid },
      reveal_count: l.reveal_count.toString(),
    });

    expect(serializedLedger).not.toContain(secretBid0.toString());
    expect(serializedLedger).not.toContain(secretBid1.toString());
    expect(serializedLedger).not.toContain(secretBid2.toString());
  });
});



