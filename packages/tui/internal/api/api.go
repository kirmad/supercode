package api

import (
	"context"
	"encoding/json"
	"log"

	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/sst/opencode-sdk-go"
)

type Request struct {
	Path string          `json:"path"`
	Body json.RawMessage `json:"body"`
}

func Start(ctx context.Context, program *tea.Program, client *opencode.Client) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			var req Request
			if err := client.Get(ctx, "/tui/control/next", nil, &req); err != nil {
				log.Printf("Error getting next request: %v", err)
				continue
			}
			program.Send(req)
		}
	}
}

func Reply(ctx context.Context, client *opencode.Client, response interface{}) tea.Cmd {
	return func() tea.Msg {
		err := client.Post(ctx, "/tui/control/response", response, nil)
		if err != nil {
			return err
		}
		return nil
	}
}

// NotifyModelChange notifies the server that the model has changed (internal API)
func NotifyModelChange(ctx context.Context, client *opencode.Client, providerID, modelID, providerName, modelName string) tea.Cmd {
	return func() tea.Msg {
		payload := map[string]interface{}{
			"providerID": providerID,
			"modelID":    modelID,
		}
		if providerName != "" {
			payload["providerName"] = providerName
		}
		if modelName != "" {
			payload["modelName"] = modelName
		}
		
		err := client.Post(ctx, "/tui/notify-model-changed", payload, nil)
		if err != nil {
			log.Printf("Error notifying model change: %v", err)
		}
		return nil
	}
}

// NotifyAgentChange notifies the server that the agent has changed (internal API)
func NotifyAgentChange(ctx context.Context, client *opencode.Client, agentName, displayName string) tea.Cmd {
	return func() tea.Msg {
		payload := map[string]interface{}{
			"agentName": agentName,
		}
		if displayName != "" {
			payload["displayName"] = displayName
		}
		
		err := client.Post(ctx, "/tui/notify-agent-changed", payload, nil)
		if err != nil {
			log.Printf("Error notifying agent change: %v", err)
		}
		return nil
	}
}
