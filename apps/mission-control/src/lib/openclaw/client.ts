// OpenClaw Gateway WebSocket Client

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import type { OpenClawMessage, OpenClawSessionInfo } from '../types';
import { getOpenClawGatewayConfig } from './config';
import { logOpenClawRequestTelemetry } from './telemetry';

export interface OpenClawClientConfig {
  gateway_url: string;
  gateway_token: string;
  gateway_origin: string;
  gateway_role: string;
  gateway_scopes: string;
}

function parseScopes(rawScopes: string): string[] {
  return rawScopes
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export class OpenClawClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageId = 0;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      method?: string;
      params?: Record<string, unknown>;
    }
  >();
  private connected = false;
  private authenticated = false; // Track auth state separately from connection state
  private connecting: Promise<void> | null = null; // Lock to prevent multiple simultaneous connection attempts
  private autoReconnect = true;
  private role: string;
  private scopes: string[];
  private token: string;
  private origin: string;

  constructor(private url: string, token: string, origin: string, role: string, scopes: string[]) {
    super();
    this.role = role;
    this.scopes = scopes;
    this.token = token;
    this.origin = origin;
    // Prevent Node.js from throwing on unhandled 'error' events
    this.on('error', () => {});
  }

  async connect(): Promise<void> {
    // If already connected, return immediately
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // If a connection attempt is already in progress, wait for it
    if (this.connecting) {
      return this.connecting;
    }

    // Create a new connection attempt
    this.connecting = new Promise((resolve, reject) => {
      let settled = false;
      const settleResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      try {
        // Clean up any existing connection
        if (this.ws) {
          this.ws.removeAllListeners();
          if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
          }
          this.ws = null;
        }

        // Add token to URL query string for Gateway authentication
        const wsUrl = new URL(this.url);
        if (this.token) {
          wsUrl.searchParams.set('token', this.token);
        }
        console.log('[OpenClaw] Connecting to:', wsUrl.toString().replace(/token=[^&]+/, 'token=***'));
        console.log('[OpenClaw] Token in URL:', wsUrl.searchParams.has('token'));
        this.ws = new WebSocket(wsUrl.toString(), {
          headers: { origin: this.origin }
        });

        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            this.ws?.close();
            this.connecting = null;
            settleReject(new Error('Connection timeout'));
          }
        }, 10000); // 10 second connection timeout

        this.ws.on('open', async () => {
          clearTimeout(connectionTimeout);
          console.log('[OpenClaw] WebSocket opened, waiting for challenge...');
          // Don't send anything yet - wait for Gateway challenge
          // Token is in URL query string
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(connectionTimeout);
          const wasConnected = this.connected;
          this.connected = false;
          this.authenticated = false;
          this.connecting = null;
          this.emit('disconnected');
          // Log close reason for debugging
          console.log(`[OpenClaw] Disconnected from Gateway (code: ${code}, reason: "${reason.toString()}")`);
          if (!wasConnected) {
            settleReject(new Error(`Gateway closed before authentication (code: ${code})`));
          }
          // Only auto-reconnect if we were previously connected (not on initial connection failure)
          if (this.autoReconnect && wasConnected) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          console.error('[OpenClaw] WebSocket error');
          this.emit('error', error);
          if (!this.connected) {
            this.connecting = null;
            settleReject(new Error('Failed to connect to OpenClaw Gateway'));
          }
        });

        this.ws.on('message', (rawData) => {
          const payload = typeof rawData === 'string' ? rawData : rawData.toString();
          console.log('[OpenClaw] Received:', payload);
          try {
            const data = JSON.parse(payload);

            // Handle challenge-response authentication (OpenClaw RequestFrame format)
            if (data.type === 'event' && data.event === 'connect.challenge') {
              console.log('[OpenClaw] Challenge received, responding...');
              const requestId = crypto.randomUUID();
              const response = {
                type: 'req',
                id: requestId,
                method: 'connect',
                params: {
                  minProtocol: 3,
                  maxProtocol: 3,
                  client: {
                    id: 'openclaw-control-ui',
                    version: '1.0.0',
                    platform: 'web',
                    mode: 'ui'
                  },
                  role: this.role,
                  scopes: this.scopes,
                  auth: {
                    token: this.token
                  }
                }
              };

              // Set up response handler
              this.pendingRequests.set(requestId, {
                resolve: () => {
                  this.connected = true;
                  this.authenticated = true;
                  this.connecting = null;
                  this.emit('connected');
                  console.log('[OpenClaw] Authenticated successfully');
                  settleResolve();
                },
                reject: (error: Error) => {
                  this.connecting = null;
                  this.ws?.close();
                  settleReject(new Error(`Authentication failed: ${error.message}`));
                },
                method: 'connect',
                params: {
                  role: this.role,
                  scopes: this.scopes,
                },
              });

              console.log('[OpenClaw] Sending challenge response');
              this.ws!.send(JSON.stringify(response));
              return;
            }

            // Handle RPC responses and other messages
            this.handleMessage(data as OpenClawMessage);
          } catch (err) {
            console.error('[OpenClaw] Failed to parse message:', err);
            if (!this.connected) {
              this.ws?.close();
            }
          }
        });
      } catch (err) {
        this.connecting = null;
        settleReject(err instanceof Error ? err : new Error('Failed to initialize OpenClaw connection'));
      }
    });

    return this.connecting;
  }

  private handleMessage(data: OpenClawMessage & { type?: string; ok?: boolean; payload?: unknown }): void {
    // Handle OpenClaw ResponseFrame format (type: "res")
    if (data.type === 'res' && data.id !== undefined) {
      const requestId = data.id as string | number;
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        const { resolve, reject, method, params } = pending;
        this.pendingRequests.delete(requestId);

        if (data.ok === false && data.error) {
          logOpenClawRequestTelemetry({
            requestId,
            method: method || 'unknown',
            params,
            status: 'error',
            payload: data.payload,
            errorMessage: data.error.message,
          });
          reject(new Error(data.error.message));
        } else {
          logOpenClawRequestTelemetry({
            requestId,
            method: method || 'unknown',
            params,
            status: 'ok',
            payload: data.payload,
          });
          resolve(data.payload);
        }
        return;
      }
    }

    // Handle legacy JSON-RPC responses
    const legacyId = data.id as string | number | undefined;
    if (legacyId !== undefined && this.pendingRequests.has(legacyId)) {
      const { resolve, reject, method, params } = this.pendingRequests.get(legacyId)!;
      this.pendingRequests.delete(legacyId);

      if (data.error) {
        logOpenClawRequestTelemetry({
          requestId: legacyId,
          method: method || 'unknown',
          params,
          status: 'error',
          payload: data.result,
          errorMessage: data.error.message,
        });
        reject(new Error(data.error.message));
      } else {
        logOpenClawRequestTelemetry({
          requestId: legacyId,
          method: method || 'unknown',
          params,
          status: 'ok',
          payload: data.result,
        });
        resolve(data.result);
      }
      return;
    }

    // Handle events/notifications
    if (data.method) {
      this.emit('notification', data);
      this.emit(data.method, data.params);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.autoReconnect) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.autoReconnect) return;

      console.log('[OpenClaw] Attempting reconnect...');
      try {
        await this.connect();
      } catch {
        // Don't spam logs on reconnect failure, just schedule another attempt
        this.scheduleReconnect();
      }
    }, 10000); // 10 seconds between reconnect attempts
  }

  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || !this.connected || !this.authenticated) {
      throw new Error('Not connected to OpenClaw Gateway');
    }

    const id = crypto.randomUUID();
    const message = { type: 'req', id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        method,
        params,
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);

      this.ws!.send(JSON.stringify(message));
    });
  }

  // Session management methods
  async listSessions(): Promise<OpenClawSessionInfo[]> {
    return this.call<OpenClawSessionInfo[]>('sessions.list');
  }

  async getSessionHistory(sessionId: string): Promise<unknown[]> {
    return this.call<unknown[]>('sessions.history', { session_id: sessionId });
  }

  async sendMessage(sessionId: string, content: string): Promise<void> {
    await this.call('sessions.send', { session_id: sessionId, content });
  }

  async createSession(channel: string, peer?: string): Promise<OpenClawSessionInfo> {
    return this.call<OpenClawSessionInfo>('sessions.create', { channel, peer });
  }

  // Node methods (device capabilities)
  async listNodes(): Promise<unknown[]> {
    return this.call<unknown[]>('node.list');
  }

  async describeNode(nodeId: string): Promise<unknown> {
    return this.call('node.describe', { node_id: nodeId });
  }

  disconnect(): void {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners(); // Prevent reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.authenticated = false;
    this.connecting = null;
  }

  isConnected(): boolean {
    return this.connected && this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }

  setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
    if (!enabled && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Singleton instance for server-side usage
let clientInstance: OpenClawClient | null = null;
let clientSignature: string | null = null;

function signatureFromConfig(config: OpenClawClientConfig): string {
  return [
    config.gateway_url,
    config.gateway_token,
    config.gateway_origin,
    config.gateway_role,
    config.gateway_scopes,
  ].join('|');
}

export function getOpenClawClient(): OpenClawClient {
  const config = getOpenClawGatewayConfig();
  const nextSignature = signatureFromConfig(config);

  if (!clientInstance || clientSignature !== nextSignature) {
    if (clientInstance) {
      clientInstance.disconnect();
    }
    clientInstance = new OpenClawClient(
      config.gateway_url,
      config.gateway_token,
      config.gateway_origin,
      config.gateway_role,
      parseScopes(config.gateway_scopes),
    );
    clientSignature = nextSignature;
  }
  return clientInstance;
}

export function resetOpenClawClient(): void {
  if (clientInstance) {
    clientInstance.disconnect();
  }
  clientInstance = null;
  clientSignature = null;
}
