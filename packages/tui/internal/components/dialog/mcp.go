package dialog

import (
	"context"
	"sort"

	"github.com/charmbracelet/bubbles/v2/key"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/components/list"
	"github.com/sst/opencode/internal/components/modal"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

const (
	numVisibleMCPServers = 10
	minMCPDialogWidth    = 50
	maxMCPDialogWidth    = 80
)

// MCPDialog interface for the MCP server list dialog
type MCPDialog interface {
	layout.Modal
}

type mcpDialog struct {
	app         *app.App
	allServers  []app.MCPServer
	width       int
	height      int
	modal       *modal.Modal
	searchDialog *SearchDialog
	dialogWidth int
}

// mcpItem is a custom list item for MCP server display
type mcpItem struct {
	server app.MCPServer
}

func (m mcpItem) Render(
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

	// Status indicator
	statusStyle := baseStyle.Background(t.BackgroundPanel())
	var status string
	if !m.server.Enabled {
		status = "❌"
		statusStyle = statusStyle.Foreground(t.TextMuted())
	} else if m.server.Connected {
		status = "✅"
		statusStyle = statusStyle.Foreground(t.Success())
	} else {
		status = "❌"
		statusStyle = statusStyle.Foreground(t.Error())
	}

	typeStyle := baseStyle.
		Foreground(t.TextMuted()).
		Background(t.BackgroundPanel())

	var typeInfo string
	if m.server.Type == "local" {
		typeInfo = " (local)"
	} else {
		typeInfo = " (remote)"
	}

	statusPart := statusStyle.Render(status)
	namePart := itemStyle.Render(" " + m.server.Name)
	typePart := typeStyle.Render(typeInfo)

	combinedText := statusPart + namePart + typePart
	return baseStyle.
		Background(t.BackgroundPanel()).
		PaddingLeft(1).
		Render(combinedText)
}

func (m mcpItem) Selectable() bool {
	return false // MCP items are not selectable, this is just for viewing status
}

type mcpKeyMap struct {
	Escape key.Binding
}

var mcpKeys = mcpKeyMap{
	Escape: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "close"),
	),
}

func (m *mcpDialog) Init() tea.Cmd {
	m.setupAllServers()
	return m.searchDialog.Init()
}

func (m *mcpDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
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

func (m *mcpDialog) View() string {
	return m.searchDialog.View()
}

func (m *mcpDialog) calculateOptimalWidth(servers []app.MCPServer) int {
	maxWidth := minMCPDialogWidth

	for _, server := range servers {
		// Calculate the width needed for this item: "status server_name (type)"
		// Add some padding for status icon and parentheses
		itemWidth := len(server.Name) + len(server.Type) + 10
		if itemWidth > maxWidth {
			maxWidth = itemWidth
		}
	}

	if maxWidth > maxMCPDialogWidth {
		maxWidth = maxMCPDialogWidth
	}

	return maxWidth
}

func (m *mcpDialog) setupAllServers() {
	servers, err := m.app.ListMCPServers(context.Background())
	if err != nil {
		// Handle error - could show a toast or fallback to empty list
		m.allServers = make([]app.MCPServer, 0)
	} else {
		m.allServers = servers
	}

	m.sortServers()

	// Calculate optimal width based on all servers
	m.dialogWidth = m.calculateOptimalWidth(m.allServers)

	// Initialize search dialog
	m.searchDialog = NewSearchDialog("Search MCP servers...", numVisibleMCPServers)
	m.searchDialog.SetWidth(m.dialogWidth)

	// Build initial display list (empty query shows all servers)
	items := m.buildDisplayList("")
	m.searchDialog.SetItems(items)
}

func (m *mcpDialog) sortServers() {
	sort.Slice(m.allServers, func(i, j int) bool {
		serverA := m.allServers[i]
		serverB := m.allServers[j]

		// Sort by connection status first (connected first)
		if serverA.Connected && !serverB.Connected {
			return true
		}
		if !serverA.Connected && serverB.Connected {
			return false
		}

		// Then by enabled status
		if serverA.Enabled && !serverB.Enabled {
			return true
		}
		if !serverA.Enabled && serverB.Enabled {
			return false
		}

		// Finally alphabetically by name
		return serverA.Name < serverB.Name
	})
}

// buildDisplayList creates the list items based on search query
func (m *mcpDialog) buildDisplayList(query string) []list.Item {
	var items []list.Item

	// Filter servers based on search query
	filteredServers := m.allServers
	if query != "" {
		filteredServers = make([]app.MCPServer, 0)
		for _, server := range m.allServers {
			// Simple case-insensitive substring search
			if contains(server.Name, query) || contains(server.Type, query) {
				filteredServers = append(filteredServers, server)
			}
		}
	}

	// Add server items
	for _, server := range filteredServers {
		items = append(items, mcpItem{server: server})
	}

	return items
}

// Simple case-insensitive contains check
func contains(s, substr string) bool {
	return len(s) >= len(substr) && 
		   (s == substr || 
		    (len(s) > len(substr) && 
		     (s[:len(substr)] == substr || 
		      s[len(s)-len(substr):] == substr ||
		      containsSubstring(s, substr))))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func (m *mcpDialog) Render(background string) string {
	return m.modal.Render(m.View(), background)
}

func (s *mcpDialog) Close() tea.Cmd {
	return nil
}

func NewMCPDialog(app *app.App) MCPDialog {
	dialog := &mcpDialog{
		app: app,
	}

	dialog.setupAllServers()

	dialog.modal = modal.New(
		modal.WithTitle("MCP Servers"),
		modal.WithMaxWidth(dialog.dialogWidth+4),
	)

	return dialog
}