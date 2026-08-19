import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getAccessToken } from "./api";
import {
  ShieldAlert, ShieldX, Activity, Zap, AlertTriangle, 
  Eye, Ban, CheckCircle2, RefreshCw, TrendingUp, Cpu
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface IpReputation {
  id: number;
  ipAddress: string;
  reputationScore: number;
  totalHits: number;
  maxSeverityOrdinal: number;
  blacklisted: boolean;
  threatLabel: string;
  firstSeen: string;
  lastSeen: string;
}

interface OrgRiskScore {
  orgId: number;
  score: number;
  riskLevel: string;
  blacklistedIpCount: number;
}

interface AnomalyStatus {
  orgId: number;
  currentHourCount: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number;
  surge: boolean;
  status: string;
  timestamp: string;
}

interface Summary {
  orgScore: OrgRiskScore;
  anomalyStatus: AnomalyStatus;
  totalIpsTracked: number;
  blacklistedCount: number;
}

interface BlacklistEvent {
  event: string;
  ip: string;
  score: number;
  timestamp: string;
}

// ── Gauge Component ────────────────────────────────────────────────────────────
function AriaGauge({ score, riskLevel }: { score: number; riskLevel: string }) {
  const radius = 80;
  const cx = 110, cy = 110;
  const startAngle = 135; // bottom-left
  const endAngle = 405; // bottom-right
  const totalAngle = endAngle - startAngle; // 270deg

  const polarToXY = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (from: number, to: number, r: number) => {
    // If from and to are the same, SVG arc doesn't draw anything, so just return M
    if (from === to) return `M ${polarToXY(from, r).x} ${polarToXY(from, r).y}`;
    const s = polarToXY(from, r);
    const e = polarToXY(to, r);
    const large = to - from > 180 ? 1 : 0;
    // sweep=1 is clockwise
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const fillAngle = startAngle + (score / 100) * totalAngle;
  
  // Needle points to fillAngle. But standard Math angle for polygon means we just use fillAngle.
  const needleEnd = polarToXY(fillAngle, radius - 15);
  // Base points are 90 deg perpendicular to needle
  const needleBase1 = polarToXY(fillAngle + 90, 8);
  const needleBase2 = polarToXY(fillAngle - 90, 8);

  const scoreColor = score < 30 ? "#10b981" : score < 55 ? "#f59e0b" : score < 75 ? "#f97316" : "#ef4444";
  const trackColor = "rgba(255,255,255,0.06)";

  return (
    <svg width={220} height={200} style={{ overflow: "visible" }}>
      {/* Track */}
      <path d={describeArc(startAngle, endAngle, radius)} fill="none" stroke={trackColor} strokeWidth={16} strokeLinecap="round" />
      {/* Fill */}
      <path d={describeArc(startAngle, fillAngle, radius)} fill="none" stroke={scoreColor} strokeWidth={16} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 8px ${scoreColor})`, transition: "all 1s ease" }} />
      {/* Needle */}
      <polygon
        points={`${needleEnd.x},${needleEnd.y} ${needleBase1.x},${needleBase1.y} ${cx},${cy} ${needleBase2.x},${needleBase2.y}`}
        fill={scoreColor} opacity={0.9} style={{ transition: "all 1s ease" }}
      />
      <circle cx={cx} cy={cy} r={10} fill="#1e293b" stroke={scoreColor} strokeWidth={3} />
      {/* Score text */}
      <text x={cx} y={cy + 45} textAnchor="middle" fill={scoreColor} fontSize={36} fontWeight={800}
        style={{ fontFamily: "monospace" }}>{score}</text>
      <text x={cx} y={cy + 65} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight={600}
        letterSpacing={2}>{riskLevel}</text>
    </svg>
  );
}

// ── Score Bar ──────────────────────────────────────────────────────────────────
function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = score < 30 ? "#10b981" : score < 60 ? "#f59e0b" : score < 80 ? "#f97316" : "#ef4444";
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4,
        boxShadow: `0 0 6px ${color}`, transition: "width 0.8s ease" }} />
    </div>
  );
}

// ── Label badge ────────────────────────────────────────────────────────────────
function ThreatLabel({ label }: { label: string }) {
  const colors: Record<string, [string, string]> = {
    CLEAN:          ["#10b981", "rgba(16,185,129,0.1)"],
    SUSPICIOUS:     ["#f59e0b", "rgba(245,158,11,0.1)"],
    THREAT_ACTOR:   ["#f97316", "rgba(249,115,22,0.1)"],
    HIGH_RISK:      ["#ef4444", "rgba(239,68,68,0.12)"],
    KNOWN_ATTACKER: ["#dc2626", "rgba(220,38,38,0.15)"],
    PARDONED:       ["#6366f1", "rgba(99,102,241,0.1)"],
  };
  const [color, bg] = colors[label] ?? ["#94a3b8", "rgba(148,163,184,0.1)"];
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 800,
      background: bg, color, letterSpacing: "0.1em", border: `1px solid ${color}33` }}>
      {label.replace("_", " ")}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function IntelligenceView({ orgId, userRole }: { orgId: number; userRole: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leaderboard, setLeaderboard] = useState<IpReputation[]>([]);
  const [blacklist, setBlacklist] = useState<IpReputation[]>([]);
  const [zHistory, setZHistory] = useState<{ t: string; z: number; baseline: number; actual: number }[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<BlacklistEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanning, setUnbanning] = useState<number | null>(null);

  const [viewTab, setViewTab] = useState<'live' | 'forecast'>('live');
  const [forecast, setForecast] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [sumRes, lbRes, blRes, forecastRes] = await Promise.all([
        api.get(`/intelligence/summary/${orgId}`),
        api.get(`/intelligence/ip-leaderboard`),
        api.get(`/intelligence/blacklist`),
        api.get(`/intelligence/forecast/${orgId}`)
      ]);
      setSummary(sumRes.data);
      setLeaderboard(lbRes.data);
      setBlacklist(blRes.data);
      setForecast(forecastRes.data);

      // Build Z-score history point
      const anom: AnomalyStatus = sumRes.data.anomalyStatus;
      setZHistory(prev => {
        const entry = {
          t: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          z: Math.round(anom.zScore * 100) / 100,
          baseline: Math.round(anom.baselineMean),
          actual: anom.currentHourCount,
        };
        return [...prev.slice(-29), entry]; // keep last 30 points
      });
    } catch (err) {
      console.error("Intelligence fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Poll every 6 seconds
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 6000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // WebSocket for live blacklist events
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const client = new Client({
      webSocketFactory: () => new (typeof SockJS === 'function' ? SockJS : (SockJS as any).default)((import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'https://securestream-backend.onrender.com') + '/ws-threats'),
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        client.subscribe(`/topic/intelligence/${orgId}`, (msg) => {
          try {
            const data: BlacklistEvent = JSON.parse(msg.body);
            setLiveAlerts(prev => [data, ...prev.slice(0, 9)]);
          } catch (_) {}
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [orgId]);

  const handleUnban = async (id: number) => {
    if (userRole !== "ADMIN") return;
    setUnbanning(id);
    try {
      await api.patch(`/intelligence/blacklist/${id}/unban`);
      fetchAll();
    } catch (err) { console.error(err); }
    finally { setUnbanning(null); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 40, color: "#94a3b8" }}>
      <RefreshCw size={18} className="spin" /> Loading ARIA Intelligence Engine...
    </div>
  );

  const orgScore = summary?.orgScore;
  const anomaly  = summary?.anomalyStatus;
  const scoreColor = (orgScore?.score ?? 0) < 30 ? "#10b981"
    : (orgScore?.score ?? 0) < 55 ? "#f59e0b"
    : (orgScore?.score ?? 0) < 75 ? "#f97316" : "#ef4444";

  return (
    <div style={{ padding: "0 20px 40px" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#6366f1,#06b6d4)",
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Cpu size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: "#e2e8f0", fontWeight: 700 }}>
              ARIA Intelligence Engine
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>
              Adaptive Risk Intelligence Algorithm — 4-Layer Threat Scoring
            </p>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", background: "rgba(15,23,42,0.6)", borderRadius: 8, padding: 4, border: "1px solid rgba(255,255,255,0.05)" }}>
            <button 
              onClick={() => setViewTab('live')}
              style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, 
                background: viewTab === 'live' ? "rgba(16,185,129,0.15)" : "transparent",
                color: viewTab === 'live' ? "#10b981" : "#64748b", cursor: "pointer", transition: "all 0.2s" }}>
              Live Dashboard
            </button>
            <button 
              onClick={() => setViewTab('forecast')}
              style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, 
                background: viewTab === 'forecast' ? "rgba(99,102,241,0.15)" : "transparent",
                color: viewTab === 'forecast' ? "#818cf8" : "#64748b", cursor: "pointer", transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={14} /> Predictive Forecast
            </button>
          </div>

          <button onClick={async () => {
              setLoading(true);
              await fetchAll();
              setLoading(false);
            }} style={{ display: "flex", alignItems: "center", gap: 6,
            background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)",
            color: "#38bdf8", padding: "6px 14px", borderRadius: 8, fontSize: 12,
            fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={13} className={loading ? "spin" : ""} /> {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {viewTab === 'live' ? (
        <>
          {/* ── Row 1: Stats + Gauge ───────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>

        {/* Gauge card */}
        <div style={{
          background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: `1px solid ${scoreColor}33`, borderRadius: 16, padding: "20px",
          display: "flex", flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em" }}>
              ORG RISK SCORE
            </span>
            <ShieldAlert size={16} color={scoreColor} />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
            <AriaGauge score={orgScore?.score ?? 0} riskLevel={orgScore?.riskLevel ?? "SECURE"} />
          </div>
        </div>

        {/* IPs Tracked */}
        <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: "1px solid rgba(56,189,248,0.1)", borderRadius: 16, padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em" }}>IPs TRACKED</span>
            <Eye size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#38bdf8", fontFamily: "monospace",
            textShadow: "0 0 20px rgba(56,189,248,0.4)" }}>
            {summary?.totalIpsTracked ?? 0}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>Unique attacker IPs</div>
        </div>

        {/* Blacklisted */}
        <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: "1px solid rgba(239,68,68,0.15)", borderRadius: 16, padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em" }}>BLACKLISTED</span>
            <Ban size={16} color="#ef4444" />
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#ef4444", fontFamily: "monospace",
            textShadow: "0 0 20px rgba(239,68,68,0.4)" }}>
            {summary?.blacklistedCount ?? 0}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>Auto-blacklisted IPs</div>
        </div>

        {/* Anomaly Status */}
        <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: `1px solid ${anomaly?.surge ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.15)"}`,
          borderRadius: 16, padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em" }}>ANOMALY (Z)</span>
            <Activity size={16} color={anomaly?.surge ? "#ef4444" : "#10b981"} />
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, fontFamily: "monospace",
            color: anomaly?.surge ? "#ef4444" : "#10b981",
            textShadow: `0 0 20px ${anomaly?.surge ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.3)"}` }}>
            {Math.abs(anomaly?.zScore ?? 0).toFixed(1)}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700,
            color: anomaly?.surge ? "#ef4444" : "#10b981" }}>
            {anomaly?.surge ? "⚡ SURGE DETECTED" : "● BASELINE NORMAL"}
          </div>
        </div>
      </div>

      {/* ── Row 2: Z-Score Chart + IP Leaderboard ─────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>

        {/* Z-Score Anomaly Chart */}
        <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: "1px solid rgba(56,189,248,0.1)", borderRadius: 16, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} color="#06b6d4" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
              Layer 3: Z-Score Behavioral Anomaly Monitor
            </span>
            {anomaly?.surge && (
              <span style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6,
                background: "rgba(239,68,68,0.15)", color: "#ef4444",
                fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", animation: "pulse 1.5s infinite" }}>
                ⚡ SURGE
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={zHistory}>
              <defs>
                <linearGradient id="zGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="t" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <ReferenceLine y={2.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Z=2.5 (Surge)", fill: "#ef4444", fontSize: 10 }} />
              <ReferenceLine y={-2.5} stroke="#ef4444" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="z" stroke="#6366f1" fill="url(#zGrad)" strokeWidth={2} name="Z-Score" dot={false} />
              <Area type="monotone" dataKey="actual" stroke="#06b6d4" fill="url(#aGrad)" strokeWidth={1.5} name="Current Hr Threats" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* IP Leaderboard */}
        <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: "1px solid rgba(56,189,248,0.1)", borderRadius: 16, padding: "20px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <ShieldAlert size={16} color="#f97316" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Layer 2: IP Reputation Board</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {leaderboard.slice(0, 8).map((ip, i) => (
              <div key={ip.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", minWidth: 16 }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "monospace" }}>
                      {ip.ipAddress}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <ThreatLabel label={ip.threatLabel} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#f97316", fontFamily: "monospace" }}>
                      {Math.round(ip.reputationScore)}
                    </span>
                  </div>
                </div>
                <ScoreBar score={ip.reputationScore} />
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                No IPs tracked yet. Waiting for threats...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Blacklist + Live Alerts ────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>

        {/* Blacklist Table */}
        <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: "1px solid rgba(239,68,68,0.12)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(239,68,68,0.08)",
            display: "flex", alignItems: "center", gap: 8 }}>
            <Ban size={16} color="#ef4444" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Layer 2: Blacklisted IPs</span>
            <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 5,
              background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: 10, fontWeight: 700 }}>
              {blacklist.length} BLOCKED
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["IP Address", "Score", "Hits", "Last Seen", userRole === "ADMIN" ? "Action" : ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10,
                    color: "#475569", fontWeight: 700, letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blacklist.map(ip => (
                <tr key={ip.id} style={{ borderTop: "1px solid rgba(239,68,68,0.05)" }}>
                  <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 12, color: "#ef4444" }}>
                    {ip.ipAddress}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#f97316" }}>
                    {Math.round(ip.reputationScore)}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
                    {ip.totalHits}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 11, color: "#64748b" }}>
                    {new Date(ip.lastSeen).toLocaleTimeString()}
                  </td>
                  {userRole === "ADMIN" && (
                    <td style={{ padding: "10px 16px" }}>
                      <button
                        onClick={() => handleUnban(ip.id)}
                        disabled={unbanning === ip.id}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5,
                          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
                          color: "#818cf8", padding: "4px 10px", borderRadius: 6,
                          fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        <CheckCircle2 size={11} /> {unbanning === ip.id ? "..." : "Unban"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {blacklist.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#475569", fontSize: 13 }}>
                    No IPs blacklisted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Live Blacklist Alert Feed */}
        <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: "1px solid rgba(239,68,68,0.15)", borderRadius: 16, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Zap size={16} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Live Blacklist Events</span>
            <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%",
              background: "#10b981", boxShadow: "0 0 6px #10b981", animation: "pulse 2s infinite" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {liveAlerts.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                Monitoring for blacklist events...
              </div>
            ) : liveAlerts.map((alert, i) => (
              <div key={i} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#ef4444", letterSpacing: "0.08em" }}>
                    AUTO-BLACKLISTED
                  </span>
                  <span style={{ fontSize: 10, color: "#64748b" }}>
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: "#fca5a5", fontWeight: 600 }}>
                  {alert.ip}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  Score: <span style={{ color: "#f97316", fontWeight: 700 }}>{Math.round(alert.score)}</span> / 100
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
        </>
      ) : (
        /* ── Forecast Tab ────────────────────────────────────────────────── */
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Top Row: Predictive Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            {/* Next Attack Window */}
            <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
              border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: "20px",
              display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.1em" }}>PREDICTED ATTACK WINDOW</span>
                <TrendingUp size={16} color="#818cf8" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#e2e8f0", fontFamily: "monospace", textShadow: "0 0 10px rgba(99,102,241,0.4)" }}>
                {forecast?.nextAttackWindow || "Analyzing..."}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>Based on historical peak cyclicality</div>
            </div>

            {/* Confidence Score */}
            <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
              border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: "20px",
              display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: "0.1em" }}>PREDICTION CONFIDENCE</span>
                <CheckCircle2 size={16} color="#34d399" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: "#34d399", fontFamily: "monospace", textShadow: "0 0 20px rgba(52,211,153,0.4)" }}>
                  {forecast?.confidenceScore || 0}%
                </span>
              </div>
              <div style={{ marginTop: 8, width: "100%", background: "rgba(255,255,255,0.05)", height: 6, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${forecast?.confidenceScore || 0}%`, background: "#34d399", boxShadow: "0 0 8px #34d399" }} />
              </div>
            </div>

            {/* Primary Target Vector */}
            <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
              border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "20px",
              display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.1em" }}>PRIMARY THREAT VECTOR</span>
                <AlertTriangle size={16} color="#fbbf24" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fcd34d", textShadow: "0 0 15px rgba(245,158,11,0.3)" }}>
                {forecast?.predictedVector || "Unknown"}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>Most likely attack methodology</div>
            </div>
          </div>

          {/* Bottom Row: 24h Volume Chart */}
          <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
            border: "1px solid rgba(99,102,241,0.15)", borderRadius: 16, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <Activity size={16} color="#818cf8" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>24-Hour Threat Volume (Historical & Projected)</span>
            </div>
            
            <div style={{ height: 260, width: "100%" }}>
              {forecast?.hourlyData ? (
                <ResponsiveContainer>
                  <AreaChart data={forecast.hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="time" stroke="#475569" fontSize={10} tickMargin={10} minTickGap={20} />
                    <YAxis stroke="#475569" fontSize={10} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "#818cf8", fontWeight: 700 }}
                    />
                    <Area type="monotone" dataKey="volume" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b" }}>
                  Generating historical threat model...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #10b981; }
          50% { opacity: 0.4; box-shadow: 0 0 2px #10b981; }
        }
        .aria-gauge-card svg { display: block; margin: 0 auto; }
      `}</style>
    </div>
  );
}
