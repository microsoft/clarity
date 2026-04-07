# MCP Server Setup

This repository includes a Git MCP (Model Context Protocol) server that gives AI coding agents enhanced Git operations — commit history, diffs, blame, branch management — through natural language.

## Prerequisites

1. **Python 3** — verify with `python3 --version`
2. **mcp-server-git** — install with:
   ```bash
   pip3 install mcp-server-git
   ```

## Claude Code

The repository includes a `.mcp.json` file that configures the server automatically.

**Option 1: Auto-enable (Recommended)**
Add to your `.claude/settings.local.json`:
```json
{
  "enableAllProjectMcpServers": true
}
```

**Option 2: Explicit approval**
Claude Code will prompt you to approve the MCP server on first use.

## GitHub Copilot (VS Code)

The repository includes `.vscode/mcp.json` which configures the server for Copilot agent mode. No setup required — VS Code 1.99+ will pick it up automatically when you open the repo.

## OpenAI Codex CLI

Codex CLI (Rust version) manages MCP servers via its CLI. Run once after installing Codex:
```bash
codex mcp add git-clarity -- python -m mcp_server_git --repository .
```
This writes the config to `~/.codex/config.toml`.
