package completions

import (
	"github.com/kirmad/supercode/internal/styles"
	"github.com/kirmad/supercode/internal/theme"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

type CustomCommandsProvider struct{}

func NewCustomCommandsProvider() *CustomCommandsProvider {
	return &CustomCommandsProvider{}
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
		if query == "" || strings.Contains(cmd, query) {
			matches = append(matches, CompletionSuggestion{
				Display: func(s styles.Style) string {
					t := theme.CurrentTheme()
					return "  " + s.Foreground(t.Primary()).Render(cmd)
				},
				Value:      cmd,
				ProviderID: p.GetId(),
			})
		}
	}

	return matches, nil
}

func (p *CustomCommandsProvider) loadCommands() []string {
	cwd, err := os.Getwd()
	if err != nil {
		slog.Debug("Failed to get working directory", "error", err)
		return []string{}
	}

	// Find git repository root (like packages/opencode does)
	root := findGitRoot(cwd)
	if root == "" {
		root = cwd // fallback to current directory
	}

	commandsDir := filepath.Join(root, ".opencode", "commands")

	// Check if commands directory exists
	if _, err := os.Stat(commandsDir); err != nil {
		return []string{}
	}

	var commands []string

	filepath.Walk(commandsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if !strings.HasSuffix(path, ".md") {
			return nil
		}

		rel, _ := filepath.Rel(commandsDir, path)
		parts := strings.Split(strings.TrimSuffix(rel, ".md"), string(filepath.Separator))

		var cmd string
		if len(parts) == 1 {
			// File directly in commands/ directory
			cmd = "/" + parts[0]
		} else if len(parts) >= 2 {
			// File in subdirectory (namespace)
			cmd = "/" + parts[0] + ":" + strings.Join(parts[1:], ":")
		}

		if cmd != "" {
			commands = append(commands, cmd)
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

