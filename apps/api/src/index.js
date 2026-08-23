import express from 'express';
import cors from 'cors';
import { config } from '../../../packages/config/src/index.js';
import { createScopedLogger } from '../../../packages/logger/src/index.js';
import { connectDatabase, analyticsService, BudgetModel, AlertRuleModel, AlertHistory, Pricing, ApiKey, User, } from '../../../packages/database/src/index.js';
import { generateApiKey, extractAuthToken, hashApiKey, issueUserToken, verifyUserToken, issueMcpAccessToken, verifyMcpAccessToken, hasPermission, } from '../../../packages/auth/src/index.js';
import { DEFAULT_PRICING_CATALOG } from '../../../packages/pricing/src/index.js';
const log = createScopedLogger('usage-api');
const app = express();
app.use(cors());
app.use(express.json());
// -------------------------------------------------------------
// Authentication & Identity Layer Middleware
// -------------------------------------------------------------
async function authMiddleware(req, res, next) {
    try {
        const rawToken = extractAuthToken(req.headers.authorization || req.headers['x-api-key']);
        if (!rawToken) {
            req.organizationId = req.headers['x-organization-id'] || req.query.orgId || config.DEFAULT_ORG_ID;
            req.userRole = 'admin'; // Default developer role for local fallback
            return next();
        }
        // 1. Check MCP OAuth Token
        const mcpToken = verifyMcpAccessToken(rawToken);
        if (mcpToken) {
            req.organizationId = mcpToken.organizationId;
            req.mcpScopes = mcpToken.scopes;
            req.authType = 'mcp_oauth';
            req.userRole = 'engineer';
            return next();
        }
        // 2. Check User JWT (Identity Layer)
        const userProfile = verifyUserToken(rawToken);
        if (userProfile) {
            req.organizationId = userProfile.organizationId;
            req.user = userProfile;
            req.userRole = userProfile.role;
            req.authType = 'user_jwt';
            return next();
        }
        // 3. Check API Key
        const hashed = hashApiKey(rawToken);
        const keyDoc = await ApiKey.findOne({ hashedKey: hashed, revoked: false });
        if (keyDoc) {
            req.organizationId = keyDoc.organizationId;
            req.userRole = 'admin';
            req.authType = 'api_key';
            keyDoc.lastUsedAt = new Date();
            await keyDoc.save().catch(() => { });
            return next();
        }
        req.organizationId = req.headers['x-organization-id'] || config.DEFAULT_ORG_ID;
        req.userRole = 'viewer';
        return next();
    }
    catch (err) {
        req.organizationId = config.DEFAULT_ORG_ID;
        req.userRole = 'viewer';
        return next();
    }
}
// -------------------------------------------------------------
// Authorization Layer (RBAC) Guard Middleware
// -------------------------------------------------------------
function requirePermission(permission) {
    return (req, res, next) => {
        const role = req.userRole || 'viewer';
        if (!hasPermission(role, permission)) {
            return res.status(403).json({
                error: `Forbidden: Role '${role}' lacks required permission '${permission}'`,
            });
        }
        next();
    };
}
app.use(authMiddleware);
// -------------------------------------------------------------
// 1. Identity Provider Endpoints (Identity Layer)
// -------------------------------------------------------------
// POST /v1/auth/login (Email / Password)
app.post('/v1/auth/login', async (req, res) => {
    const { email, password, organizationId = config.DEFAULT_ORG_ID } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    // Find or provision user
    let user = await User.findOne({ email });
    if (!user) {
        user = await User.create({
            userId: `usr_${email.split('@')[0]}_${Math.floor(Math.random() * 1000)}`,
            email,
            name: email.split('@')[0],
            organizationId,
            role: email.includes('admin') ? 'admin' : 'engineer',
        });
    }
    const profile = {
        userId: user.userId,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        role: user.role,
        provider: 'email',
        permissions: ['metrics:read', 'metrics:write', 'mcp:read'],
    };
    const token = issueUserToken(profile);
    return res.json({ token, profile });
});
// POST /v1/auth/sso/google, github, microsoft, saml
app.post(['/v1/auth/sso/:provider', '/v1/auth/oauth/:provider'], async (req, res) => {
    const provider = (req.params.provider || 'sso');
    const { email = 'developer@acme.com', name = 'Enterprise User', organizationId = config.DEFAULT_ORG_ID } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
        user = await User.create({
            userId: `usr_${provider}_${Math.floor(Math.random() * 10000)}`,
            email,
            name,
            organizationId,
            role: 'engineer',
        });
    }
    const profile = {
        userId: user.userId,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        role: user.role,
        provider,
        permissions: ['metrics:read', 'metrics:write', 'mcp:read'],
    };
    const token = issueUserToken(profile);
    return res.json({
        token,
        profile,
        identityProvider: provider,
        message: `Authenticated via ${provider.toUpperCase()}`,
    });
});
// GET /v1/auth/me
app.get('/v1/auth/me', (req, res) => {
    const user = req.user || {
        userId: 'usr_default',
        email: 'admin@acme.com',
        name: 'Admin Developer',
        organizationId: req.organizationId,
        role: req.userRole,
        provider: 'sso',
    };
    return res.json({ user });
});
// -------------------------------------------------------------
// 2. MCP OAuth 2.0 Token Server Endpoints
// -------------------------------------------------------------
// POST /v1/oauth/token (Issues scoped MCP Access Tokens for AI clients)
app.post(['/v1/oauth/token', '/oauth/token'], async (req, res) => {
    const { grant_type = 'client_credentials', client_id = 'mcp-client', client_secret, scope = 'mcp:read mcp:usage mcp:cost', organizationId = req.organizationId, } = req.body;
    const scopes = scope.split(' ');
    const tokenData = issueMcpAccessToken({
        sub: client_id,
        organizationId,
        clientId: client_id,
        scopes,
    });
    return res.json({
        access_token: tokenData.accessToken,
        token_type: tokenData.tokenType,
        expires_in: tokenData.expiresInSeconds,
        scope: scopes.join(' '),
        organization_id: organizationId,
    });
});
// GET /v1/oauth/jwks (Public verification metadata)
app.get(['/v1/oauth/jwks', '/oauth/jwks'], (_req, res) => {
    return res.json({
        keys: [
            {
                kty: 'oct',
                alg: 'HS256',
                use: 'sig',
                kid: 'agentmeter-mcp-key-1',
            },
        ],
    });
});
// -------------------------------------------------------------
// 3. Analytics Endpoints (Protected by Authorization Layer)
// -------------------------------------------------------------
// GET /v1/analytics/overview
app.get('/v1/analytics/overview', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    const range = req.query.range || '30d';
    try {
        const overview = await analyticsService.getOverview(orgId, range);
        return res.json(overview);
    }
    catch (err) {
        log.error({ err: err.message }, 'Failed to fetch analytics overview');
        return res.status(500).json({ error: err.message });
    }
});
// GET /v1/analytics/usage/trend
app.get('/v1/analytics/usage/trend', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    const range = req.query.range || '30d';
    try {
        const trend = await analyticsService.getUsageTrend(orgId, range);
        return res.json({ organizationId: orgId, range, trend });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /v1/analytics/usage/by-agent
app.get('/v1/analytics/usage/by-agent', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    const range = req.query.range || '30d';
    try {
        const data = await analyticsService.getUsageByAgent(orgId, range);
        return res.json({ organizationId: orgId, range, agents: data });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /v1/analytics/usage/by-model
app.get('/v1/analytics/usage/by-model', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    const range = req.query.range || '30d';
    try {
        const data = await analyticsService.getUsageByModel(orgId, range);
        return res.json({ organizationId: orgId, range, models: data });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /v1/analytics/usage/by-project
app.get('/v1/analytics/usage/by-project', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    const range = req.query.range || '30d';
    try {
        const data = await analyticsService.getUsageByProject(orgId, range);
        return res.json({ organizationId: orgId, range, projects: data });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /v1/analytics/usage/by-user
app.get('/v1/analytics/usage/by-user', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    const range = req.query.range || '30d';
    try {
        const data = await analyticsService.getUsageByUser(orgId, range);
        return res.json({ organizationId: orgId, range, users: data });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// -------------------------------------------------------------
// 4. Session Endpoints
// -------------------------------------------------------------
app.get('/v1/sessions', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    const agent = req.query.agent;
    const project = req.query.project;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    try {
        const result = await analyticsService.listSessions(orgId, { agent, project, limit, offset });
        return res.json(result);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
app.get('/v1/sessions/:id', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    const sessionId = req.params.id;
    try {
        const detail = await analyticsService.getSessionDetail(orgId, sessionId);
        if (!detail)
            return res.status(404).json({ error: 'Session not found' });
        return res.json(detail);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// -------------------------------------------------------------
// 5. MCP Telemetry Endpoints
// -------------------------------------------------------------
app.get('/v1/mcp/analytics', requirePermission('mcp:read'), async (req, res) => {
    const orgId = req.organizationId;
    const range = req.query.range || '30d';
    try {
        const analytics = await analyticsService.getMcpAnalytics(orgId, range);
        return res.json(analytics);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// -------------------------------------------------------------
// 6. Budgets & Alerts Endpoints
// -------------------------------------------------------------
app.get('/v1/budgets', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    const currentMonth = new Date().toISOString().slice(0, 7);
    try {
        let budget = await BudgetModel.findOne({ organizationId: orgId, month: currentMonth });
        if (!budget) {
            budget = await BudgetModel.create({
                organizationId: orgId,
                monthlyLimitUsd: 1000,
                alertThresholdPercent: 80,
                currentSpendUsd: 0,
                month: currentMonth,
            });
        }
        return res.json(budget);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
app.post('/v1/budgets', requirePermission('budgets:manage'), async (req, res) => {
    const orgId = req.organizationId;
    const { monthlyLimitUsd, alertThresholdPercent } = req.body;
    const currentMonth = new Date().toISOString().slice(0, 7);
    try {
        const budget = await BudgetModel.findOneAndUpdate({ organizationId: orgId, month: currentMonth }, {
            $set: {
                monthlyLimitUsd: Number(monthlyLimitUsd),
                alertThresholdPercent: Number(alertThresholdPercent || 80),
            },
        }, { upsert: true, new: true });
        return res.json(budget);
    }
    catch (err) {
        return res.status(400).json({ error: err.message });
    }
});
app.get('/v1/alerts', requirePermission('metrics:read'), async (req, res) => {
    const orgId = req.organizationId;
    try {
        const rules = await AlertRuleModel.find({ organizationId: orgId });
        const history = await AlertHistory.find({ organizationId: orgId }).sort({ timestamp: -1 }).limit(20);
        return res.json({ rules, history });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// -------------------------------------------------------------
// 7. Pricing Catalog Endpoints
// -------------------------------------------------------------
app.get('/v1/pricing', async (_req, res) => {
    try {
        const dbPricing = await Pricing.find().sort({ provider: 1, model: 1 });
        return res.json({ pricing: dbPricing.length > 0 ? dbPricing : DEFAULT_PRICING_CATALOG });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// -------------------------------------------------------------
// 8. API Keys Management
// -------------------------------------------------------------
app.get('/v1/api-keys', requirePermission('keys:manage'), async (req, res) => {
    const orgId = req.organizationId;
    try {
        const keys = await ApiKey.find({ organizationId: orgId, revoked: false }).select('-hashedKey');
        return res.json({ keys });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
app.post('/v1/api-keys', requirePermission('keys:manage'), async (req, res) => {
    const orgId = req.organizationId;
    const name = req.body.name || 'New API Key';
    try {
        const generated = generateApiKey(orgId, name);
        await ApiKey.create({
            hashedKey: generated.hashedKey,
            prefix: generated.key.slice(0, 16) + '...',
            organizationId: orgId,
            name,
        });
        return res.status(201).json({
            name,
            apiKey: generated.key,
            warning: 'Store this key safely; it will not be displayed again.',
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'agentmeter-api',
        identityLayer: 'active',
        oauthServer: 'active',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
    });
});
export async function startApiServer(port = config.API_PORT) {
    await connectDatabase();
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            log.info({ port }, `📊 AgentMeter Usage & Analytics API running on http://localhost:${port}`);
            resolve(server);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                log.warn({ port }, `API server port ${port} is already in use, reusing active instance.`);
                resolve(server);
            }
            else {
                log.error({ err: err.message }, 'API server error');
            }
        });
    });
}
if (process.argv[1] && process.argv[1].includes('apps/api')) {
    startApiServer();
}
