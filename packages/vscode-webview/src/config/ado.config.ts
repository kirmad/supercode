/**
 * Azure DevOps Configuration Helper
 *
 * This module handles loading ADO credentials from various sources
 * In VS Code context, these would typically come from the extension settings
 */

export interface ADOConfig {
  organization: string;
  project: string;
  pat: string;
}

/**
 * Get ADO credentials from environment or VS Code settings
 * In production, these should come from VS Code extension context
 */
export function getADOCredentials(): Partial<ADOConfig> {
  // In VS Code webview, these would typically be injected by the extension
  // For development, we can use environment variables

  // Try to get from VS Code API if available (would be injected by extension)
  if (typeof (window as any).vscode !== 'undefined') {
    const vscodeApi = (window as any).vscode;
    const state = vscodeApi.getState();
    if (state?.adoCredentials) {
      console.log('[ADO Config] Using VS Code extension settings');
      return state.adoCredentials;
    }
  }

  // Try to get from window.adoSettings (injected by VS Code extension on initial load)
  if (typeof (window as any).adoSettings !== 'undefined') {
    const adoSettings = (window as any).adoSettings;
    if (adoSettings?.adoCredentials) {
      console.log('[ADO Config] Using VS Code injected settings');
      return adoSettings.adoCredentials;
    }
  }

  // Try Vite environment variables (for development)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viteCredentials = {
      organization: import.meta.env.VITE_AZURE_DEVOPS_ORG || import.meta.env.VITE_ADO_ORG,
      project: import.meta.env.VITE_AZURE_DEVOPS_PROJECT || import.meta.env.VITE_ADO_PROJECT,
      pat: import.meta.env.VITE_AZURE_DEVOPS_PAT || import.meta.env.VITE_ADO_PAT
    };

    if (viteCredentials.organization || viteCredentials.project || viteCredentials.pat) {
      console.log('[ADO Config] Using Vite environment variables');
      return viteCredentials;
    }
  }

  // Fallback to process.env for development
  // Note: In a real VS Code extension, process.env wouldn't be available
  // These would need to be passed from the extension host
  if (typeof process !== 'undefined' && process.env) {
    const processCredentials = {
      organization: process.env.AZURE_DEVOPS_ORG || process.env.VSCODE_ADO_ORG,
      project: process.env.AZURE_DEVOPS_PROJECT || process.env.VSCODE_ADO_PROJECT,
      pat: process.env.AZURE_DEVOPS_PAT || process.env.VSCODE_ADO_PAT
    };

    if (processCredentials.organization || processCredentials.project || processCredentials.pat) {
      console.log('[ADO Config] Using process.env variables');
      return processCredentials;
    }
  }

  // Try to get from localStorage (for development/testing)
  try {
    const stored = localStorage.getItem('ado-credentials');
    if (stored) {
      console.log('[ADO Config] Using localStorage credentials');
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load ADO credentials from localStorage:', e);
  }

  console.warn('[ADO Config] No Azure DevOps credentials found in any source');
  return {};
}

/**
 * Save ADO credentials (for development/testing)
 * In production, these should be managed by VS Code settings
 */
export function saveADOCredentials(credentials: Partial<ADOConfig>): void {
  try {
    localStorage.setItem('ado-credentials', JSON.stringify(credentials));
  } catch (e) {
    console.error('Failed to save ADO credentials:', e);
  }

  // If VS Code API is available, update state
  if (typeof (window as any).vscode !== 'undefined') {
    const vscodeApi = (window as any).vscode;
    vscodeApi.setState({
      ...vscodeApi.getState(),
      adoCredentials: credentials
    });
  }
}

/**
 * Check if ADO credentials are configured
 */
export function hasADOCredentials(): boolean {
  const creds = getADOCredentials();
  return !!(creds.organization && creds.project && creds.pat);
}

/**
 * Clear stored ADO credentials (for development/testing)
 */
export function clearADOCredentials(): void {
  try {
    localStorage.removeItem('ado-credentials');
  } catch (e) {
    console.error('Failed to clear ADO credentials:', e);
  }

  // If VS Code API is available, clear from state
  if (typeof (window as any).vscode !== 'undefined') {
    const vscodeApi = (window as any).vscode;
    const state = vscodeApi.getState() || {};
    delete state.adoCredentials;
    vscodeApi.setState(state);
  }
}