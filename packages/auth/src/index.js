import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config/src/index.js';
// -------------------------------------------------------------
// 1. Role-Based Access Control (RBAC) Permissions
// -------------------------------------------------------------
const ROLE_PERMISSIONS = {
    admin: ['metrics:read', 'metrics:write', 'budgets:manage', 'keys:manage', 'mcp:manage', 'mcp:read', 'admin:access'],
    engineer: ['metrics:read', 'metrics:write', 'mcp:read', 'keys:read'],
    finance_lead: ['metrics:read', 'budgets:manage', 'cost:read', 'mcp:read'],
    viewer: ['metrics:read', 'mcp:read'],
};
export function getRolePermissions(role) {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
}
export function hasPermission(userRole, requiredPermission) {
    const permissions = getRolePermissions(userRole);
    return permissions.includes(requiredPermission) || permissions.includes('admin:access');
}
// -------------------------------------------------------------
// 2. Identity Provider Authentication & JWT Token Issuer
// -------------------------------------------------------------
const JWT_SECRET = config.JWT_SECRET || 'agentmeter-secret-key-32-chars-long!';
export function issueUserToken(profile, expiresIn = '7d') {
    return jwt.sign({
        sub: profile.userId,
        email: profile.email,
        name: profile.name,
        organizationId: profile.organizationId,
        role: profile.role,
        provider: profile.provider,
        permissions: profile.permissions || getRolePermissions(profile.role),
    }, JWT_SECRET, { expiresIn });
}
export function verifyUserToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return {
            userId: decoded.sub,
            email: decoded.email,
            name: decoded.name,
            organizationId: decoded.organizationId,
            role: decoded.role,
            provider: decoded.provider,
            permissions: decoded.permissions || getRolePermissions(decoded.role),
        };
    }
    catch (err) {
        return null;
    }
}
// -------------------------------------------------------------
// 3. MCP OAuth 2.0 Access Token Server
// -------------------------------------------------------------
export function issueMcpAccessToken(options) {
    const scopes = options.scopes || ['mcp:read', 'mcp:usage', 'mcp:cost'];
    const expiresIn = options.expiresIn || '30d';
    const token = jwt.sign({
        sub: options.sub,
        organizationId: options.organizationId,
        clientId: options.clientId,
        scopes,
        type: 'mcp_access_token',
    }, JWT_SECRET, { expiresIn });
    return {
        accessToken: token,
        expiresInSeconds: 30 * 86400,
        tokenType: 'Bearer',
        scopes,
    };
}
export function verifyMcpAccessToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'mcp_access_token') {
            return null;
        }
        return {
            sub: decoded.sub,
            organizationId: decoded.organizationId,
            scopes: decoded.scopes || [],
            clientId: decoded.clientId,
            type: 'mcp_access_token',
            exp: decoded.exp,
        };
    }
    catch (err) {
        return null;
    }
}
// -------------------------------------------------------------
// 4. API Key Hashing & Verification
// -------------------------------------------------------------
export function generateApiKey(orgId, name = 'Default Key') {
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const key = `am_live_${randomBytes}`;
    const hashedKey = hashApiKey(key);
    return {
        key,
        hashedKey,
        organizationId: orgId,
        name,
        createdAt: new Date().toISOString(),
    };
}
export function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}
export function verifyApiKey(rawKey, hashedKey) {
    const computed = hashApiKey(rawKey);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hashedKey));
}
export function extractAuthToken(authHeader) {
    if (!authHeader)
        return null;
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
    }
    if (authHeader.startsWith('ApiKey ') || authHeader.startsWith('am_live_')) {
        return authHeader.replace(/^ApiKey\s+/, '').trim();
    }
    return authHeader.trim();
}
