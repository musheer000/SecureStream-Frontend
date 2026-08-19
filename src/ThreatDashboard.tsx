import React, { useEffect, useRef, useState, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  Area, AreaChart, CartesianGrid, XAxis, YAxis,
  Radar, RadarChart, PolarGrid, PolarAngleAxis
} from "recharts";
import { getAccessToken } from "./api";
import {
  AlertTriangle, Wifi, WifiOff, CheckCircle2,
  Activity, Zap, Globe, Eye, Terminal, BellRing, Target
} from "lucide-react";

export interface ThreatEvent {
  id: number;
  eventType: "BRUTE_FORCE" | "GEO_ANOMALY" | "LOGIN_FAIL" | "PORT_SCAN";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  sourceIp: string;
  targetUser: string;
  description: string;
  resolved: boolean;
  occurredAt: string;
  organization?: { id: number; name: string };
  ariaScore?: number;
  coordinatedAttack?: boolean;
}

interface Props {
  orgId: number;
  userRole: string;
  username: string;
  onResolve: (threatId: number) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

const SEVERITY_GLOW: Record<string, string> = {
  CRITICAL: "0 0 12px rgba(239,68,68,0.7)",
  HIGH: "0 0 12px rgba(249,115,22,0.7)",
  MEDIUM: "0 0 12px rgba(234,179,8,0.5)",
  LOW: "0 0 10px rgba(34,197,94,0.4)",
};

const TYPE_LABELS: Record<string, string> = {
  BRUTE_FORCE: "Brute Force",
  GEO_ANOMALY: "Geo Anomaly",
  LOGIN_FAIL: "Login Fail",
  PORT_SCAN: "Port Scan",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  BRUTE_FORCE: <Zap size={13} />,
  GEO_ANOMALY: <Globe size={13} />,
  LOGIN_FAIL: <Eye size={13} />,
  PORT_SCAN: <Terminal size={13} />,
};

// --- Audio Alert Generator (No assets needed) ---
const playCriticalAlert = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* ignore if audio blocked */ }
};

export default function ThreatDashboard({ orgId, userRole, username, onResolve }: Props) {
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [velocityData, setVelocityData] = useState<{ time: string; count: number }[]>([]);
  const [toasts, setToasts] = useState<ThreatEvent[]>([]);
  
  const clientRef = useRef<Client | null>(null);
  const velocityRef = useRef<number>(0);
  const resolvedSet = useRef<Set<number>>(new Set());

  // -- WebSocket Connection -----------------------------------------------------
  useEffect(() => {
    const token = getAccessToken();
    const client = new Client({
      webSocketFactory: () => new (typeof SockJS === 'function' ? SockJS : (SockJS as any).default)((import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'https://securestream-backend.onrender.com') + '/ws-threats') as any,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/threats/${orgId}`, (msg) => {
          try {
            const event: ThreatEvent = JSON.parse(msg.body);
            setThreats(prev => [event, ...prev].slice(0, 100));
            velocityRef.current += 1;
            
            if (event.severity === "CRITICAL") {
              playCriticalAlert();
              setToasts(prev => [event, ...prev].slice(0, 3));
              setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== event.id));
              }, 5000);
            }
          } catch (e) { /* skip malformed */ }
        });
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    });
    client.activate();
    clientRef.current = client;
    return () => { client.deactivate(); };
  }, [orgId]);

  // -- Velocity chart ticker every 5s -----------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setVelocityData(prev => [...prev.slice(-19), { time: now, count: velocityRef.current }]);
      velocityRef.current = 0;
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLocalResolve = useCallback((id: number) => {
    resolvedSet.current.add(id);
    setThreats(prev => prev.map(t => t.id === id ? { ...t, resolved: true } : t));
    onResolve(id);
  }, [onResolve]);

  // -- Derived Data -----------------------------------------------------------
  const severityDist = Object.entries(
    threats.reduce((acc, t) => { acc[t.severity] = (acc[t.severity] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const vectorDist = Object.entries(
    threats.reduce((acc, t) => { acc[t.eventType] = (acc[t.eventType] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: TYPE_LABELS[name], value }));

  const totalThreats = threats.length;
  const criticalCount = threats.filter(t => t.severity === "CRITICAL" && !t.resolved).length;
  const highCount = threats.filter(t => t.severity === "HIGH" && !t.resolved).length;
  const resolvedCount = threats.filter(t => t.resolved).length;

  // -- DEFCON System ---------------------------------------------------------
  let defcon = 5;
  let defconColor = "#3b82f6";
  let defconText = "NORMAL OPERATIONS";
  if (criticalCount > 3) {
    defcon = 1; defconColor = "#ef4444"; defconText = "CRITICAL BREACH IMMINENT";
  } else if (criticalCount > 0 || highCount > 5) {
    defcon = 2; defconColor = "#f97316"; defconText = "SEVERE THREAT DETECTED";
  } else if (highCount > 0) {
    defcon = 3; defconColor = "#eab308"; defconText = "ELEVATED RISK LEVEL";
  } else if (totalThreats > 0) {
    defcon = 4; defconColor = "#10b981"; defconText = "GENERAL MONITORING";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
      
      {/* -- Toasts -- */}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: "rgba(15,23,42,0.95)", border: "1px solid #ef4444", borderLeft: "4px solid #ef4444",
            padding: "12px 16px", borderRadius: 8, boxShadow: "0 4px 20px rgba(239,68,68,0.3)",
            display: "flex", gap: 12, alignItems: "center", minWidth: 300,
            animation: "slideIn 0.3s ease-out forwards"
          }}>
            <div style={{ background: "rgba(239,68,68,0.2)", padding: 8, borderRadius: "50%" }}>
              <BellRing size={20} color="#ef4444" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#ef4444", letterSpacing: "0.05em" }}>CRITICAL ALERT</div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>{t.description}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontFamily: "monospace" }}>IP: {t.sourceIp} | TGT: {t.targetUser}</div>
            </div>
          </div>
        ))}
      </div>

      {/* -- Connection Banner -- */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 18px", borderRadius: 10,
        background: connected ? "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(6,182,212,0.08))" : "rgba(239,68,68,0.1)",
        border: `1px solid ${connected ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {connected ? <Wifi size={16} color="#10b981" /> : <WifiOff size={16} color="#ef4444" />}
          <span style={{ fontSize: 13, fontWeight: 600, color: connected ? "#10b981" : "#ef4444" }}>
            {connected ? "LIVE � WebSocket Connected � STOMP/SockJS Secured" : "DISCONNECTED � Retrying..."}
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
          <span style={{ color: "#94a3b8" }}>Org: <strong style={{ color: "#e2e8f0" }}>CyberDefend Global</strong></span>
          <span style={{ color: "#94a3b8" }}>User: <strong style={{ color: "#e2e8f0" }}>{username}</strong></span>
          <span style={{ color: "#94a3b8" }}>Role: <strong style={{ color: "#38bdf8" }}>{userRole}</strong></span>
        </div>
      </div>

      {/* -- Defcon & KPI Cards Row -- */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr repeat(4, 1fr)", gap: 14 }}>
        
        {/* DEFCON INDICATOR */}
        <div style={{
          background: "linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.9))",
          border: `1px solid rgba(${defconColor.replace("#", "")},0.3)`,
          borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "center",
          boxShadow: defcon < 4 ? `0 0 20px ${defconColor}40` : "none",
        }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, letterSpacing: "0.1em" }}>THREAT LEVEL</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <div style={{
              fontSize: 32, fontWeight: 900, color: defconColor, lineHeight: 1,
              textShadow: `0 0 15px ${defconColor}`
            }}>
              DEFCON {defcon}
            </div>
          </div>
          <div style={{ fontSize: 11, color: defconColor, marginTop: 6, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {defconText}
          </div>
        </div>

        {[
          { label: "Total Events", value: totalThreats, color: "#38bdf8", icon: <Activity size={18} /> },
          { label: "Active Critical", value: criticalCount, color: "#ef4444", icon: <AlertTriangle size={18} /> },
          { label: "Active High", value: highCount, color: "#f97316", icon: <Zap size={18} /> },
          { label: "Resolved", value: resolvedCount, color: "#10b981", icon: <CheckCircle2 size={18} /> },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            background: "linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.9))",
            border: `1px solid ${kpi.color}40`,
            borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 2px 20px rgba(0,0,0,0.3)",
          }}>
            <div style={{ color: kpi.color, opacity: 0.85 }}>{kpi.icon}</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* -- Charts Row -- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 16 }}>

        {/* Severity Donut */}
        <div style={{
          background: "linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.9))",
          border: "1px solid rgba(56,189,248,0.12)", borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 12 }}>SEVERITY DISTRIBUTION</div>
          {severityDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={severityDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  dataKey="value" strokeWidth={0} paddingAngle={3}>
                  {severityDist.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || "#64748b"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#e2e8f0" }} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 12 }}>
              Waiting for live data...
            </div>
          )}
        </div>

        {/* Attack Vector Radar */}
        <div style={{
          background: "linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.9))",
          border: "1px solid rgba(56,189,248,0.12)", borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 0 }}>ATTACK VECTOR PROFILE</div>
          {vectorDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <RadarChart cx="50%" cy="50%" outerRadius={60} data={vectorDist}>
                <PolarGrid stroke="rgba(56,189,248,0.2)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Radar name="Threats" dataKey="value" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.3} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
             <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 12 }}>
             Waiting for live data...
           </div>
          )}
        </div>

        {/* Velocity Area Chart */}
        <div style={{
          background: "linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.9))",
          border: "1px solid rgba(56,189,248,0.12)", borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 12 }}>ATTACK VELOCITY (events/5s)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={velocityData}>
              <defs>
                <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#475569" }} />
              <YAxis tick={{ fontSize: 9, fill: "#475569" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} fill="url(#velGrad)" name="Events" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* -- Live Event Feed -- */}
      <div style={{
        background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
        border: "1px solid rgba(56,189,248,0.12)", borderRadius: 14, overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid rgba(56,189,248,0.1)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Target size={16} color="#06b6d4" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em" }}>LIVE THREAT INTELLIGENCE FEED</span>
            {connected && (
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: "#10b981",
                boxShadow: "0 0 8px #10b981", animation: "pulse 2s ease-in-out infinite",
                display: "inline-block"
              }} />
            )}
          </div>
          <span style={{ fontSize: 11, color: "#475569" }}>{threats.length} events captured</span>
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {threats.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#334155", fontSize: 13 }}>
              Waiting for incoming threat events...
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
                  {["Severity", "ARIA", "Type", "Source IP", "Target", "Description", "Time", "Action"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {threats.map((t) => (
                  <tr key={t.id} style={{
                    borderBottom: "1px solid rgba(56,189,248,0.05)",
                    background: t.coordinatedAttack ? "rgba(99,102,241,0.07)" : t.severity === "CRITICAL" ? "rgba(239,68,68,0.06)" : t.severity === "HIGH" ? "rgba(249,115,22,0.03)" : "transparent",
                    opacity: t.resolved ? 0.45 : 1,
                    transition: "opacity 0.3s",
                  }}>
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                        background: `${SEVERITY_COLORS[t.severity]}22`,
                        color: SEVERITY_COLORS[t.severity],
                        boxShadow: t.severity === "CRITICAL" || t.severity === "HIGH" ? SEVERITY_GLOW[t.severity] : "none",
                      }}>
                        {t.severity}
                      </span>
                    </td>
                    {/* ARIA Score Badge */}
                    <td style={{ padding: "9px 14px" }}>
                      {t.ariaScore != null ? (
                        <span
                          title={t.coordinatedAttack ? "⚡ Coordinated Attack Detected" : `ARIA Score: ${t.ariaScore}`}
                          style={{
                          display: "inline-block", padding: "3px 7px", borderRadius: 5,
                          fontSize: 10, fontWeight: 800, fontFamily: "monospace",
                          background: t.ariaScore >= 75 ? "rgba(239,68,68,0.15)" : t.ariaScore >= 55 ? "rgba(249,115,22,0.12)" : t.ariaScore >= 30 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.1)",
                          color: t.ariaScore >= 75 ? "#ef4444" : t.ariaScore >= 55 ? "#f97316" : t.ariaScore >= 30 ? "#f59e0b" : "#10b981",
                          boxShadow: t.coordinatedAttack ? "0 0 8px rgba(99,102,241,0.5)" : "none",
                          border: t.coordinatedAttack ? "1px solid rgba(99,102,241,0.4)" : "none",
                        }}>
                          {t.coordinatedAttack ? "⚡" : ""}{t.ariaScore}
                        </span>
                      ) : (
                        <span style={{ color: "#475569", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#94a3b8" }}>
                        {TYPE_ICONS[t.eventType]} {TYPE_LABELS[t.eventType]}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px", fontSize: 11, color: "#38bdf8", fontFamily: "monospace" }}>{t.sourceIp}</td>
                    <td style={{ padding: "9px 14px", fontSize: 11, color: "#cbd5e1" }}>{t.targetUser}</td>
                    <td style={{ padding: "9px 14px", fontSize: 11, color: "#64748b", maxWidth: 200 }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {t.description}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px", fontSize: 10, color: "#475569", whiteSpace: "nowrap" }}>
                      {new Date(t.occurredAt).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      {!t.resolved && (userRole === "ANALYST" || userRole === "ADMIN") ? (
                        <button
                          onClick={() => handleLocalResolve(t.id)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                            background: "rgba(16,185,129,0.12)", color: "#10b981",
                            border: "1px solid rgba(16,185,129,0.25)", cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.25)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "rgba(16,185,129,0.12)")}
                        >
                          <CheckCircle2 size={11} /> Resolve
                        </button>
                      ) : t.resolved ? (
                        <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700 }}>? Resolved</span>
                      ) : (
                        <span style={{ fontSize: 10, color: "#334155" }}>View Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
