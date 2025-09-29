<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="['icon', `icon-${name}`]"
  >
    <!-- Git Icons -->
    <template v-if="name === 'git-compare'">
      <circle cx="18" cy="18" r="3"></circle>
      <circle cx="6" cy="6" r="3"></circle>
      <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
      <path d="M11 18H8a2 2 0 0 1-2-2V9"></path>
    </template>

    <template v-else-if="name === 'git-branch'">
      <line x1="6" y1="3" x2="6" y2="15"></line>
      <circle cx="18" cy="6" r="3"></circle>
      <circle cx="6" cy="18" r="3"></circle>
      <path d="M18 9a9 9 0 0 1-9 9"></path>
    </template>

    <template v-else-if="name === 'git-commit'">
      <circle cx="12" cy="12" r="3"></circle>
      <line x1="12" y1="3" x2="12" y2="9"></line>
      <line x1="12" y1="15" x2="12" y2="21"></line>
    </template>

    <!-- File Icons -->
    <template v-else-if="name === 'file-diff'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="9" y1="15" x2="15" y2="15"></line>
    </template>

    <template v-else-if="name === 'file-code'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <polyline points="16 13 18 15 16 17"></polyline>
      <polyline points="8 13 6 15 8 17"></polyline>
    </template>

    <template v-else-if="name === 'file-x'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="9.5" y1="11.5" x2="14.5" y2="16.5"></line>
      <line x1="14.5" y1="11.5" x2="9.5" y2="16.5"></line>
    </template>

    <!-- Action Icons -->
    <template v-else-if="name === 'play-circle'">
      <circle cx="12" cy="12" r="10"></circle>
      <polygon points="10 8 16 12 10 16 10 8"></polygon>
    </template>

    <template v-else-if="name === 'x-circle'">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </template>

    <template v-else-if="name === 'chevron-down'">
      <polyline points="6 9 12 15 18 9"></polyline>
    </template>

    <template v-else-if="name === 'chevron-right'">
      <polyline points="9 18 15 12 9 6"></polyline>
    </template>

    <!-- Status Icons -->
    <template v-else-if="name === 'spinner' || name === 'loader'">
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </template>

    <template v-else-if="name === 'alert-triangle'">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </template>

    <!-- Quality Icons -->
    <template v-else-if="name === 'shield-alert'">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </template>

    <template v-else-if="name === 'bug'">
      <rect x="8" y="6" width="8" height="14" rx="4"></rect>
      <path d="M6 10h.01"></path>
      <path d="M18 10h.01"></path>
      <path d="M4 8l2 2"></path>
      <path d="M20 8l-2 2"></path>
      <path d="M4 16l2-2"></path>
      <path d="M20 16l-2-2"></path>
      <line x1="12" y1="2" x2="12" y2="6"></line>
    </template>

    <template v-else-if="name === 'activity'">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </template>

    <template v-else-if="name === 'star'">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </template>

    <template v-else-if="name === 'layers'">
      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      <polyline points="2 17 12 22 22 17"></polyline>
      <polyline points="2 12 12 17 22 12"></polyline>
    </template>

    <!-- Communication Icons -->
    <template v-else-if="name === 'message-square'">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </template>

    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </template>

    <template v-else-if="name === 'zap'">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </template>

    <!-- View Icons -->
    <template v-else-if="name === 'align-left'">
      <line x1="17" y1="10" x2="3" y2="10"></line>
      <line x1="21" y1="6" x2="3" y2="6"></line>
      <line x1="21" y1="14" x2="3" y2="14"></line>
      <line x1="17" y1="18" x2="3" y2="18"></line>
    </template>

    <template v-else-if="name === 'columns'">
      <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path>
    </template>

    <template v-else-if="name === 'code'">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </template>

    <template v-else-if="name === 'code-review'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="8" y1="13" x2="16" y2="13"></line>
      <line x1="8" y1="17" x2="12" y2="17"></line>
    </template>

    <!-- Action Icons -->
    <template v-else-if="name === 'copy'">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </template>

    <template v-else-if="name === 'check'">
      <polyline points="20 6 9 17 4 12"></polyline>
    </template>

    <template v-else-if="name === 'check-circle'">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </template>

    <template v-else-if="name === 'x'">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </template>

    <template v-else-if="name === 'hash'">
      <line x1="4" y1="9" x2="20" y2="9"></line>
      <line x1="4" y1="15" x2="20" y2="15"></line>
      <line x1="10" y1="3" x2="8" y2="21"></line>
      <line x1="16" y1="3" x2="14" y2="21"></line>
    </template>

    <template v-else-if="name === 'arrow-right'">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </template>

    <template v-else-if="name === 'plus'">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </template>

    <template v-else-if="name === 'minus'">
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </template>

    <template v-else-if="name === 'thumbs-up'">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
    </template>

    <template v-else-if="name === 'lightbulb'">
      <path d="M9 18h6"></path>
      <path d="M10 22h4"></path>
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.05 1.5 3.5.76.76 1.23 1.52 1.41 2.5"></path>
      <line x1="12" y1="18" x2="12" y2="22"></line>
    </template>

    <template v-else-if="name === 'tool'">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </template>

    <!-- Default/Fallback -->
    <template v-else>
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </template>
  </svg>
</template>

<script setup lang="ts">
interface Props {
  name: string
  size?: number | string
}

withDefaults(defineProps<Props>(), {
  size: 20
})
</script>

<style scoped>
.icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}
</style>