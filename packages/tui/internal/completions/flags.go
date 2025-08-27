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

type FlagsProvider struct{}

type FlagMetadata struct {
	Description string `yaml:"description"`
	Signature   string `yaml:"signature"`
	Placement   string `yaml:"placement"`
}

type FlagInfo struct {
	Name        string
	Description string
	Signature   string
	Placement   string
}

func NewFlagsProvider() *FlagsProvider {
	return &FlagsProvider{}
}

func parseFlagFrontMatter(content []byte) FlagMetadata {
	var metadata FlagMetadata
	
	// Set default placement
	metadata.Placement = "replace"
	
	// Regex to match front matter between --- delimiters
	frontMatterRegex := regexp.MustCompile(`^---\r?\n([\s\S]*?)\r?\n---\r?\n`)
	matches := frontMatterRegex.FindSubmatch(content)
	
	if len(matches) < 2 {
		return metadata // Return default metadata if no front matter found
	}
	
	yamlContent := matches[1]
	
	// Parse YAML front matter
	err := yaml.Unmarshal(yamlContent, &metadata)
	if err != nil {
		slog.Debug("Failed to parse flag front matter YAML", "error", err)
		return FlagMetadata{Placement: "replace"} // Return default metadata on error
	}
	
	return metadata
}

func (p *FlagsProvider) GetId() string {
	return "flags"
}

func (p *FlagsProvider) GetEmptyMessage() string {
	return "no flags available"
}

func (p *FlagsProvider) GetChildEntries(query string) ([]CompletionSuggestion, error) {
	// Load flags dynamically to pick up new files
	flags := p.loadFlags()

	var matches []CompletionSuggestion
	for _, flag := range flags {
		if query == "" || strings.Contains(flag.Name, query) || strings.Contains(flag.Signature, query) {
			matches = append(matches, CompletionSuggestion{
				Display: func(s styles.Style) string {
					t := theme.CurrentTheme()
					
					// Use signature if available, otherwise construct from name
					displayName := flag.Signature
					if displayName == "" {
						displayName = flag.Name
					}
					
					// Use the passed-in style for the main flag name to respect selection highlighting
					display := "  " + s.Render(displayName)
					
					// Add placement indicator using muted colors relative to current style
					if flag.Placement != "" {
						// Use a slightly muted version of the current style's foreground color
						mutedStyle := s.Foreground(t.TextMuted())
						display += " " + mutedStyle.Render("[" + flag.Placement + "]")
					}
					
					// Add description using muted colors relative to current style
					if flag.Description != "" {
						mutedStyle := s.Foreground(t.TextMuted())
						display += " " + mutedStyle.Render("- " + flag.Description)
					}
					
					return display
				},
				Value:      flag.Name, // Use the flag name for completion value
				ProviderID: p.GetId(),
			})
		}
	}

	return matches, nil
}

func (p *FlagsProvider) loadFlags() []FlagInfo {
	var allFlags []FlagInfo
	flagMap := make(map[string]FlagInfo) // To handle overrides (project over global)

	// Load global flags first
	globalFlags := p.loadFlagsFromDir(getGlobalFlagsDir())
	for _, flag := range globalFlags {
		flagMap[flag.Name] = flag
	}

	// Load project flags (these override global ones)
	projectFlags := p.loadFlagsFromDir(getProjectFlagsDir())
	for _, flag := range projectFlags {
		flagMap[flag.Name] = flag
	}

	// Convert map back to slice
	for _, flag := range flagMap {
		allFlags = append(allFlags, flag)
	}

	return allFlags
}

func getGlobalFlagsDir() string {
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
	return filepath.Join(configDir, "supercode", "flags")
}

func getProjectFlagsDir() string {
	cwd, err := os.Getwd()
	if err != nil {
		slog.Debug("Failed to get working directory", "error", err)
		return ""
	}

	// Find git repository root
	root := findGitRoot(cwd)
	if root == "" {
		root = cwd // fallback to current directory
	}

	return filepath.Join(root, ".opencode", "flags")
}

func (p *FlagsProvider) loadFlagsFromDir(flagsDir string) []FlagInfo {
	var flags []FlagInfo

	// Check if flags directory exists
	if _, err := os.Stat(flagsDir); err != nil {
		return flags
	}

	filepath.Walk(flagsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if !strings.HasSuffix(path, ".md") {
			return nil
		}

		rel, _ := filepath.Rel(flagsDir, path)
		parts := strings.Split(strings.TrimSuffix(rel, ".md"), string(filepath.Separator))

		var flagName string
		if len(parts) == 1 {
			// File directly in flags/ directory
			flagName = "--" + parts[0]
		} else if len(parts) >= 2 {
			// File in subdirectory (namespace)
			flagName = "--" + parts[0] + ":" + strings.Join(parts[1:], ":")
		}

		if flagName != "" {
			// Read file content to parse front matter
			content, err := ioutil.ReadFile(path)
			if err != nil {
				slog.Debug("Failed to read flag file", "path", path, "error", err)
				// Still add the flag without description or other metadata
				flags = append(flags, FlagInfo{
					Name:        flagName,
					Description: "",
					Signature:   "",
					Placement:   "replace",
				})
				return nil
			}

			// Parse front matter to get metadata
			metadata := parseFlagFrontMatter(content)
			
			// Use signature from metadata if available, otherwise use constructed name
			signature := metadata.Signature
			if signature == "" {
				signature = flagName
			}
			
			flags = append(flags, FlagInfo{
				Name:        flagName,
				Description: metadata.Description,
				Signature:   signature,
				Placement:   metadata.Placement,
			})
		}

		return nil
	})

	return flags
}

