# Sealed-Bid RFP — 60-Second Demo Video Script & Walkthrough Guide

This guide provides a second-by-second script, UI actions, and narration for recording your 1-minute hackathon demo video.

---

## 🎬 Video Overview

- **Target Duration**: 60 seconds (55–65s max)
- **Resolution**: 1080p (1920x1080) or 1440p
- **Audio**: Clear microphone narration
- **Demo URL**: Localhost (`http://localhost:5173`) or your deployed live Vercel URL

---

## ⏱️ Second-by-Second Storyboard & Script

```
┌─────────────┬──────────────────────────┬───────────────────────────────────────────┐
│ Time        │ Screen / Action          │ Voiceover Narration                       │
├─────────────┼──────────────────────────┼───────────────────────────────────────────┤
│ 0:00 - 0:10 │ Tab 1: Create RFP        │ "Welcome to Sealed-Bid RFP, a privacy-    │
│             │ Deploy a new procurement │ preserving procurement dApp built on the  │
│             │ round with budget range. │ Midnight Network."                        │
├─────────────┼──────────────────────────┼───────────────────────────────────────────┤
│ 0:10 - 0:25 │ Tab 2: Seal Bid          │ "Vendors submit cryptographically sealed  │
│             │ Submit bids for Vendor 0,│ bids. Each bid and salt stay strictly     │
│             │ Vendor 1, and Vendor 2.  │ client-side—only a ZK commitment hash is  │
│             │ Inspect on-chain ledger. │ recorded on the Midnight ledger."         │
├─────────────┼──────────────────────────┼───────────────────────────────────────────┤
│ 0:25 - 0:40 │ Tab 3: ZK Reveal         │ "During reveal, the ZK circuit proves the │
│             │ Execute ZK reveal proofs │ bid is within budget and matches the hash │
│             │ for all 3 vendors.       │ without leaking the numerical bid amount."│
├─────────────┼──────────────────────────┼───────────────────────────────────────────┤
│ 0:40 - 0:52 │ Tab 4: Settle & Audit    │ "We finalize the winner. The contract     │
│             │ Click 'Determine Winner' │ proves in ZK that Vendor 1 had the lowest │
│             │ & 'Verify Fairness'.     │ bid—while all bid amounts stay secret."   │
├─────────────┼──────────────────────────┼───────────────────────────────────────────┤
│ 0:52 - 1:00 │ Terminal: npm test       │ "With 9/9 passing tests and full ZK       │
│             │ Show 9 green passing     │ proof isolation, Midnight makes fair,     │
│             │ tests & conclude.        │ private procurement a reality."           │
└─────────────┴──────────────────────────┴───────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Recording Instructions

### Pre-recording Setup
1. Launch local frontend:
   ```bash
   cd ui && npm run dev
   ```
2. Open `http://localhost:5173` in your browser at 100% or 110% zoom.
3. Have your terminal open with the command ready: `npm test`.

---

### Step 1: Create RFP (0:00 – 0:10)
- **Action**:
  1. Click **Create RFP** tab.
  2. Enter brief: `Enterprise Cloud & ZK Infrastructure RFP`.
  3. Set Min Bid: `100`, Max Bid: `500`.
  4. Click **Deploy RFP Round**.
- **Say**:
  > *"Welcome to Sealed-Bid RFP on Midnight. A buyer creates a procurement round with budget constraints and commit deadlines."*

---

### Step 2: Submit Sealed Bids (0:10 – 0:25)
- **Action**:
  1. Switch to **Seal Bid** tab.
  2. Select **Vendor 0 (Alpha)** → Enter Bid: `250` → Click **Submit Sealed Bid**.
  3. Select **Vendor 1 (Beta)** → Enter Bid: `120` → Click **Submit Sealed Bid**.
  4. Select **Vendor 2 (Gamma)** → Enter Bid: `310` → Click **Submit Sealed Bid**.
  5. Click **Inspect** in the top header to show only hashes are on-chain.
- **Say**:
  > *"Three competing vendors submit their sealed bids. Notice how each bid is hashed locally with a private salt—zero bid amounts touch the public blockchain."*

---

### Step 3: ZK Reveal (0:25 – 0:40)
- **Action**:
  1. Switch to **ZK Reveal** tab.
  2. Click **Advance Phase Early** (or wait for deadline).
  3. Click **Execute ZK Reveal** for Vendor 0, Vendor 1, and Vendor 2.
- **Say**:
  > *"Once the commit window closes, vendors reveal. Midnight's ZK circuits mathematically prove each bid is authentic and within budget, without revealing the numbers to competitors."*

---

### Step 4: Settle & Audit (0:40 – 0:52)
- **Action**:
  1. Switch to **Settle & Audit** tab.
  2. Click **Determine Winner (ZK Circuit)**.
  3. Point to the winning card: **Vendor 1 (Beta)** wins!
  4. Click **Run Cryptographic Audit (verify_fairness)** → shows green verified badge.
- **Say**:
  > *"We settle the auction. The ZK circuit computes the lowest bid in zero knowledge and declares Vendor 1 the winner. Anyone can audit the outcome with on-chain fairness verification."*

---

### Step 5: Test Suite Verification & Outro (0:52 – 1:00)
- **Action**:
  1. Switch to the terminal and show `npm test` passing with 9/9 green tests.
- **Say**:
  > *"Backed by 9 comprehensive integration tests and strict witness isolation, Sealed-Bid RFP brings true commercial privacy to decentralized procurement on Midnight."*

---

## 💡 Top Tips for a Winning Demo
- **Pacing**: Speak at a brisk, confident tempo.
- **Visual Clarity**: Hide browser bookmarks bar and use full-screen recording.
- **Highlight Privacy**: Emphasize that neither the buyer nor competing vendors ever saw the losing bid amounts.
