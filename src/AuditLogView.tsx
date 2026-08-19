import { useEffect, useState } from "react";
import { api } from "./api";
import { Terminal, Clock, User, Hash } from "lucide-react";

interface AuditLog {
  id: number;
  actor: string;
  action: string;
  targetEntity: string;
  targetId: number;
  details: string;
  createdAt: string;
}

export default function AuditLogView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get("/audit");
        setLogs(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) return <div style={{ padding: 20, color: "#94a3b8" }}>Loading audit logs...</div>;
  if (error) return <div style={{ padding: 20, color: "#f43f5e" }}>Error: {error}</div>;

  return (
    <div style={{ padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Terminal size={24} color="#06b6d4" />
        <h2 style={{ margin: 0, fontSize: 18, color: "#e2e8f0" }}>Security Audit Logs</h2>
      </div>

      <div style={{
        background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
        border: "1px solid rgba(56,189,248,0.12)", borderRadius: 14, overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
              {["Timestamp", "Actor", "Action", "Target", "Details"].map(h => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, color: "#475569", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: "1px solid rgba(56,189,248,0.05)" }}>
                <td style={{ padding: "12px 14px", color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={12} /> {new Date(log.createdAt).toLocaleString()}
                  </div>
                </td>
                <td style={{ padding: "12px 14px", color: "#38bdf8", fontSize: 13, fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <User size={12} /> {log.actor || "System"}
                  </div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{
                    padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                    background: "rgba(56,189,248,0.1)", color: "#38bdf8",
                  }}>
                    {log.action}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", color: "#94a3b8", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Hash size={12} /> {log.targetEntity} ({log.targetId})
                  </div>
                </td>
                <td style={{ padding: "12px 14px", color: "#cbd5e1", fontSize: 12, fontFamily: "monospace" }}>
                  {log.details || "-"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  No audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
