const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  console.log('Launching Chrome for Visual Verification of Public & Private Channels...');
  const artifactDir = path.resolve('C:/Users/solvi/.gemini/antigravity-ide/brain/f9d4ae72-c5ec-4cff-98d9-e131b5a84777');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,820'],
    defaultViewport: { width: 1280, height: 820 },
  });

  try {
    const page = await browser.newPage();
    console.log('Navigating to http://localhost:4000...');
    await page.goto('http://localhost:4000', { waitUntil: 'networkidle0' });
    await sleep(1000);

    // 1. Screenshot: Community Lounge Explorer (Public Channels)
    await page.screenshot({ path: path.join(artifactDir, '01_community_lounge_explorer.png') });
    console.log('Saved 01_community_lounge_explorer.png');

    // 2. Open Create Public Channel Modal
    await page.click('.create-community-btn');
    await sleep(600);
    await page.screenshot({ path: path.join(artifactDir, '02_create_channel_modal.png') });
    console.log('Saved 02_create_channel_modal.png');

    // Close modal
    await page.click('.btn-icon');
    await sleep(400);

    // 3. Switch to Private Watch Party Tab
    const privateTabBtn = await page.$('.type-toggle-btn:nth-child(2)');
    if (privateTabBtn) {
      await privateTabBtn.click();
      await sleep(600);
      await page.screenshot({ path: path.join(artifactDir, '03_private_party_creator.png') });
      console.log('Saved 03_private_party_creator.png');
    }

    // 4. Switch back to Community Lounges and Join "☕ 24/7 Lofi & Chill Study Lounge"
    const communityTabBtn = await page.$('.type-toggle-btn:nth-child(1)');
    if (communityTabBtn) {
      await communityTabBtn.click();
      await sleep(600);
    }

    // Set name in top bar first
    await page.type('.top-username-input', 'Solvi (Host)');
    await sleep(300);

    // Click join on first card
    const firstJoinBtn = await page.$('.community-card .card-join-btn');
    if (firstJoinBtn) {
      await firstJoinBtn.click();
    }
    await page.waitForSelector('.room-code-pill', { timeout: 10000 });
    await sleep(2500);

    // Screenshot 4: Public Room View
    await page.screenshot({ path: path.join(artifactDir, '04_public_channel_room_view.png') });
    console.log('Saved 04_public_channel_room_view.png');

    // 5. Open Host Settings modal (visibility toggle)
    const settingsBtn = await page.$('button[title="Channel Settings & Privacy"]');
    if (settingsBtn) {
      await settingsBtn.click();
      await sleep(600);
      await page.screenshot({ path: path.join(artifactDir, '05_host_channel_settings_modal.png') });
      console.log('Saved 05_host_channel_settings_modal.png');
    }

    console.log('Visual captures completed successfully!');
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error('Visual capture error:', err);
  process.exit(1);
});
