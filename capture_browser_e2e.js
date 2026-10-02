const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  console.log('Launching Chrome for Visual Multi-Tab Verification...');
  const artifactDir = path.resolve('C:/Users/solvi/.gemini/antigravity-ide/brain/1ffead57-bcd5-4833-b534-d29e8697e194');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });

  try {
    // -------------------------------------------------------------
    // Page 1: Alice (Host)
    // -------------------------------------------------------------
    const pageAlice = await browser.newPage();
    console.log('Navigating Alice to http://localhost:4000...');
    await pageAlice.goto('http://localhost:4000', { waitUntil: 'networkidle0' });

    // Screenshot 1: Landing Page
    await pageAlice.screenshot({ path: path.join(artifactDir, '01_landing_page.png') });
    console.log('Saved 01_landing_page.png');

    // Switch to Private Watch Party Tab
    const privateTabBtn = await pageAlice.$('.type-toggle-btn:nth-child(2)');
    if (privateTabBtn) {
      await privateTabBtn.click();
      await sleep(600);
    }

    // Create Room as Alice
    await pageAlice.type('input[placeholder="e.g. Alice"]', 'Alice');
    await pageAlice.click('button[type="submit"]');
    await pageAlice.waitForSelector('.room-code-pill', { timeout: 10000 });
    await sleep(2000);

    // Get Room Code
    const roomCode = await pageAlice.$eval('.room-code-pill strong', (el) => el.textContent.trim());
    console.log(`Alice created room: ${roomCode}`);

    // Alice sends chat message
    await pageAlice.type('input[placeholder="Type a message..."]', 'Welcome to the party! 🍿');
    await pageAlice.keyboard.press('Enter');
    await sleep(800);

    // Alice triggers reaction
    await pageAlice.evaluate(() => {
      const btn = document.querySelector('.reaction-bubble-btn');
      if (btn) btn.click();
    });
    await sleep(800);

    // Screenshot 2: Host Room View
    await pageAlice.screenshot({ path: path.join(artifactDir, '02_host_room_view.png') });
    console.log('Saved 02_host_room_view.png');

    // -------------------------------------------------------------
    // Page 2: Bob (Participant)
    // -------------------------------------------------------------
    const contextBob = await browser.createBrowserContext();
    const pageBob = await contextBob.newPage();
    await pageBob.setViewport({ width: 1280, height: 800 });

    const bobJoinUrl = `http://localhost:4000/?room=${roomCode}`;
    console.log(`Navigating Bob to ${bobJoinUrl}...`);
    await pageBob.goto(bobJoinUrl, { waitUntil: 'networkidle0' });

    // Bob enters name and joins
    await pageBob.type('input[placeholder="e.g. Alice"]', 'Bob');
    await pageBob.click('button[type="submit"]');
    await pageBob.waitForSelector('.room-code-pill', { timeout: 10000 });
    await sleep(2000);

    // Bob sends a chat message
    await pageBob.type('input[placeholder="Type a message..."]', 'Hey Alice, stoked to be here!');
    await pageBob.keyboard.press('Enter');
    await sleep(800);

    // Screenshot 3: Participant Room View
    await pageBob.screenshot({ path: path.join(artifactDir, '03_participant_room_view.png') });
    console.log('Saved 03_participant_room_view.png');

    // Bob clicks "Request Action" button
    await pageBob.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find((b) => b.textContent && b.textContent.includes('Request Action'));
      if (target) target.click();
    });
    await sleep(800);

    // Screenshot 4: Request Action Modal
    await pageBob.screenshot({ path: path.join(artifactDir, '04_participant_request_modal.png') });
    console.log('Saved 04_participant_request_modal.png');

    // Bob selects Seek and submits
    await pageBob.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const seekBtn = btns.find((b) => b.textContent && b.textContent.includes('Seek'));
      if (seekBtn) seekBtn.click();
    });
    await sleep(400);

    await pageBob.type('input[placeholder="e.g. 120"]', '45');
    await pageBob.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find((b) => b.textContent && b.textContent.includes('Submit Request'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(1000);

    // -------------------------------------------------------------
    // Back to Alice (Host): Pending Requests Approval
    // -------------------------------------------------------------
    await pageAlice.bringToFront();
    await sleep(1000);

    // Alice clicks Requests button
    await pageAlice.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const reqBtn = btns.find((b) => b.textContent && b.textContent.includes('Requests'));
      if (reqBtn) reqBtn.click();
    });
    await sleep(800);

    // Screenshot 5: Host Pending Requests
    await pageAlice.screenshot({ path: path.join(artifactDir, '05_host_pending_requests.png') });
    console.log('Saved 05_host_pending_requests.png');

    // Approve the request
    await pageAlice.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const approveBtn = btns.find((b) => b.textContent && b.textContent.includes('Approve'));
      if (approveBtn) approveBtn.click();
    });
    await sleep(1000);

    // Switch Alice sidebar to Party tab
    await pageAlice.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.sidebar-tab-btn'));
      if (tabs.length > 1) tabs[1].click();
    });
    await sleep(800);

    // Open Bob's menu and promote to Moderator
    await pageAlice.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.participant-row'));
      const bobRow = rows.find((r) => r.textContent && r.textContent.includes('Bob'));
      if (bobRow) {
        const iconBtn = bobRow.querySelector('.btn-icon');
        if (iconBtn) iconBtn.click();
      }
    });
    await sleep(500);

    await pageAlice.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const promoteBtn = btns.find((b) => b.textContent && b.textContent.includes('Promote to Moderator'));
      if (promoteBtn) promoteBtn.click();
    });
    await sleep(1000);

    // Screenshot 6: Role Promotion View
    await pageAlice.screenshot({ path: path.join(artifactDir, '06_role_promotion.png') });
    console.log('Saved 06_role_promotion.png');

    // -------------------------------------------------------------
    // Back to Bob: Moderator View
    // -------------------------------------------------------------
    await pageBob.bringToFront();
    await sleep(1000);

    // Switch Bob to Party tab
    await pageBob.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.sidebar-tab-btn'));
      if (tabs.length > 1) tabs[1].click();
    });
    await sleep(800);

    // Screenshot 7: Bob as Moderator
    await pageBob.screenshot({ path: path.join(artifactDir, '07_bob_as_moderator.png') });
    console.log('Saved 07_bob_as_moderator.png');

    console.log('\nAll 7 walkthrough screenshots captured and saved successfully!');
  } catch (err) {
    console.error('Visual test error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
