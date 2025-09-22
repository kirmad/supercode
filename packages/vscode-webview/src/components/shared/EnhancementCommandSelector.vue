<template>
  <div class="enhancement-command-selector">
    <!-- Compact Selector Button -->
    <div
      class="selector-trigger"
      @click="toggleDropdown"
      :class="{ active: isOpen }"
    >
      <div class="trigger-content">
        <span class="trigger-icon">{{ selectedCommand.icon }}</span>
        <span class="trigger-label">{{ selectedCommand.name }}</span>
        <svg
          class="trigger-arrow"
          :class="{ rotated: isOpen }"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M6 9L12 15L18 9"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>

    <!-- Modal Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="isOpen"
          class="command-modal-overlay"
          @click="closeDropdown"
        >
          <div
            class="command-modal"
            @click.stop
            ref="dropdownRef"
          >
        <!-- Modal Header -->
        <div class="modal-header">
          <h3 class="modal-title">Choose Enhancement Style</h3>
          <button class="modal-close" @click="closeDropdown" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>

        <!-- Search Input -->
        <div class="search-container" v-if="commands.length > 6">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M21 21L16.65 16.65"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search commands..."
            @keydown.esc="closeDropdown"
          />
        </div>

        <!-- Category Groups -->
        <div class="command-list">
          <div
            v-for="[category, categoryCommands] in filteredCommandsByCategory"
            :key="category"
            class="command-category"
          >
            <div class="category-header">{{ category }}</div>
            <div
              v-for="command in categoryCommands"
              :key="command.id"
              class="command-item"
              :class="{
                selected: command.id === selectedCommand.id,
                default: command.isDefault
              }"
              @click="selectCommand(command)"
            >
              <span class="command-icon">{{ command.icon }}</span>
              <div class="command-info">
                <div class="command-name">
                  {{ command.name }}
                  <span v-if="command.isDefault" class="default-badge">Default</span>
                </div>
                <div class="command-description">{{ command.description }}</div>
              </div>
              <svg
                v-if="command.id === selectedCommand.id"
                class="check-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M20 6L9 17L4 12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <!-- Quick Actions Footer -->
        <div class="dropdown-footer">
          <button
            class="refresh-btn"
            @click="refreshCommands"
            :disabled="isRefreshing"
            title="Refresh commands"
          >
            <svg
              :class="{ rotating: isRefreshing }"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M1 4V10H7M23 20V14H17M20.49 9C19.79 5.91 16.99 3.5 13.5 3.5C9.36 3.5 6 6.86 6 11C6 11.49 6.03 11.97 6.07 12.45M3.51 15C4.21 18.09 7.01 20.5 10.5 20.5C14.64 20.5 18 17.14 18 13C18 12.51 17.97 12.03 17.93 11.55"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span v-if="!isRefreshing">Refresh</span>
            <span v-else>Loading...</span>
          </button>
          <div class="command-count">
            {{ commands.length }} commands available
          </div>
        </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { CommandDiscoveryService, type EnhancementCommand } from '../../services/CommandDiscoveryService';

// Props
const props = defineProps<{
  modelValue?: string; // Selected command ID
  wsClient?: any;
}>();

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string];
  'command-selected': [command: EnhancementCommand];
}>();

// State
const isOpen = ref(false);
const searchQuery = ref('');
const commands = ref<EnhancementCommand[]>([]);
const selectedCommandId = ref(props.modelValue || 'default');
const isRefreshing = ref(false);
const isMobile = ref(false);

// Refs
const dropdownRef = ref<HTMLElement | null>(null);

// Service
let commandService: CommandDiscoveryService;

// Computed
const selectedCommand = computed(() => {
  const cmd = commands.value.find(c => c.id === selectedCommandId.value);
  return cmd || {
    id: 'default',
    name: 'Standard Enhancement',
    icon: '✨',
    command: '/enhance-prompt',
    description: 'Comprehensive prompt enhancement'
  };
});

const filteredCommands = computed(() => {
  if (!searchQuery.value) return commands.value;

  const query = searchQuery.value.toLowerCase();
  return commands.value.filter(cmd =>
    cmd.name.toLowerCase().includes(query) ||
    cmd.description.toLowerCase().includes(query) ||
    cmd.category?.toLowerCase().includes(query)
  );
});

const filteredCommandsByCategory = computed(() => {
  const grouped = new Map<string, EnhancementCommand[]>();

  for (const command of filteredCommands.value) {
    const category = command.category || 'General';
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(command);
  }

  // Sort categories
  const sortedCategories = Array.from(grouped.entries()).sort((a, b) => {
    // General category comes first
    if (a[0] === 'General') return -1;
    if (b[0] === 'General') return 1;
    return a[0].localeCompare(b[0]);
  });

  return sortedCategories;
});

// Methods
function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchQuery.value = '';
    // Focus search input if visible
    setTimeout(() => {
      const searchInput = dropdownRef.value?.querySelector('.search-input') as HTMLInputElement;
      searchInput?.focus();
    }, 100);
  }
}

function closeDropdown() {
  isOpen.value = false;
  searchQuery.value = '';
}

function selectCommand(command: EnhancementCommand) {
  selectedCommandId.value = command.id;
  emit('update:modelValue', command.id);
  emit('command-selected', command);
  closeDropdown();
}

async function refreshCommands() {
  isRefreshing.value = true;
  try {
    commands.value = await commandService.refreshCommands();
  } catch (error) {
    console.error('Failed to refresh commands:', error);
  } finally {
    isRefreshing.value = false;
  }
}

async function loadCommands() {
  try {
    commands.value = await commandService.discoverCommands();
  } catch (error) {
    console.error('Failed to load commands:', error);
    // Use built-in commands as fallback
    commandService = CommandDiscoveryService.getInstance(props.wsClient);
    commands.value = commandService.getCommands();
  }
}

// Handle escape key
function handleEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    closeDropdown();
  }
}

// Check if mobile
function checkMobile() {
  isMobile.value = window.innerWidth < 768;
}

// Watch for prop changes
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    selectedCommandId.value = newValue;
  }
});

// Lifecycle
onMounted(async () => {
  commandService = CommandDiscoveryService.getInstance(props.wsClient);
  await loadCommands();

  // Event listeners
  document.addEventListener('keydown', handleEscapeKey);
  window.addEventListener('resize', checkMobile);
  checkMobile();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscapeKey);
  window.removeEventListener('resize', checkMobile);
});
</script>

<style scoped>
/* Import shared variables */
@import '../../styles/shared/variables.css';

.enhancement-command-selector {
  position: relative;
  z-index: 10;
  contain: layout style;
  isolation: isolate;
}

/* Trigger Button */
.selector-trigger {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.selector-trigger:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  transform: translateY(-1px);
}

.selector-trigger.active {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.2);
}

.trigger-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.trigger-icon {
  font-size: 1rem;
}

.trigger-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

.trigger-arrow {
  opacity: 0.5;
  transition: transform 0.2s ease;
}

.trigger-arrow.rotated {
  transform: rotate(180deg);
}

/* Modal Overlay */
.command-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

/* Modal Dialog */
.command-modal {
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  background: rgba(30, 30, 35, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  /* Mobile adjustments */
  @media (max-width: 640px) {
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 4rem);
  }
}

/* Modal Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.2);
}

/* Search Container */
.search-container {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
}

.search-icon {
  position: absolute;
  left: 1.75rem;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.5;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.75rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.8rem;
  outline: none;
  transition: all 0.2s ease;
}

.search-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.search-input:focus {
  border-color: var(--primary-color);
  background: rgba(0, 0, 0, 0.5);
}

/* Command List */
.command-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

/* Category */
.command-category {
  margin-bottom: 0.75rem;
}

.command-category:last-child {
  margin-bottom: 0;
}

.category-header {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.5rem;
  opacity: 0.7;
}

/* Command Item */
.command-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  margin-bottom: 0.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.command-item:hover {
  background: rgba(102, 126, 234, 0.15);
  border-color: rgba(102, 126, 234, 0.3);
  transform: translateX(2px);
}

.command-item.selected {
  background: rgba(102, 126, 234, 0.2);
  border-color: var(--primary-color);
}

.command-item.default {
  position: relative;
}

.command-icon {
  font-size: 1.25rem;
  width: 1.75rem;
  text-align: center;
  flex-shrink: 0;
}

.command-info {
  flex: 1;
  min-width: 0;
}

.command-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.command-description {
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.8;
  margin-top: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.default-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.375rem;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--primary-color);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.check-icon {
  color: var(--success-color);
  flex-shrink: 0;
}

/* Footer */
.dropdown-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
  border-color: var(--primary-color);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-btn svg {
  transition: transform 0.3s ease;
}

.refresh-btn svg.rotating {
  animation: rotate 1s linear infinite;
}

.command-count {
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.7;
}


/* Animations */
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .command-modal,
.modal-leave-to .command-modal {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}

/* Scrollbar styling */
.command-list::-webkit-scrollbar {
  width: 6px;
}

.command-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.command-list::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: 3px;
}

.command-list::-webkit-scrollbar-thumb:hover {
  background: var(--primary-color);
}

</style>