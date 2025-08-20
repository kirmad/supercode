package commands

// MCP command definitions for the TUI
// This is a new file to avoid modifying existing command.go

const (
	MCPListCommand CommandName = "mcp_list"
)

// mcpCommands returns MCP-specific commands to extend the default registry
func mcpCommands() []Command {
	return []Command{
		{
			Name:        MCPListCommand,
			Description: "list MCP servers",
			Keybindings: parseBindings("<leader>p"),
			Trigger:     []string{"mcp", "servers"},
		},
	}
}

// extendRegistryWithMCP adds MCP commands to an existing registry
func extendRegistryWithMCP(registry CommandRegistry) {
	for _, command := range mcpCommands() {
		registry[command.Name] = command
	}
}