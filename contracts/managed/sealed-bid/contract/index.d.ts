import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  getBid(context: __compactRuntime.WitnessContext<Ledger, PS>,
         vendor_index_0: bigint): [PS, bigint];
  getSalt(context: __compactRuntime.WitnessContext<Ledger, PS>,
          vendor_index_0: bigint): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  commit_bid(context: __compactRuntime.CircuitContext<PS>,
             vendor_index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  reveal_bid(context: __compactRuntime.CircuitContext<PS>,
             vendor_index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  determine_winner(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  verify_fairness(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  commit_bid(context: __compactRuntime.CircuitContext<PS>,
             vendor_index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  reveal_bid(context: __compactRuntime.CircuitContext<PS>,
             vendor_index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  determine_winner(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  verify_fairness(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
  computeCommitment(bid_0: bigint, salt_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  computeCommitment(context: __compactRuntime.CircuitContext<PS>,
                    bid_0: bigint,
                    salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  commit_bid(context: __compactRuntime.CircuitContext<PS>,
             vendor_index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  reveal_bid(context: __compactRuntime.CircuitContext<PS>,
             vendor_index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  determine_winner(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  verify_fairness(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  readonly rfp: { description: Uint8Array,
                  commit_deadline: bigint,
                  reveal_deadline: bigint,
                  min_bid: bigint,
                  max_bid: bigint
                };
  commitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): { commitment_hash: Uint8Array, revealed: boolean };
    [Symbol.iterator](): Iterator<[bigint, { commitment_hash: Uint8Array, revealed: boolean }]>
  };
  readonly result: { winner_index: bigint, proof_valid: boolean };
  readonly reveal_count: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               description_0: Uint8Array,
               commit_deadline_0: bigint,
               reveal_deadline_0: bigint,
               min_bid_0: bigint,
               max_bid_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
