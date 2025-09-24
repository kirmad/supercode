package dialog

import (
	"context"
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/lithammer/fuzzysearch/fuzzy"
	"github.com/kirmad/supercode/internal/app"
	"github.com/kirmad/supercode/internal/components/list"
	"github.com/kirmad/supercode/internal/components/modal"
	"github.com/kirmad/supercode/internal/layout"
	"github.com/kirmad/supercode/internal/styles"
	"github.com/kirmad/supercode/internal/theme"
	"github.com/kirmad/supercode/internal/util"
)

const (
	numVisibleStyles = 10
	minStyleDialogWidth = 40
	maxStyleDialogWidth = 80
)

// OutputStyleDialog interface for the output style selection dialog
type OutputStyleDialog interface {
	layout.Modal
}

type outputStyleDialog struct {
	app          *app.App
	allStyles    []OutputStyleInfo
	width        int
	height       int
	modal        *modal.Modal
	searchDialog *SearchDialog
	dialogWidth  int
}

type OutputStyleInfo struct {
	Name        string
	Description string
	BuiltIn     bool
	Current     bool
}

// outputStyleItem is a custom list item for output style selections
type outputStyleItem struct {
	style OutputStyleInfo
}

func (m outputStyleItem) Render(
	selected bool,
	width int,
	baseStyle styles.Style,
) string {
	t := theme.CurrentTheme()

	itemStyle := baseStyle.
		Background(t.BackgroundPanel()).
		Foreground(t.Text())

	if selected {
		itemStyle = itemStyle.Foreground(t.Primary())
	}

	typeStyle := baseStyle.
		Foreground(t.TextMuted()).
		Background(t.BackgroundPanel())

	currentStyle := baseStyle.
		Foreground(t.Success()).
		Background(t.BackgroundPanel())

	descStyle := baseStyle.
		Foreground(t.TextMuted()).
		Background(t.BackgroundPanel())

	// Build the display string
	stylePart := itemStyle.Render(m.style.Name)

	// Add type indicator
	typePart := ""
	if m.style.BuiltIn {
		typePart = typeStyle.Render(" [built-in]")
	} else {
		typePart = typeStyle.Render(" [custom]")
	}

	// Add current indicator
	currentPart := ""
	if m.style.Current {
		currentPart = currentStyle.Render(" ✓")
	}

	// Add description if available (on same line, truncated if needed)
	descPart := ""
	if m.style.Description != "" {
		// Calculate available space for description
		usedWidth := len(m.style.Name) + len(" [built-in]") + len(" ✓") + 3
		availableWidth := width - usedWidth

		desc := m.style.Description
		if availableWidth > 10 && len(desc) > 0 {
			if len(desc) > availableWidth {
				desc = desc[:availableWidth-3] + "..."
			}
			descPart = descStyle.Render(" - " + desc)
		}
	}

	combinedText := stylePart + typePart + currentPart + descPart

	return baseStyle.
		Background(t.BackgroundPanel()).
		PaddingLeft(1).
		Render(combinedText)
}

func (m outputStyleItem) Selectable() bool {
	return true
}

type outputStyleKeyMap struct {
	Enter  key.Binding
	Escape key.Binding
}

var outputStyleKeys = outputStyleKeyMap{
	Enter: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "select style"),
	),
	Escape: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "close"),
	),
}

func (m *outputStyleDialog) Init() tea.Cmd {
	m.setupAllStyles()
	return m.searchDialog.Init()
}

func (m *outputStyleDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case SearchSelectionMsg:
		// Handle selection from search dialog
		if item, ok := msg.Item.(outputStyleItem); ok {
			return m, tea.Sequence(
				util.CmdHandler(modal.CloseModalMsg{}),
				util.CmdHandler(
					app.OutputStyleSelectedMsg{
						StyleName: item.style.Name,
					}),
			)
		}
		return m, util.CmdHandler(modal.CloseModalMsg{})
	case SearchCancelledMsg:
		return m, util.CmdHandler(modal.CloseModalMsg{})

	case SearchQueryChangedMsg:
		// Update the list based on search query
		items := m.buildDisplayList(msg.Query)
		m.searchDialog.SetItems(items)
		return m, nil

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.searchDialog.SetWidth(m.dialogWidth)
		m.searchDialog.SetHeight(msg.Height)
	}

	updatedDialog, cmd := m.searchDialog.Update(msg)
	m.searchDialog = updatedDialog.(*SearchDialog)
	return m, cmd
}

func (m *outputStyleDialog) View() string {
	return m.searchDialog.View()
}

func (m *outputStyleDialog) calculateOptimalWidth(styles []OutputStyleInfo) int {
	maxWidth := minStyleDialogWidth

	for _, style := range styles {
		// Calculate the width needed for this item
		itemWidth := len(style.Name) + 15 // Extra space for [built-in] or [custom] and (current)
		if itemWidth > maxWidth {
			maxWidth = itemWidth
		}

		// Also consider description width
		if style.Description != "" && len(style.Description) + 2 > maxWidth {
			maxWidth = len(style.Description) + 2
		}
	}

	if maxWidth > maxStyleDialogWidth {
		maxWidth = maxStyleDialogWidth
	}

	return maxWidth
}

func (m *outputStyleDialog) setupAllStyles() {
	// Fetch output styles from the backend
	styles, err := m.fetchOutputStyles()
	if err != nil {
		// If we can't fetch styles, provide defaults
		m.allStyles = []OutputStyleInfo{
			{Name: "default", Description: "Concise and direct responses", BuiltIn: true},
			{Name: "explanatory", Description: "Educational insights with helpful explanations", BuiltIn: true},
			{Name: "learning", Description: "Learning-focused with detailed explanations", BuiltIn: true},
		}
	} else {
		m.allStyles = styles
	}

	// Mark the current style
	currentStyle := m.getCurrentStyle()
	for i := range m.allStyles {
		m.allStyles[i].Current = m.allStyles[i].Name == currentStyle
	}

	// Calculate optimal width based on all styles
	m.dialogWidth = m.calculateOptimalWidth(m.allStyles)

	// Initialize search dialog
	m.searchDialog = NewSearchDialog("Search output styles...", numVisibleStyles)
	m.searchDialog.SetWidth(m.dialogWidth)

	// Build initial display list
	items := m.buildDisplayList("")
	m.searchDialog.SetItems(items)
}

func (m *outputStyleDialog) fetchOutputStyles() ([]OutputStyleInfo, error) {
	// Make API call to fetch available output styles
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var resp struct {
		Styles []struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			BuiltIn     bool   `json:"builtIn"`
		} `json:"styles"`
	}

	if err := m.app.Client.Get(ctx, "/output-styles", nil, &resp); err != nil {
		return nil, err
	}

	var styles []OutputStyleInfo
	for _, style := range resp.Styles {
		styles = append(styles, OutputStyleInfo{
			Name:        style.Name,
			Description: style.Description,
			BuiltIn:     style.BuiltIn,
		})
	}

	return styles, nil
}

func (m *outputStyleDialog) getCurrentStyle() string {
	// Get the current style from the app state
	if m.app.OutputStyle != "" {
		return m.app.OutputStyle
	}
	return "default"
}

// buildDisplayList creates the list items based on search query
func (m *outputStyleDialog) buildDisplayList(query string) []list.Item {
	if query != "" {
		// Search mode: use fuzzy matching
		return m.buildSearchResults(query)
	} else {
		// Normal mode: show all styles
		return m.buildAllStyles()
	}
}

// buildSearchResults creates a flat list of search results using fuzzy matching
func (m *outputStyleDialog) buildSearchResults(query string) []list.Item {
	styleNames := []string{}
	styleMap := make(map[string]OutputStyleInfo)

	// Create search strings and perform fuzzy matching
	for _, style := range m.allStyles {
		searchStr := fmt.Sprintf("%s %s", style.Name, style.Description)
		styleNames = append(styleNames, searchStr)
		styleMap[searchStr] = style
	}

	matches := fuzzy.RankFindFold(query, styleNames)
	items := []list.Item{}

	for _, match := range matches {
		style := styleMap[match.Target]
		items = append(items, outputStyleItem{style: style})
	}

	return items
}

// buildAllStyles creates a list of all available styles
func (m *outputStyleDialog) buildAllStyles() []list.Item {
	var items []list.Item

	// Add Built-in styles section
	items = append(items, list.HeaderItem("Built-in Styles"))
	for _, style := range m.allStyles {
		if style.BuiltIn {
			items = append(items, outputStyleItem{style: style})
		}
	}

	// Add Custom styles section if any exist
	hasCustom := false
	for _, style := range m.allStyles {
		if !style.BuiltIn {
			hasCustom = true
			break
		}
	}

	if hasCustom {
		items = append(items, list.HeaderItem("Custom Styles"))
		for _, style := range m.allStyles {
			if !style.BuiltIn {
				items = append(items, outputStyleItem{style: style})
			}
		}
	}

	return items
}

func (m *outputStyleDialog) Render(background string) string {
	return m.modal.Render(m.View(), background)
}

func (s *outputStyleDialog) Close() tea.Cmd {
	return nil
}

func NewOutputStyleDialog(app *app.App) OutputStyleDialog {
	dialog := &outputStyleDialog{
		app: app,
	}

	dialog.setupAllStyles()

	dialog.modal = modal.New(
		modal.WithTitle("Select Output Style"),
		modal.WithMaxWidth(dialog.dialogWidth+4),
	)

	return dialog
}