const { io } = require('./client/node_modules/socket.io-client');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=== STARTING AUTOMATED WATCH PARTY E2E TESTS ===\n');
  const serverUrl = 'http://localhost:4000';
  const roomId = 'TEST-ROOM-' + Math.floor(Math.random() * 10000);

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

  // 1. Connect Client 1 (Alice - Creator / Host)
  const aliceSocket = io(serverUrl, { transports: ['websocket'] });
  let aliceState = null;
  let aliceRole = null;
  let aliceParticipants = [];
  let pendingRequestForAlice = null;
  let aliceDeniedError = null;

  aliceSocket.on('user_joined', (data) => {
    aliceParticipants = data.participants;
    if (data.username === 'Alice') {
      aliceRole = data.role;
    }
  });

  aliceSocket.on('sync_state', (data) => {
    aliceState = data;
  });

  aliceSocket.on('request_pending', (data) => {
    pendingRequestForAlice = data;
  });

  await new Promise((resolve) => aliceSocket.on('connect', resolve));
  console.log('Connected Alice to WebSocket server');

  aliceSocket.emit('join_room', { roomId, username: 'Alice', userId: 'alice_01' });
  await sleep(300);

  assert(aliceRole === 'HOST', 'Alice (room creator) was automatically assigned role HOST');
  assert(aliceParticipants.length === 1, 'Room participant count is 1');
  assert(aliceState !== null, 'Alice received initial sync_state');

  // 2. Connect Client 2 (Bob - Joiner / Participant)
  const bobSocket = io(serverUrl, { transports: ['websocket'] });
  let bobRole = null;
  let bobParticipants = [];
  let bobState = null;
  let bobDeniedError = null;
  let bobRequestResolved = null;

  bobSocket.on('user_joined', (data) => {
    bobParticipants = data.participants;
    if (data.username === 'Bob') {
      bobRole = data.role;
    }
  });

  bobSocket.on('sync_state', (data) => {
    bobState = data;
  });

  bobSocket.on('permission_denied', (data) => {
    bobDeniedError = data;
  });

  bobSocket.on('request_resolved', (data) => {
    bobRequestResolved = data;
  });

  await new Promise((resolve) => bobSocket.on('connect', resolve));
  console.log('Connected Bob to WebSocket server');

  bobSocket.emit('join_room', { roomId, username: 'Bob', userId: 'bob_02' });
  await sleep(300);

  assert(bobRole === 'PARTICIPANT', 'Bob (joiner) was automatically assigned role PARTICIPANT');
  assert(bobParticipants.length === 2, 'Bob participant list shows 2 users');
  assert(aliceParticipants.length === 2, 'Alice participant list updated live to 2 users');
  assert(bobState !== null, 'Bob (late joiner) immediately received current sync_state');

  // 3. Host Play / Pause Synchronization
  aliceSocket.emit('play');
  await sleep(300);
  assert(bobState.playState === 'PLAYING', 'Host Play synchronized to Bob (Bob state is PLAYING)');

  aliceSocket.emit('pause');
  await sleep(300);
  assert(bobState.playState === 'PAUSED', 'Host Pause synchronized to Bob (Bob state is PAUSED)');

  // 4. Host Seek Synchronization
  aliceSocket.emit('seek', { time: 85.5 });
  await sleep(300);
  assert(bobState.currentTime === 85.5, 'Host Seek (85.5s) synchronized to Bob');

  // 5. Host Change Video Synchronization
  aliceSocket.emit('change_video', { videoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  await sleep(300);
  assert(bobState.videoId === 'dQw4w9WgXcQ', 'Host changed video from full URL; parsed ID synchronized to Bob');
  assert(bobState.currentTime === 0, 'New video playback starts at 0s');

  // 6. RBAC Validation: Forged Playback Command from Participant Rejected
  bobDeniedError = null;
  bobSocket.emit('change_video', { videoId: 'jfKfPfyJRdk' });
  await sleep(300);
  assert(bobDeniedError !== null && bobDeniedError.code === 'FORBIDDEN', 'Server rejected unauthorized change_video from Participant Bob with FORBIDDEN');
  assert(aliceState.videoId === 'dQw4w9WgXcQ', 'Video was NOT changed by unauthorized Participant');

  // 7. Participant Request -> Host Approval Workflow
  pendingRequestForAlice = null;
  bobRequestResolved = null;
  bobSocket.emit('request_action', { action: 'seek', payload: { time: 142 } });
  await sleep(300);

  assert(pendingRequestForAlice !== null, 'Alice received request_pending event from Bob');
  assert(pendingRequestForAlice.action === 'seek' && pendingRequestForAlice.payload.time === 142, 'Request details match Bob request');

  // Alice approves request
  aliceSocket.emit('approve_request', { requestId: pendingRequestForAlice.id });
  await sleep(300);

  assert(bobRequestResolved !== null && bobRequestResolved.status === 'approved', 'Bob received request_resolved with approved status');
  assert(bobState.currentTime === 142, 'Approved seek action took effect for all room members (currentTime: 142)');

  // 8. Participant Request -> Host Rejection Workflow
  pendingRequestForAlice = null;
  bobRequestResolved = null;
  bobSocket.emit('request_action', { action: 'play' });
  await sleep(300);
  assert(pendingRequestForAlice !== null, 'Alice received second request');

  aliceSocket.emit('reject_request', { requestId: pendingRequestForAlice.id });
  await sleep(300);
  assert(bobRequestResolved !== null && bobRequestResolved.status === 'rejected', 'Bob received request_resolved with rejected status');

  // 9. Host Promotes Participant to Moderator
  let bobRoleAssigned = null;
  bobSocket.on('role_assigned', (data) => {
    bobRoleAssigned = data;
  });

  aliceSocket.emit('assign_role', { userId: 'bob_02', role: 'MODERATOR' });
  await sleep(300);

  assert(bobRoleAssigned !== null && bobRoleAssigned.role === 'MODERATOR', 'Role promotion broadcasted Bob as MODERATOR');

  // Now Bob (Moderator) can directly control playback!
  bobDeniedError = null;
  bobSocket.emit('seek', { time: 200 });
  await sleep(300);
  assert(bobDeniedError === null, 'Moderator Bob was not rejected when seeking');
  assert(Math.abs(aliceState.currentTime - 200) < 2, 'Moderator seek synchronized to Alice (currentTime ~ 200s)');

  // 10. Transfer Host Role
  let hostTransferredEvent = null;
  bobSocket.on('host_transferred', (data) => {
    hostTransferredEvent = data;
  });

  aliceSocket.emit('transfer_host', { userId: 'bob_02' });
  await sleep(300);

  assert(hostTransferredEvent !== null && hostTransferredEvent.newHostId === 'bob_02', 'Host ownership transferred to Bob');
  const bobRecordInList = hostTransferredEvent.participants.find((p) => p.userId === 'bob_02');
  assert(bobRecordInList && bobRecordInList.role === 'HOST', 'Bob is now recorded as HOST in participant list');

  // 11. Connect Client 3 (Charlie) and Test Removal / Kick
  const charlieSocket = io(serverUrl, { transports: ['websocket'] });
  let charlieRemoved = null;
  charlieSocket.on('participant_removed', (data) => {
    charlieRemoved = data;
  });

  await new Promise((resolve) => charlieSocket.on('connect', resolve));
  charlieSocket.emit('join_room', { roomId, username: 'Charlie', userId: 'charlie_03' });
  await sleep(300);

  // Bob (now Host) kicks Charlie
  bobSocket.emit('remove_participant', { userId: 'charlie_03' });
  await sleep(300);

  assert(charlieRemoved !== null, 'Charlie received participant_removed event');

  // 12. Chat Messages and Reactions
  let receivedChat = null;
  let receivedReaction = null;
  aliceSocket.on('chat_message', (data) => {
    receivedChat = data;
  });
  aliceSocket.on('reaction_received', (data) => {
    receivedReaction = data;
  });

  bobSocket.emit('chat_message', { message: 'Awesome watch party!' });
  bobSocket.emit('send_reaction', { emoji: '🔥' });
  await sleep(300);

  assert(receivedChat !== null && receivedChat.message === 'Awesome watch party!', 'Chat message received in real-time');
  assert(receivedReaction !== null && receivedReaction.emoji === '🔥', 'Emoji reaction received in real-time');

  // 13. Host Disconnect & Auto-Promotion
  let newHostAfterDisconnect = null;
  aliceSocket.on('host_transferred', (data) => {
    newHostAfterDisconnect = data;
  });

  bobSocket.disconnect();
  await sleep(400);

  assert(newHostAfterDisconnect !== null && newHostAfterDisconnect.newHostId === 'alice_01', 'When Host Bob disconnected, Alice was auto-promoted back to HOST');

  // Cleanup
  aliceSocket.disconnect();
  charlieSocket.disconnect();

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passedTests} / ${totalTests} TESTS PASSED!`);
  console.log(`========================================\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
