import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ADOSettings {
  organization: string;
  project: string;
  pat: string;
  repository?: string;
  defaultPullRequestBuildId?: string;
  workItemDefaults?: {
    areaPath?: string;
    iterationPath?: string;
    assignedTo?: string;
  };
  pullRequestDefaults?: {
    targetBranch?: string;
    autoComplete?: boolean;
    deleteSourceBranch?: boolean;
  };
}

interface WorkspaceADOConfig {
  organization?: string;
  project?: string;
  repository?: string;
  defaultPullRequestBuildId?: string;
  workItemDefaults?: {
    areaPath?: string;
    iterationPath?: string;
    assignedTo?: string;
  };
  pullRequestDefaults?: {
    targetBranch?: string;
    autoComplete?: boolean;
    deleteSourceBranch?: boolean;
  };
}

/**
 * Service to manage Azure DevOps settings from VS Code configuration
 */
export class ADOSettingsService {
  private static instance: ADOSettingsService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ADOSettingsService {
    if (!ADOSettingsService.instance) {
      ADOSettingsService.instance = new ADOSettingsService();
    }
    return ADOSettingsService.instance;
  }

  /**
   * Read workspace-specific ADO configuration file
   */
  private readWorkspaceConfig(): WorkspaceADOConfig | null {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
      }

      // Look for .supercode/ado-config.json in the workspace root
      const configPath = path.join(
        workspaceFolders[0].uri.fsPath,
        '.supercode',
        'ado-config.json'
      );

      if (!fs.existsSync(configPath)) {
        return null;
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent) as WorkspaceADOConfig;

      console.log('[ADOSettingsService] Loaded workspace config from', configPath);
      return config;
    } catch (error) {
      console.error('[ADOSettingsService] Failed to read workspace config:', error);
      return null;
    }
  }

  /**
   * Get ADO settings merged from workspace config and VS Code configuration
   * Priority: VS Code settings (user/workspace) > workspace config file
   * PAT is only read from VS Code settings for security
   */
  public getSettings(): ADOSettings {
    const config = vscode.workspace.getConfiguration('supercode');
    const workspaceConfig = this.readWorkspaceConfig();

    // Start with VS Code settings
    const vscodeSettings = {
      organization: config.get<string>('azureDevOps.organization', ''),
      project: config.get<string>('azureDevOps.project', ''),
      pat: config.get<string>('azureDevOps.pat', '')
    };

    // If workspace config exists, use it as defaults (VS Code settings override)
    if (workspaceConfig) {
      return {
        // Non-sensitive settings can come from workspace config or VS Code settings
        organization: vscodeSettings.organization || workspaceConfig.organization || '',
        project: vscodeSettings.project || workspaceConfig.project || '',
        // PAT only from VS Code settings (never from workspace config)
        pat: vscodeSettings.pat,
        // Additional settings from workspace config
        repository: workspaceConfig.repository,
        defaultPullRequestBuildId: workspaceConfig.defaultPullRequestBuildId,
        workItemDefaults: workspaceConfig.workItemDefaults,
        pullRequestDefaults: workspaceConfig.pullRequestDefaults
      };
    }

    // No workspace config, just return VS Code settings
    return vscodeSettings;
  }

  /**
   * Check if ADO settings are configured
   */
  public hasSettings(): boolean {
    const settings = this.getSettings();
    // Organization and project can come from either source
    // PAT must be configured in VS Code settings
    return !!(settings.organization && settings.project && settings.pat);
  }

  /**
   * Get the path to the workspace config file
   */
  public getWorkspaceConfigPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    return path.join(
      workspaceFolders[0].uri.fsPath,
      '.supercode',
      'ado-config.json'
    );
  }

  /**
   * Create a sample workspace config file
   */
  public async createSampleWorkspaceConfig(): Promise<void> {
    const configPath = this.getWorkspaceConfigPath();
    if (!configPath) {
      throw new Error('No workspace folder found');
    }

    const configDir = path.dirname(configPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Don't overwrite existing config
    if (fs.existsSync(configPath)) {
      const overwrite = await vscode.window.showWarningMessage(
        'ADO config file already exists. Overwrite?',
        'Yes',
        'No'
      );
      if (overwrite !== 'Yes') {
        return;
      }
    }

    const sampleConfig: WorkspaceADOConfig = {
      organization: 'your-organization',
      project: 'your-project',
      repository: 'your-repo-name',
      defaultPullRequestBuildId: undefined,
      workItemDefaults: {
        areaPath: undefined,
        iterationPath: undefined,
        assignedTo: undefined
      },
      pullRequestDefaults: {
        targetBranch: 'main',
        autoComplete: false,
        deleteSourceBranch: false
      }
    };

    fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2));

    // Open the file in the editor
    const document = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(document);

    vscode.window.showInformationMessage(
      'Created sample ADO config file. Please update with your project details.'
    );
  }

  /**
   * Update ADO settings in VS Code configuration
   */
  public async updateSettings(settings: Partial<ADOSettings>): Promise<void> {
    const config = vscode.workspace.getConfiguration('supercode');

    if (settings.organization !== undefined) {
      await config.update('azureDevOps.organization', settings.organization, vscode.ConfigurationTarget.Global);
    }

    if (settings.project !== undefined) {
      await config.update('azureDevOps.project', settings.project, vscode.ConfigurationTarget.Global);
    }

    if (settings.pat !== undefined) {
      await config.update('azureDevOps.pat', settings.pat, vscode.ConfigurationTarget.Global);
    }
  }

  /**
   * Watch for ADO settings changes
   */
  public onDidChangeSettings(callback: (settings: ADOSettings) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('supercode.azureDevOps')) {
        callback(this.getSettings());
      }
    });
  }

  /**
   * Get settings as a serializable object for webview
   */
  public getSettingsForWebview(): any {
    const settings = this.getSettings();
    return {
      adoCredentials: {
        organization: settings.organization,
        project: settings.project,
        pat: settings.pat
      }
    };
  }
}