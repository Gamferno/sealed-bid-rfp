# 🎬 Demo Video Recording Script: 2-Account Live Sealed-Bid RFP

> **HOW TO RECORD:**  
> Perform the **"🖥️ DO THIS"** screen actions and speak the exact **"🎙️ SAY THIS"** lines.

---

### ⏱️ [00:00 - 00:15] • Intro & Start

**🖥️ DO THIS ON SCREEN:**
- Browser is open at `http://localhost:5173`.
- Show the clean header and welcome screen.

**🎙️ SAY THIS:**
> "Welcome to **Sealed-Bid RFP** on the **Midnight Network**. Today, I will demonstrate a live end-to-end multi-account tender where two competing vendors submit sealed bids, reveal them in zero knowledge, and the lowest bidder wins on-chain without disclosing any prices."

---

### ⏱️ [00:15 - 00:40] • Account 1 Connects & Deploys RFP Contract

**🖥️ DO THIS ON SCREEN:**
1. Click **`Connect Wallet`** in top-right ➔ Select **`Lace`** (Account 1).
2. Click **`Create New RFP Round`** (Step 01).
3. Leave preset on **`Demo Mode`** (2m commit, 2m reveal, 100 to 10,000 tDUST).
4. Click **`Deploy Sealed RFP Smart Contract`**.

**🎙️ SAY THIS:**
> "First, I connect with Account 1. As the buyer, I set a budget range between 100 and 10,000 tDUST and deploy our Compact smart contract to Midnight Preprod."

---

### ⏱️ [00:40 - 01:05] • Account 1 Seals Bid (Vendor Slot #0: 250 tDUST)

**🖥️ DO THIS ON SCREEN:**
1. App automatically moves to **`Step 02: Seal Bid`**.
2. Type `250` in the Bid Amount box.
3. Click **`Seal & Submit Private Bid`**.
4. Show the green **`Bid Sealed in Vault`** receipt (Slot #0) and the Poseidon commitment hash.

**🎙️ SAY THIS:**
> "The round is live. As Vendor 0, I submit a bid of **250 tDUST**. The app generates a 256-bit salt locally and computes a Poseidon hash. Only the 32-byte hash is published to the ledger; the bid amount never leaves this machine."

---

### ⏱️ [01:05 - 01:30] • Disconnect Account 1 & Connect Account 2

**🖥️ DO THIS ON SCREEN:**
1. Click the **Logout / Disconnect** icon on the top-right wallet chip.
2. Open the Lace / 1AM browser extension ➔ **Switch to Account 2**.
3. Click **`Connect Wallet`** on screen ➔ Select **`Lace`** (Account 2 address now appears in the header).

**🎙️ SAY THIS:**
> "Now, I disconnect Account 1, switch my wallet extension to **Account 2**, and reconnect as our competing vendor."

---

### ⏱️ [01:30 - 01:55] • Account 2 Seals Bid (Vendor Slot #1: 120 tDUST)

**🖥️ DO THIS ON SCREEN:**
1. You are still on **`Step 02: Seal Bid`**.
2. Type `120` in the Bid Amount box.
3. Click **`Seal & Submit Private Bid`**.
4. Show the **`Participating Vendors Board`** below displaying both **Slot #0** and **Slot #1** sealed on-chain.

**🎙️ SAY THIS:**
> "As Vendor 1, I submit a lower bid of **120 tDUST**. The app creates an independent salt and publishes the second commitment hash. Both Vendor 0 and Vendor 1 are now sealed on the ledger."

---

### ⏱️ [01:55 - 02:20] • Inspect On-Chain Ledger (Proof of Zero Leakage)

**🖥️ DO THIS ON SCREEN:**
1. Click the **`Inspect`** button with the code icon in the top RFP header pill.
2. Point cursor to the **Ledger Commitments Map** showing only 32-byte hashes for Slot #0 and Slot #1.
3. Click **`Raw Ledger JSON`** tab to show raw state.
4. Click close (**`X`**) on the modal.

**🎙️ SAY THIS:**
> "Let's inspect the on-chain ledger. You can see both vendor commitment hashes. There are zero numerical prices recorded on-chain, proving complete commercial confidentiality."

---

### ⏱️ [02:20 - 02:45] • Account 2 Generates ZK Reveal Proof

**🖥️ DO THIS ON SCREEN:**
1. Click **`03 ZK Reveal`** in the top navigation stepper.
2. Click **`Generate ZK Proof & Reveal Bid`**.
3. Watch the local prover run and show the green **`Zero-Knowledge Proof Verified`** badge for Slot #1.

**🎙️ SAY THIS:**
> "Now we enter the ZK Reveal phase. While still on Account 2, I click **Generate ZK Proof & Reveal Bid**. The `reveal_bid` circuit proves in zero knowledge that Vendor 1's bid is authentic and within budget without disclosing the 120 tDUST amount."

---

### ⏱️ [02:45 - 03:15] • Disconnect Account 2, Connect Account 1 & Reveal

**🖥️ DO THIS ON SCREEN:**
1. Click the **Logout / Disconnect** icon on the top-right wallet chip.
2. Switch wallet extension back to **Account 1**.
3. Click **`Connect Wallet`** ➔ Select **`Lace`** (Account 1 connected).
4. Click **`03 ZK Reveal`** ➔ Click **`Generate ZK Proof & Reveal Bid`**.
5. Show both vendors now marked with green **Revealed & Verified** badges (Progress bar at 100%).

**🎙️ SAY THIS:**
> "I disconnect Account 2, switch back to **Account 1**, and reconnect. As Vendor 0, I submit my ZK reveal proof. Both bids are now mathematically verified on-chain, with neither price ever made public."

---

### ⏱️ [03:15 - 03:55] • ZK Winner Settlement & On-Chain Fairness Audit

**🖥️ DO THIS ON SCREEN:**
1. Click **`04 Settle & Audit`** in the top navigation stepper.
2. Click **`Finalize & Determine Lowest Bidder (ZK Circuit)`**.
3. Point to the **Winner Podium Card** showing **Vendor Slot #1** as the winner.
4. Scroll to the **Zero-Leakage Tender Matrix** table (all bids marked *"Kept Private via ZK"*).
5. Click **`Run On-Chain Fairness Check`**.
6. Point to the green **`Fairness Cryptographically Verified`** box.

**🎙️ SAY THIS:**
> "Finally, I click **Finalize & Determine Lowest Bidder**. The ZK circuit computes the lowest bid across both vendors and declares **Vendor Slot #1** the winner because 120 is lower than 250. Notice in the Tender Matrix that neither the winning price nor the losing price was ever revealed. I then click **Run On-Chain Fairness Check** to prove that the smart contract followed all rules with zero price leakage."

---

### ⏱️ [03:55 - 04:10] • Wrap-Up & Conclusion

**🖥️ DO THIS ON SCREEN:**
- Hover over the verified proof badges and explorer link.

**🎙️ SAY THIS:**
> "This demonstrates the power of Midnight and Compact: full public verifiability with total commercial privacy. The contract is live on Midnight Preprod, and all code is open on GitHub. Thank you!"

---

# 📋 Quick Step Cheat Sheet

| Step | Wallet | Action | Spoken Topic |
|---|---|---|---|
| **1** | — | Open browser | Intro to Sealed-Bid RFP on Midnight |
| **2** | **Account 1** | Connect ➔ Deploy RFP | Deploy Compact contract (100–10,000 tDUST) |
| **3** | **Account 1** | Seal Bid (250 tDUST) | Vendor 0 commits Poseidon hash |
| **4** | — | Disconnect ➔ Switch to Account 2 | Switch to competing bidder |
| **5** | **Account 2** | Seal Bid (120 tDUST) | Vendor 1 commits Poseidon hash |
| **6** | **Account 2** | Click `Inspect` | Show on-chain hashes (zero bid leakage) |
| **7** | **Account 2** | Go to `ZK Reveal` ➔ Reveal | Vendor 1 reveals range & authenticity in ZK |
| **8** | — | Disconnect ➔ Switch to Account 1 | Switch back to first bidder |
| **9** | **Account 1** | Go to `ZK Reveal` ➔ Reveal | Vendor 0 reveals range & authenticity in ZK |
| **10** | **Any** | Go to `Settle & Audit` ➔ Finalize | Winner computed in ZK (Vendor 1 wins) |
| **11** | **Any** | Click `Run Fairness Check` | On-chain cryptographic fairness audit |
| **12** | — | Conclusion | Wrap-up & GitHub repository |
