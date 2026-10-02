const { io } = require('./client/node_modules/socket.io-client');
const http = require('http');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('=== STARTING PUBLIC & PRIVATE CHANNELS E2E TESTS ===\n');
  const serverUrl = 'http://localhost:4000';

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. REST API: Verify seeded public community channels
  console.log('\n--- 1. Testing REST API Public Lounges Endpoint ---');
  const publicRoomsResp = await fetchJson(`${serverUrl}/api/rooms/public`);
  assert(Array.isArray(publicRoomsResp.rooms), 'GET /api/rooms/public returns an array of rooms');
  assert(publicRoomsResp.rooms.length >= 4, `At least 4 seeded public rooms exist (Found: ${publicRoomsResp.rooms.length})`);

  const lofiRoom = publicRoomsResp.rooms.find((r) => r.id === 'COMMUNITY-LOFI');
  assert(lofiRoom !== undefined, 'Seeded COMMUNITY-LOFI public lounge found');
  assert(lofiRoom && lofiRoom.roomType === 'public', 'COMMUNITY-LOFI has roomType "public"');
  assert(lofiRoom && lofiRoom.category === 'Study & Lofi', 'COMMUNITY-LOFI has category "Study & Lofi"');

  // 2. Client 1: Join Public Lounge
  console.log('\n--- 2. Testing Socket Joining Public Lounge ---');
  const alice = io(serverUrl, { transports: ['websocket'] });
  let aliceRoomDetails = null;
  let aliceSyncState = null;

  alice.on('room_details', (details) => {
    aliceRoomDetails = details;
  });
  alice.on('sync_state', (state) => {
    aliceSyncState = state;
  });

  await new Promise((resolve) => alice.on('connect', resolve));
  alice.emit('join_room', {
    roomId: 'COMMUNITY-LOFI',
    username: 'Alice',
    userId: 'user_alice_pub',
  });
  await sleep(350);

  assert(aliceRoomDetails !== null, 'Alice received room_details upon joining public lounge');
  assert(aliceRoomDetails && aliceRoomDetails.roomType === 'public', 'Alice room_details has roomType === "public"');
  assert(aliceSyncState !== null, 'Alice received live sync_state');

  // 3. Client 2: Create Private Watch Party
  console.log('\n--- 3. Testing Private Channel Creation & Code Sharing ---');
  const privateRoomId = `PARTY-TEST-${Math.floor(Math.random() * 9000 + 1000)}`;
  const bob = io(serverUrl, { transports: ['websocket'] });
  let bobRoomDetails = null;
  let bobRole = null;

  bob.on('room_details', (details) => {
    bobRoomDetails = details;
  });
  bob.on('user_joined', (data) => {
    if (data.username === 'Bob') bobRole = data.role;
  });

  await new Promise((resolve) => bob.on('connect', resolve));
  bob.emit('join_room', {
    roomId: privateRoomId,
    username: 'Bob',
    userId: 'user_bob_priv',
    roomType: 'private',
    name: "Bob's Secret Anime Screening",
  });
  await sleep(350);

  assert(bobRole === 'HOST', 'Bob is automatically assigned HOST of his private room');
  assert(bobRoomDetails !== null, 'Bob received room_details for private room');
  assert(bobRoomDetails && bobRoomDetails.roomType === 'private', 'Bob roomDetails roomType === "private"');

  // Verify private room does NOT appear in public rooms explorer
  const publicRoomsCheck1 = await fetchJson(`${serverUrl}/api/rooms/public`);
  const privateInPublic = publicRoomsCheck1.rooms.find((r) => r.id === privateRoomId);
  assert(!privateInPublic, 'Private room is NOT listed in public rooms explorer');

  // 4. Client 3: Charlie joins Bob's private room using the code
  console.log('\n--- 4. Testing Join Private Channel With Code ---');
  const charlie = io(serverUrl, { transports: ['websocket'] });
  let charlieRoomDetails = null;
  let charlieParticipants = [];

  charlie.on('room_details', (details) => {
    charlieRoomDetails = details;
  });
  charlie.on('user_joined', (data) => {
    charlieParticipants = data.participants;
  });

  await new Promise((resolve) => charlie.on('connect', resolve));
  charlie.emit('join_room', {
    roomId: privateRoomId,
    username: 'Charlie',
    userId: 'user_charlie_priv',
  });
  await sleep(350);

  assert(charlieRoomDetails && charlieRoomDetails.roomType === 'private', 'Charlie joined private party via code');
  assert(charlieParticipants.length === 2, 'Room now has 2 participants (Bob and Charlie)');

  // 5. Host toggles visibility from Private to Public on the fly
  console.log('\n--- 5. Testing Host Visibility Toggle (Private -> Public) ---');
  let publicRoomsUpdatedReceived = false;
  alice.on('public_rooms_updated', (rooms) => {
    if (rooms.some((r) => r.id === privateRoomId)) {
      publicRoomsUpdatedReceived = true;
    }
  });

  bob.emit('update_room_details', {
    roomType: 'public',
    name: "Bob's Now Public Anime Screening",
    category: 'Cinema',
  });
  await sleep(400);

  assert(bobRoomDetails && bobRoomDetails.roomType === 'public', 'Bob roomDetails updated to public');
  assert(charlieRoomDetails && charlieRoomDetails.roomType === 'public', 'Charlie received roomDetails update to public');

  const publicRoomsCheck2 = await fetchJson(`${serverUrl}/api/rooms/public`);
  const nowPublicRoom = publicRoomsCheck2.rooms.find((r) => r.id === privateRoomId);
  assert(nowPublicRoom !== undefined, 'Room now appears in public community explorer');
  assert(nowPublicRoom && nowPublicRoom.participantsCount === 2, 'Live participant count reflected accurately in community explorer (2 viewers)');

  // 6. Non-host attempts to toggle visibility -> denied
  console.log('\n--- 6. Testing Permission Enforcement (Non-Host Cannot Change Privacy) ---');
  let permissionDeniedReceived = false;
  charlie.on('permission_denied', (err) => {
    if (err.action === 'update_room_details') {
      permissionDeniedReceived = true;
    }
  });

  charlie.emit('update_room_details', {
    roomType: 'private',
  });
  await sleep(350);

  assert(permissionDeniedReceived, 'Non-host (Charlie) was denied permission to change channel privacy');

  // 7. Host toggles back to Private
  console.log('\n--- 7. Testing Host Visibility Toggle (Public -> Private) ---');
  bob.emit('update_room_details', {
    roomType: 'private',
  });
  await sleep(400);

  assert(bobRoomDetails && bobRoomDetails.roomType === 'private', 'Bob successfully switched room back to private');
  const publicRoomsCheck3 = await fetchJson(`${serverUrl}/api/rooms/public`);
  assert(!publicRoomsCheck3.rooms.find((r) => r.id === privateRoomId), 'Room no longer appears in public community explorer');

  // Cleanup
  alice.disconnect();
  bob.disconnect();
  charlie.disconnect();

  console.log(`\n=== RESULTS: ${passedTests} / ${totalTests} TESTS PASSED ===\n`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL PUBLIC & PRIVATE CHANNEL TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
