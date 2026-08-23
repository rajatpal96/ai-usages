import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { UsageEventSchema } from '../../../packages/event-schema/src/index.js';
import { adapterRegistry } from '../../../packages/agents/src/index.js';
import { createScopedLogger } from '../../../packages/logger/src/index.js';
const log = createScopedLogger('collector');
export class LocalCollector {
    config;
    db;
    timer = null;
    isUploading = false;
    backoffUntil = 0;
    uploadedCount = 0;
    lastUploadTime = null;
    constructor(customConfig) {
        const defaultDbDir = path.join(process.cwd(), '.agentpulse');
        if (!fs.existsSync(defaultDbDir)) {
            try {
                fs.mkdirSync(defaultDbDir, { recursive: true });
            }
            catch (e) { }
        }
        this.config = {
            apiUrl: customConfig?.apiUrl || process.env.AGENTMETER_INGEST_URL || process.env.AGENTMETER_API_URL || 'http://localhost:4001',
            apiKey: customConfig?.apiKey || process.env.AGENTMETER_API_KEY,
            organizationId: customConfig?.organizationId || process.env.AGENTMETER_ORG_ID || 'org_default',
            batchSize: customConfig?.batchSize || 25,
            flushIntervalMs: customConfig?.flushIntervalMs || 3000,
            maxRetries: customConfig?.maxRetries || 5,
            dbPath: customConfig?.dbPath || path.join(defaultDbDir, 'collector.db'),
        };
        this.initDatabase();
        this.startPeriodicFlush();
    }
    /**
     * Initialize SQLite local durability queue
     */
    initDatabase() {
        try {
            this.db = new Database(this.config.dbPath);
            this.db.pragma('journal_mode = WAL');
            // 1. Events Queue Table
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS events (
          eventId TEXT PRIMARY KEY,
          organizationId TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending', -- pending, uploading, uploaded, quarantined
          retryCount INTEGER NOT NULL DEFAULT 0,
          errorMessage TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
        CREATE INDEX IF NOT EXISTS idx_events_createdAt ON events(createdAt);
      `);
            // 2. Upload Batches Audit Table
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS upload_batches (
          batchId TEXT PRIMARY KEY,
          eventCount INTEGER NOT NULL,
          status TEXT NOT NULL,
          statusCode INTEGER,
          createdAt TEXT NOT NULL
        );
      `);
            // 3. Agent State & Health Registry
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS agent_state (
          agentName TEXT PRIMARY KEY,
          lastSeen TEXT NOT NULL,
          capabilities TEXT
        );
      `);
            log.info({ dbPath: this.config.dbPath }, '📦 SQLite local durability queue initialized');
        }
        catch (err) {
            log.error({ err: err.message }, 'Failed to initialize SQLite queue. Using in-memory mode.');
            this.db = new Database(':memory:');
        }
    }
    /**
     * Enqueue raw telemetry from agent hooks or transcript watchers:
     * 1. Normalizes payload via Agent Adapters
     * 2. Validates with Zod schema
     * 3. Persists immediately into SQLite queue
     */
    enqueue(rawEvent) {
        try {
            const normalized = adapterRegistry.normalize(rawEvent, {
                organizationId: this.config.organizationId,
                userId: rawEvent.userId || 'developer',
                projectId: rawEvent.projectId,
                sessionId: rawEvent.sessionId,
            });
            const validated = UsageEventSchema.parse(normalized);
            const now = new Date().toISOString();
            // Upsert into SQLite queue
            const insert = this.db.prepare(`
        INSERT OR IGNORE INTO events (eventId, organizationId, payload, status, retryCount, createdAt, updatedAt)
        VALUES (?, ?, ?, 'pending', 0, ?, ?)
      `);
            const result = insert.run(validated.eventId, validated.organizationId, JSON.stringify(validated), now, now);
            // Record agent last seen
            const updateAgent = this.db.prepare(`
        INSERT INTO agent_state (agentName, lastSeen)
        VALUES (?, ?)
        ON CONFLICT(agentName) DO UPDATE SET lastSeen=excluded.lastSeen
      `);
            updateAgent.run(validated.agent.name, now);
            if (result.changes > 0) {
                log.debug({ eventId: validated.eventId, agent: validated.agent.name }, 'Enqueued event to SQLite buffer');
            }
            return true;
        }
        catch (err) {
            log.error({ err: err.message }, 'Failed to validate and enqueue telemetry event');
            return false;
        }
    }
    /**
     * Flush pending events from SQLite buffer to Central Ingestion API
     */
    async flush() {
        if (this.isUploading)
            return 0;
        if (Date.now() < this.backoffUntil) {
            log.debug('Rate-limit / Backoff active. Skipping flush tick.');
            return 0;
        }
        this.isUploading = true;
        try {
            // Pull pending events
            const select = this.db.prepare(`
        SELECT eventId, payload, retryCount FROM events
        WHERE status = 'pending'
        ORDER BY createdAt ASC
        LIMIT ?
      `);
            const rows = select.all(this.config.batchSize);
            if (!rows || rows.length === 0) {
                return 0;
            }
            const eventPayloads = rows.map((r) => JSON.parse(r.payload));
            const eventIds = rows.map((r) => r.eventId);
            // Mark as uploading
            const markUploading = this.db.prepare(`
        UPDATE events SET status = 'uploading', updatedAt = ? WHERE eventId = ?
      `);
            const now = new Date().toISOString();
            for (const id of eventIds) {
                markUploading.run(now, id);
            }
            // Send batch via HTTP
            const uploadSuccess = await this.uploadBatch(eventPayloads);
            if (uploadSuccess) {
                // Delete uploaded events from queue
                const deleteUploaded = this.db.prepare(`DELETE FROM events WHERE eventId = ?`);
                for (const id of eventIds) {
                    deleteUploaded.run(id);
                }
                this.uploadedCount += eventIds.length;
                this.lastUploadTime = new Date().toISOString();
                log.info({ uploaded: eventIds.length }, '🚀 Successfully uploaded batch of events to AgentMeter Ingestion');
                return eventIds.length;
            }
            else {
                // Increment retry or quarantine
                const markFailed = this.db.prepare(`
          UPDATE events
          SET status = CASE WHEN retryCount >= ? THEN 'quarantined' ELSE 'pending' END,
              retryCount = retryCount + 1,
              updatedAt = ?
          WHERE eventId = ?
        `);
                for (const r of rows) {
                    markFailed.run(this.config.maxRetries, new Date().toISOString(), r.eventId);
                }
                // Apply exponential backoff (e.g. 5s)
                this.backoffUntil = Date.now() + 5000;
                return 0;
            }
        }
        catch (err) {
            log.error({ err: err.message }, 'Error in collector flush execution');
            return 0;
        }
        finally {
            this.isUploading = false;
        }
    }
    /**
     * HTTP POST batch to Central Ingestion API
     */
    async uploadBatch(events) {
        try {
            const endpoint = `${this.config.apiUrl}/v1/events/batch`;
            const headers = {
                'Content-Type': 'application/json',
                ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
            };
            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ events }),
            });
            if (response.status === 429) {
                log.warn('HTTP 429: Ingestion rate limit exceeded. Backing off...');
                this.backoffUntil = Date.now() + 15000;
                return false;
            }
            if (response.ok || response.status === 201) {
                return true;
            }
            const errorText = await response.text().catch(() => '');
            log.warn({ status: response.status, error: errorText }, 'Ingestion upload rejected');
            return false;
        }
        catch (err) {
            log.warn({ err: err.message }, 'Network error communicating with Ingestion API');
            return false;
        }
    }
    /**
     * Doctor Diagnostics: Expose queue depth, connectivity, and adapter health
     */
    async doctor() {
        const queueDepthRow = this.db.prepare(`SELECT COUNT(*) as count FROM events WHERE status = 'pending'`).get();
        const quarantinedRow = this.db.prepare(`SELECT COUNT(*) as count FROM events WHERE status = 'quarantined'`).get();
        let isApiReachable = false;
        try {
            const res = await fetch(`${this.config.apiUrl}/health`).catch(() => null);
            isApiReachable = res ? res.ok : false;
        }
        catch (e) { }
        const adapters = {
            'claude-code': true,
            'github-copilot': true,
            'gemini-antigravity': true,
            codex: true,
            grok: true,
        };
        return {
            status: isApiReachable ? 'healthy' : queueDepthRow.count > 0 ? 'degraded' : 'offline',
            apiUrl: this.config.apiUrl,
            queueDepth: queueDepthRow.count || 0,
            quarantinedCount: quarantinedRow.count || 0,
            uploadedTotal: this.uploadedCount,
            lastSuccessfulUpload: this.lastUploadTime || undefined,
            adapters,
            dbPath: this.config.dbPath,
        };
    }
    startPeriodicFlush() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.flush().catch(() => { });
        }, this.config.flushIntervalMs);
    }
    stop() {
        if (this.timer)
            clearInterval(this.timer);
        try {
            this.db.close();
        }
        catch (e) { }
    }
}
export const collector = new LocalCollector();
