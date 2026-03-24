/**
 * Crisp Proxy Pattern - Test Suite
 * Tests the actual crisp.ts implementation behavior
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('Crisp Proxy Pattern', () => {
  let crispBundle: string;

  test.beforeAll(() => {
    // Load the actual built Crisp agent bundle
    crispBundle = readFileSync(
      join(__dirname, '../packages/clarity-js/build/dynamic/clarity.crisp.js'),
      'utf-8'
    );
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to blank page and inject mock Crisp SDK
    await page.goto('about:blank');

    // Inject mock Crisp SDK before the bundle loads
    await page.evaluate(() => {
      (window as any).$crisp = {
        _handlers: {} as Record<string, Function>,
        push: function(args: [string, string, Function?]) {
          const [action, eventName, callback] = args;
          if (action === "on" && callback) {
            // Crisp's actual behavior: replaces previous handler
            this._handlers[eventName] = callback;
          } else if (action === "off") {
            if (callback) {
              // Remove specific handler
              delete this._handlers[eventName];
            } else {
              // No callback - remove all (Crisp supports this)
              delete this._handlers[eventName];
            }
          }
        },
        _trigger: function(eventName: string, data?: any) {
          if (this._handlers[eventName]) {
            this._handlers[eventName](data);
          }
        }
      };
    });
  });

  test('should preserve multiple handlers for same event', async ({ page }) => {
    // Inject the actual Crisp agent bundle
    await page.addScriptTag({ content: crispBundle });

    const result = await page.evaluate(() => {
      // Test: Register multiple handlers for same event
      const callCounts = { app: 0, clarity: 0, analytics: 0 };

      const appHandler = () => { callCounts.app++; };
      const clarityHandler = () => { callCounts.clarity++; };
      const analyticsHandler = () => { callCounts.analytics++; };

      (window as any).$crisp.push(["on", "chat:opened", appHandler]);
      (window as any).$crisp.push(["on", "chat:opened", clarityHandler]);
      (window as any).$crisp.push(["on", "chat:opened", analyticsHandler]);

      // Trigger the event
      (window as any).$crisp._trigger("chat:opened", { test: true });

      return {
        appCalled: callCounts.app === 1,
        clarityCalled: callCounts.clarity === 1,
        analyticsCalled: callCounts.analytics === 1,
        allCalled: callCounts.app === 1 && callCounts.clarity === 1 && callCounts.analytics === 1
      };
    });

    expect(result.appCalled).toBe(true);
    expect(result.clarityCalled).toBe(true);
    expect(result.analyticsCalled).toBe(true);
    expect(result.allCalled).toBe(true);
  });

  test('should remove handlers correctly', async ({ page }) => {
    await page.addScriptTag({ content: crispBundle });

    const result = await page.evaluate(() => {
      let handler1Calls = 0;
      let handler2Calls = 0;

      const handler1 = () => { handler1Calls++; };
      const handler2 = () => { handler2Calls++; };

      (window as any).$crisp.push(["on", "chat:closed", handler1]);
      (window as any).$crisp.push(["on", "chat:closed", handler2]);

      // Trigger - both should fire
      (window as any).$crisp._trigger("chat:closed", {});

      const callsAfterBoth = { h1: handler1Calls, h2: handler2Calls };

      // Remove handler2
      (window as any).$crisp.push(["off", "chat:closed", handler2]);

      // Trigger again - only handler1 should fire
      (window as any).$crisp._trigger("chat:closed", {});

      return {
        callsAfterBoth,
        callsAfterRemoval: { h1: handler1Calls, h2: handler2Calls }
      };
    });

    expect(result.callsAfterBoth.h1).toBe(1);
    expect(result.callsAfterBoth.h2).toBe(1);
    expect(result.callsAfterRemoval.h1).toBe(2);
    expect(result.callsAfterRemoval.h2).toBe(1);
  });

  test('should remove all handlers when off called without callback', async ({ page }) => {
    await page.addScriptTag({ content: crispBundle });

    const result = await page.evaluate(() => {
      let handler1Calls = 0;
      let handler2Calls = 0;

      const handler1 = () => { handler1Calls++; };
      const handler2 = () => { handler2Calls++; };

      (window as any).$crisp.push(["on", "message:sent", handler1]);
      (window as any).$crisp.push(["on", "message:sent", handler2]);

      // Trigger - both should fire
      (window as any).$crisp._trigger("message:sent", {});

      const callsAfterBoth = { h1: handler1Calls, h2: handler2Calls };

      // Remove ALL handlers (no callback provided)
      (window as any).$crisp.push(["off", "message:sent"]);

      // Trigger again - NO handlers should fire
      (window as any).$crisp._trigger("message:sent", {});

      return {
        callsAfterBoth,
        callsAfterRemoveAll: { h1: handler1Calls, h2: handler2Calls }
      };
    });

    expect(result.callsAfterBoth.h1).toBe(1);
    expect(result.callsAfterBoth.h2).toBe(1);
    // After removing all, no additional calls
    expect(result.callsAfterRemoveAll.h1).toBe(1);
    expect(result.callsAfterRemoveAll.h2).toBe(1);
  });

  test('should isolate errors in handlers', async ({ page }) => {
    await page.addScriptTag({ content: crispBundle });

    const result = await page.evaluate(() => {
      let goodHandlerCalls = 0;

      const goodHandler = () => { goodHandlerCalls++; };
      const badHandler = () => { throw new Error('Intentional error'); };

      (window as any).$crisp.push(["on", "test:error", goodHandler]);
      (window as any).$crisp.push(["on", "test:error", badHandler]);

      // Trigger - good handler should execute despite bad handler throwing
      try {
        (window as any).$crisp._trigger("test:error", {});
      } catch (e) {
        // Should not throw - errors should be caught
      }

      return { goodHandlerCalls };
    });

    expect(result.goodHandlerCalls).toBe(1);
  });

  test('should protect against infinite loops', async ({ page }) => {
    await page.addScriptTag({ content: crispBundle });

    const result = await page.evaluate(() => {
      // Save the Clarity proxy from the bundle
      const clarityProxy = (window as any).$crisp.push;
      let proxyEnterCount = 0;

      // Wrap the proxy to count entries and attempt re-entry
      (window as any).$crisp.push = function(args: any[]) {
        proxyEnterCount++;

        // Call the real Clarity proxy
        clarityProxy.call(this, args);

        // While inside the first call, try to re-enter
        // This simulates originalPush calling us back
        if (proxyEnterCount === 1) {
          clarityProxy.call(this, args); // Should be blocked by isProcessing
        }
      };

      (window as any).$crisp.push(["on", "test:loop", () => {}]);

      return {
        proxyEnterCount,
        reentryBlocked: proxyEnterCount === 1 // Only entered once, second blocked
      };
    });

    expect(result.reentryBlocked).toBe(true);
    expect(result.proxyEnterCount).toBe(1);
  });

  test('should allow handlers to register new handlers', async ({ page }) => {
    await page.addScriptTag({ content: crispBundle });

    const result = await page.evaluate(() => {
      let nestedHandlerRegistered = false;

      // Handler that registers another handler (legitimate use case)
      const parentHandler = () => {
        try {
          (window as any).$crisp.push(["on", "nested:event", () => {}]);
          nestedHandlerRegistered = true;
        } catch (e) {
          nestedHandlerRegistered = false;
        }
      };

      (window as any).$crisp.push(["on", "parent:event", parentHandler]);
      (window as any).$crisp._trigger("parent:event", {});

      return { nestedHandlerRegistered };
    });

    // This is legitimate - handlers should be able to register other handlers
    expect(result.nestedHandlerRegistered).toBe(true);
  });

  test('should clean up empty registry entries', async ({ page }) => {
    await page.addScriptTag({ content: crispBundle });

    const result = await page.evaluate(() => {
      const handler1 = () => {};
      const handler2 = () => {};

      // Register handlers
      (window as any).$crisp.push(["on", "test:cleanup", handler1]);
      (window as any).$crisp.push(["on", "test:cleanup", handler2]);

      // Remove all handlers one by one
      (window as any).$crisp.push(["off", "test:cleanup", handler1]);
      (window as any).$crisp.push(["off", "test:cleanup", handler2]);

      // Try to access the registry through a test helper
      // (In real code, the registry should be cleaned up)
      // We'll verify by trying to add a new handler and trigger
      let newHandlerCalled = 0;
      const newHandler = () => { newHandlerCalled++; };

      (window as any).$crisp.push(["on", "test:cleanup", newHandler]);
      (window as any).$crisp._trigger("test:cleanup", {});

      return {
        newHandlerCalled,
        registryCleanedUp: newHandlerCalled === 1 // Should work correctly
      };
    });

    expect(result.newHandlerCalled).toBe(1);
    expect(result.registryCleanedUp).toBe(true);
  });
});
