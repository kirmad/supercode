/**
 * Service for discovering and managing prompt enhancement commands
 */

export interface EnhancementCommand {
  id: string;                    // e.g., 'technical-spec'
  name: string;                   // e.g., 'Technical Specification'
  command: string;                // e.g., '/enhance-prompt:technical-spec'
  description: string;            // Brief description from the cmd file
  icon?: string;                  // Optional icon/emoji for the command
  category?: string;              // Optional category for grouping
  isDefault?: boolean;            // Whether this is the default command
  filePath?: string;              // Path to the command file
}

export class CommandDiscoveryService {
  private static instance: CommandDiscoveryService;
  private commands: Map<string, EnhancementCommand> = new Map();
  private discoveryPromise: Promise<void> | null = null;
  private wsClient: any;
  private port: number = 5173; // Default port

  private constructor(wsClient?: any) {
    this.wsClient = wsClient;
    // Try to get the port from the current window location if in browser
    if (typeof window !== 'undefined' && window.location) {
      const urlPort = window.location.port;
      if (urlPort) {
        this.port = parseInt(urlPort, 10);
      }
    }
  }

  public static getInstance(wsClient?: any): CommandDiscoveryService {
    if (!CommandDiscoveryService.instance) {
      CommandDiscoveryService.instance = new CommandDiscoveryService(wsClient);
    }
    return CommandDiscoveryService.instance;
  }

  /**
   * Discover all available enhancement commands
   */
  public async discoverCommands(): Promise<EnhancementCommand[]> {
    // If already discovering, wait for it
    if (this.discoveryPromise) {
      await this.discoveryPromise;
      return this.getCommands();
    }

    this.discoveryPromise = this._performDiscovery();
    await this.discoveryPromise;
    this.discoveryPromise = null;

    return this.getCommands();
  }

  private async _performDiscovery(): Promise<void> {
    this.commands.clear();

    // Always add the default command
    this.addDefaultCommand();

    try {
      // Try to discover commands from the server
      await this.discoverFromServer();
    } catch (error) {
      console.warn('[CommandDiscoveryService] Server discovery failed, using defaults:', error);
      // Add some built-in commands as fallback
      this.addBuiltInCommands();
    }
  }

  private addDefaultCommand(): void {
    const defaultCommand: EnhancementCommand = {
      id: 'default',
      name: 'Standard Enhancement',
      command: '/enhance-prompt',
      description: 'Comprehensive prompt enhancement with research and best practices',
      icon: '✨',
      category: 'General',
      isDefault: true
    };
    this.commands.set('default', defaultCommand);
  }

  private addBuiltInCommands(): void {
    const builtInCommands: EnhancementCommand[] = [
      {
        id: 'technical-spec',
        name: 'Technical Specification',
        command: '/enhance-prompt:technical-spec',
        description: 'Transform into detailed technical specifications with architecture and design',
        icon: '📋',
        category: 'Technical'
      },
      {
        id: 'user-story',
        name: 'User Story',
        command: '/enhance-prompt:user-story',
        description: 'Convert into agile user stories with acceptance criteria',
        icon: '👤',
        category: 'Agile'
      },
      {
        id: 'startup-pitch',
        name: 'Startup Pitch',
        command: '/enhance-prompt:startup-pitch',
        description: 'Transform into a compelling startup pitch deck',
        icon: '🚀',
        category: 'Business'
      },
      {
        id: 'api-design',
        name: 'API Design',
        command: '/enhance-prompt:api-design',
        description: 'Design RESTful APIs with OpenAPI specifications',
        icon: '🔌',
        category: 'Technical'
      },
      {
        id: 'test-plan',
        name: 'Test Plan',
        command: '/enhance-prompt:test-plan',
        description: 'Create comprehensive test plans and scenarios',
        icon: '🧪',
        category: 'Quality'
      },
      {
        id: 'security-review',
        name: 'Security Review',
        command: '/enhance-prompt:security-review',
        description: 'Analyze security implications and threat modeling',
        icon: '🛡️',
        category: 'Security'
      }
    ];

    for (const cmd of builtInCommands) {
      this.commands.set(cmd.id, cmd);
    }
  }

  private async discoverFromServer(): Promise<void> {
    try {
      const response = await fetch(`http://localhost:${this.port}/api/commands/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          namespace: 'enhance-prompt',
          directory: '.opencode/commands/enhance-prompt'
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();

      if (data.commands && Array.isArray(data.commands)) {
        for (const cmd of data.commands) {
          const command = this.parseCommandData(cmd);
          if (command) {
            this.commands.set(command.id, command);
          }
        }
      }
    } catch (error) {
      console.error('[CommandDiscoveryService] Server discovery error:', error);
      throw error;
    }
  }

  private parseCommandData(data: any): EnhancementCommand | null {
    try {
      // Parse command file data
      const id = data.id || data.filename?.replace('.md', '');
      const content = data.content || '';

      // Split content into lines
      const lines = content.split('\n');

      // Skip YAML frontmatter if present
      let startIdx = 0;
      if (lines[0]?.trim() === '---') {
        // Find the closing --- of the frontmatter
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === '---') {
            startIdx = i + 1;
            break;
          }
        }
      }

      // Look for the command line after the frontmatter
      let commandLine = '';
      let descriptionLine = '';

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();

        // Find the command line (starts with /enhance-prompt)
        if (line.startsWith('/enhance-prompt') && !commandLine) {
          commandLine = line;
        }

        // Find the description line (first # comment after command)
        if (line.startsWith('#') && commandLine && !descriptionLine) {
          descriptionLine = line;
        }

        // Stop if we have both
        if (commandLine && descriptionLine) {
          break;
        }
      }

      if (!commandLine) {
        console.warn(`[CommandDiscoveryService] No command found in file ${id}`);
        return null;
      }

      // Extract description
      const description = descriptionLine?.replace('#', '').trim() || 'Custom enhancement command';

      // Derive a friendly name from the ID
      const name = this.idToName(id);

      // Try to determine an appropriate icon
      const icon = this.getIconForCommand(id, description);

      // Determine category
      const category = this.getCategoryForCommand(id, description);

      return {
        id,
        name,
        command: commandLine,
        description,
        icon,
        category,
        filePath: data.path
      };
    } catch (error) {
      console.error('[CommandDiscoveryService] Error parsing command:', error);
      return null;
    }
  }

  private idToName(id: string): string {
    // Convert kebab-case to Title Case
    return id
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getIconForCommand(id: string, description: string): string {
    const desc = description.toLowerCase();
    const idLower = id.toLowerCase();

    // Icon mapping based on keywords
    if (desc.includes('technical') || idLower.includes('tech')) return '📋';
    if (desc.includes('user') || desc.includes('story')) return '👤';
    if (desc.includes('startup') || desc.includes('pitch')) return '🚀';
    if (desc.includes('api') || desc.includes('rest')) return '🔌';
    if (desc.includes('test') || desc.includes('qa')) return '🧪';
    if (desc.includes('security') || desc.includes('threat')) return '🛡️';
    if (desc.includes('design') || desc.includes('ui')) return '🎨';
    if (desc.includes('data') || desc.includes('database')) return '💾';
    if (desc.includes('performance') || desc.includes('optimize')) return '⚡';
    if (desc.includes('document') || desc.includes('docs')) return '📄';
    if (desc.includes('mobile') || desc.includes('app')) return '📱';
    if (desc.includes('cloud') || desc.includes('deploy')) return '☁️';
    if (desc.includes('ai') || desc.includes('ml')) return '🤖';
    if (desc.includes('workflow') || desc.includes('process')) return '⚙️';

    return '💡'; // Default icon
  }

  private getCategoryForCommand(id: string, description: string): string {
    const desc = description.toLowerCase();
    const idLower = id.toLowerCase();

    if (desc.includes('technical') || desc.includes('architecture') || idLower.includes('tech')) return 'Technical';
    if (desc.includes('user') || desc.includes('story') || desc.includes('agile')) return 'Agile';
    if (desc.includes('startup') || desc.includes('business') || desc.includes('pitch')) return 'Business';
    if (desc.includes('test') || desc.includes('qa') || desc.includes('quality')) return 'Quality';
    if (desc.includes('security') || desc.includes('threat')) return 'Security';
    if (desc.includes('design') || desc.includes('ui') || desc.includes('ux')) return 'Design';
    if (desc.includes('api') || desc.includes('backend')) return 'Backend';
    if (desc.includes('performance') || desc.includes('optimize')) return 'Performance';

    return 'General';
  }

  /**
   * Get all discovered commands
   */
  public getCommands(): EnhancementCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands grouped by category
   */
  public getCommandsByCategory(): Map<string, EnhancementCommand[]> {
    const grouped = new Map<string, EnhancementCommand[]>();

    for (const command of this.commands.values()) {
      const category = command.category || 'General';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(command);
    }

    // Sort commands within each category
    for (const [category, commands] of grouped) {
      commands.sort((a, b) => {
        // Default command comes first
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        // Then sort by name
        return a.name.localeCompare(b.name);
      });
    }

    return grouped;
  }

  /**
   * Get a specific command by ID
   */
  public getCommand(id: string): EnhancementCommand | undefined {
    return this.commands.get(id);
  }

  /**
   * Get the default command
   */
  public getDefaultCommand(): EnhancementCommand {
    return this.commands.get('default') || this.addDefaultCommand() as any;
  }

  /**
   * Refresh commands (re-discover)
   */
  public async refreshCommands(): Promise<EnhancementCommand[]> {
    this.discoveryPromise = null;
    return this.discoverCommands();
  }

  /**
   * Check if commands have been discovered
   */
  public hasDiscoveredCommands(): boolean {
    return this.commands.size > 1; // More than just the default
  }
}