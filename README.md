[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/ogoldberg-gemini-context-mcp-server-badge.png)](https://mseep.ai/app/ogoldberg-gemini-context-mcp-server)

# Gemini Context MCP Server

A powerful MCP (Model Context Protocol) server implementation that leverages Gemini's capabilities for context management and caching. This server maximizes the value of Gemini's 2M token context window while providing tools for efficient caching of large contexts.

## 🚀 Features

### Context Management
- **Up to 2M token context window support** - Leverage Gemini's extensive context capabilities
- **Session-based conversations** - Maintain conversational state across multiple interactions
- **Smart context tracking** - Add, retrieve, and search context with metadata
- **Semantic search** - Find relevant context using semantic similarity
- **Automatic context cleanup** - Sessions and context expire automatically

### API Caching
- **Large prompt caching** - Efficiently reuse large system prompts and instructions
- **Cost optimization** - Reduce token usage costs for frequently used contexts
- **TTL management** - Control cache expiration times
- **Automatic cleanup** - Expired caches are removed automatically

## 🏁 Quick Start

### Prerequisites
- Node.js 18+ installed
- Gemini API key ([Get one here](https://ai.google.dev/))

### Installation

```bash
# Clone the repository
git clone https://github.com/ogoldberg/gemini-context-mcp-server
cd gemini-context-mcp-server

# Install dependencies
npm install

# Copy environment variables example
cp .env.example .env

# Add your Gemini API key to .env file
# GEMINI_API_KEY=your_api_key_here
```

### Basic Usage

```bash
# Build the server
npm run build

# Start the server
node dist/mcp-server.js
```

### MCP Client Integration

This MCP server can be integrated with various MCP-compatible clients:

- **Claude Desktop** - Add as an MCP server in Claude settings
- **Cursor** - Configure in Cursor's AI/MCP settings
- **VS Code** - Use with MCP-compatible extensions

For detailed integration instructions with each client, see the [MCP Client Configuration Guide](README-MCP.md#-configuring-with-popular-mcp-clients) in the MCP documentation.

#### Quick Client Setup

Use our simplified client installation commands:

```bash
# Install and configure for Claude Desktop
npm run install:claude

# Install and configure for Cursor
npm run install:cursor

# Install and configure for VS Code
npm run install:vscode
```

Each command sets up the appropriate configuration files and provides instructions for completing the integration.

## 💻 Usage Examples

### For Beginners

#### Directly using the server:

1. **Start the server:**
   ```bash
   node dist/mcp-server.js
   ```

2. **Interact using the provided test scripts:**
   ```bash
   # Test basic context management
   node test-gemini-context.js
   
   # Test caching features
   node test-gemini-api-cache.js
   ```

#### Using in your Node.js application:

```javascript
import { GeminiContextServer } from './src/gemini-context-server.js';

async function main() {
  // Create server instance
  const server = new GeminiContextServer();
  
  // Generate a response in a session
  const sessionId = "user-123";
  const response = await server.processMessage(sessionId, "What is machine learning?");
  console.log("Response:", response);
  
  // Ask a follow-up in the same session (maintains context)
  const followUp = await server.processMessage(sessionId, "What are popular algorithms?");
  console.log("Follow-up:", followUp);
}

main();
```

### For Power Users

#### Using custom configurations:

```javascript
// Custom configuration
const config = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-pro',
    temperature: 0.2,
    maxOutputTokens: 1024,
  },
  server: {
    sessionTimeoutMinutes: 30,
    maxTokensPerSession: 1000000
  }
};

const server = new GeminiContextServer(config);
```

#### Using the caching system for cost optimization:

```javascript
// Create a cache for large system instructions
const cacheName = await server.createCache(
  'Technical Support System',
  'You are a technical support assistant for a software company...',
  7200 // 2 hour TTL
);

// Generate content using the cache
const response = await server.generateWithCache(
  cacheName,
  'How do I reset my password?'
);

// Clean up when done
await server.deleteCache(cacheName);
```

## 🔌 Using with MCP Tools (like Cursor)

This server implements the Model Context Protocol (MCP), making it compatible with tools like Cursor or other AI-enhanced development environments.

### Available MCP Tools

1. **Context Management Tools:**
   - `generate_text` - Generate text with context
   - `get_context` - Get current context for a session
   - `clear_context` - Clear session context
   - `add_context` - Add specific context entries
   - `search_context` - Find relevant context semantically

2. **Caching Tools:**
   - `mcp_gemini_context_create_cache` - Create a cache for large contexts
   - `mcp_gemini_context_generate_with_cache` - Generate with cached context
   - `mcp_gemini_context_list_caches` - List all available caches
   - `mcp_gemini_context_update_cache_ttl` - Update cache TTL
   - `mcp_gemini_context_delete_cache` - Delete a cache

### Connecting with Cursor

When used with [Cursor](https://cursor.sh/), you can connect via the MCP configuration:

```json
{
  "name": "gemini-context",
  "version": "1.0.0",
  "description": "Gemini context management and caching MCP server",
  "entrypoint": "dist/mcp-server.js",
  "capabilities": {
    "tools": true
  },
  "manifestPath": "mcp-manifest.json",
  "documentation": "README-MCP.md"
}
```

For detailed usage instructions for MCP tools, see [README-MCP.md](README-MCP.md).

## ⚙️ Configuration Options

### Environment Variables

Create a `.env` file with these options:

```bash
# Required
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.0-flash

# Optional - Model Settings
GEMINI_TEMPERATURE=0.7
GEMINI_TOP_K=40
GEMINI_TOP_P=0.9
GEMINI_MAX_OUTPUT_TOKENS=2097152

# Optional - Server Settings
MAX_SESSIONS=50
SESSION_TIMEOUT_MINUTES=120
MAX_MESSAGE_LENGTH=1000000
MAX_TOKENS_PER_SESSION=2097152
DEBUG=false
```

## 🧪 Development

```bash
# Build TypeScript files
npm run build

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test
```

## 📚 Further Reading

- For MCP-specific usage, see [README-MCP.md](README-MCP.md)
- Explore the manifest in [mcp-manifest.json](mcp-manifest.json) to understand available tools
- Check example scripts in the repository for usage patterns

## 📋 Future Improvements

- Database persistence for context and caches
- Cache size management and eviction policies
- Vector-based semantic search
- Analytics and metrics tracking
- Integration with vector stores
- Batch operations for context management
- Hybrid caching strategies
- Automatic prompt optimization

## 📄 License

MIT
