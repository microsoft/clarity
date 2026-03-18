# Clarity
Clarity is an open-source behavioral analytics library written in typescript, with two key goals: privacy & performance. 

It helps you understand how users view and use your website across all modern devices and browsers. Understanding how users navigate, interact and browse your website can provide new insights about your users. Empathizing with your users and seeing where features fail or succeed can help improve your product, grow revenue and improve user retention.

It's the same code that powers Microsoft's hosted behavioral analytics solution: <a href="https://clarity.microsoft.com">https://clarity.microsoft.com</a>. If you would like to see a demo of how it works, checkout <a href="https://clarity.microsoft.com/demo/projects/view/3t0wlogvdz/impressions?date=Last%203%20days">live demo</a>. 

We encourage the community to join us in building the best behavioral analytics library, that puts privacy first and prioritizes performance. 

## Project Structure
1. **[clarity-js](https://github.com/microsoft/clarity/tree/master/packages/clarity-js)**: Instrumentation code that goes on the website and tracks user interactions as well as layout changes.

2. **[clarity-decode](https://github.com/microsoft/clarity/tree/master/packages/clarity-decode)**: Code, which usually runs on the server, decodes incoming data back into its original format.

3. **[clarity-visualize](https://github.com/microsoft/clarity/tree/master/packages/clarity-visualize)**: It takes the decoded data from clarity-decode and turns it back into pixel-perfect session replay.

4. **[clarity-devtools](https://github.com/microsoft/clarity/tree/master/packages/clarity-devtools)**: Devtools extension for chromium based browsers to generate live captures against any website.

## Releasing new version
1. **Bump Version**
   ```bash
   yarn bump-version
   ```

2. **Submit Changes**
    * Commit updated files
    * Push changes
    * Create PR

3. **Automated Release**
    * After PR approval and merge
    * GitHub Actions publishes to npmjs.org automatically

## Examples
Here are some example sessions on popular websites visualized to demonstrate the telemetry captured:
1. CNN (Web)
</br><a href="https://thumbs.gfycat.com/AggressiveLankyAbyssiniangroundhornbill-size_restricted.gif"><img src="https://thumbs.gfycat.com/AggressiveLankyAbyssiniangroundhornbill-size_restricted.gif" title="Clarity - CNN Example"/></a>

2. Cook with Manali (Mobile)
</br><a href="https://thumbs.gfycat.com/CoolDependableAdamsstaghornedbeetle-size_restricted.gif"><img src="https://thumbs.gfycat.com/CoolDependableAdamsstaghornedbeetle-size_restricted.gif" title="Clarity - Cook With Manali Example"/></a> 

## Privacy Notice
Clarity handles sensitive data with care. By default sensitive content on the page is masked before uploading to the server. Additionally, Clarity offers several masking configuration options to ensure you are in full control of your data.

## Claude Code Setup (Optional)
If you're using [Claude Code](https://claude.ai/claude-code) for development, this repository includes MCP (Model Context Protocol) server configuration for enhanced Git operations.

### Prerequisites
1. Install Python 3:
   ```bash
   python3 --version  # Verify installation
   ```

2. Install the Git MCP Server:
   ```bash
   pip3 install mcp-server-git
   ```

### Enable MCP Server
The repository includes a `.mcp.json` file that configures the Git MCP server. To enable it:

**Option 1: Auto-enable (Recommended)**
Add to your `.claude/settings.local.json`:
```json
{
  "enableAllProjectMcpServers": true
}
```

**Option 2: Explicit approval**
Claude Code will prompt you to approve the MCP server on first use.

### What It Provides
Once configured, Claude gains access to powerful Git operations:
- View commit history and diffs
- Inspect working tree status
- Create branches and commits
- Compare changes between branches
- And more Git operations through natural language

## Improving Clarity
If you haven't already done so, start contributing by following instructions **[here](https://github.com/microsoft/clarity/blob/master/CONTRIBUTING.md)**.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

Happy coding!
