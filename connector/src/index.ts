#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// stdout carries the protocol, so anything human-readable goes to stderr.
await createServer().connect(new StdioServerTransport());
console.error("Encounter Tracker connector ready");
