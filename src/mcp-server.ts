import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { GeminiContextServer } from './gemini-context-server.js';
import { Logger } from './utils/logger.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Parse command line arguments
const args = process.argv.slice(2);
const httpMode = args.includes('--http');
const portIndex = args.indexOf('--port');
const port = portIndex !== -1 && portIndex + 1 < args.length ? parseInt(args[portIndex + 1], 10) : 3000;

// Fallback manifest in case file loading fails
const FALLBACK_MANIFEST = {
    "name": "gemini-context",
    "version": "1.0.0",
    "description": "MCP server for adding Gemini context management with both session-based context and API caching",
    "capabilities": {
        "tools": true
    },
    "tools": [
        {
            "name": "mcp_gemini_context_generate_text",
            "description": "Generate text using Gemini with context management",
            "parameters": {
                "sessionId": {
                    "type": "string",
                    "description": "Session ID for context management"
                },
                "message": {
                    "type": "string",
                    "description": "Message to process"
                }
            }
        },
        {
            "name": "mcp_gemini_context_get_context",
            "description": "Retrieve the current context for a session",
            "parameters": {
                "sessionId": {
                    "type": "string",
                    "description": "Session ID to retrieve context for"
                }
            }
        },
        {
            "name": "mcp_gemini_context_clear_context",
            "description": "Clear the context for a session",
            "parameters": {
                "sessionId": {
                    "type": "string",
                    "description": "Session ID to clear context for"
                }
            }
        },
        {
            "name": "mcp_gemini_context_add_context",
            "description": "Add a new entry to the context",
            "parameters": {
                "content": {
                    "type": "string",
                    "description": "The content to add to context"
                },
                "role": {
                    "type": "string",
                    "enum": ["user", "assistant", "system"],
                    "description": "Role of the context entry"
                },
                "metadata": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "description": "Topic for context organization"
                        },
                        "tags": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            },
                            "description": "Tags for context categorization"
                        }
                    },
                    "description": "Metadata for context tracking"
                }
            }
        },
        {
            "name": "mcp_gemini_context_search_context",
            "description": "Search for relevant context using semantic similarity",
            "parameters": {
                "query": {
                    "type": "string",
                    "description": "The search query to find relevant context"
                },
                "limit": {
                    "type": "number",
                    "description": "Maximum number of context entries to return"
                }
            }
        },
        {
            "name": "mcp_gemini_context_create_cache",
            "description": "Create a cache for frequently used large contexts",
            "parameters": {
                "displayName": {
                    "type": "string",
                    "description": "Friendly name for the cache"
                },
                "content": {
                    "type": "string",
                    "description": "Large context to cache (system instructions, documents, etc)"
                },
                "ttlSeconds": {
                    "type": "number",
                    "description": "Time to live in seconds (default: 3600)"
                }
            }
        },
        {
            "name": "mcp_gemini_context_generate_with_cache",
            "description": "Generate content using a cached context",
            "parameters": {
                "cacheName": {
                    "type": "string",
                    "description": "The cache name/ID from createCache"
                },
                "userPrompt": {
                    "type": "string",
                    "description": "The user prompt to append to the cached context"
                }
            }
        },
        {
            "name": "mcp_gemini_context_list_caches",
            "description": "List all available caches",
            "parameters": {}
        },
        {
            "name": "mcp_gemini_context_update_cache_ttl",
            "description": "Updates a cache's TTL",
            "parameters": {
                "cacheName": {
                    "type": "string",
                    "description": "Cache name/ID"
                },
                "ttlSeconds": {
                    "type": "number",
                    "description": "New TTL in seconds"
                }
            }
        },
        {
            "name": "mcp_gemini_context_delete_cache",
            "description": "Deletes a cache",
            "parameters": {
                "cacheName": {
                    "type": "string",
                    "description": "Cache name/ID"
                }
            }
        },
        {
            "name": "discover_capabilities",
            "description": "Returns a manifest describing all capabilities of this MCP server",
            "parameters": {}
        },
        {
            "name": "get_tool_help",
            "description": "Get detailed help and examples for a specific tool",
            "parameters": {
                "toolName": {
                    "type": "string",
                    "description": "Name of the tool to get help for"
                }
            }
        }
    ]
};

// Define the request handler extra type to match the SDK
interface RequestHandlerExtra {
    sessionId?: string;
    metadata?: Record<string, unknown>;
}

// Load manifest file if it exists
export function loadManifest(): any {
    try {
        const manifestPath = path.resolve(process.cwd(), 'mcp-manifest.json');
        Logger.info(`Looking for manifest at: ${manifestPath}`);

        if (fs.existsSync(manifestPath)) {
            Logger.info('Manifest file found');
            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            try {
                const parsedManifest = JSON.parse(manifestContent);
                Logger.info('Manifest successfully parsed');
                return parsedManifest;
            } catch (parseError) {
                Logger.error('Failed to parse manifest JSON:', parseError);
                return null;
            }
        } else {
            Logger.error(`Manifest file not found at path: ${manifestPath}`);
        }
    } catch (error) {
        Logger.error('Error loading manifest:', error);
    }
    return null;
}

export async function startServer() {
    try {
        Logger.setOutputStream(process.stderr);
        Logger.info('Starting MCP server...');
        Logger.info(`Current working directory: ${process.cwd()}`);

        // Initialize the Gemini Context Server
        const geminiServer = new GeminiContextServer();

        // Load manifest
        let manifest = loadManifest();

        // If manifest is still not loaded, try alternate locations
        if (!manifest) {
            Logger.info('Attempting to load manifest from absolute path');
            // Try to load from the directory where this file is located
            const dirPath = path.dirname(new URL(import.meta.url).pathname);
            const altPath = path.join(dirPath, '..', 'mcp-manifest.json');

            Logger.info(`Trying alternate path: ${altPath}`);
            if (fs.existsSync(altPath)) {
                try {
                    const manifestContent = fs.readFileSync(altPath, 'utf8');
                    manifest = JSON.parse(manifestContent);
                    Logger.info('Loaded manifest from alternate path');
                } catch (error) {
                    Logger.error('Error loading manifest from alternate path:', error);
                }
            } else {
                Logger.error(`Alternate manifest file not found at: ${altPath}`);
            }
        }

        // Create and configure the MCP server
        const server = new McpServer({
            name: 'gemini-context',
            version: '1.0.0',
            capabilities: {
                tools: true
            }
        });

        // Register tools
        server.tool(
            'generate_text',
            'Generate text using Gemini with context management',
            {
                sessionId: z.string().describe('Session ID for context management'),
                message: z.string().describe('Message to process')
            },
            async (args: { sessionId: string; message: string }, extra: RequestHandlerExtra) => {
                try {
                    const response = await geminiServer.processMessage(args.sessionId, args.message);
                    return {
                        content: [{
                            type: 'text',
                            text: response || ''
                        }]
                    };
                } catch (error) {
                    Logger.error('Error generating text:', error);
                    throw error;
                }
            }
        );

        server.tool(
            'get_context',
            'Retrieve the current context for a session',
            {
                sessionId: z.string().describe('Session ID to retrieve context for')
            },
            async (args: { sessionId: string }, extra: RequestHandlerExtra) => {
                try {
                    const context = await geminiServer.getSessionContext(args.sessionId);
                    return {
                        content: [{
                            type: 'text',
                            text: context ? JSON.stringify(context, null, 2) : ''
                        }]
                    };
                } catch (error) {
                    Logger.error('Error getting context:', error);
                    throw error;
                }
            }
        );

        server.tool(
            'clear_context',
            'Clear the context for a session',
            {
                sessionId: z.string().describe('Session ID to clear context for')
            },
            async (args: { sessionId: string }, extra: RequestHandlerExtra) => {
                try {
                    await geminiServer.clearSession(args.sessionId);
                    return {
                        content: [{
                            type: 'text',
                            text: 'Context cleared successfully'
                        }]
                    };
                } catch (error) {
                    Logger.error('Error clearing context:', error);
                    throw error;
                }
            }
        );

        server.tool(
            'add_context',
            'Add a new entry to the context',
            {
                content: z.string().describe('The content to add to context'),
                role: z.enum(['user', 'assistant', 'system']).describe('Role of the context entry'),
                metadata: z.object({
                    topic: z.string().optional().describe('Topic for context organization'),
                    tags: z.array(z.string()).optional().describe('Tags for context categorization')
                }).optional().describe('Metadata for context tracking')
            },
            async (args: {
                content: string;
                role: 'user' | 'assistant' | 'system';
                metadata?: {
                    topic?: string;
                    tags?: string[];
                }
            }, extra: RequestHandlerExtra) => {
                try {
                    await geminiServer.addEntry(args.role, args.content, args.metadata);
                    return {
                        content: [{
                            type: 'text',
                            text: 'Context entry added successfully'
                        }]
                    };
                } catch (error) {
                    Logger.error('Error adding context:', error);
                    throw error;
                }
            }
        );

        server.tool(
            'search_context',
            'Search for relevant context using semantic similarity',
            {
                query: z.string().describe('The search query to find relevant context'),
                limit: z.number().optional().describe('Maximum number of context entries to return')
            },
            async (args: { query: string; limit?: number }, extra: RequestHandlerExtra) => {
                try {
                    const results = await geminiServer.searchContext(args.query, args.limit);
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(results, null, 2)
                        }]
                    };
                } catch (error) {
                    Logger.error('Error searching context:', error);
                    throw error;
                }
            }
        );

        server.tool(
            'mcp_gemini_context_create_cache',
            'Create a cache for frequently used large contexts',
            {
                displayName: z.string().describe('Friendly name for the cache'),
                content: z.string().describe('Large context to cache (system instructions, documents, etc)'),
                ttlSeconds: z.number().optional().describe('Time to live in seconds (default: 3600)')
            },
            async (args: { displayName: string; content: string; ttlSeconds?: number }, extra: RequestHandlerExtra) => {
                try {
                    const cacheName = await geminiServer.createCache(
                        args.displayName,
                        args.content,
                        args.ttlSeconds
                    );
                    return {
                        content: [{
                            type: 'text',
                            text: cacheName || 'Failed to create cache'
                        }]
                    };
                } catch (error) {
                    Logger.error('Error creating cache:', error);
                    throw error;
                }
            }
        );

        server.tool(
            'mcp_gemini_context_generate_with_cache',
            'Generate content using a cached context',
            {
                cacheName: z.string().describe('The cache name/ID from createCache'),
                userPrompt: z.string().describe('The user prompt to append to the cached context')
            },
            async (args: { cacheName: string; userPrompt: string }, extra: RequestHandlerExtra) => {
                try {
                    const response = await geminiServer.generateWithCache(args.cacheName, args.userPrompt);
                    return {
                        content: [{
                            type: 'text',
                            text: response || ''
                        }]
                    };
                } catch (error) {
                    Logger.error('Error generating with cache:', error);
                    throw error;
                }
            }
        );

        server.tool(
            'mcp_gemini_context_list_caches',
            'List all available caches',
            {},
            async (args: {}, extra: RequestHandlerExtra) => {
                try {
                    const caches = await geminiServer.listCaches();
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(caches, null, 2)
                        }]
                    };
                } catch (error) {
                    Logger.error('Error listing caches:', error);
                    throw error;
                }
            }
        );

        server.tool(
            'mcp_gemini_context_update_cache_ttl',
            'Updates a cache\'s TTL',
            {
                cacheName: z.string().describe('Cache name/ID'),
                ttlSeconds: z.number().describe('New TTL in seconds')
            },
            async (args: { cacheName: string; ttlSeconds: number }, extra: RequestHandlerExtra) => {
                try {
                    const updatedCache = await geminiServer.updateCacheTTL(args.cacheName, args.ttlSeconds);
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(updatedCache, null, 2)
                        }]
                    };
                } catch (error) {
                    Logger.error('Error updating cache TTL:', error);
                    throw error;
                }
            }
        );

        server.tool(
            'mcp_gemini_context_delete_cache',
            'Deletes a cache',
            {
                cacheName: z.string().describe('Cache name/ID')
            },
            async (args: { cacheName: string }, extra: RequestHandlerExtra) => {
                try {
                    await geminiServer.deleteCache(args.cacheName);
                    return {
                        content: [{
                            type: 'text',
                            text: 'Cache deleted successfully'
                        }]
                    };
                } catch (error) {
                    Logger.error('Error deleting cache:', error);
                    throw error;
                }
            }
        );

        // Add a tool to expose the manifest for discovery
        server.tool(
            'discover_capabilities',
            'Returns a manifest describing all capabilities of this MCP server',
            {},
            async () => {
                try {
                    // If manifest isn't loaded, try loading it again
                    if (!manifest) {
                        Logger.info('Manifest not loaded, attempting to load it again');
                        const reloadedManifest = loadManifest();
                        if (reloadedManifest) {
                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify(reloadedManifest, null, 2)
                                }]
                            };
                        } else {
                            Logger.info('Using fallback manifest');
                            return {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify(FALLBACK_MANIFEST, null, 2)
                                }]
                            };
                        }
                    }

                    return {
                        content: [{
                            type: 'text',
                            text: manifest ? JSON.stringify(manifest, null, 2) : JSON.stringify(FALLBACK_MANIFEST, null, 2)
                        }]
                    };
                } catch (error) {
                    Logger.error('Error in discovery endpoint:', error);
                    // Return fallback manifest even on error
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(FALLBACK_MANIFEST, null, 2)
                        }]
                    };
                }
            }
        );

        // Add a tool to get help on specific tools
        server.tool(
            'get_tool_help',
            'Get detailed help and examples for a specific tool',
            {
                toolName: z.string().describe('Name of the tool to get help for')
            },
            async (args: { toolName: string }) => {
                try {
                    const manifestToUse = manifest || FALLBACK_MANIFEST;

                    if (!manifestToUse || !manifestToUse.tools) {
                        return {
                            content: [{
                                type: 'text',
                                text: '{"error": "Manifest or tools not available"}'
                            }]
                        };
                    }

                    const toolInfo = manifestToUse.tools.find((tool: any) => tool.name === args.toolName);

                    if (!toolInfo) {
                        return {
                            content: [{
                                type: 'text',
                                text: `{"error": "Tool '${args.toolName}' not found"}`
                            }]
                        };
                    }

                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(toolInfo, null, 2)
                        }]
                    };
                } catch (error) {
                    Logger.error('Error getting tool help:', error);
                    throw error;
                }
            }
        );

        // Create and connect transport
        let transport;
        if (httpMode) {
            Logger.info(`Starting in HTTP mode on port ${port}`);
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                enableJsonResponse: false
            });
            
            // Log server URL
            console.log(`\n🚀 MCP server running in HTTP mode at http://localhost:${port}`);
            console.log(`Configuration: Use endpoint http://localhost:${port}/mcp in your MCP client\n`);
        } else {
            Logger.info('Starting in stdio mode');
            transport = new StdioServerTransport();
        }

        await server.connect(transport);

        // Handle cleanup
        const cleanup = async () => {
            try {
                await geminiServer.cleanup();
                await transport.close();
                Logger.close();
                process.exit(0);
            } catch (error) {
                Logger.error('Error during cleanup:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        Logger.info('MCP server started successfully');
    } catch (error) {
        Logger.error('Failed to start MCP server:', error);
        process.exit(1);
    }
}

// Only start if this is the main module
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
    startServer().catch(error => {
        Logger.error('Unhandled error:', error);
        process.exit(1);
    });
}