import * as vscode from "vscode";
import { registerOpenStaticWebviewCommand } from "./commands/openStaticWebview";
import { tuiManager } from "./utils/tuiInstanceManager";
import { SuperCodeInstanceStatic } from "./webview/SuperCodeInstanceStatic";
import { scanDynamicCommands, watchDynamicCommands, DynamicCommand } from "./utils/dynamicCommands";

const TERMINAL_NAME = "supercode";

// Dynamic command storage
let dynamicCommands: DynamicCommand[] = [];
let dynamicCommandDisposables: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext) {
  let openNewTerminalDisposable = vscode.commands.registerCommand("supercode.openNewTerminal", async () => {
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    if (uiMethod === 'static') {
      await openStaticWebview();
    } else {
      await openTerminal();
    }
  });

  let openTerminalDisposable = vscode.commands.registerCommand("supercode.openTerminal", async () => {
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    await tuiManager.openSuperCode(
      async () => {
        // Create new instance function
        if (uiMethod === 'static') {
          return await openStaticWebview();
        } else {
          return await openTerminal();
        }
      },
      async (port: number) => {
        // Connect to existing TUI function
        if (uiMethod === 'static') {
          return await connectToExistingTui(port);
        } else {
          // For terminal method, we can't "connect" to existing TUI with new terminal
          // so we'll create a new terminal but show message about existing TUI
          vscode.window.showInformationMessage(`Found existing TUI on port ${port}. Creating new terminal connection.`);
          return await openTerminal();
        }
      }
    );
  });

  let addFilepathDisposable = vscode.commands.registerCommand("supercode.addFilepathToTerminal", async () => {
    const fileRef = getActiveFile();
    if (!fileRef) {return;}

    const terminal = vscode.window.activeTerminal;
    if (!terminal) {return;}

    if (terminal.name === TERMINAL_NAME) {
      // @ts-ignore
      const port = terminal.creationOptions.env?.["_EXTENSION_SUPERCODE_PORT"];
      port ? await appendPrompt(parseInt(port), fileRef, 'appendWithSpacing') : terminal.sendText(fileRef);
      terminal.show();
    }
  });

  // Register static webview command (demonstrates clean static files approach)
  registerOpenStaticWebviewCommand(context);

  // Initialize dynamic commands
  initializeDynamicCommands(context);

  // Register context menu commands for text selection
  let explainSelectionDisposable = vscode.commands.registerCommand("supercode.explainSelection", async () => {
    await handleSelectionCommand("explain");
  });

  let refactorSelectionDisposable = vscode.commands.registerCommand("supercode.refactorSelection", async () => {
    await handleSelectionCommand("refactor");
  });

  let addCommentsDisposable = vscode.commands.registerCommand("supercode.addCommentsToSelection", async () => {
    await handleSelectionCommand("addComments");
  });

  let debugSelectionDisposable = vscode.commands.registerCommand("supercode.debugSelection", async () => {
    await handleSelectionCommand("debug");
  });

  let optimizeSelectionDisposable = vscode.commands.registerCommand("supercode.optimizeSelection", async () => {
    await handleSelectionCommand("optimize");
  });

  // Register review commands
  let reviewGeneralDisposable = vscode.commands.registerCommand("supercode.reviewGeneral", async () => {
    await handleSelectionCommand("reviewGeneral");
  });

  let reviewSecurityDisposable = vscode.commands.registerCommand("supercode.reviewSecurity", async () => {
    await handleSelectionCommand("reviewSecurity");
  });

  let reviewDesignDisposable = vscode.commands.registerCommand("supercode.reviewDesign", async () => {
    await handleSelectionCommand("reviewDesign");
  });

  let reviewDefensiveDisposable = vscode.commands.registerCommand("supercode.reviewDefensive", async () => {
    await handleSelectionCommand("reviewDefensive");
  });

  // Register dynamic commands picker
  let showDynamicCommandsDisposable = vscode.commands.registerCommand("supercode.showDynamicCommands", async () => {
    await showDynamicCommandsPicker();
  });

  // Register context menu commands for files
  let sendFileToChat = vscode.commands.registerCommand("supercode.sendFileToChat", async (uri: vscode.Uri, uris: vscode.Uri[]) => {
    // Support both single and multi-selection
    const selectedUris = uris && uris.length > 0 ? uris : [uri];
    await handleSendFilesToChat(selectedUris);
  });

  let sendSelectionToChat = vscode.commands.registerCommand("supercode.sendSelectionToChat", async () => {
    await handleSendSelectionToChat();
  });

  let sendCurrentFileToChat = vscode.commands.registerCommand("supercode.sendCurrentFileToChat", async () => {
    await handleSendCurrentFileToChat();
  });

  // Register file context menu commands
  let explainFileDisposable = vscode.commands.registerCommand("supercode.explainFile", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await handleFileCommand("explain", selectedUris);
  });

  let refactorFileDisposable = vscode.commands.registerCommand("supercode.refactorFile", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await handleFileCommand("refactor", selectedUris);
  });

  let addCommentsToFileDisposable = vscode.commands.registerCommand("supercode.addCommentsToFile", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await handleFileCommand("addComments", selectedUris);
  });

  let debugFileDisposable = vscode.commands.registerCommand("supercode.debugFile", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await handleFileCommand("debug", selectedUris);
  });

  let optimizeFileDisposable = vscode.commands.registerCommand("supercode.optimizeFile", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await handleFileCommand("optimize", selectedUris);
  });

  // Register file review commands
  let reviewFileGeneralDisposable = vscode.commands.registerCommand("supercode.reviewFileGeneral", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await handleFileCommand("reviewGeneral", selectedUris);
  });

  let reviewFileSecurityDisposable = vscode.commands.registerCommand("supercode.reviewFileSecurity", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await handleFileCommand("reviewSecurity", selectedUris);
  });

  let reviewFileDesignDisposable = vscode.commands.registerCommand("supercode.reviewFileDesign", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await handleFileCommand("reviewDesign", selectedUris);
  });

  let reviewFileDefensiveDisposable = vscode.commands.registerCommand("supercode.reviewFileDefensive", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await handleFileCommand("reviewDefensive", selectedUris);
  });

  // Register dynamic commands for files
  let showDynamicCommandsForFileDisposable = vscode.commands.registerCommand("supercode.showDynamicCommandsForFile", async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
    const selectedUris = getFileUrisFromContext(uri, uris);
    await showDynamicCommandsPickerForFiles(selectedUris);
  });

  context.subscriptions.push(
    openTerminalDisposable, 
    openNewTerminalDisposable, 
    addFilepathDisposable,
    explainSelectionDisposable,
    refactorSelectionDisposable,
    addCommentsDisposable,
    debugSelectionDisposable,
    optimizeSelectionDisposable,
    reviewGeneralDisposable,
    reviewSecurityDisposable,
    reviewDesignDisposable,
    reviewDefensiveDisposable,
    showDynamicCommandsDisposable,
    sendFileToChat,
    sendSelectionToChat,
    sendCurrentFileToChat,
    explainFileDisposable,
    refactorFileDisposable,
    addCommentsToFileDisposable,
    debugFileDisposable,
    optimizeFileDisposable,
    reviewFileGeneralDisposable,
    reviewFileSecurityDisposable,
    reviewFileDesignDisposable,
    reviewFileDefensiveDisposable,
    showDynamicCommandsForFileDisposable
  );

  async function handleSelectionCommand(action: string) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage("No active editor found");
      return;
    }

    const selection = activeEditor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage("No text selected");
      return;
    }

    const selectedText = activeEditor.document.getText(selection);
    const document = activeEditor.document;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("File is not part of a workspace");
      return;
    }

    // Get the relative path from workspace root
    const relativePath = vscode.workspace.asRelativePath(document.uri);
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;
    
    let fileRef: string;
    if (startLine === endLine) {
      fileRef = `@${relativePath}#L${startLine}`;
    } else {
      fileRef = `@${relativePath}#L${startLine}-${endLine}`;
    }

    // Generate the appropriate prompt based on the action
    const prompts = {
      explain: `Please explain this code:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`,
      refactor: `Please refactor this code to improve readability and maintainability:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`,
      addComments: `Please add helpful comments to this code:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`,
      debug: `Please help me debug this code. Look for potential issues, bugs, or improvements:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`,
      optimize: `Please optimize this code for better performance:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`,
      reviewGeneral: `Please conduct a comprehensive code review of this selection, focusing on overall code quality, readability, maintainability, and best practices:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`,
      reviewSecurity: `Please conduct a security-focused code review of this selection. Look for potential vulnerabilities, security anti-patterns, input validation issues, and suggest security improvements:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`,
      reviewDesign: `Please review this code from a design perspective. Analyze the architecture, design patterns, separation of concerns, modularity, and suggest improvements for better software design:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`,
      reviewDefensive: `Please review this code with a focus on defensive coding practices. Look for error handling, input validation, boundary conditions, null safety, and suggest improvements for more robust code:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`
    };

    const prompt = prompts[action as keyof typeof prompts];
    if (!prompt) {
      vscode.window.showErrorMessage(`Unknown action: ${action}`);
      return;
    }

    // For selection commands, we want to reuse existing instances without closing them
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    // Check for existing instances first (don't close them for selection commands)
    let tuiInstance = tuiManager.getConnectedInstance();
    
    if (!tuiInstance) {
      // No existing instance, create one
      if (uiMethod === 'static') {
        tuiInstance = await openStaticWebview();
      } else {
        tuiInstance = await openTerminal();
      }
    } else {
      // Show existing instance
      if (tuiInstance.method === 'static' && tuiInstance.webview) {
        tuiInstance.webview.reveal();
      } else if (tuiInstance.method === 'terminal' && tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    }

    const { port } = tuiInstance;

    // Send the prompt to SuperCode
    try {
      await appendPrompt(port, prompt, 'appendWithSpacing');
      
      // Show the interface (terminal or webview)
      if (tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
      // For static webviews, they're already visible after creation
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send command to SuperCode: ${error}`);
    }
  }

  async function openStaticWebview() {
    const port = Math.floor(Math.random() * (65535 - 16384 + 1)) + 16384;
    const instanceId = `supercode-static-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    const instance = new SuperCodeInstanceStatic(
      instanceId,
      port,
      context,
      () => {
        // Cleanup when disposed - remove instance but keep port for reconnection
        console.log(`Static webview instance ${instanceId} disposed, keeping port ${port} for reconnection`);
        tuiManager.removeInstance(instanceId);
      }
    );
    
    // Register with TUI manager
    tuiManager.registerStaticInstance(instanceId, instance, port);
    
    await instance.initialize();
    
    // Mark as connected
    tuiManager.markConnected(instanceId);
    
    return {
      webview: instance,
      port,
      isConnected: true,
      method: 'static' as const
    };
  }

  async function connectToExistingTui(port: number) {
    const instanceId = `supercode-static-existing-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    const instance = new SuperCodeInstanceStatic(
      instanceId,
      port,
      context,
      () => {
        // Cleanup when disposed - remove instance but keep port for reconnection
        console.log(`Connected static webview instance ${instanceId} disposed, keeping port ${port} for reconnection`);
        tuiManager.removeInstance(instanceId);
      },
      true // Connect to existing instead of spawning new
    );
    
    // Register with TUI manager
    tuiManager.registerStaticInstance(instanceId, instance, port);
    
    await instance.initialize();
    
    // Mark as connected
    tuiManager.markConnected(instanceId);
    
    return {
      webview: instance,
      port,
      isConnected: true,
      method: 'static' as const
    };
  }

  async function openTerminal() {
    // Create a new terminal in split screen
    const port = Math.floor(Math.random() * (65535 - 16384 + 1)) + 16384;
    const terminal = vscode.window.createTerminal({
      name: TERMINAL_NAME,
      iconPath: {
        light: vscode.Uri.file(context.asAbsolutePath("images/button-dark.svg")),
        dark: vscode.Uri.file(context.asAbsolutePath("images/button-light.svg")),
      },
      location: {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false,
      },
      env: {
        _EXTENSION_SUPERCODE_PORT: port.toString(),
      },
    });

    // Register the instance with the TUI manager
    tuiManager.registerTerminalInstance(terminal, port);

    terminal.show();
    terminal.sendText(`SUPERCODE_CALLER=vscode supercode --port ${port}`);

    const fileRef = getActiveFile();
    
    // Wait for the terminal to be ready
    let tries = 10;
    let connected = false;
    do {
      await new Promise((resolve) => setTimeout(resolve, 200));
      try {
        await fetch(`http://localhost:${port}/app`);
        connected = true;
        break;
      } catch (e) {}

      tries--;
    } while (tries > 0);

    if (connected) {
      // Mark as connected in the TUI manager
      tuiManager.markConnected(terminal.name);
      
      // If there's an active file, append the prompt
      if (fileRef) {
        await appendPrompt(port, `In ${fileRef}`);
      }
      terminal.show();
    }

    return {
      terminal,
      port,
      isConnected: connected,
      method: 'terminal' as const
    };
  }

  async function appendPrompt(port: number, text: string, variant: 'clearAndAdd' | 'appendWithSpacing' = 'clearAndAdd') {
    // Check UI method to determine how to send the prompt
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    if (uiMethod === 'static') {
      // For static UI, send message to the focused webview panel instead of TUI
      const focusedInstance = tuiManager.getFocusedStaticInstance();
      if (focusedInstance) {
        focusedInstance.addPromptToInput(text, variant);
        return;
      }
    }
    
    // Fallback to original TUI method for terminal UI or if no focused static instance
    await fetch(`http://localhost:${port}/tui/append-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
  }

  function getActiveFile() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {return;}

    const document = activeEditor.document;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {return;}

    // Get the relative path from workspace root
    const relativePath = vscode.workspace.asRelativePath(document.uri);
    let filepathWithAt = `@${relativePath}`;

    // Check if there's a selection and add line numbers
    const selection = activeEditor.selection;
    if (!selection.isEmpty) {
      // Convert to 1-based line numbers
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;

      if (startLine === endLine) {
        // Single line selection
        filepathWithAt += `#L${startLine}`;
      } else {
        // Multi-line selection
        filepathWithAt += `#L${startLine}-${endLine}`;
      }
    }

    return filepathWithAt;
  }

  /**
   * Show a quick pick menu with available dynamic commands
   */
  async function showDynamicCommandsPicker() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage("No active editor found");
      return;
    }

    const selection = activeEditor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage("No text selected");
      return;
    }

    // Refresh commands to get latest list
    await refreshDynamicCommands(context);

    if (dynamicCommands.length === 0) {
      vscode.window.showInformationMessage("No commands found. Add .md files to .opencode/commands/ directory.");
      return;
    }

    // Create quick pick items
    const quickPickItems = dynamicCommands.map(command => ({
      label: command.title,
      description: command.name,
      detail: command.description || `Run /${command.name} command`,
      command: command
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "Select a command to run on the selected text",
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await handleDynamicSelectionCommand(selected.command.name);
    }
  }

  /**
   * Initialize dynamic commands from .opencode/commands directory
   */
  async function initializeDynamicCommands(context: vscode.ExtensionContext) {
    // Load initial commands
    await refreshDynamicCommands(context);
    
    // Watch for changes
    const watcher = watchDynamicCommands(() => {
      refreshDynamicCommands(context);
    });
    
    if (watcher) {
      context.subscriptions.push(watcher);
    }
  }

  /**
   * Refresh dynamic commands by scanning the directory and re-registering
   */
  async function refreshDynamicCommands(context: vscode.ExtensionContext) {
    // Dispose existing dynamic command disposables
    dynamicCommandDisposables.forEach(disposable => disposable.dispose());
    dynamicCommandDisposables = [];
    
    // Scan for new commands
    dynamicCommands = await scanDynamicCommands();
    
    // Register new commands
    for (const command of dynamicCommands) {
      const commandId = `supercode.dynamic.${command.name}`;
      const disposable = vscode.commands.registerCommand(commandId, async () => {
        await handleDynamicSelectionCommand(command.name);
      });
      
      dynamicCommandDisposables.push(disposable);
      context.subscriptions.push(disposable);
    }
    
    console.log(`Loaded ${dynamicCommands.length} dynamic commands`);
  }

  /**
   * Handle sending files or folders to chat from file explorer context menu
   */
  async function handleSendFilesToChat(uris: vscode.Uri[]) {
    if (!uris || uris.length === 0) {
      vscode.window.showErrorMessage("No files selected");
      return;
    }

    // Check if all files are part of a workspace
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uris[0]);
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("Files are not part of a workspace");
      return;
    }

    // Process each URI and determine if it's a file or folder
    const fileRefs: string[] = [];
    for (const uri of uris) {
      const stat = await vscode.workspace.fs.stat(uri);
      const relativePath = vscode.workspace.asRelativePath(uri);
      
      if (stat.type === vscode.FileType.Directory) {
        // For directories, add with a trailing slash to indicate it's a folder
        fileRefs.push(`@${relativePath}/`);
      } else {
        // For files, add normally
        fileRefs.push(`@${relativePath}`);
      }
    }
    
    // Create the prompt with file references
    let prompt: string;
    if (fileRefs.length === 1) {
      const ref = fileRefs[0];
      if (ref.endsWith('/')) {
        prompt = `Please review the folder ${ref}`;
      } else {
        prompt = `Please review the file ${ref}`;
      }
    } else {
      // Multiple items selected
      const folders = fileRefs.filter(ref => ref.endsWith('/'));
      const files = fileRefs.filter(ref => !ref.endsWith('/'));
      
      let itemDescription = '';
      if (folders.length > 0 && files.length > 0) {
        itemDescription = `${files.length} file(s) and ${folders.length} folder(s)`;
      } else if (folders.length > 0) {
        itemDescription = `${folders.length} folder(s)`;
      } else {
        itemDescription = `${files.length} file(s)`;
      }
      
      prompt = `Please review these ${itemDescription}:\n${fileRefs.join('\n')}`;
    }

    // Prefer last active instance for context menu commands
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    let tuiInstance = tuiManager.getLastActiveInstance();
    
    if (!tuiInstance) {
      // No existing instance, create a new one
      if (uiMethod === 'static') {
        tuiInstance = await openStaticWebview();
      } else {
        tuiInstance = await openTerminal();
      }
    } else {
      // Show existing instance
      if (tuiInstance.method === 'static' && tuiInstance.webview) {
        tuiInstance.webview.reveal();
      } else if (tuiInstance.method === 'terminal' && tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    }

    const { port } = tuiInstance;

    // Send the prompt to SuperCode
    try {
      await appendPrompt(port, prompt, 'appendWithSpacing');
      
      // Show the interface (terminal or webview)
      if (tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send file to SuperCode: ${error}`);
    }
  }

  /**
   * Handle sending selection to chat from editor context menu
   */
  async function handleSendSelectionToChat() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage("No active editor found");
      return;
    }

    const selection = activeEditor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage("No text selected");
      return;
    }

    const selectedText = activeEditor.document.getText(selection);
    const document = activeEditor.document;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("File is not part of a workspace");
      return;
    }

    // Get the relative path from workspace root
    const relativePath = vscode.workspace.asRelativePath(document.uri);
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;
    
    let fileRef: string;
    if (startLine === endLine) {
      fileRef = `@${relativePath}#L${startLine}`;
    } else {
      fileRef = `@${relativePath}#L${startLine}-${endLine}`;
    }

    // Create the prompt
    const prompt = `\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`;

    // Prefer last active instance for context menu commands
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    let tuiInstance = tuiManager.getLastActiveInstance();
    
    if (!tuiInstance) {
      // No existing instance, create a new one
      if (uiMethod === 'static') {
        tuiInstance = await openStaticWebview();
      } else {
        tuiInstance = await openTerminal();
      }
    } else {
      // Show existing instance
      if (tuiInstance.method === 'static' && tuiInstance.webview) {
        tuiInstance.webview.reveal();
      } else if (tuiInstance.method === 'terminal' && tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    }

    const { port } = tuiInstance;

    // Send the prompt to SuperCode
    try {
      await appendPrompt(port, prompt, 'appendWithSpacing');
      
      // Show the interface (terminal or webview)
      if (tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send selection to SuperCode: ${error}`);
    }
  }

  /**
   * Handle sending current file to chat from editor context menu
   */
  async function handleSendCurrentFileToChat() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage("No active editor found");
      return;
    }

    const document = activeEditor.document;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("File is not part of a workspace");
      return;
    }

    // Get the relative path from workspace root
    const relativePath = vscode.workspace.asRelativePath(document.uri);
    const fileRef = `@${relativePath}`;
    
    // Create the prompt with file reference
    const prompt = ` ${fileRef}`;

    // Prefer last active instance for context menu commands
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    let tuiInstance = tuiManager.getLastActiveInstance();
    
    if (!tuiInstance) {
      // No existing instance, create a new one
      if (uiMethod === 'static') {
        tuiInstance = await openStaticWebview();
      } else {
        tuiInstance = await openTerminal();
      }
    } else {
      // Show existing instance
      if (tuiInstance.method === 'static' && tuiInstance.webview) {
        tuiInstance.webview.reveal();
      } else if (tuiInstance.method === 'terminal' && tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    }

    const { port } = tuiInstance;

    // Send the prompt to SuperCode
    try {
      await appendPrompt(port, prompt, 'appendWithSpacing');
      
      // Show the interface (terminal or webview)
      if (tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send file to SuperCode: ${error}`);
    }
  }

  /**
   * Get file URIs from context - handles both file explorer and editor contexts
   */
  function getFileUrisFromContext(uri?: vscode.Uri, uris?: vscode.Uri[]): vscode.Uri[] {
    // If we have multiple selections from file explorer
    if (uris && uris.length > 0) {
      return uris;
    }
    
    // If we have a single selection from file explorer
    if (uri) {
      return [uri];
    }
    
    // Otherwise, get the current active editor's file
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      return [activeEditor.document.uri];
    }
    
    return [];
  }

  /**
   * Handle file commands (explain, refactor, debug, etc.)
   */
  async function handleFileCommand(action: string, uris: vscode.Uri[]) {
    if (!uris || uris.length === 0) {
      vscode.window.showErrorMessage("No files selected");
      return;
    }

    // Check if all files are part of a workspace
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uris[0]);
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("Files are not part of a workspace");
      return;
    }

    // Process each URI
    const fileRefs: string[] = [];
    for (const uri of uris) {
      const stat = await vscode.workspace.fs.stat(uri);
      const relativePath = vscode.workspace.asRelativePath(uri);
      
      if (stat.type === vscode.FileType.File) {
        fileRefs.push(`@${relativePath}`);
      }
    }

    if (fileRefs.length === 0) {
      vscode.window.showErrorMessage("No files selected (folders are not supported for this action)");
      return;
    }

    // Generate the appropriate prompt based on the action
    const prompts = {
      explain: fileRefs.length === 1 
        ? `Please explain the code in ${fileRefs[0]}`
        : `Please explain the code in these files:\n${fileRefs.join('\n')}`,
      refactor: fileRefs.length === 1
        ? `Please refactor ${fileRefs[0]} to improve readability and maintainability`
        : `Please refactor these files to improve readability and maintainability:\n${fileRefs.join('\n')}`,
      addComments: fileRefs.length === 1
        ? `Please add helpful comments to ${fileRefs[0]}`
        : `Please add helpful comments to these files:\n${fileRefs.join('\n')}`,
      debug: fileRefs.length === 1
        ? `Please help me debug ${fileRefs[0]}. Look for potential issues, bugs, or improvements`
        : `Please help me debug these files. Look for potential issues, bugs, or improvements:\n${fileRefs.join('\n')}`,
      optimize: fileRefs.length === 1
        ? `Please optimize ${fileRefs[0]} for better performance`
        : `Please optimize these files for better performance:\n${fileRefs.join('\n')}`,
      reviewGeneral: fileRefs.length === 1
        ? `Please conduct a comprehensive code review of ${fileRefs[0]}, focusing on overall code quality, readability, maintainability, and best practices`
        : `Please conduct a comprehensive code review of these files, focusing on overall code quality, readability, maintainability, and best practices:\n${fileRefs.join('\n')}`,
      reviewSecurity: fileRefs.length === 1
        ? `Please conduct a security-focused code review of ${fileRefs[0]}. Look for potential vulnerabilities, security anti-patterns, input validation issues, and suggest security improvements`
        : `Please conduct a security-focused code review of these files. Look for potential vulnerabilities, security anti-patterns, input validation issues, and suggest security improvements:\n${fileRefs.join('\n')}`,
      reviewDesign: fileRefs.length === 1
        ? `Please review ${fileRefs[0]} from a design perspective. Analyze the architecture, design patterns, separation of concerns, modularity, and suggest improvements for better software design`
        : `Please review these files from a design perspective. Analyze the architecture, design patterns, separation of concerns, modularity, and suggest improvements for better software design:\n${fileRefs.join('\n')}`,
      reviewDefensive: fileRefs.length === 1
        ? `Please review ${fileRefs[0]} with a focus on defensive coding practices. Look for error handling, input validation, boundary conditions, null safety, and suggest improvements for more robust code`
        : `Please review these files with a focus on defensive coding practices. Look for error handling, input validation, boundary conditions, null safety, and suggest improvements for more robust code:\n${fileRefs.join('\n')}`
    };

    const prompt = prompts[action as keyof typeof prompts];
    if (!prompt) {
      vscode.window.showErrorMessage(`Unknown action: ${action}`);
      return;
    }

    // For file commands, we want to reuse existing instances without closing them
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    // Check for existing instances first (don't close them for file commands)
    let tuiInstance = tuiManager.getConnectedInstance();
    
    if (!tuiInstance) {
      // No existing instance, create one
      if (uiMethod === 'static') {
        tuiInstance = await openStaticWebview();
      } else {
        tuiInstance = await openTerminal();
      }
    } else {
      // Show existing instance
      if (tuiInstance.method === 'static' && tuiInstance.webview) {
        tuiInstance.webview.reveal();
      } else if (tuiInstance.method === 'terminal' && tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    }

    const { port } = tuiInstance;

    // Send the prompt to SuperCode
    try {
      await appendPrompt(port, prompt, 'appendWithSpacing');
      
      // Show the interface (terminal or webview)
      if (tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
      // For static webviews, they're already visible after creation
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send command to SuperCode: ${error}`);
    }
  }

  /**
   * Show dynamic commands picker for files
   */
  async function showDynamicCommandsPickerForFiles(uris: vscode.Uri[]) {
    if (!uris || uris.length === 0) {
      vscode.window.showErrorMessage("No files selected");
      return;
    }

    // Filter to only include files (not folders)
    const fileUris: vscode.Uri[] = [];
    for (const uri of uris) {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type === vscode.FileType.File) {
        fileUris.push(uri);
      }
    }

    if (fileUris.length === 0) {
      vscode.window.showErrorMessage("No files selected (folders are not supported for dynamic commands)");
      return;
    }

    // Refresh commands to get latest list
    await refreshDynamicCommands(context);

    if (dynamicCommands.length === 0) {
      vscode.window.showInformationMessage("No commands found. Add .md files to .opencode/commands/ directory.");
      return;
    }

    // Create quick pick items
    const quickPickItems = dynamicCommands.map(command => ({
      label: command.title,
      description: command.name,
      detail: command.description || `Run /${command.name} command`,
      command: command
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "Select a command to run on the selected file(s)",
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await handleDynamicFileCommand(selected.command.name, fileUris);
    }
  }

  /**
   * Handle dynamic file commands
   */
  async function handleDynamicFileCommand(commandName: string, uris: vscode.Uri[]) {
    // Check if all files are part of a workspace
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uris[0]);
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("Files are not part of a workspace");
      return;
    }

    // Process each URI
    const fileRefs: string[] = [];
    for (const uri of uris) {
      const relativePath = vscode.workspace.asRelativePath(uri);
      fileRefs.push(`@${relativePath}`);
    }

    // Create the command prompt
    const prompt = fileRefs.length === 1
      ? `/${commandName} ${fileRefs[0]}`
      : `/${commandName}\n${fileRefs.join('\n')}`;

    // For file commands, we want to reuse existing instances without closing them
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    // Check for existing instances first (don't close them for file commands)
    let tuiInstance = tuiManager.getConnectedInstance();
    
    if (!tuiInstance) {
      // No existing instance, create one
      if (uiMethod === 'static') {
        tuiInstance = await openStaticWebview();
      } else {
        tuiInstance = await openTerminal();
      }
    } else {
      // Show existing instance
      if (tuiInstance.method === 'static' && tuiInstance.webview) {
        tuiInstance.webview.reveal();
      } else if (tuiInstance.method === 'terminal' && tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    }

    const { port } = tuiInstance;

    // Send the prompt to SuperCode
    try {
      await appendPrompt(port, prompt, 'appendWithSpacing');
      
      // Show the interface (terminal or webview)
      if (tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
      // For static webviews, they're already visible after creation
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send command to SuperCode: ${error}`);
    }
  }

  /**
   * Handle dynamic selection commands
   */
  async function handleDynamicSelectionCommand(commandName: string) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage("No active editor found");
      return;
    }

    const selection = activeEditor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage("No text selected");
      return;
    }

    const selectedText = activeEditor.document.getText(selection);
    const document = activeEditor.document;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("File is not part of a workspace");
      return;
    }

    // Get the relative path from workspace root
    const relativePath = vscode.workspace.asRelativePath(document.uri);
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;
    
    let fileRef: string;
    if (startLine === endLine) {
      fileRef = `@${relativePath}#L${startLine}`;
    } else {
      fileRef = `@${relativePath}#L${startLine}-${endLine}`;
    }

    // Create the command prompt
    const prompt = `/${commandName}\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nFrom ${fileRef}`;

    // For selection commands, we want to reuse existing instances without closing them
    const config = vscode.workspace.getConfiguration('supercode');
    const uiMethod = config.get<'static' | 'terminal'>('ui.method', 'static');
    
    // Check for existing instances first (don't close them for selection commands)
    let tuiInstance = tuiManager.getConnectedInstance();
    
    if (!tuiInstance) {
      // No existing instance, create one
      if (uiMethod === 'static') {
        tuiInstance = await openStaticWebview();
      } else {
        tuiInstance = await openTerminal();
      }
    } else {
      // Show existing instance
      if (tuiInstance.method === 'static' && tuiInstance.webview) {
        tuiInstance.webview.reveal();
      } else if (tuiInstance.method === 'terminal' && tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
    }

    const { port } = tuiInstance;

    // Send the prompt to SuperCode
    try {
      await appendPrompt(port, prompt, 'appendWithSpacing');
      
      // Show the interface (terminal or webview)
      if (tuiInstance.terminal) {
        tuiInstance.terminal.show();
      }
      // For static webviews, they're already visible after creation
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send command to SuperCode: ${error}`);
    }
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  // Dispose dynamic command disposables
  dynamicCommandDisposables.forEach(disposable => disposable.dispose());
  dynamicCommandDisposables = [];
  
  tuiManager.dispose();
}
