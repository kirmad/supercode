// Simple test to verify tree structure parsing
import { describe, it, expect } from 'bun:test'

// Mock the tree structure creation logic
function createTreeStructure(files: Array<{ path?: string; fileName?: string }>) {
  const root: any[] = []

  files.forEach((file) => {
    const filePath = file.path || file.fileName || ''
    const pathParts = filePath.split('/').filter(part => part.length > 0)

    let currentLevel = root
    let currentPath = ''

    pathParts.forEach((part, partIndex) => {
      currentPath += (currentPath ? '/' : '') + part
      const isFile = partIndex === pathParts.length - 1

      let existingNode = currentLevel.find(node => node.name === part)

      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          isFile,
          children: [],
          file: isFile ? file : undefined
        }
        currentLevel.push(existingNode)
      }

      currentLevel = existingNode.children
    })
  })

  return root
}

describe('FileTreeView', () => {
  it('should create correct tree structure from file paths', () => {
    const files = [
      { path: 'src/components/App.vue' },
      { path: 'src/utils/helper.ts' },
      { path: 'docs/README.md' },
      { path: 'src/components/Header.vue' }
    ]

    const tree = createTreeStructure(files)

    expect(tree).toHaveLength(2) // src and docs
    expect(tree[0].name).toBe('src')
    expect(tree[0].isFile).toBe(false)
    expect(tree[0].children).toHaveLength(2) // components and utils

    const componentsNode = tree[0].children.find((n: any) => n.name === 'components')
    expect(componentsNode).toBeTruthy()
    expect(componentsNode.children).toHaveLength(2) // App.vue and Header.vue

    const appFile = componentsNode.children.find((n: any) => n.name === 'App.vue')
    expect(appFile.isFile).toBe(true)
    expect(appFile.path).toBe('src/components/App.vue')
  })
})