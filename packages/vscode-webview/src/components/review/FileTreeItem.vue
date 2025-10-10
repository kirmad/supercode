<template>
  <div class="tree-item">
    <div
      :class="[
        'tree-node',
        {
          'is-directory': !item.isFile,
          'is-file': item.isFile,
          'is-selected': item.isFile && isSelected,
          'is-expanded': isExpanded
        }
      ]"
      @click.stop="handleClick"
      :style="{ paddingLeft: `${depth * 0.75 + 0.5}rem` }"
    >
      <!-- Directory icon and expand/collapse -->
      <div v-if="!item.isFile" class="node-icon">
        <ChevronDown v-if="isExpanded" :size="12" class="expand-icon" />
        <ChevronRight v-else :size="12" class="expand-icon" />
        <FolderOpen v-if="isExpanded" :size="16" class="folder-icon" />
        <Folder v-else :size="16" class="folder-icon" />
      </div>

      <!-- File icon -->
      <div v-else class="node-icon">
        <component :is="getFileIcon(item.name)" :size="16" class="file-icon" />
      </div>

      <!-- Node name -->
      <span class="node-name">{{ item.name }}</span>

      <!-- File change indicators -->
      <div v-if="item.isFile && item.file" class="file-indicators">
        <span v-if="hasAdditions" class="change-indicator additions">+{{ additionCount }}</span>
        <span v-if="hasDeletions" class="change-indicator deletions">-{{ deletionCount }}</span>
      </div>
    </div>

    <!-- Children (recursive) -->
    <div v-if="!item.isFile && isExpanded" class="tree-children">
      <FileTreeItem
        v-for="child in item.children"
        :key="child.path || child.name"
        :item="child"
        :depth="depth + 1"
        :selected-file="selectedFile"
        @file-select="$emit('file-select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { DiffFile } from '../../services/ProjectWorkflowService'
import { ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Code, Image, Archive, Settings, Lock, Globe, Palette, File } from 'lucide-vue-next'

interface TreeNode {
  name: string
  path?: string
  isFile: boolean
  children: TreeNode[]
  file?: DiffFile
}

interface Props {
  item: TreeNode
  depth?: number
  selectedFile?: string
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0
})

const emit = defineEmits<{
  'file-select': [file: DiffFile]
}>()

const isExpanded = ref(props.depth < 2) // Auto-expand first 2 levels

const isSelected = computed(() => {
  if (!props.item.isFile || !props.selectedFile) return false
  return (props.item.file?.path || props.item.file?.fileName) === props.selectedFile
})

// Calculate file change stats
const additionCount = computed(() => {
  if (!props.item.file?.patches) return 0
  return props.item.file.patches.reduce((sum, patch) => {
    return sum + (patch.lines?.filter((line: any) => line.type === 'addition').length || 0)
  }, 0)
})

const deletionCount = computed(() => {
  if (!props.item.file?.patches) return 0
  return props.item.file.patches.reduce((sum, patch) => {
    return sum + (patch.lines?.filter((line: any) => line.type === 'deletion').length || 0)
  }, 0)
})

const hasAdditions = computed(() => additionCount.value > 0)
const hasDeletions = computed(() => deletionCount.value > 0)

function handleClick() {
  if (props.item.isFile && props.item.file) {
    emit('file-select', props.item.file)
  } else {
    isExpanded.value = !isExpanded.value
  }
}

function getFileIcon(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase()

  const iconMap: Record<string, any> = {
    // Code files
    'vue': Code,
    'js': Code,
    'ts': Code,
    'jsx': Code,
    'tsx': Code,
    'py': Code,
    'java': Code,
    'cpp': Code,
    'c': Code,
    'go': Code,
    'rs': Code,
    'php': Code,
    'rb': Code,

    // Web files
    'html': Globe,
    'css': Palette,
    'scss': Palette,
    'sass': Palette,
    'less': Palette,

    // Config files
    'json': Settings,
    'yml': Settings,
    'yaml': Settings,
    'toml': Settings,
    'ini': Settings,
    'conf': Settings,
    'config': Settings,

    // Documentation
    'md': FileText,
    'txt': FileText,
    'rst': FileText,
    'doc': FileText,
    'docx': FileText,
    'pdf': FileText,

    // Images
    'png': Image,
    'jpg': Image,
    'jpeg': Image,
    'gif': Image,
    'svg': Image,
    'webp': Image,

    // Archives
    'zip': Archive,
    'tar': Archive,
    'gz': Archive,
    'rar': Archive,

    // Lock files
    'lock': Lock
  }

  return iconMap[extension || ''] || File
}
</script>

<style scoped>
.tree-item {
  user-select: none;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 1.75rem;
}

.tree-node:hover {
  background: var(--glass-bg-hover);
}

.tree-node.is-selected {
  background: var(--primary-alpha-10);
  color: var(--primary-color);
  font-weight: 500;
}

.tree-node.is-selected:hover {
  background: var(--primary-alpha-15);
}

.node-icon {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.expand-icon {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.folder-icon {
  font-size: 0.875rem;
  color: var(--warning-color);
}

.file-icon {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-left: 1rem; /* Align with expanded folder content */
}

.node-name {
  flex: 1;
  font-size: 0.75rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-indicators {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.change-indicator {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  line-height: 1;
}

.change-indicator.additions {
  background: var(--success-alpha-10);
  color: var(--success-color);
}

.change-indicator.deletions {
  background: var(--error-alpha-10);
  color: var(--error-color);
}

.tree-children {
  margin-left: 0;
}

/* Hover effects for better UX */
.tree-node.is-directory:hover .expand-icon {
  color: var(--text-secondary);
}

.tree-node.is-directory:hover .folder-icon {
  color: var(--warning-color-dark);
}

.tree-node.is-file:hover .file-icon {
  color: var(--text-primary);
}
</style>