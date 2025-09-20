#!/usr/bin/env bun

/**
 * Test runner for BuildClient tests
 *
 * This is a convenience wrapper that runs the build-client test suite
 * through the main test runner.
 *
 * Usage:
 *   bun test/test-build-client.ts
 */

// Import and run the test through the main test runner
import './index.ts';

// Set the argument to run build-client test
process.argv = [process.argv[0], process.argv[1], 'build-client'];