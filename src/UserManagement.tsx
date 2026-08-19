import { useEffect, useState } from "react";
import { api } from "./api";
import {
  Shield, Users, Eye, Cpu, Trash2, Power, X,
  CheckCircle, AlertTriangle, Search, UserCog, RefreshCw
} from "lucide-react";

interface AppUser {
  id: number;
  username: string;
  email: string;
  role: string;
  active: boolean;
}

interface Props { theme: "dark" | "light"; }

/* ── Role Config ─────────────────────────────────────── */
const ROLE_CFG: Record<string, { icon: any; label: string; color: string; bg: string; border: string; gradient: string; avatarGrad: string }> = {
  ADMIN:   { icon: Shield,  label: "Admin",   color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.4)",  gradient: "linear-gradient(135deg,#f59e0b,#d97706)", avatarGrad: "linear-gradient(135deg,#f59e0b,#ef4444)" },
  ANALYST: { icon: Cpu,     label: "Analyst", color: "#818cf8", bg: "rgba(129,140,248,0.12)", border: "rgba(129,140,248,0.4)", gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)", avatarGrad: "linear-gradient(135deg,#6366f1,#06b6d4)" },
  VIEWER:  { icon: Eye,     label: "Viewer",  color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.4)",  gradient: "linear-gradient(135deg,#10b981,#06b6d4)", avatarGrad: "linear-gradient(135deg,#10b981,#0ea5e9)" },
};

export default function UserManagement({ theme }: Props) {
  const [users, setUsers]           = useState<AppUser[]>([]);
  const [filtered, setFiltered]     = useState<AppUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "ANALYST" | "VIEWER">("ALL");
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [delTarget, setDelTarget]   = useState<AppUser | null>(null);

  const isDark = theme === "dark";
  const surface  = isDark ? "rgba(15,23,42,0.97)"   : "#ffffff";
  const surface2 = isDark ? "rgba(30,41,59,0.85)"   : "#f8fafc";
  const border   = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const text     = isDark ? "#f1f5f9"                : "#0f172a";
  const sub      = isDark ? "#94a3b8"                : "#64748b";

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/dashboard");
      setUsers(res.data.allUsers);
    } catch (err: any) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  // Apply search + role filter
  useEffect(() => {
    let list = [...users];
    if (roleFilter !== "ALL") list = list.filter(u => u.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    setFiltered(list);
  }, [users, search, roleFilter]);

  const handleRoleChange = async (id: number, role: string) => {
    try { await api.patch(`/users/${id}/role`, { role }); fetchUsers(); showToast("Role updated", true); }
    catch { showToast("Failed to update role", false); }
  };

  const handleToggle = async (u: AppUser) => {
    try { await api.patch(`/users/${u.id}/status`, { active: !u.active }); fetchUsers(); showToast(`User ${u.active ? "disabled" : "enabled"}`, true); }
    catch { showToast("Failed", false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    try { await api.delete(`/users/${delTarget.id}`); setDelTarget(null); fetchUsers(); showToast(`"${delTarget.username}" deleted`, true); }
    catch (err: any) { setDelTarget(null); showToast(err.response?.data?.error || "Delete failed", false); }
  };

  const counts = { ADMIN: users.filter(u => u.role === "ADMIN").length, ANALYST: users.filter(u => u.role === "ANALYST").length, VIEWER: users.filter(u => u.role === "VIEWER").length };

  if (error) return <div style={{ padding: 20, color: "#f43f5e" }}>Error: {error}</div>;

  return (
    <div style={{ padding: "0 24px 40px", position: "relative", minHeight: "100%" }}>

      {/* ── Toast ──────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", top: 80, right: 24, zIndex: 9999,
          background: toast.ok ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#ef4444,#dc2626)",
          color: "#fff", padding: "12px 20px", borderRadius: 12,
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 700, boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          animation: "slideIn 0.3s ease"
        }}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />} {toast.msg}
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────── */}
      {delTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} onClick={() => setDelTarget(null)} />
          <div style={{
            position: "relative", background: isDark ? "#0f172a" : "#fff",
            border: "1px solid rgba(239,68,68,0.4)", borderRadius: 16,
            padding: 32, width: 400, boxShadow: "0 30px 80px rgba(0,0,0,0.7)"
          }}>
            <button onClick={() => setDelTarget(null)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: sub }}><X size={18} /></button>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <Trash2 size={26} color="#ef4444" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: text, marginBottom: 6 }}>Delete User Account</div>
              <div style={{ fontSize: 13, color: sub, lineHeight: 1.7 }}>
                Are you sure you want to permanently delete<br />
                <strong style={{ color: "#ef4444" }}>"{delTarget.username}"</strong>?<br />
                This cannot be undone.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDelTarget(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: sub, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 13, boxShadow: "0 4px 14px rgba(239,68,68,0.4)" }}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#38bdf8,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(56,189,248,0.3)" }}>
            <UserCog size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: text }}>User Management</h2>
            <p style={{ margin: 0, fontSize: 11, color: sub }}>Manage roles, access & permissions across your organization</p>
          </div>
        </div>
        <button onClick={fetchUsers} style={{ display: "flex", alignItems: "center", gap: 6, background: isDark ? "rgba(56,189,248,0.1)" : "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 8, padding: "7px 14px", color: "#38bdf8", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Stats Strip ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {([
          { label: "Total Users",  value: users.length,         color: "#38bdf8", icon: Users,  bg: "rgba(56,189,248,0.1)"  },
          { label: "Admins",       value: counts.ADMIN,         color: "#fbbf24", icon: Shield, bg: "rgba(251,191,36,0.1)"  },
          { label: "Analysts",     value: counts.ANALYST,       color: "#818cf8", icon: Cpu,    bg: "rgba(129,140,248,0.1)" },
          { label: "Viewers",      value: counts.VIEWER,        color: "#34d399", icon: Eye,    bg: "rgba(52,211,153,0.1)"  },
        ] as const).map(({ label, value, color, icon: Icon, bg }) => (
          <div key={label} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: sub, marginTop: 3 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters Row ────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} color={sub} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username or email..."
            style={{
              width: "100%", boxSizing: "border-box",
              background: surface, border: `1px solid ${border}`,
              borderRadius: 10, padding: "10px 14px 10px 36px",
              color: text, fontSize: 13, outline: "none"
            }}
          />
        </div>
        {/* Role Tabs */}
        {(["ALL", "ADMIN", "ANALYST", "VIEWER"] as const).map(r => {
          const cfg = r === "ALL" ? null : ROLE_CFG[r];
          const active = roleFilter === r;
          return (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              style={{
                padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: active ? `2px solid ${cfg?.color || "#38bdf8"}` : `1px solid ${border}`,
                background: active ? (cfg?.bg || "rgba(56,189,248,0.12)") : surface,
                color: active ? (cfg?.color || "#38bdf8") : sub,
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: active ? `0 0 12px ${(cfg?.color || "#38bdf8")}30` : "none",
                transition: "all 0.2s"
              }}
            >
              {cfg && <cfg.icon size={13} />} {r === "ALL" ? "All Users" : cfg!.label + "s"}
              <span style={{ background: active ? `${cfg?.color || "#38bdf8"}30` : "rgba(255,255,255,0.06)", borderRadius: 8, padding: "1px 7px", fontSize: 10 }}>
                {r === "ALL" ? users.length : counts[r]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── User Cards ─────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: sub }}>
          <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading users...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 50, color: sub, fontSize: 14 }}>No users match your filter.</div>
          )}
          {filtered.map(u => {
            const cfg = ROLE_CFG[u.role] || ROLE_CFG.VIEWER;
            const RoleIcon = cfg.icon;
            return (
              <div
                key={u.id}
                style={{
                  background: surface,
                  border: `1px solid ${border}`,
                  borderLeft: `4px solid ${cfg.color}`,
                  borderRadius: 14,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  boxShadow: isDark ? "0 2px 10px rgba(0,0,0,0.25)" : "0 2px 10px rgba(0,0,0,0.05)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateX(4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px ${cfg.color}20`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = isDark ? "0 2px 10px rgba(0,0,0,0.25)" : "0 2px 10px rgba(0,0,0,0.05)"; }}
              >
                {/* Avatar */}
                <div style={{ width: 46, height: 46, borderRadius: 14, background: cfg.avatarGrad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: `0 4px 12px ${cfg.color}40` }}>
                  {u.username.charAt(0).toUpperCase()}
                </div>

                {/* Name + Email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: text, display: "flex", alignItems: "center", gap: 8 }}>
                    {u.username}
                    {!u.active && <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: 6, padding: "2px 7px" }}>DISABLED</span>}
                  </div>
                  <div style={{ fontSize: 12, color: sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                </div>

                {/* Role Badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "6px 14px" }}>
                    <RoleIcon size={13} color={cfg.color} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color, letterSpacing: "0.04em" }}>{cfg.label.toUpperCase()}</span>
                  </div>
                </div>

                {/* Role Selector (non-admin only) */}
                {u.role !== "ADMIN" && (
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    style={{
                      background: isDark ? "rgba(15,23,42,0.8)" : "#f0f9ff",
                      border: `1px solid ${cfg.border}`, color: cfg.color,
                      padding: "6px 10px", borderRadius: 8, fontSize: 12,
                      outline: "none", cursor: "pointer", fontWeight: 700, flexShrink: 0
                    }}
                  >
                    <option value="ANALYST">ANALYST</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                )}

                {/* Status Toggle */}
                {u.role !== "ADMIN" && (
                  <button
                    onClick={() => handleToggle(u)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: u.active ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                      border: `1px solid ${u.active ? "rgba(239,68,68,0.35)" : "rgba(16,185,129,0.35)"}`,
                      color: u.active ? "#ef4444" : "#10b981",
                      padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", flexShrink: 0
                    }}
                  >
                    <Power size={13} /> {u.active ? "Disable" : "Enable"}
                  </button>
                )}

                {/* Delete */}
                {u.role !== "ADMIN" ? (
                  <button
                    onClick={() => setDelTarget(u)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                      color: "#ef4444", padding: "7px 14px", borderRadius: 9,
                      fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0
                    }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                ) : (
                  <div style={{ padding: "7px 14px", fontSize: 12, color: sub, flexShrink: 0 }}>Protected</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
