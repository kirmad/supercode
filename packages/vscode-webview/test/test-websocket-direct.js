/**
 * Direct test of WebSocket connection to OpenCode server
 */

import WebSocket from 'ws';

async function testWebSocketConnection() {
  console.log('Testing WebSocket connection to OpenCode server...');
  
  const ws = new WebSocket('ws://localhost:8881/ws');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connection opened');
    
    // Send a test request
    const testRequest = {
      type: 'request',
      id: 'test-1',
      method: 'GET',
      path: '/config',
      timestamp: Date.now()
    };
    
    console.log('📤 Sending test request:', testRequest);
    ws.send(JSON.stringify(testRequest));
    
    // Send a ping
    setTimeout(() => {
      const ping = {
        type: 'control',
        action: 'ping',
        id: 'ping-1',
        timestamp: Date.now()
      };
      console.log('📤 Sending ping:', ping);
      ws.send(JSON.stringify(ping));
    }, 1000);
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📥 Received message:', message);
    
    if (message.type === 'response' && message.id === 'test-1') {
      console.log('✅ Got response to test request');
    }
    
    if (message.type === 'control' && message.action === 'pong') {
      console.log('✅ Got pong response');
      
      // Close connection after successful test
      setTimeout(() => {
        console.log('Closing connection...');
        ws.close();
      }, 500);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed with code ${code}, reason: ${reason}`);
  });
}

// Run the test
testWebSocketConnection().catch(console.error);