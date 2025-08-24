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
					
					display := "  " + s.Foreground(t.Primary()).Render(displayName)
					
					// Add placement indicator
					if flag.Placement != "" {
						display += " " + s.Foreground(t.Secondary()).Render("[" + flag.Placement + "]")
					}
					
					// Add description if present
					if flag.Description != "" {
						display += " " + s.Foreground(t.TextMuted()).Render("- " + flag.Description)
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
	cwd, err := os.Getwd()
	if err != nil {
		slog.Debug("Failed to get working directory", "error", err)
		return []FlagInfo{}
	}

	// Find git repository root
	root := findGitRoot(cwd)
	if root == "" {
		root = cwd // fallback to current directory
	}

	flagsDir := filepath.Join(root, ".opencode", "flags")

	// Check if flags directory exists
	if _, err := os.Stat(flagsDir); err != nil {
		return []FlagInfo{}
	}

	var flags []FlagInfo

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