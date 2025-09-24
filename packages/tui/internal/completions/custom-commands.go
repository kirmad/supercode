package completions

import (
	"github.com/kirmad/supercode/internal/styles"
	"github.com/kirmad/supercode/internal/theme"
	"gopkg.in/yaml.v3"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type CustomCommandsProvider struct{}

type CommandMetadata struct {
	Description   string `yaml:"description"`
	ArgumentHint  string `yaml:"argument-hint"`
}

type CommandInfo struct {
	Name         string
	Description  string
	ArgumentHint string
}

func NewCustomCommandsProvider() *CustomCommandsProvider {
	return &CustomCommandsProvider{}
}

func parseFrontMatter(content []byte) CommandMetadata {
	var metadata CommandMetadata
	
	// Regex to match front matter between --- delimiters
	frontMatterRegex := regexp.MustCompile(`^---\r?\n([\s\S]*?)\r?\n---\r?\n`)
	matches := frontMatterRegex.FindSubmatch(content)
	
	if len(matches) < 2 {
		return metadata // Return empty metadata if no front matter found
	}
	
	yamlContent := matches[1]
	
	// Parse YAML front matter
	err := yaml.Unmarshal(yamlContent, &metadata)
	if err != nil {
		slog.Debug("Failed to parse front matter YAML", "error", err)
		return CommandMetadata{} // Return empty metadata on error
	}
	
	return metadata
}

func (p *CustomCommandsProvider) GetId() string {
	return "custom-commands"
}

func (p *CustomCommandsProvider) GetEmptyMessage() string {
	return "no custom commands"
}

func (p *CustomCommandsProvider) GetChildEntries(query string) ([]CompletionSuggestion, error) {
	// Load commands dynamically to pick up new files
	commands := p.loadCommands()

	var matches []CompletionSuggestion
	for _, cmd := range commands {
		if query == "" || strings.Contains(cmd.Name, query) {
			matches = append(matches, CompletionSuggestion{
				Display: func(s styles.Style) string {
					t := theme.CurrentTheme()
					
					// Use the style's foreground color, which will be orange/primary for selected items
					display := "  " + s.Render(cmd.Name)
					
					// For additional elements, use a muted color relative to current foreground
					// This ensures they appear dimmer than the main command name
					if cmd.ArgumentHint != "" {
						// Create a dimmed version of the current style for hints
						hintStyle := s.Copy().Foreground(t.Secondary())
						display += " " + hintStyle.Render(cmd.ArgumentHint)
					}
					
					if cmd.Description != "" {
						// Create a more dimmed version for descriptions
						descStyle := s.Copy().Foreground(t.TextMuted())
						display += " " + descStyle.Render("- " + cmd.Description)
					}
					
					return display
				},
				Value:      cmd.Name,
				ProviderID: p.GetId(),
			})
		}
	}

	return matches, nil
}

func (p *CustomCommandsProvider) loadCommands() []CommandInfo {
	var allCommands []CommandInfo
	commandMap := make(map[string]CommandInfo) // To handle overrides (project over global over defaults)

	// Load built-in default commands first
	defaultCommands := p.loadCommandsFromDir(getBuiltInDefaultsDir())
	for _, cmd := range defaultCommands {
		commandMap[cmd.Name] = cmd
	}

	// Load global commands (these override defaults)
	globalCommands := p.loadCommandsFromDir(getGlobalCommandsDir())
	for _, cmd := range globalCommands {
		commandMap[cmd.Name] = cmd
	}

	// Load project commands (these override global and defaults)
	projectCommands := p.loadCommandsFromDir(getProjectCommandsDir())
	for _, cmd := range projectCommands {
		commandMap[cmd.Name] = cmd
	}

	// Convert map back to slice
	for _, cmd := range commandMap {
		allCommands = append(allCommands, cmd)
	}

	return allCommands
}

func getBuiltInDefaultsDir() string {
	// Get the executable path to find built-in defaults
	execPath, err := os.Executable()
	if err != nil {
		slog.Debug("Failed to get executable path", "error", err)
		return ""
	}

	// For development mode, check relative to the executable's directory
	// In production, this will be packaged alongside the binary
	execDir := filepath.Dir(execPath)

	// Try multiple possible locations
	// 1. Development mode: relative to package location
	devPath := filepath.Join(execDir, "..", "..", "packages", "opencode", "src", "commands", "defaults")
	if _, err := os.Stat(devPath); err == nil {
		return devPath
	}

	// 2. Production mode: packaged alongside binary
	prodPath := filepath.Join(execDir, "commands", "defaults")
	if _, err := os.Stat(prodPath); err == nil {
		return prodPath
	}

	// 3. Alternative production mode: in share directory
	sharePath := filepath.Join(execDir, "..", "share", "opencode", "commands", "defaults")
	if _, err := os.Stat(sharePath); err == nil {
		return sharePath
	}

	return ""
}

func getGlobalCommandsDir() string {
	// Get XDG config directory, similar to packages/opencode/src/global/index.ts
	configDir := os.Getenv("XDG_CONFIG_HOME")
	if configDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			slog.Debug("Failed to get user home directory", "error", err)
			return ""
		}
		configDir = filepath.Join(homeDir, ".config")
	}
	return filepath.Join(configDir, "supercode", "commands")
}

func getProjectCommandsDir() string {
	cwd, err := os.Getwd()
	if err != nil {
		slog.Debug("Failed to get working directory", "error", err)
		return ""
	}

	// Find git repository root (like packages/opencode does)
	root := findGitRoot(cwd)
	if root == "" {
		root = cwd // fallback to current directory
	}

	return filepath.Join(root, ".opencode", "commands")
}

func (p *CustomCommandsProvider) loadCommandsFromDir(commandsDir string) []CommandInfo {
	var commands []CommandInfo

	// Check if commands directory exists
	if _, err := os.Stat(commandsDir); err != nil {
		return commands
	}

	filepath.Walk(commandsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if !strings.HasSuffix(path, ".md") {
			return nil
		}

		rel, _ := filepath.Rel(commandsDir, path)
		parts := strings.Split(strings.TrimSuffix(rel, ".md"), string(filepath.Separator))

		var cmdName string
		if len(parts) == 1 {
			// File directly in commands/ directory
			cmdName = "/" + parts[0]
		} else if len(parts) >= 2 {
			// File in subdirectory (namespace)
			cmdName = "/" + parts[0] + ":" + strings.Join(parts[1:], ":")
		}

		if cmdName != "" {
			// Read file content to parse front matter
			content, err := os.ReadFile(path)
			if err != nil {
				slog.Debug("Failed to read command file", "path", path, "error", err)
				// Still add the command without description or argument hint
				commands = append(commands, CommandInfo{
					Name:         cmdName,
					Description:  "",
					ArgumentHint: "",
				})
				return nil
			}

			// Parse front matter to get description
			metadata := parseFrontMatter(content)
			
			commands = append(commands, CommandInfo{
				Name:         cmdName,
				Description:  metadata.Description,
				ArgumentHint: metadata.ArgumentHint,
			})
		}

		return nil
	})

	return commands
}

// findGitRoot walks up the directory tree to find the .git directory
// This matches the logic from packages/opencode/src/app/app.ts
func findGitRoot(startDir string) string {
	dir := startDir
	for {
		gitPath := filepath.Join(dir, ".git")
		if _, err := os.Stat(gitPath); err == nil {
			return dir // Return the directory containing .git
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached the root of the filesystem
			break
		}
		dir = parent
	}
	return "" // No .git found
}

