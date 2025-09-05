#!/usr/bin/env bun

// Simple test script to verify the instructions() function works
import { SystemPrompt } from "./src/session/system"
import { Instance } from "./src/project/instance"

async function testInstructions() {
  try {
    console.log("Testing SystemPrompt.instructions() function...")
    console.log("Current directory:", process.cwd())
    
    // We need to provide instance context
    await Instance.provide(process.cwd(), async () => {
      const instructions = await SystemPrompt.instructions()
      
      console.log(`Found ${instructions.length} instruction file(s)`)
      
      instructions.forEach((instruction, index) => {
        console.log(`\n--- Instruction ${index + 1} ---`)
        console.log(instruction.substring(0, 200) + (instruction.length > 200 ? '...' : ''))
      })
      
      if (instructions.length === 0) {
        console.log("No instruction files found (this is expected if no *.instructions.md files exist)")
      }
    })
    
    console.log("\n✅ Test completed successfully!")
  } catch (error) {
    console.error("❌ Test failed:", error)
    process.exit(1)
  }
}

testInstructions()