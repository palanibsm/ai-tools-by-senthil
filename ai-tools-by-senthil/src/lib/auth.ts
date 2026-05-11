import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type UserStatus = "pending" | "approved" | "rejected" | "disabled";
export type UserRole = "admin" | "user";

type UserRecord = {
  username: string;
  passwordHash: string;
  salt: string;
  status: UserStatus;
  role: UserRole;
  createdAt: number;
};

type SessionRecord = {
  sid: string;
  username: string;
  role: UserRole;
  expiresAt: number;
};

type Store = {
  users: UserRecord[];
  sessions: SessionRecord[];
  usedApprovalNonces: string[];
};

const STORE_PATH = path.join("/tmp", "ai-tools-auth-store.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function getSecret() {
  return process.env.AUTH_SIGNING_SECRET || "dev-secret-change-me";
}

function ensureStore(): Store {
  if (!fs.existsSync(STORE_PATH)) {
    const initial: Store = { users: [], sessions: [], usedApprovalNonces: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
  }
  const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
  return parsed;
}

function saveStore(store: Store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function hashPassword(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
}

export function ensureAdminBootstrap() {
  const store = ensureStore();
  const adminUser = process.env.ADMIN_USERNAME || "senthil-admin";
  const adminPwd = process.env.ADMIN_BOOTSTRAP_PASSWORD || "ChangeMeNow!123";

  const exists = store.users.find((u) => u.username === adminUser);
  if (!exists) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(adminPwd, salt);
    store.users.push({
      username: adminUser,
      passwordHash,
      salt,
      status: "approved",
      role: "admin",
      createdAt: Date.now(),
    });
    saveStore(store);
  }
}

export function registerPendingUser(username: string, password: string) {
  const store = ensureStore();
  const clean = username.trim().toLowerCase();
  if (!clean) return { ok: false as const, error: "Username required" };
  if (password.length < 8) return { ok: false as const, error: "Password must be at least 8 characters" };

  const exists = store.users.find((u) => u.username === clean);
  if (exists) return { ok: false as const, error: "User already exists" };

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  store.users.push({
    username: clean,
    passwordHash,
    salt,
    status: "pending",
    role: "user",
    createdAt: Date.now(),
  });
  saveStore(store);
  return { ok: true as const, username: clean };
}

export function approveUser(username: string) {
  const store = ensureStore();
  const user = store.users.find((u) => u.username === username);
  if (!user) return false;
  user.status = "approved";
  saveStore(store);
  return true;
}

export function rejectUser(username: string) {
  const store = ensureStore();
  const user = store.users.find((u) => u.username === username);
  if (!user) return false;
  user.status = "rejected";
  saveStore(store);
  return true;
}

export function removeUser(username: string) {
  const store = ensureStore();
  const before = store.users.length;
  store.users = store.users.filter((u) => u.username !== username);
  store.sessions = store.sessions.filter((s) => s.username !== username);
  saveStore(store);
  return store.users.length < before;
}

export function loginUser(username: string, password: string) {
  const store = ensureStore();
  const clean = username.trim().toLowerCase();
  const user = store.users.find((u) => u.username === clean);
  if (!user) return { ok: false as const, error: "Invalid credentials" };
  if (user.status !== "approved") return { ok: false as const, error: `User is ${user.status}` };

  const provided = hashPassword(password, user.salt);
  if (provided !== user.passwordHash) return { ok: false as const, error: "Invalid credentials" };

  const sid = crypto.randomBytes(24).toString("hex");
  store.sessions.push({
    sid,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  saveStore(store);
  return { ok: true as const, sid, username: user.username, role: user.role };
}

export function logoutSession(sid: string) {
  const store = ensureStore();
  store.sessions = store.sessions.filter((s) => s.sid !== sid);
  saveStore(store);
}

export function getSession(sid: string | undefined) {
  if (!sid) return null;
  const store = ensureStore();
  const now = Date.now();
  store.sessions = store.sessions.filter((s) => s.expiresAt > now);
  const session = store.sessions.find((s) => s.sid === sid);
  saveStore(store);
  return session || null;
}

export function listUsers() {
  const store = ensureStore();
  return store.users.map((u) => ({ username: u.username, status: u.status, role: u.role, createdAt: u.createdAt }));
}

export function signApprovalToken(payload: { username: string; action: "approve" | "reject"; exp: number; nonce: string }) {
  const base = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(base).digest("base64url");
  return `${base}.${sig}`;
}

export function verifyApprovalToken(token: string) {
  const [base, sig] = token.split(".");
  if (!base || !sig) return { ok: false as const, error: "invalid token" };
  const expected = crypto.createHmac("sha256", getSecret()).update(base).digest("base64url");
  if (sig !== expected) return { ok: false as const, error: "bad signature" };

  const payload = JSON.parse(Buffer.from(base, "base64url").toString("utf8")) as {
    username: string;
    action: "approve" | "reject";
    exp: number;
    nonce: string;
  };

  if (Date.now() > payload.exp) return { ok: false as const, error: "expired" };

  const store = ensureStore();
  if (store.usedApprovalNonces.includes(payload.nonce)) return { ok: false as const, error: "already used" };

  return { ok: true as const, payload };
}

export function markApprovalTokenUsed(nonce: string) {
  const store = ensureStore();
  store.usedApprovalNonces.push(nonce);
  if (store.usedApprovalNonces.length > 5000) {
    store.usedApprovalNonces = store.usedApprovalNonces.slice(-1000);
  }
  saveStore(store);
}
