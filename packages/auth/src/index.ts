import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config/src/index.js';

export type UserRole = 'admin' | 'engineer' | 'finance_lead' | 'viewer';

export type IdentityProviderType = 'email' | 'google' | 'github' | 'microsoft' | 'saml_sso' | 'oidc';

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  role: UserRole;
  provider: IdentityProviderType;
  avatarUrl?: string;
  permissions: string[];
}

export interface McpTokenPayload {
  sub: string; // userId or clientId
  organizationId: string;
  scopes: string[]; // e.g. ['mcp:read', 'mcp:usage', 'mcp:cost', 'mcp:admin']
  clientId: string;
  type: 'mcp_access_token';
  exp?: number;
}

export interface ApiKeyPayload {
  key: string;
  hashedKey: string;
  organizationId: string;
  name: string;
  createdAt: string;
}

// -------------------------------------------------------------
// 1. Role-Based Access Control (RBAC) Permissions
// -------------------------------------------------------------
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['metrics:read', 'metrics:write', 'budgets:manage', 'keys:manage', 'mcp:manage', 'mcp:read', 'admin:access'],
  engineer: ['metrics:read', 'metrics:write', 'mcp:read', 'keys:read'],
  finance_lead: ['metrics:read', 'budgets:manage', 'cost:read', 'mcp:read'],
  viewer: ['metrics:read', 'mcp:read'],
};

export function getRolePermissions(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.engineer;
}

export function normalizeUserRole(inputRole?: string): UserRole {
  if (!inputRole) return 'engineer';
  const lower = inputRole.toLowerCase().trim();
  if (lower.includes('admin') || lower.includes('owner') || lower.includes('lead')) {
    if (lower.includes('finance')) return 'finance_lead';
    if (lower.includes('admin') || lower.includes('owner')) return 'admin';
  }
  if (lower.includes('finance') || lower.includes('billing')) return 'finance_lead';
  if (lower.includes('viewer') || lower.includes('guest') || lower.includes('read')) return 'viewer';
  return 'engineer';
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function hasPermission(userRole: UserRole, requiredPermission: string): boolean {
  const permissions = getRolePermissions(userRole);
  return permissions.includes(requiredPermission) || permissions.includes('admin:access');
}

// -------------------------------------------------------------
// 2. Identity Provider Authentication & JWT Token Issuer
// -------------------------------------------------------------
const JWT_SECRET = config.JWT_SECRET || 'agentmeter-secret-key-32-chars-long!';

export function issueUserToken(profile: UserProfile, expiresIn: string = '7d'): string {
  return jwt.sign(
    {
      sub: profile.userId,
      email: profile.email,
      name: profile.name,
      organizationId: profile.organizationId,
      role: profile.role,
      provider: profile.provider,
      permissions: profile.permissions || getRolePermissions(profile.role),
    },
    JWT_SECRET,
    { expiresIn } as any
  );
}

export function verifyUserToken(token: string): UserProfile | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      organizationId: decoded.organizationId,
      role: decoded.role,
      provider: decoded.provider,
      permissions: decoded.permissions || getRolePermissions(decoded.role),
    };
  } catch (err) {
    return null;
  }
}

// -------------------------------------------------------------
// 3. MCP OAuth 2.0 Access Token Server
// -------------------------------------------------------------
export function issueMcpAccessToken(options: {
  sub: string;
  organizationId: string;
  clientId: string;
  scopes?: string[];
  expiresIn?: string;
}): { accessToken: string; expiresInSeconds: number; tokenType: string; scopes: string[] } {
  const scopes = options.scopes || ['mcp:read', 'mcp:usage', 'mcp:cost'];
  const expiresIn = options.expiresIn || '30d';

  const token = jwt.sign(
    {
      sub: options.sub,
      organizationId: options.organizationId,
      clientId: options.clientId,
      scopes,
      type: 'mcp_access_token',
    },
    JWT_SECRET,
    { expiresIn } as any
  );

  return {
    accessToken: token,
    expiresInSeconds: 30 * 86400,
    tokenType: 'Bearer',
    scopes,
  };
}

export function verifyMcpAccessToken(token: string): McpTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
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
  } catch (err) {
    return null;
  }
}

// -------------------------------------------------------------
// 4. API Key Hashing & Verification
// -------------------------------------------------------------
export function generateApiKey(orgId: string, name: string = 'Default Key'): ApiKeyPayload {
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

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function verifyApiKey(rawKey: string, hashedKey: string): boolean {
  const computed = hashApiKey(rawKey);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hashedKey));
}

export function extractAuthToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (authHeader.startsWith('ApiKey ') || authHeader.startsWith('am_live_')) {
    return authHeader.replace(/^ApiKey\s+/, '').trim();
  }
  return authHeader.trim();
}
