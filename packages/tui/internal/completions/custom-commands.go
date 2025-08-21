package completions

import (
	"github.com/kirmad/supercode/internal/styles"
	"github.com/kirmad/supercode/internal/theme"
	"gopkg.in/yaml.v3"
	"io/ioutil"
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
					display := "  " + s.Foreground(t.Primary()).Render(cmd.Name)
					
					// Add argument hint if present
					if cmd.ArgumentHint != "" {
						display += " " + s.Foreground(t.Secondary()).Render(cmd.ArgumentHint)
					}
					
					// Add description if present
					if cmd.Description != "" {
						display += " " + s.Foreground(t.TextMuted()).Render("- " + cmd.Description)
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
	cwd, err := os.Getwd()
	if err != nil {
		slog.Debug("Failed to get working directory", "error", err)
		return []CommandInfo{}
	}

	// Find git repository root (like packages/opencode does)
	root := findGitRoot(cwd)
	if root == "" {
		root = cwd // fallback to current directory
	}

	commandsDir := filepath.Join(root, ".opencode", "commands")

	// Check if commands directory exists
	if _, err := os.Stat(commandsDir); err != nil {
		return []CommandInfo{}
	}

	var commands []CommandInfo

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
			content, err := ioutil.ReadFile(path)
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

