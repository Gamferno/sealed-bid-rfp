/**
 * Sealed-Bid RFP — Witness Providers
 *
 * Witnesses are private inputs that flow into ZK circuits on demand.
 * None of this data is ever disclosed to the public ledger.
 */

export type SealedBidPrivateState = {
  readonly bid?: bigint;      // actual bid amount (never leaves client)
  readonly salt?: Uint8Array; // 32-byte random salt used for commitment
  readonly vendorIndex?: number;
  readonly bids?: Record<number, bigint>;
  readonly salts?: Record<number, Uint8Array>;
};

export const createSealedBidPrivateState = (
  bid: bigint,
  salt: Uint8Array,
  vendorIndex?: number,
): SealedBidPrivateState => ({ bid, salt, vendorIndex });

/**
 * Generate a random 32-byte salt for a new bid commitment.
 * Call this once per bid and persist it for the reveal step.
 */
export const generateSalt = (): Uint8Array => {
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);
  return salt;
};

/**
 * Encode a bid amount as a 32-byte big-endian Uint8Array for hashing.
 */
export const encodeBid = (bid: bigint): Uint8Array => {
  const buf = new Uint8Array(32);
  let v = bid;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
};

export const createWitnesses = () => ({
  /**
   * Circuit witness: getBid()
   * Returns the vendor's private bid amount.
   */
  getBid: (
    context: { privateState: SealedBidPrivateState },
    vendor_index_0: bigint,
  ): [SealedBidPrivateState, bigint] => {
    const idx = Number(vendor_index_0);
    const bid = context.privateState.bids?.[idx] ?? context.privateState.bid ?? 0n;
    return [context.privateState, bid];
  },

  /**
   * Circuit witness: getSalt()
   * Returns the vendor's private salt for commitment hashing.
   */
  getSalt: (
    context: { privateState: SealedBidPrivateState },
    vendor_index_0: bigint,
  ): [SealedBidPrivateState, Uint8Array] => {
    const idx = Number(vendor_index_0);
    const salt = context.privateState.salts?.[idx] ?? context.privateState.salt ?? new Uint8Array(32);
    return [context.privateState, salt];
  },
});

