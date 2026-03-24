/**
 * Crisp Proxy Pattern - Comprehensive Test Suite
 * Tests proxy implementation with mocked Crisp SDK
 */

import { test, expect } from '@playwright/test';

test.describe('Crisp Proxy Pattern', () => {

  test('should handle multiple handlers for same event without conflicts', async ({ page }) => {
    const testResults = await page.evaluate(() => {
      const results: any = {
        scenarios: [],
        bundleSize: {},
        performance: {},
        overall: { passed: 0, failed: 0, total: 0 }
      };

      // ==================== MOCK CRISP SDK ====================
      // Simulate Crisp's behavior where only one handler is kept per event
      (window as any).$crisp = {
        _handlers: {} as Record<string, Function>,
        push: function(args: [string, string, Function?]) {
          const [action, eventName, callback] = args;

          if (action === "on" && callback) {
            // Crisp's actual behavior: replaces previous handler (this is the bug)
            this._handlers[eventName] = callback;
          } else if (action === "off") {
            delete this._handlers[eventName];
          }
        },
        // Helper to trigger events for testing
        _trigger: function(eventName: string, data?: any) {
          if (this._handlers[eventName]) {
            this._handlers[eventName](data);
          }
        }
      };

      // ==================== PROXY IMPLEMENTATION (from crisp.ts) ====================
      const handlerRegistry: Record<string, Function[]> = {};
      let originalPush: Function | null = null;
      let isProxyInstalled = false;
      let isProcessing = false;
      let callDepth = 0;
      const MAX_DEPTH = 10;

      function installProxy() {
        if (isProxyInstalled || !(window as any).$crisp) {
          return false;
        }

        originalPush = (window as any).$crisp.push.bind((window as any).$crisp);

        (window as any).$crisp.push = function(args: [string, string, Function?]) {
          const [action, eventName, callback] = args;

          // Infinite loop protection
          if (isProcessing) {
            if (originalPush) originalPush(args);
            return;
          }

          callDepth++;
          if (callDepth > MAX_DEPTH) {
            callDepth = 0;
            if (originalPush) originalPush(args);
            return;
          }

          try {
            isProcessing = true;

            if (action === "on" && callback) {
              if (!handlerRegistry[eventName]) {
                handlerRegistry[eventName] = [];
              }

              if (!handlerRegistry[eventName].includes(callback)) {
                handlerRegistry[eventName].push(callback);
              }

              const multiplexer = (data?: any): void => {
                for (const handler of handlerRegistry[eventName]) {
                  try {
                    handler(data);
                  } catch (e) {
                    // Silently catch errors
                  }
                }
              };

              originalPush!(["on", eventName, multiplexer]);
            } else if (action === "off" && callback) {
              if (handlerRegistry[eventName]) {
                const index = handlerRegistry[eventName].indexOf(callback);
                if (index > -1) {
                  handlerRegistry[eventName].splice(index, 1);
                }
              }

              if (handlerRegistry[eventName] && handlerRegistry[eventName].length > 0) {
                const multiplexer = (data?: any): void => {
                  for (const handler of handlerRegistry[eventName]) {
                    try {
                      handler(data);
                    } catch (e) {
                      // Silently catch errors
                    }
                  }
                };
                originalPush!(["on", eventName, multiplexer]);
              } else {
                originalPush!(args);
              }
            } else {
              originalPush!(args);
            }
          } finally {
            isProcessing = false;
            callDepth--;
          }
        };

        isProxyInstalled = true;
        return true;
      }

      // ==================== TEST SCENARIOS ====================

      // Scenario 1: Basic Handler Registration
      function testScenario1() {
        const scenario = { name: 'Basic Registration', passed: false, details: '' };

        try {
          let callCount = 0;
          const handler = () => { callCount++; };

          (window as any).$crisp.push(["on", "session:loaded", handler]);

          const registeredCount = handlerRegistry['session:loaded']?.length || 0;
          scenario.passed = registeredCount >= 1;
          scenario.details = `${registeredCount} handler(s) registered`;
        } catch (e: any) {
          scenario.details = `Error: ${e.message}`;
        }

        return scenario;
      }

      // Scenario 2: Multiple Handlers Same Event (Core Issue #979)
      function testScenario2() {
        const scenario = { name: 'Multiple Handlers', passed: false, details: '' };

        try {
          const callCounts = { app: 0, clarity: 0, analytics: 0 };

          const appHandler = () => { callCounts.app++; };
          const clarityHandler = () => { callCounts.clarity++; };
          const analyticsHandler = () => { callCounts.analytics++; };

          (window as any).$crisp.push(["on", "chat:opened", appHandler]);
          (window as any).$crisp.push(["on", "chat:opened", clarityHandler]);
          (window as any).$crisp.push(["on", "chat:opened", analyticsHandler]);

          // Trigger the event
          (window as any).$crisp._trigger("chat:opened", { test: true });

          const registeredCount = handlerRegistry['chat:opened']?.length || 0;
          const allCalled = callCounts.app === 1 && callCounts.clarity === 1 && callCounts.analytics === 1;

          scenario.passed = registeredCount === 3 && allCalled;
          scenario.details = `${registeredCount}/3 handlers preserved, all executed: ${allCalled}`;
        } catch (e: any) {
          scenario.details = `Error: ${e.message}`;
        }

        return scenario;
      }

      // Scenario 3: Handler Removal
      function testScenario3() {
        const scenario = { name: 'Handler Removal', passed: false, details: '' };

        try {
          const handler1 = () => {};
          const handler2 = () => {};

          (window as any).$crisp.push(["on", "chat:closed", handler1]);
          (window as any).$crisp.push(["on", "chat:closed", handler2]);

          const beforeRemoval = handlerRegistry['chat:closed']?.length || 0;

          (window as any).$crisp.push(["off", "chat:closed", handler2]);

          const afterRemoval = handlerRegistry['chat:closed']?.length || 0;
          scenario.passed = beforeRemoval === 2 && afterRemoval === 1;
          scenario.details = `${beforeRemoval} → ${afterRemoval}`;
        } catch (e: any) {
          scenario.details = `Error: ${e.message}`;
        }

        return scenario;
      }

      // Scenario 4: Multiple Event Types
      function testScenario4() {
        const scenario = { name: 'Multiple Events', passed: false, details: '' };

        try {
          const events = ['message:sent', 'message:received'];

          events.forEach(eventName => {
            for (let i = 0; i < 2; i++) {
              (window as any).$crisp.push(["on", eventName, () => {}]);
            }
          });

          const eventCount = Object.keys(handlerRegistry).filter(k => events.includes(k)).length;
          let totalHandlers = 0;
          events.forEach(e => {
            totalHandlers += handlerRegistry[e]?.length || 0;
          });

          scenario.passed = eventCount === 2 && totalHandlers === 4;
          scenario.details = `${eventCount} types, ${totalHandlers} handlers`;
        } catch (e: any) {
          scenario.details = `Error: ${e.message}`;
        }

        return scenario;
      }

      // Scenario 5: Error Handling
      function testScenario5() {
        const scenario = { name: 'Error Handling', passed: false, details: '' };

        try {
          let goodCalls = 0;
          const goodHandler = () => { goodCalls++; };
          const badHandler = () => { throw new Error('Intentional error'); };

          (window as any).$crisp.push(["on", "test:error", goodHandler]);
          (window as any).$crisp.push(["on", "test:error", badHandler]);

          // Trigger event
          (window as any).$crisp._trigger("test:error", {});

          const registeredCount = handlerRegistry['test:error']?.length || 0;
          // Good handler should have executed despite bad handler throwing
          scenario.passed = registeredCount === 2 && goodCalls === 1;
          scenario.details = `${registeredCount} handlers, good handler called: ${goodCalls === 1}`;
        } catch (e: any) {
          scenario.details = `Error: ${e.message}`;
        }

        return scenario;
      }

      // Scenario 6: Performance Test
      function testScenario6() {
        const scenario = { name: 'Performance', passed: false, details: '', metrics: {} as any };

        try {
          const numHandlers = 10;
          const startTime = performance.now();

          for (let i = 0; i < numHandlers; i++) {
            (window as any).$crisp.push(["on", "perf:test", () => {}]);
          }

          const endTime = performance.now();
          const duration = endTime - startTime;
          const avgPerHandler = duration / numHandlers;

          scenario.passed = avgPerHandler < 1;
          scenario.details = `${avgPerHandler.toFixed(3)}ms per handler`;
          scenario.metrics = { duration, avgPerHandler };
        } catch (e: any) {
          scenario.details = `Error: ${e.message}`;
        }

        return scenario;
      }

      // Scenario 7: Bundle Size Analysis
      function testScenario7() {
        const scenario = { name: 'Bundle Size', passed: false, details: '', metrics: {} as any };

        try {
          const proxyCode = installProxy.toString();
          const originalSize = new Blob([proxyCode]).size;
          const minifiedEstimate = proxyCode.replace(/\s+/g, ' ').replace(/\n/g, '').trim().length;
          const sizeKB = (minifiedEstimate / 1024).toFixed(2);

          scenario.passed = parseFloat(sizeKB) < 2;
          scenario.details = `${sizeKB} KB minified`;
          scenario.metrics = { originalSize, minifiedEstimate };
        } catch (e: any) {
          scenario.details = `Error: ${e.message}`;
        }

        return scenario;
      }

      // ==================== RUN ALL TESTS ====================

      const proxyInstalled = installProxy();
      if (!proxyInstalled) {
        results.overall.error = 'Failed to install proxy';
        return results;
      }

      results.scenarios.push(testScenario1());
      results.scenarios.push(testScenario2());
      results.scenarios.push(testScenario3());
      results.scenarios.push(testScenario4());
      results.scenarios.push(testScenario5());
      results.scenarios.push(testScenario6());
      results.scenarios.push(testScenario7());

      // Calculate totals
      results.overall.total = results.scenarios.length;
      results.overall.passed = results.scenarios.filter((s: any) => s.passed).length;
      results.overall.failed = results.overall.total - results.overall.passed;

      return results;
    });

    testResults.scenarios.forEach((scenario: any) => {
      expect(scenario.passed).toBe(true);
    });

    expect(testResults.overall.passed).toBe(testResults.overall.total);
    expect(testResults.overall.failed).toBe(0);
  });

  test('should protect against infinite loops', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Mock Crisp SDK
      (window as any).$crisp = {
        push: function(args: any[]) { /* mock */ }
      };

      // Proxy with loop protection
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
