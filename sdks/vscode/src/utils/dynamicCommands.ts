import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface DynamicCommand {
  name: string;
  title: string;
  description?: string;
  filePath: string;
}

/**
 * Parses front-matter from a markdown file
 */
function parseFrontMatter(content: string): { frontMatter: Record<string, any>, body: string } {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);
  
  if (!match) {
    return { frontMatter: {}, body: content };
  }
  
  const frontMatterText = match[1];
  const body = match[2];
  const frontMatter: Record<string, any> = {};
  
  // Simple YAML-like parser for front-matter
  const lines = frontMatterText.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      frontMatter[key] = value;
    }
  }
  
  return { frontMatter, body };
}

/**
 * Scans the .opencode/commands directory for command files
 */
export async function scanDynamicCommands(): Promise<DynamicCommand[]> {
  const commands: DynamicCommand[] = [];
  
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return commands;
    }
    
    const commandsDir = path.join(workspaceFolder.uri.fsPath, '.opencode', 'commands');
    
    // Check if directory exists
    if (!fs.existsSync(commandsDir)) {
      return commands;
    }
    
    const files = fs.readdirSync(commandsDir);
    
    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue;
      }
      
      const filePath = path.join(commandsDir, file);
      const commandName = path.basename(file, '.md');
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { frontMatter } = parseFrontMatter(content);
        
        const command: DynamicCommand = {
          name: commandName,
          title: frontMatter.title || commandName.charAt(0).toUpperCase() + commandName.slice(1),
          description: frontMatter.description,
          filePath
        };
        
        commands.push(command);
      } catch (error) {
        console.warn(`Failed to read command file ${file}:`, error);
      }
    }
    
    // Sort commands alphabetically by name
    commands.sort((a, b) => a.name.localeCompare(b.name));
    
  } catch (error) {
    console.warn('Failed to scan dynamic commands:', error);
  }
  
  return commands;
}

/**
 * Watches for changes in the .opencode/commands directory
 */
export function watchDynamicCommands(callback: () => void): vscode.Disposable | null {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return null;
    }
    
    const commandsDir = path.join(workspaceFolder.uri.fsPath, '.opencode', 'commands');
    
    if (!fs.existsSync(commandsDir)) {
      return null;
    }
    
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolder, '.opencode/commands/*.md')
    );
    
    watcher.onDidCreate(callback);
    watcher.onDidDelete(callback);
    watcher.onDidChange(callback);
    
    return watcher;
  } catch (error) {
    console.warn('Failed to watch dynamic commands:', error);
    return null;
  }
}