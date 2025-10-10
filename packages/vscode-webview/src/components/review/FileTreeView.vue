<template>
  <div class="file-tree-view">
    <div class="tree-header">
      <FolderOpen :size="16" class="header-icon" />
      <span class="header-title">Files</span>
      <span class="file-count">({{ totalFiles }})</span>
    </div>
    <div class="tree-container">
      <FileTreeItem
        v-for="item in treeData"
        :key="item.name"
        :item="item"
        :selected-file="selectedFile"
        @file-select="handleFileSelect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DiffFile } from '../../services/ProjectWorkflowService'
import { FolderOpen } from 'lucide-vue-next'
import FileTreeItem from './FileTreeItem.vue'

interface TreeNode {
  name: string
  path?: string
  isFile: boolean
  children: TreeNode[]
  file?: DiffFile
}

interface Props {
  files: DiffFile[]
  selectedFile?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'file-select': [file: DiffFile]
}>()

// Build tree structure from flat file paths
const treeData = computed<TreeNode[]>(() => {
  const root: TreeNode[] = []

  props.files.forEach((file, index) => {
    const filePath = file.path || file.fileName || ''
    const pathParts = filePath.split('/').filter(part => part.length > 0)

    let currentLevel = root
    let currentPath = ''

    pathParts.forEach((part, partIndex) => {
      currentPath += (currentPath ? '/' : '') + part
      const isFile = partIndex === pathParts.length - 1

      // Find existing node at this level
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

  return sortTreeNodes(root)
})

// Sort tree nodes: directories first, then files, both alphabetically
function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    // Directories come first
    if (!a.isFile && b.isFile) return -1
    if (a.isFile && !b.isFile) return 1

    // Within same type, sort alphabetically
    return a.name.localeCompare(b.name)
  }).map(node => ({
    ...node,
    children: sortTreeNodes(node.children)
  }))
}

const totalFiles = computed(() => props.files.length)

function handleFileSelect(file: DiffFile) {
  emit('file-select', file)
}
</script>

<style scoped>
.file-tree-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

.tree-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.header-icon {
  font-size: 1rem;
  color: var(--primary-color);
}

.header-title {
  flex: 1;
}

.file-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 400;
}

.tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.tree-container::-webkit-scrollbar {
  width: 4px;
}

.tree-container::-webkit-scrollbar-track {
  background: transparent;
}

.tree-container::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 2px;
}

.tree-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
</style>