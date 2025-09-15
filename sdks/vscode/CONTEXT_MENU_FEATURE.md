# Context Menu Integration for SuperCode VSCode Extension

## Overview
Added context menu integration to allow sending files and selections directly to SuperCode chat from:
- File Explorer context menu
- Editor context menu

## New Features

### 1. File Explorer Context Menu
- **Command**: `Send to SuperCode Chat`
- **When**: Right-click on files, folders, or multiple selections in the file explorer
- **Supports**:
  - Single file selection
  - Single folder selection
  - Multiple file selection (Ctrl/Cmd+Click)
  - Multiple folder selection
  - Mixed file and folder selection
- **Action**: Sends file/folder references (`@filename` or `@foldername/`) to SuperCode chat for review

### 2. Editor Context Menu - Selection
- **Command**: `Send Selection to Chat`
- **When**: Right-click with text selected in the editor
- **Action**: Sends the selected text with file reference and line numbers to SuperCode chat

### 3. Editor Context Menu - Full File
- **Command**: `Send Current File to Chat`
- **When**: Right-click in the editor with no selection
- **Action**: Sends the entire current file reference to SuperCode chat

## Implementation Details

### Commands Added
- `supercode.sendFileToChat` - Handles file/folder sending from explorer (supports multi-selection)
- `supercode.sendSelectionToChat` - Handles selection sending from editor
- `supercode.sendCurrentFileToChat` - Handles full file sending from editor

### Menu Configuration
Context menus are configured in `package.json`:
- `explorer/context` - File explorer right-click menu (files and folders)
- `editor/context` - Editor right-click menu (conditional based on selection)

### Handler Functions
New handler functions in `extension.ts`:
- `handleSendFilesToChat(uris)` - Processes single or multiple files/folders from explorer
- `handleSendSelectionToChat()` - Processes selected text
- `handleSendCurrentFileToChat()` - Processes current file

### Multi-Selection Support
- Detects file vs folder using `vscode.workspace.fs.stat()`
- Folders are indicated with trailing `/` in references
- Creates descriptive prompts for multi-selection (e.g., "3 file(s) and 2 folder(s)")

## Usage

1. **Send files/folders from File Explorer**:
   - **Single file**: Right-click any file → "Send to SuperCode Chat"
   - **Single folder**: Right-click any folder → "Send to SuperCode Chat"
   - **Multiple items**: Ctrl/Cmd+Click to select multiple files/folders → Right-click → "Send to SuperCode Chat"
   - All selected items will be appended to SuperCode with appropriate references

2. **Send selected text from Editor**:
   - Select text in the editor
   - Right-click on the selection
   - Select "Send Selection to Chat"
   - Selected text with line numbers will be sent to SuperCode

3. **Send entire file from Editor**:
   - Open a file in the editor
   - Right-click anywhere (without selecting text)
   - Select "Send Current File to Chat"
   - File reference will be sent to SuperCode

## Integration with SuperCode
- **Smart Instance Management**: Always uses the last active SuperCode window when available
- **No Window Proliferation**: Sends prompts to existing windows instead of creating new ones
- **Automatic Creation**: Only creates a new SuperCode instance if none exist
- **Focus Tracking**: Tracks which window was last active/focused for optimal routing
- Sends prompts using the existing `appendPrompt` function
- Maintains consistency with existing commands and workflows

## Behavior
- When you use a context menu command:
  1. First checks for the last active SuperCode window
  2. If found, **appends** the prompt to that window's input (doesn't replace existing text)
  3. If no windows exist, creates a new one
- This ensures a smooth workflow without creating multiple windows unnecessarily
- **Append Mode**: All context menu commands append content with spacing, preserving any existing text in the input field