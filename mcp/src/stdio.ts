#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createVeritasServer } from './server'

const server = createVeritasServer()
await server.connect(new StdioServerTransport())
