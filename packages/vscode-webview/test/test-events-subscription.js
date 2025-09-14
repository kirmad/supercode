/**
 * Test WebSocket Event Subscription
 * This script connects to the WebSocket server and monitors all incoming events
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8881/ws');

console.log('🔌 Connecting to WebSocket server...');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('📡 Monitoring for Bus events (no subscription needed - server sends all when subscriptions.size === 0)');
  
  // Send a test message after 2 seconds to trigger Bus events
  setTimeout(() => {
    console.log('\n📤 Sending test request to trigger Bus events...');
    const request = {
      type: 'request',
      id: 'trigger-' + Date.now(),
      method: 'POST',
      path: '/tui/append-prompt',
      params: {
        body: {
          text: 'Hello from event test!'
        }
      },
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(request));
  }, 2000);
  
  // Send another message after 5 seconds
  setTimeout(() => {
    console.log('\n📤 Sending another test request...');
    const request = {
      type: 'request',
      id: 'trigger2-' + Date.now(),
      method: 'POST',
      path: '/tui/submit-prompt',
      params: {
        body: {}
      },
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(request));
  }, 5000);
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'event') {
    console.log(`\n🎉 BUS EVENT RECEIVED!`);
    console.log(`   Event: ${message.event}`);
    console.log(`   Data: ${JSON.stringify(message.data, null, 2)}`);
    console.log(`   Timestamp: ${new Date(message.timestamp).toLocaleTimeString()}`);
  } else if (message.type === 'response') {
    console.log(`\n📬 Response: ${message.id} - Status: ${message.status}`);
  } else {
    console.log(`\n📦 ${message.type}: ${JSON.stringify(message)}`);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 WebSocket closed: code=${code}, reason=${reason}`);
});

// Keep the script running for 30 seconds
setTimeout(() => {
  console.log('\n⏰ Test complete, closing connection...');
  ws.close();
  process.exit(0);
}, 30000);

console.log('⏳ Test will run for 30 seconds...\n');