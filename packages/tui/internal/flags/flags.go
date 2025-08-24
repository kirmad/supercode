package flags

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/charmbracelet/lipgloss/v2/compat"
	"github.com/kirmad/supercode/internal/app"
	"github.com/kirmad/supercode/internal/styles"
	"github.com/kirmad/supercode/internal/theme"
	"github.com/kirmad/supercode/internal/util"
)

type FlagsComponent interface {
	tea.ViewModel
	SetSize(width, height int) tea.Cmd
	SetBackgroundColor(color compat.AdaptiveColor)
}

type flagsComponent struct {
	app           *app.App
	width, height int
	showKeybinds  bool
	showAll       bool
	showVscode    bool
	background    *compat.AdaptiveColor
	limit         *int
}

type FlagMetadata struct {
	Description string `json:"description"`
	Signature   string `json:"signature"`
	Placement   string `json:"placement"`
}

type Flag struct {
	Name        string
	Namespace   string
	Description string
	Signature   string
	Placement   string
	FilePath    string
}

func (c *flagsComponent) SetSize(width, height int) tea.Cmd {
	c.width = width
	c.height = height
	return nil
}

func (c *flagsComponent) SetBackgroundColor(color compat.AdaptiveColor) {
	c.background = &color
}

func (c *flagsComponent) View() string {
	t := theme.CurrentTheme()

	flagStyle := styles.NewStyle().Foreground(t.Primary()).Bold(true)
	descriptionStyle := styles.NewStyle().Foreground(t.Text())
	placementStyle := styles.NewStyle().Foreground(t.TextMuted())

	if c.background != nil {
		flagStyle = flagStyle.Background(*c.background)
		descriptionStyle = descriptionStyle.Background(*c.background)
		placementStyle = placementStyle.Background(*c.background)
	}

	flags := c.loadFlags()

	if len(flags) == 0 {
		muted := styles.NewStyle().Foreground(theme.CurrentTheme().TextMuted())
		if c.background != nil {
			muted = muted.Background(*c.background)
		}
		return muted.Render("No flags available")
	}

	if c.limit != nil && len(flags) > *c.limit {
		flags = flags[:*c.limit]
	}

	// Calculate column widths
	maxFlagWidth := 0
	maxDescriptionWidth := 0
	maxPlacementWidth := 0

	// Prepare flag data
	type flagRow struct {
		flag        string
		description string
		placement   string
	}

	rows := make([]flagRow, 0, len(flags))

	for _, flag := range flags {
		flagSignature := flag.Signature
		if flagSignature == "" {
			if flag.Namespace != "" {
				flagSignature = "--" + flag.Namespace + ":" + flag.Name
			} else {
				flagSignature = "--" + flag.Name
			}
		}
		
		description := flag.Description
		if description == "" {
			description = "No description available"
		}

		placement := flag.Placement
		if placement == "" {
			placement = "replace"
		}

		rows = append(rows, flagRow{
			flag:        flagSignature,
			description: description,
			placement:   "[" + placement + "]",
		})

		// Update max widths
		if len(flagSignature) > maxFlagWidth {
			maxFlagWidth = len(flagSignature)
		}
		if len(description) > maxDescriptionWidth {
			maxDescriptionWidth = len(description)
		}
		if len(placement)+2 > maxPlacementWidth { // +2 for brackets
			maxPlacementWidth = len(placement) + 2
		}
	}

	// Add padding between columns
	columnPadding := 3

	// Build the output
	var output strings.Builder

	maxWidth := 0
	for _, row := range rows {
		// Pad each column to align properly
		flag := fmt.Sprintf("%-*s", maxFlagWidth, row.flag)
		description := fmt.Sprintf("%-*s", maxDescriptionWidth, row.description)

		// Apply styles and combine
		line := flagStyle.Render(flag) +
			flagStyle.Render(strings.Repeat(" ", columnPadding)) +
			descriptionStyle.Render(description) +
			placementStyle.Render(strings.Repeat(" ", columnPadding)) +
			placementStyle.Render(row.placement)

		output.WriteString(line + "\n")
		maxWidth = max(maxWidth, lipgloss.Width(line))
	}

	// Remove trailing newline
	result := strings.TrimSuffix(output.String(), "\n")
	if c.background != nil {
		result = styles.NewStyle().Background(*c.background).Width(maxWidth).Render(result)
	}

	return result
}

func (c *flagsComponent) loadFlags() []Flag {
	flags := []Flag{}

	// Get flags directory path
	flagsDir := filepath.Join(c.app.Path.Root, ".opencode", "flags")

	// Check if flags directory exists
	if _, err := os.Stat(flagsDir); os.IsNotExist(err) {
		return flags
	}

	// Walk through the flags directory
	err := filepath.Walk(flagsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue on errors
		}

		// Only process .md files
		if !strings.HasSuffix(info.Name(), ".md") {
			return nil
		}

		// Calculate relative path from flags directory
		relPath, err := filepath.Rel(flagsDir, path)
		if err != nil {
			return nil
		}

		// Parse namespace and flag name
		var namespace, flagName string
		
		if strings.Contains(relPath, string(os.PathSeparator)) {
			// Namespaced flag
			parts := strings.Split(relPath, string(os.PathSeparator))
			namespace = strings.Join(parts[:len(parts)-1], ":")
			flagName = strings.TrimSuffix(parts[len(parts)-1], ".md")
		} else {
			// Root level flag
			flagName = strings.TrimSuffix(relPath, ".md")
		}

		// Read and parse flag file
		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		metadata, _ := parseFrontMatter(string(content))

		flag := Flag{
			Name:        flagName,
			Namespace:   namespace,
			Description: metadata.Description,
			Signature:   metadata.Signature,
			Placement:   metadata.Placement,
			FilePath:    path,
		}

		flags = append(flags, flag)

		return nil
	})

	if err != nil {
		// Return empty slice on error
		return []Flag{}
	}

	return flags
}

func parseFrontMatter(content string) (FlagMetadata, string) {
	frontMatterRegex := regexp.MustCompile(`^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$`)
	matches := frontMatterRegex.FindStringSubmatch(content)
	
	metadata := FlagMetadata{
		Placement: "replace", // default
	}
	
	if len(matches) < 3 {
		return metadata, content
	}

	yamlContent := matches[1]
	markdownContent := matches[2]

	// Simple YAML parser for basic key-value pairs
	lines := strings.Split(yamlContent, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		
		colonIndex := strings.Index(trimmed, ":")
		if colonIndex == -1 {
			continue
		}
		
		key := strings.TrimSpace(trimmed[:colonIndex])
		value := strings.TrimSpace(trimmed[colonIndex+1:])
		
		// Remove quotes if present
		if (strings.HasPrefix(value, `"`) && strings.HasSuffix(value, `"`)) ||
		   (strings.HasPrefix(value, `'`) && strings.HasSuffix(value, `'`)) {
			value = value[1 : len(value)-1]
		}
		
		switch key {
		case "description":
			metadata.Description = value
		case "signature":
			metadata.Signature = value
		case "placement":
			metadata.Placement = value
		}
	}

	return metadata, markdownContent
}

type Option func(*flagsComponent)

func WithKeybinds(show bool) Option {
	return func(c *flagsComponent) {
		c.showKeybinds = show
	}
}

func WithBackground(background compat.AdaptiveColor) Option {
	return func(c *flagsComponent) {
		c.background = &background
	}
}

func WithLimit(limit int) Option {
	return func(c *flagsComponent) {
		c.limit = &limit
	}
}

func WithShowAll(showAll bool) Option {
	return func(c *flagsComponent) {
		c.showAll = showAll
	}
}

func WithVscode(showVscode bool) Option {
	return func(c *flagsComponent) {
		c.showVscode = showVscode
	}
}

func New(app *app.App, opts ...Option) FlagsComponent {
	c := &flagsComponent{
		app:          app,
		background:   nil,
		showKeybinds: true,
		showAll:      false,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}