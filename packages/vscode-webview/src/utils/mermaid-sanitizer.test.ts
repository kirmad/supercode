/**
 * Test cases for Mermaid diagram sanitization
 * This file contains test examples to verify that the sanitization function works correctly
 */

import { sanitizeMermaidDiagram } from './mermaid-loader'

// Test data with various edge cases
const testCases = [
  {
    name: 'Node with forward slash (user example)',
    input: `graph LR
    API[/review endpoints]
    Server[backend server]
    API --> Server`,
    expected: `graph LR
    API["/review endpoints"]
    Server[backend server]
    API --> Server`
  },
  {
    name: 'Multiple nodes with special characters',
    input: `flowchart TD
    A[Start/Begin]
    B[Process|Data]
    C[End/Finish]
    D[Normal Text]
    A --> B
    B --> C
    C --> D`,
    expected: `flowchart TD
    A["Start/Begin"]
    B["Process|Data"]
    C["End/Finish"]
    D[Normal Text]
    A --> B
    B --> C
    C --> D`
  },
  {
    name: 'Node with already quoted text',
    input: `graph LR
    A["Already quoted"]
    B[Needs/quotes]
    A --> B`,
    expected: `graph LR
    A["Already quoted"]
    B["Needs/quotes"]
    A --> B`
  },
  {
    name: 'Edge labels with special characters',
    input: `graph LR
    A --> |/api/call| B
    B --> |normal text| C
    C --> |special#char| D`,
    expected: `graph LR
    A --> |"/api/call"| B
    B --> |normal text| C
    C --> |"special#char"| D`
  },
  {
    name: 'Complex diagram with mixed content',
    input: `graph TD
    API[/api/v1/users]
    DB[(Database)]
    Cache[Redis Cache]
    Auth[Auth Service]

    API -->|GET /users/:id| DB
    API --> Cache
    Auth -->|validate token| API
    DB -->|return data| API`,
    expected: `graph TD
    API["/api/v1/users"]
    DB[(Database)]
    Cache[Redis Cache]
    Auth[Auth Service]

    API -->|"GET /users/:id"| DB
    API --> Cache
    Auth -->|validate token| API
    DB -->|return data| API`
  },
  {
    name: 'Node with parentheses style',
    input: `flowchart LR
    A(/start/point)
    B(middle)
    C(/end/point)
    A --> B --> C`,
    expected: `flowchart LR
    A("/start/point")
    B(middle)
    C("/end/point")
    A --> B --> C`
  },
  {
    name: 'Node with curly braces style',
    input: `flowchart LR
    A{Decision?}
    B{/path/check}
    C{Result}
    A --> B --> C`,
    expected: `flowchart LR
    A{Decision?}
    B{"/path/check"}
    C{Result}
    A --> B --> C`
  },
  {
    name: 'Single quotes conversion',
    input: `graph LR
    A['/api/endpoint']
    B[normal]
    A --> B`,
    expected: `graph LR
    A["/api/endpoint"]
    B[normal]
    A --> B`
  }
]

// Test function to validate sanitization
export function runSanitizationTests() {
  console.log('=== Running Mermaid Sanitization Tests ===\n')

  let passed = 0
  let failed = 0

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`)
    console.log('Input:')
    console.log(testCase.input)
    console.log('\nExpected:')
    console.log(testCase.expected)

    const result = sanitizeMermaidDiagram(testCase.input)

    console.log('\nActual:')
    console.log(result)

    if (result === testCase.expected) {
      console.log('✅ PASSED\n')
      passed++
    } else {
      console.log('❌ FAILED\n')
      failed++

      // Show differences
      const resultLines = result.split('\n')
      const expectedLines = testCase.expected.split('\n')
      const maxLines = Math.max(resultLines.length, expectedLines.length)

      for (let i = 0; i < maxLines; i++) {
        const resultLine = resultLines[i] || ''
        const expectedLine = expectedLines[i] || ''

        if (resultLine !== expectedLine) {
          console.log(`  Line ${i + 1} difference:`)
          console.log(`    Expected: "${expectedLine}"`)
          console.log(`    Got:      "${resultLine}"`)
        }
      }
    }

    console.log('---\n')
  })

  console.log(`=== Test Results ===`)
  console.log(`Passed: ${passed}/${testCases.length}`)
  console.log(`Failed: ${failed}/${testCases.length}`)
  console.log(`Success Rate: ${(passed / testCases.length * 100).toFixed(1)}%`)

  return { passed, failed, total: testCases.length }
}

// Example usage for manual testing
if (typeof window !== 'undefined') {
  // Can be run in browser console
  ;(window as any).testMermaidSanitizer = runSanitizationTests
}

// Export test cases for external use
export { testCases }