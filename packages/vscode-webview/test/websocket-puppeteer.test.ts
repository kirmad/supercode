/**
 * Puppeteer tests for WebSocket communication
 * Tests the vscode-webview standalone client with WebSocket backend
 */

import puppeteer, { Browser, Page } from 'puppeteer';

describe('WebSocket Communication Tests', () => {
  let browser: Browser;
  let page: Page;
  const WEBVIEW_URL = 'http://localhost:5173'; // Vite dev server
  const SERVER_URL = 'http://localhost:8881';  // OpenCode server
  const WS_URL = 'ws://localhost:8881/ws';

  beforeAll(async () => {
    // Launch browser with debugging enabled
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      console.log(`PAGE LOG: ${msg.type()} - ${msg.text()}`);
    });
    
    // Log page errors
    page.on('pageerror', error => {
      console.error(`PAGE ERROR: ${error.message}`);
    });
    
    // Log WebSocket frames
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    
    client.on('Network.webSocketCreated', ({ url, requestId }) => {
      console.log(`WebSocket created: ${url} (${requestId})`);
    });
    
    client.on('Network.webSocketFrameSent', ({ response }) => {
      console.log(`WebSocket frame sent:`, response.payloadData);
    });
    
    client.on('Network.webSocketFrameReceived', ({ response }) => {
      console.log(`WebSocket frame received:`, response.payloadData);
    });
    
    client.on('Network.webSocketClosed', ({ timestamp }) => {
      console.log(`WebSocket closed at ${new Date(timestamp * 1000).toISOString()}`);
    });
  });

  afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should establish WebSocket connection', async () => {
    // Navigate to the webview
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle2' });
    
    // Wait for the connection status to show connected
    await page.waitForSelector('.status-bar.connected', { timeout: 10000 });
    
    // Verify connection status text
    const statusText = await page.$eval('.status-text', el => el.textContent);
    expect(statusText).toContain('Connected');
    
    // Check for WebSocket in network
    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Check if WebSocket is connected in the app
        const checkConnection = () => {
          const statusBar = document.querySelector('.status-bar');
          if (statusBar && statusBar.classList.contains('connected')) {
            resolve(true);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });
    });
    
    expect(wsConnected).toBe(true);
  });

  test('should send and receive messages via WebSocket', async () => {
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle2' });
    
    // Wait for connection
    await page.waitForSelector('.status-bar.connected', { timeout: 10000 });
    
    // Type a message in the input field
    const testMessage = 'Hello from Puppeteer WebSocket test!';
    await page.type('.input-field', testMessage);
    
    // Submit the message (press Enter)
    await page.keyboard.press('Enter');
    
    // Wait for the user message to appear
    await page.waitForSelector('.message.user', { timeout: 5000 });
    
    // Verify the message was sent
    const userMessage = await page.$eval('.user-content', el => el.textContent);
    expect(userMessage).toBe(testMessage);
    
    // Wait for assistant response (via WebSocket)
    await page.waitForSelector('.message.assistant', { timeout: 30000 });
    
    // Verify response was received
    const assistantMessages = await page.$$('.assistant-message');
    expect(assistantMessages.length).toBeGreaterThan(0);
  });

  test('should handle WebSocket events and SSE', async () => {
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle2' });
    
    // Wait for connection
    await page.waitForSelector('.status-bar.connected', { timeout: 10000 });
    
    // Monitor for events
    const events: any[] = [];
    await page.evaluateOnNewDocument(() => {
      (window as any).capturedEvents = [];
    });
    
    // Intercept console logs that contain event data
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('WebSocket event received') || text.includes('SSE event')) {
        events.push(text);
      }
    });
    
    // Send a message to trigger events
    await page.type('.input-field', 'Test event handling');
    await page.keyboard.press('Enter');
    
    // Wait a bit for events to be processed
    await page.waitForTimeout(3000);
    
    // Check if any events were captured
    const capturedEvents = await page.evaluate(() => {
      return (window as any).capturedEvents || [];
    });
    
    console.log('Captured events:', capturedEvents);
  });

  test('should reconnect WebSocket on disconnection', async () => {
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle2' });
    
    // Wait for initial connection
    await page.waitForSelector('.status-bar.connected', { timeout: 10000 });
    
    // Simulate WebSocket disconnection by evaluating in page context
    await page.evaluate(() => {
      // Find and close the WebSocket connection
      const wsClient = (window as any).wsClient;
      if (wsClient && wsClient.ws) {
        wsClient.ws.close();
      }
    });
    
    // Wait for reconnection (should show connecting status)
    await page.waitForSelector('.status-bar.connecting', { timeout: 5000 });
    
    // Wait for reconnection to complete
    await page.waitForSelector('.status-bar.connected', { timeout: 15000 });
    
    // Verify reconnection
    const statusText = await page.$eval('.status-text', el => el.textContent);
    expect(statusText).toContain('Connected');
  });

  test('should handle model selection via WebSocket', async () => {
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle2' });
    
    // Wait for connection
    await page.waitForSelector('.status-bar.connected', { timeout: 10000 });
    
    // Click on model selector
    await page.click('.model-info-inline.clickable');
    
    // Wait for model dropdown to appear
    await page.waitForSelector('.model-selector-dropdown', { timeout: 5000 });
    
    // Check if models are loaded
    const modelItems = await page.$$('.model-item');
    expect(modelItems.length).toBeGreaterThan(0);
    
    // Select a different model if available
    if (modelItems.length > 1) {
      await modelItems[1].click();
      
      // Wait for model change to complete
      await page.waitForTimeout(2000);
      
      // Verify model changed
      const modelInfo = await page.$eval('.model-info-inline', el => el.textContent);
      expect(modelInfo).toBeTruthy();
    }
  });

  test('should display token usage via WebSocket', async () => {
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle2' });
    
    // Wait for connection
    await page.waitForSelector('.status-bar.connected', { timeout: 10000 });
    
    // Check context window display
    const contextInfo = await page.$eval('.context-info', el => el.textContent);
    expect(contextInfo).toBeTruthy();
    
    // Send a message to update token usage
    await page.type('.input-field', 'Update token usage');
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForSelector('.message.assistant', { timeout: 30000 });
    
    // Check if context info is updated
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.context-info');
        return el && el.textContent !== 'Context Unavailable';
      },
      { timeout: 10000 }
    );
    
    const updatedContextInfo = await page.$eval('.context-info', el => el.textContent);
    expect(updatedContextInfo).not.toBe('Context Unavailable');
  });

  test('should handle tool calls via WebSocket', async () => {
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle2' });
    
    // Wait for connection
    await page.waitForSelector('.status-bar.connected', { timeout: 10000 });
    
    // Send a message that triggers tool usage
    await page.type('.input-field', 'What files are in the current directory?');
    await page.keyboard.press('Enter');
    
    // Wait for tool call indicators
    await page.waitForSelector('.tool-call-inline', { timeout: 30000 });
    
    // Verify tool calls are displayed
    const toolCalls = await page.$$('.tool-call-inline');
    expect(toolCalls.length).toBeGreaterThan(0);
    
    // Check tool call format
    const toolTitle = await page.$eval('.tool-title', el => el.textContent);
    expect(toolTitle).toBeTruthy();
  });

  test('should handle session management via WebSocket', async () => {
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle2' });
    
    // Wait for connection
    await page.waitForSelector('.status-bar.connected', { timeout: 10000 });
    
    // Send a message to create session activity
    await page.type('.input-field', 'Test session');
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForSelector('.message.assistant', { timeout: 30000 });
    
    // Press Cmd+K (or Ctrl+K) to clear session
    await page.keyboard.down('Meta');
    await page.keyboard.press('k');
    await page.keyboard.up('Meta');
    
    // Verify messages are cleared
    await page.waitForFunction(
      () => {
        const messages = document.querySelectorAll('.message');
        return messages.length === 0;
      },
      { timeout: 5000 }
    );
    
    const messages = await page.$$('.message');
    expect(messages.length).toBe(0);
  });

  test('should handle cancellation via WebSocket', async () => {
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle2' });
    
    // Wait for connection
    await page.waitForSelector('.status-bar.connected', { timeout: 10000 });
    
    // Send a long-running request
    await page.type('.input-field', 'Generate a very long story about testing');
    await page.keyboard.press('Enter');
    
    // Wait a moment for the request to start
    await page.waitForTimeout(500);
    
    // Press Escape to cancel
    await page.keyboard.press('Escape');
    
    // Check for cancellation (implementation specific)
    // The exact behavior depends on how cancellation is displayed in the UI
    await page.waitForTimeout(2000);
    
    // Verify the interface is responsive after cancellation
    const inputField = await page.$('.input-field');
    expect(inputField).toBeTruthy();
    
    const isDisabled = await page.$eval('.input-field', el => (el as HTMLTextAreaElement).disabled);
    expect(isDisabled).toBe(false);
  });
});

// Helper function to run tests
export async function runWebSocketTests() {
  console.log('Starting WebSocket Puppeteer tests...');
  
  // Check if servers are running
  try {
    const response = await fetch('http://localhost:8881/health');
    if (!response.ok) {
      console.error('OpenCode server is not running on port 8881');
      return;
    }
  } catch (error) {
    console.error('Cannot connect to OpenCode server:', error);
    return;
  }
  
  try {
    const response = await fetch('http://localhost:5173');
    if (!response.ok) {
      console.error('Vite dev server is not running on port 5173');
      return;
    }
  } catch (error) {
    console.error('Cannot connect to Vite dev server:', error);
    return;
  }
  
  console.log('Servers are running, starting tests...');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runWebSocketTests();
}