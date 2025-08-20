package app

import (
	"context"
)

// MCPServer represents an MCP server configuration and status
// This is a new file to avoid modifying existing app.go
type MCPServer struct {
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	Enabled   bool     `json:"enabled"`
	Connected bool     `json:"connected"`
	URL       *string  `json:"url,omitempty"`
	Command   []string `json:"command,omitempty"`
}

// MCPResponse represents the response from the MCP status endpoint
type MCPResponse struct {
	Servers []MCPServer `json:"servers"`
}

// ListMCPServers retrieves the list of MCP servers and their status
// This extends the App functionality without modifying the main file
func (a *App) ListMCPServers(ctx context.Context) ([]MCPServer, error) {
	// Make HTTP call directly using the SDK's Get method
	// TODO: Replace with a.Client.Config.Mcp(ctx) once SDK is regenerated
	response := &MCPResponse{}
	err := a.Client.Get(ctx, "config/mcp", nil, response)
	if err != nil {
		return nil, err
	}
	
	return response.Servers, nil
}