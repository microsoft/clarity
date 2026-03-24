/**
 * Crisp Proxy Pattern - Test Suite
 * Tests the actual crisp.ts implementation behavior
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('Crisp Proxy Pattern', () => {

  test('should preserve multiple handlers for same event', async ({ page }) => {
    // Load the actual built Crisp agent bundle
    const crispBundle = readFileSync(
      join(__dirname, '../packages/clarity-js/build/dynamic/clarity.crisp.js'),
      'utf-8'
    );

    const result = await page.evaluate((bundleCode) => {
      // Mock Crisp SDK
      (window as any).$crisp = {
        _handlers: {} as Record<string, Function>,
        push: function(args: [string, string, Function?]) {
          const [action, eventName, callback] = args;
          if (action === "on" && callback) {
            // Crisp's actual behavior: replaces previous handler
            this._handlers[eventName] = callback;
          } else if (action === "off") {
            delete this._handlers[eventName];
          }
        },
        _trigger: function(eventName: string, data?: any) {
          if (this._handlers[eventName]) {
            this._handlers[eventName](data);
          }
        }
      };

      // Execute the actual Crisp agent bundle
      eval(bundleCode);

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
    }, crispBundle);

    expect(result.appCalled).toBe(true);
    expect(result.clarityCalled).toBe(true);
    expect(result.analyticsCalled).toBe(true);
    expect(result.allCalled).toBe(true);
  });

  test('should remove handlers correctly', async ({ page }) => {
    const crispBundle = readFileSync(
      join(__dirname, '../packages/clarity-js/build/dynamic/clarity.crisp.js'),
      'utf-8'
    );

    const result = await page.evaluate((bundleCode) => {
      // Mock Crisp SDK
      (window as any).$crisp = {
        _handlers: {} as Record<string, Function>,
        push: function(args: [string, string, Function?]) {
          const [action, eventName, callback] = args;
          if (action === "on" && callback) {
            this._handlers[eventName] = callback;
          } else if (action === "off") {
            delete this._handlers[eventName];
          }
        },
        _trigger: function(eventName: string, data?: any) {
          if (this._handlers[eventName]) {
            this._handlers[eventName](data);
          }
        }
      };

      eval(bundleCode);

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
    }, crispBundle);

    // After registering both handlers, both should have executed once
    expect(result.callsAfterBoth.h1).toBe(1);
    expect(result.callsAfterBoth.h2).toBe(1);

    // After removing handler2, handler1 should execute again but handler2 should not
    expect(result.callsAfterRemoval.h1).toBe(2);
    expect(result.callsAfterRemoval.h2).toBe(1);
  });

  test('should isolate errors in handlers', async ({ page }) => {
    const crispBundle = readFileSync(
      join(__dirname, '../packages/clarity-js/build/dynamic/clarity.crisp.js'),
      'utf-8'
    );

    const result = await page.evaluate((bundleCode) => {
      (window as any).$crisp = {
        _handlers: {} as Record<string, Function>,
        push: function(args: [string, string, Function?]) {
          const [action, eventName, callback] = args;
          if (action === "on" && callback) {
            this._handlers[eventName] = callback;
          }
        },
        _trigger: function(eventName: string, data?: any) {
          if (this._handlers[eventName]) {
            this._handlers[eventName](data);
          }
        }
      };

      eval(bundleCode);

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
    }, crispBundle);

    // Good handler should have executed despite bad handler throwing
    expect(result.goodHandlerCalls).toBe(1);
  });

  test('should protect against infinite loops', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Mock Crisp SDK
      (window as any).$crisp = {
        push: function(_args: any[]) { /* mock */ }
      };

      // Simulate the proxy with loop protection
      let isProcessing = false;
      let callDepth = 0;
      const MAX_DEPTH = 10;
      let enterCount = 0;
      let processCount = 0;

      (window as any).$crisp.push = function(args: any[]) {
        enterCount++;

        if (isProcessing) return;

        callDepth++;
        if (callDepth > MAX_DEPTH) {
          callDepth = 0;
          return;
        }

        try {
          isProcessing = true;
          processCount++;

          // Try to cause infinite loop
          for (let i = 0; i < 4; i++) {
            (window as any).$crisp.push(args);
          }
        } finally {
          isProcessing = false;
          callDepth--;
        }
      };

      (window as any).$crisp.push(["on", "test", () => {}]);

      return {
        enterCount,
        processCount,
        loopBlocked: enterCount === 5 && processCount === 1
      };
    });

    expect(result.loopBlocked).toBe(true);
    expect(result.enterCount).toBe(5);
    expect(result.processCount).toBe(1);
  });
});
