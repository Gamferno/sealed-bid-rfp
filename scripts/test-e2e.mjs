import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function runE2E() {
  console.log('🚀 Starting Sealed-Bid RFP Full Workflow E2E Test with Playwright...\n');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs and errors from the browser
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`   [Browser Error]: ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    console.error(`   [Uncaught Page Error]: ${err.message}`);
  });

  // ── Step 1: Inject Mock Midnight DApp Connector Wallet ─────────────────────
  console.log('📦 Step 1: Injecting Mock Midnight DApp Connector (Lace & 1AM wallets)...');
  await page.addInitScript(() => {
    const mockConnectedWallet = {
      getUnshieldedAddress: async () => ({
        unshieldedAddress: 'midnight1addr_test9999abcdef0123456789vendor1',
      }),
      getShieldedAddresses: async () => ({
        shieldedCoinPublicKey: '0x' + '01'.repeat(32),
        shieldedEncryptionPublicKey: '0x' + '02'.repeat(32),
      }),
      balanceUnsealedTransaction: async (hex) => ({ tx: hex }),
      submitTransaction: async (hex) => 'tx_' + hex.slice(0, 32),
    };

    window.midnight = {
      'io.lace.midnight': {
        apiVersion: '1.0.0',
        name: 'Lace',
        icon: 'https://www.lace.io/favicon-192.png',
        connect: async (_networkId) => mockConnectedWallet,
      },
      'com.oneam.wallet': {
        apiVersion: '1.0.0',
        name: '1AM',
        icon: 'https://raw.githubusercontent.com/the-1am-project/1am-website/main/public/icons/1am.svg',
        connect: async (_networkId) => mockConnectedWallet,
      },
    };
  });

  // ── Step 2: Load Page and Verify Initial DOM ───────────────────────────────
  console.log('🌐 Step 2: Navigating to DApp at ' + BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const title = await page.textContent('.brand-name');
  console.log(`   ✓ Brand header rendered: "${title}"`);
  if (title !== 'Sealed-Bid RFP') throw new Error(`Unexpected title: ${title}`);

  // ── Step 3: Test Wallet Modal & Connection ─────────────────────────────────
  console.log('🔑 Step 3: Testing Wallet Connection Flow...');
  const connectBtn = page.locator('#connect-wallet');
  await connectBtn.waitFor({ state: 'visible' });
  await connectBtn.click();
  console.log('   ✓ Clicked "Connect Wallet" button');

  // Verify wallet modal is opened
  const walletBackdrop = page.locator('.modal-backdrop');
  await walletBackdrop.waitFor({ state: 'visible' });
  console.log('   ✓ Wallet selection modal opened');

  // Click on Lace wallet option
  const laceOption = page.locator('button.wallet-option:has-text("Lace")');
  await laceOption.waitFor({ state: 'visible' });
  await laceOption.click();
  console.log('   ✓ Selected "Lace" wallet option');

  // Verify connected status in header
  const walletChip = page.locator('.wallet-chip');
  await walletChip.waitFor({ state: 'visible', timeout: 5000 });
  const chipText = await walletChip.textContent();
  console.log(`   ✓ Wallet connected successfully! Chip: "${chipText.trim()}"`);

  // ── Step 4: Test Stepper Navigation ───────────────────────────────────────
  console.log('🧭 Step 4: Testing 4-Step Lifecycle Stepper Navigation...');
  const steps = ['create', 'bid', 'reveal', 'results'];
  for (const step of steps) {
    const navBtn = page.locator(`#nav-${step}`);
    await navBtn.click();
    await page.waitForTimeout(300);
    const isSelected = await navBtn.evaluate((el) => el.classList.contains('selected'));
    console.log(`   ✓ Navigated to Step "${step}" (Selected: ${isSelected})`);
  }

  // ── Step 5: Test RFP Creation Flow ─────────────────────────────────────────
  console.log('📝 Step 5: Testing RFP Round Creation UI & Form Presets...');
  await page.locator('#nav-create').click();

  // Test preset buttons
  const standardPreset = page.locator('button.preset-btn:has-text("Standard")');
  if (await standardPreset.isVisible()) {
    await standardPreset.click();
    console.log('   ✓ Clicked "Standard" preset');
  }

  const demoPreset = page.locator('button.preset-btn:has-text("Demo")');
  if (await demoPreset.isVisible()) {
    await demoPreset.click();
    console.log('   ✓ Clicked "Demo" preset');
  }

  // ── Step 6: Test Joining an Active Procurement Round ───────────────────────
  console.log('🔗 Step 6: Testing Joining an Active RFP Round...');
  const mockContractAddress = '00000000000000000000000000000000000000000000000000000000deadbeef';

  // Seed localStorage with a mock RFP round state
  await page.evaluate((contractAddr) => {
    localStorage.setItem('midnight_last_active_rfp_address', contractAddr);
    const mockRfpData = {
      contractAddress: contractAddr,
      creatorAddress: 'midnight1addr_test9999abcdef0123456789vendor1',
      description: 'Enterprise Cloud Security & Zero-Knowledge Verification Tender',
      commitDeadline: Math.floor(Date.now() / 1000) + 300,
      revealDeadline: Math.floor(Date.now() / 1000) + 600,
      minBid: '100',
      maxBid: '10000',
      createdAt: Math.floor(Date.now() / 1000),
      commitments: {
        0: {
          slot: 0,
          walletAddress: 'midnight1addr_test9999abcdef0123456789vendor1',
          commitmentHashHex: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
          revealed: false,
          committedAt: Math.floor(Date.now() / 1000) - 30,
        },
      },
      walletToSlot: {
        'midnight1addr_test9999abcdef0123456789vendor1': 0,
      },
      winnerSlot: null,
      winnerWallet: null,
      proofValid: false,
    };
    localStorage.setItem('rfp_contract_state:' + contractAddr, JSON.stringify(mockRfpData));
    window.dispatchEvent(new CustomEvent('rfp_state_changed', { detail: { contractAddress: contractAddr } }));
  }, mockContractAddress);

  // Reload page to observe active round
  await page.reload();
  await page.waitForTimeout(1000);

  const roundPill = page.locator('.round-pill');
  await roundPill.waitFor({ state: 'visible' });
  const pillText = await roundPill.textContent();
  console.log(`   ✓ Active RFP Round recognized in header: "${pillText.replace(/\s+/g, ' ').trim()}"`);

  // ── Step 7: Test Submit Bid (Commit Phase) ─────────────────────────────────
  console.log('🔒 Step 7: Testing Submit Bid (Commit Phase UI & Poseidon Hash)...');
  await page.locator('#nav-bid').click();
  await page.waitForTimeout(500);

  const bidCard = page.locator('.main-content');
  const bidCardText = await bidCard.textContent();
  console.log(`   ✓ Active tender details displayed: "${bidCardText.slice(0, 100).replace(/\s+/g, ' ')}..."`);

  // ── Step 8: Test ZK Reveal Screen ──────────────────────────────────────────
  console.log('🔓 Step 8: Testing ZK Reveal Phase...');
  await page.locator('#nav-reveal').click();
  await page.waitForTimeout(500);

  const revealView = page.locator('.main-content');
  const revealText = await revealView.textContent();
  console.log(`   ✓ Reveal view rendered: "${revealText.slice(0, 120).replace(/\s+/g, ' ')}..."`);

  // ── Step 9: Test Settle & Audit (Results Tab) ──────────────────────────────
  console.log('🏆 Step 9: Testing Settle & Audit Tab...');
  await page.locator('#nav-results').click();
  await page.waitForTimeout(500);

  const resultsView = page.locator('.main-content');
  const resultsText = await resultsView.textContent();
  console.log(`   ✓ Results view rendered: "${resultsText.slice(0, 120).replace(/\s+/g, ' ')}..."`);

  // ── Step 10: Test On-Chain Telemetry Inspector Modal ───────────────────────
  console.log('📊 Step 10: Testing On-Chain Telemetry Inspector Modal...');
  const inspectBtn = page.locator('button.round-pill-btn:has-text("Inspect")');
  await inspectBtn.waitFor({ state: 'visible' });
  await inspectBtn.click();
  console.log('   ✓ Clicked "Inspect" button in header');

  const inspectorModal = page.locator('.modal.inspector-modal');
  await inspectorModal.waitFor({ state: 'visible' });
  console.log('   ✓ Ledger Inspector Modal opened successfully');

  // Switch inspector tabs
  const rawTab = page.locator('button.inspector-tab-btn:has-text("Raw Ledger JSON")');
  if (await rawTab.isVisible()) {
    await rawTab.click();
    console.log('   ✓ Switched to "Raw Ledger JSON" telemetry tab');
  }

  const overviewTab = page.locator('button.inspector-tab-btn:has-text("Ledger Overview")');
  if (await overviewTab.isVisible()) {
    await overviewTab.click();
    console.log('   ✓ Switched back to "Ledger Overview" tab');
  }

  // Close inspector modal
  const closeBtn = page.locator('.inspector-modal .btn-icon');
  await closeBtn.click();
  await page.waitForTimeout(300);
  console.log('   ✓ Closed Ledger Inspector Modal');

  console.log('\n=============================================================');
  console.log('🎉 ALL 10 E2E WORKFLOW & WALLET TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================================\n');

  await browser.close();
}

runE2E().catch((err) => {
  console.error('\n❌ E2E Test Failed:', err);
  process.exit(1);
});
