# Plan UI Implementation Design

## Overview

This document provides a comprehensive implementation design for integrating a Plan UI tab into the SuperCode VSCode webview. The design follows existing patterns from the prompt generation tab and adds two distinct implementation modes: file-by-file and phase-wise planning.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph VSCode Extension
        WV[WebView Manager]
        SC[SuperCode Instance]
        ADO[ADO Settings Service]
    end

    subgraph Vue Application
        App[App Component]
        PT[Plan Tab Component]
        PG[Prompt Generation Tab]

        subgraph Plan Tab Components
            PM[Plan Mode Selector]
            CI[Context Input]
            OS[Output Style Selector]
            PD[Plan Display]
            AG[ADO Generator]
        end

        subgraph Services
            PGS[Plan Generation Service]
            AIS[ADO Integration Service]
            WSC[WebSocket Client]
        end
    end

    subgraph Commands
        PF[/plan-filewise]
        PP[/plan-phases]
    end

    App --> PT
    App --> PG
    PT --> PM
    PT --> CI
    PT --> OS
    PT --> PD
    PT --> AG

    PT --> PGS
    PT --> AIS
    PGS --> WSC

    WV <--> App
    SC <--> WSC
    ADO --> AIS

    PF --> PGS
    PP --> PGS
```

## Component Structure

### 1. Main Plan Tab Component

**File**: `src/components/tabs/PlanTab.vue`

```vue
<template>
  <div class="plan-tab">
    <!-- Header with Mode Selector -->
    <div class="workflow-header">
      <h2 class="workflow-title">
        Plan Generation
        <span class="alpha-badge">ALPHA</span>
      </h2>
      <div class="nav-pills">
        <button
          class="nav-pill"
          :class="{ active: mode === 'filewise' }"
          @click="mode = 'filewise'"
        >
          File-by-File
        </button>
        <button
          class="nav-pill"
          :class="{ active: mode === 'phases' }"
          @click="mode = 'phases'"
        >
          Phase-Wise
        </button>
      </div>
    </div>

    <!-- Context Sources Section -->
    <div class="context-sources">
      <h3>Context Sources</h3>
      <div class="source-buttons">
        <button @click="addADOContext">
          <icon name="azure-devops" />
          ADO Items
        </button>
        <button @click="addFileContext">
          <icon name="file" />
          Files
        </button>
        <button @click="addFolderContext">
          <icon name="folder" />
          Folders
        </button>
      </div>
      <div class="active-contexts">
        <div v-for="source in contextSources" :key="source.id" class="context-chip">
          {{ source.label }}
          <button @click="removeContext(source.id)">×</button>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="input-section">
      <textarea
        v-model="planRequest"
        placeholder="Describe what you want to plan..."
        @input="handleInput"
        class="plan-input"
      />
      <div class="input-footer">
        <span class="char-count">{{ charCount }}/10000</span>
        <OutputStyleSelector
          v-model="outputStyle"
          :styles="availableStyles"
        />
        <button
          class="generate-btn"
          :disabled="!canGenerate"
          @click="generatePlan"
        >
          Generate Plan
        </button>
      </div>
    </div>

    <!-- Generated Plan Display -->
    <div v-if="generatedPlan" class="plan-display">
      <div class="plan-header">
        <h3>{{ planTitle }}</h3>
        <div class="plan-actions">
          <button @click="copyPlan">Copy</button>
          <button @click="exportToADO">Export to ADO</button>
          <button @click="implementPlan">Implement</button>
        </div>
      </div>

      <!-- File-wise Display -->
      <div v-if="mode === 'filewise'" class="filewise-plan">
        <FileImplementationList :files="generatedPlan.files" />
      </div>

      <!-- Phase-wise Display -->
      <div v-else class="phasewise-plan">
        <PhaseProgressTracker :phases="generatedPlan.phases" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';
import { PlanGenerationService } from '@/services/PlanGenerationService';
import { ADOIntegrationService } from '@/services/ADOIntegrationService';
import OutputStyleSelector from '@/components/OutputStyleSelector.vue';
import FileImplementationList from '@/components/FileImplementationList.vue';
import PhaseProgressTracker from '@/components/PhaseProgressTracker.vue';

export default defineComponent({
  name: 'PlanTab',
  components: {
    OutputStyleSelector,
    FileImplementationList,
    PhaseProgressTracker
  },
  setup() {
    const mode = ref<'filewise' | 'phases'>('filewise');
    const planRequest = ref('');
    const contextSources = ref<ContextSource[]>([]);
    const outputStyle = ref('standard');
    const generatedPlan = ref<Plan | null>(null);

    const planService = new PlanGenerationService();
    const adoService = new ADOIntegrationService();

    const availableStyles = computed(() => {
      return mode.value === 'filewise'
        ? ['standard', 'detailed', 'checklist']
        : ['progressive', 'systematic', 'adaptive'];
    });

    const canGenerate = computed(() => {
      return planRequest.value.length > 10;
    });

    async function generatePlan() {
      const config = {
        mode: mode.value,
        outputStyle: outputStyle.value,
        contextSources: contextSources.value,
        request: planRequest.value
      };

      generatedPlan.value = await planService.generatePlan(config);
    }

    async function exportToADO() {
      if (!generatedPlan.value) return;

      if (mode.value === 'phases') {
        // Create epic with phases as stories
        await adoService.createEpicFromPhases(generatedPlan.value);
      } else {
        // Create tasks for each file
        await adoService.createTasksFromFiles(generatedPlan.value);
      }
    }

    return {
      mode,
      planRequest,
      contextSources,
      outputStyle,
      generatedPlan,
      availableStyles,
      canGenerate,
      generatePlan,
      exportToADO
    };
  }
});
</script>
```

### 2. Plan Generation Service

**File**: `src/services/PlanGenerationService.ts`

```typescript
export class PlanGenerationService {
  private wsClient: WebSocketClient;

  constructor() {
    this.wsClient = new WebSocketClient();
  }

  async generatePlan(config: PlanConfig): Promise<Plan> {
    const command = config.mode === 'filewise'
      ? '/plan-filewise'
      : '/plan-phases';

    const context = this.buildContext(config.contextSources);
    const outputStyle = this.getOutputStylePath(config);

    const message = {
      command,
      arguments: config.request,
      context,
      outputStyle
    };

    return await this.wsClient.sendAndWait(message);
  }

  private buildContext(sources: ContextSource[]): string {
    return sources
      .map(s => {
        switch (s.type) {
          case 'ado': return `@ado:${s.id}`;
          case 'file': return `@${s.path}`;
          case 'folder': return `@${s.path}/`;
          default: return '';
        }
      })
      .filter(Boolean)
      .join(' ');
  }

  private getOutputStylePath(config: PlanConfig): string {
    const base = config.mode === 'filewise'
      ? 'plan-filewise'
      : 'plan-phasewise';

    return `.opencode/output-styles/${base}.md`;
  }
}
```

### 3. ADO Integration Service

**File**: `src/services/ADOIntegrationService.ts`

```typescript
export class ADOIntegrationService {
  private settings: ADOSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  async createEpicFromPhases(plan: PhasePlan): Promise<ADOEpic> {
    const epic = await this.createWorkItem({
      type: 'Epic',
      title: plan.title,
      description: plan.overview,
      areaPath: this.settings.defaultAreaPath,
      iterationPath: this.settings.defaultIterationPath
    });

    for (const phase of plan.phases) {
      const story = await this.createWorkItem({
        type: 'User Story',
        title: `Phase ${phase.number}: ${phase.title}`,
        description: this.formatPhaseDescription(phase),
        parent: epic.id,
        estimatedEffort: phase.estimatedHours
      });

      for (const task of phase.tasks) {
        await this.createWorkItem({
          type: 'Task',
          title: task.title,
          description: task.description,
          parent: story.id,
          remainingWork: task.hours
        });
      }
    }

    return epic;
  }

  async createTasksFromFiles(plan: FilePlan): Promise<ADOTask[]> {
    const tasks: ADOTask[] = [];

    for (const file of plan.files) {
      const task = await this.createWorkItem({
        type: 'Task',
        title: `Implement ${file.path}`,
        description: this.formatFileDescription(file),
        tags: ['implementation', plan.feature],
        estimatedHours: file.estimatedHours
      });

      tasks.push(task);
    }

    return tasks;
  }

  private async createWorkItem(config: WorkItemConfig): Promise<any> {
    const url = `${this.settings.organizationUrl}/${this.settings.project}/_apis/wit/workitems/$${config.type}?api-version=7.0`;

    const operations = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: config.title
      },
      {
        op: 'add',
        path: '/fields/System.Description',
        value: config.description
      }
    ];

    if (config.parent) {
      operations.push({
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${this.settings.organizationUrl}/_apis/wit/workitems/${config.parent}`
        }
      });
    }

    return await this.makeRequest(url, operations);
  }
}
```

## Integration Points

### 1. WebView Message Handling

Update `SuperCodeInstanceStatic.ts` to handle plan-related messages:

```typescript
private async handleWebviewMessage(message: any): Promise<void> {
  switch (message.command) {
    case 'generatePlan':
      await this.generatePlan(message.config);
      break;

    case 'exportPlanToADO':
      await this.exportPlanToADO(message.plan);
      break;

    case 'implementPlan':
      await this.implementPlan(message.plan);
      break;

    // ... existing cases
  }
}

private async generatePlan(config: PlanConfig): Promise<void> {
  const command = config.mode === 'filewise'
    ? 'plan-filewise'
    : 'plan-phases';

  const response = await this.sendToSuperCode({
    command,
    arguments: config.request,
    context: config.context,
    outputStyle: config.outputStyle
  });

  this.panel?.webview.postMessage({
    command: 'planGenerated',
    plan: response.plan
  });
}
```

### 2. Command Registration

Register the new commands in the extension:

```typescript
// In extension.ts
context.subscriptions.push(
  vscode.commands.registerCommand('supercode.planFilewise', async () => {
    const instance = await SuperCodeInstanceStatic.getInstance(context);
    instance.showPlanTab('filewise');
  }),

  vscode.commands.registerCommand('supercode.planPhases', async () => {
    const instance = await SuperCodeInstanceStatic.getInstance(context);
    instance.showPlanTab('phases');
  })
);
```

## CSS Styling

Add styles to `webview.css`:

```css
/* Plan Tab Styles */
.plan-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.nav-pills {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.375rem;
}

.nav-pill {
  padding: 0.25rem 0.625rem;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-pill.active {
  color: #fff;
  background: var(--accent-color);
}

.context-sources {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 0.5rem;
}

.source-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.context-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
  font-size: 0.8125rem;
}

.plan-input {
  width: 100%;
  min-height: 120px;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  color: var(--text-primary);
  resize: vertical;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}

.generate-btn {
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plan-display {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 0.5rem;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.plan-actions {
  display: flex;
  gap: 0.5rem;
}

/* File-wise Plan Styles */
.filewise-plan {
  margin-top: 1rem;
}

.file-item {
  padding: 1rem;
  margin-bottom: 0.5rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 0.375rem;
  border-left: 3px solid var(--accent-color);
}

/* Phase-wise Plan Styles */
.phasewise-plan {
  margin-top: 1rem;
}

.phase-card {
  padding: 1rem;
  margin-bottom: 1rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 0.5rem;
}

.phase-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.3s ease;
}

/* Animation for alpha badge */
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(255, 107, 53, 0.5);
  }
  50% {
    box-shadow: 0 0 15px rgba(255, 107, 53, 0.8);
  }
}

.alpha-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  height: 16px;
  margin-left: 6px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  background: linear-gradient(135deg, #ff6b35, #ff8c42);
  color: #fff;
  border-radius: 3px;
  animation: pulse-glow 2s infinite;
}
```

## Output Style Integration

The Plan UI integrates with two output styles:

### 1. File-wise Output Style
- **Path**: `.opencode/output-styles/plan-filewise.md`
- **Features**:
  - Detailed file-by-file specifications
  - Dependency ordering
  - Complete implementation details
  - Testing requirements

### 2. Phase-wise Output Style
- **Path**: `.opencode/output-styles/plan-phasewise.md`
- **Features**:
  - XML-structured phases for parsing
  - Progress tracking capabilities
  - Independent deployability
  - Risk assessment and mitigation

## Custom Commands

### 1. `/plan-filewise`
- **Path**: `.opencode/commands/plan-filewise.md`
- **Usage**: Generates detailed file-by-file implementation plans
- **Context Support**: Files, folders, ADO tickets, URLs

### 2. `/plan-phases`
- **Path**: `.opencode/commands/plan-phases.md`
- **Usage**: Generates phase-wise implementation plans
- **Context Support**: Files, folders, ADO tickets, URLs

## Testing Strategy

### Unit Tests

```typescript
// tests/components/PlanTab.spec.ts
import { mount } from '@vue/test-utils';
import PlanTab from '@/components/tabs/PlanTab.vue';

describe('PlanTab', () => {
  it('switches between filewise and phases modes', async () => {
    const wrapper = mount(PlanTab);

    expect(wrapper.vm.mode).toBe('filewise');

    await wrapper.find('.nav-pill:nth-child(2)').trigger('click');
    expect(wrapper.vm.mode).toBe('phases');
  });

  it('generates plan with correct configuration', async () => {
    const wrapper = mount(PlanTab);
    const planService = wrapper.vm.planService;

    jest.spyOn(planService, 'generatePlan');

    await wrapper.find('.plan-input').setValue('Create user authentication');
    await wrapper.find('.generate-btn').trigger('click');

    expect(planService.generatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'filewise',
        request: 'Create user authentication'
      })
    );
  });
});
```

### Integration Tests

```typescript
// tests/integration/PlanGeneration.spec.ts
describe('Plan Generation Integration', () => {
  it('generates and displays filewise plan', async () => {
    const { getByRole, getByText } = render(App);

    // Navigate to Plan tab
    await userEvent.click(getByRole('tab', { name: 'Plan' }));

    // Enter request
    const input = getByRole('textbox');
    await userEvent.type(input, 'Implement shopping cart');

    // Generate plan
    await userEvent.click(getByRole('button', { name: 'Generate Plan' }));

    // Verify plan display
    await waitFor(() => {
      expect(getByText(/File Implementation Plan/)).toBeInTheDocument();
    });
  });
});
```

## Performance Considerations

1. **Lazy Loading**: Components loaded on-demand
2. **Virtual Scrolling**: For long file/phase lists
3. **Debounced Input**: 300ms debounce on text input
4. **Cached Context**: Reuse context sources across sessions
5. **Progressive Rendering**: Stream plan generation results

## Accessibility

1. **ARIA Labels**: All interactive elements properly labeled
2. **Keyboard Navigation**: Tab navigation and shortcuts
3. **Screen Reader Support**: Semantic HTML and ARIA attributes
4. **Focus Management**: Proper focus states and indicators
5. **Reduced Motion**: Respect prefers-reduced-motion

## Deployment Steps

1. **Build Vue Components**
   ```bash
   npm run build:webview
   ```

2. **Update Extension Manifest**
   ```json
   {
     "contributes": {
       "commands": [
         {
           "command": "supercode.planFilewise",
           "title": "Generate File-wise Plan"
         },
         {
           "command": "supercode.planPhases",
           "title": "Generate Phase-wise Plan"
         }
       ]
     }
   }
   ```

3. **Package Extension**
   ```bash
   vsce package
   ```

## Migration Path

For existing users:

1. **Backward Compatibility**: Existing prompt generation remains unchanged
2. **Feature Flag**: Plan tab hidden behind alpha flag initially
3. **Gradual Rollout**: Enable for power users first
4. **Feedback Collection**: In-app feedback mechanism
5. **Documentation**: Comprehensive user guide and examples

## Next Steps

1. **Vue Source Integration**: Integrate components into Vue source
2. **WebSocket Implementation**: Connect to SuperCode backend
3. **ADO Testing**: Test with real Azure DevOps instances
4. **User Testing**: Alpha testing with selected users
5. **Performance Optimization**: Profile and optimize rendering
6. **Documentation**: Create user guides and tutorials

This design provides a complete blueprint for implementing the Plan UI with both file-by-file and phase-wise planning capabilities, following existing patterns while adding powerful new functionality.