import React, { useEffect, useState, useCallback } from 'react';
import { Globe, Crosshair, AlertCircle, RefreshCw, MapPin } from 'lucide-react';
import { api } from './api';

interface TopCountry {
  countryCode: string;
  countryName: string;
  count: number;
}

// World map SVG path data for major continents (simplified)
const WORLD_SVG_PATH = "M 50,100 Q 80,70 120,80 Q 160,90 180,70 Q 200,50 220,60 Q 240,70 260,60 Q 300,40 340,50 Q 360,55 380,45 Q 420,35 440,50 L 450,80 Q 430,90 410,85 Q 380,80 360,90 Q 340,100 320,90 Q 300,80 280,90 Q 260,100 240,95 Q 220,90 200,100 Q 180,110 160,105 Q 140,100 120,110 Q 100,120 80,115 Z";

// Approximate lat/lng to SVG x/y converter
function latLngToXY(lat: number, lng: number, width: number, height: number) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

// Country flag emoji from country code
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  const offset = 0x1F1E6;
  const A = 0x41;
  return String.fromCodePoint(offset + code.charCodeAt(0) - A) +
         String.fromCodePoint(offset + code.charCodeAt(1) - A);
}

interface ThreatPing {
  id: string;
  lat: number;
  lng: number;
  severity: string;
  countryCode: string;
}

export default function GeoMapView({ orgId }: { orgId: number }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ totalAnalyzed: number; topCountries: TopCountry[] } | null>(null);
  const [pings, setPings] = useState<ThreatPing[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get(`/intelligence/geo-stats/${orgId}`);
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // WebSocket for live pings
  useEffect(() => {
    let stompClient: any = null;
    const connectWS = async () => {
      try {
        const { Client } = await import('@stomp/stompjs');
        const SockJS = (await import('sockjs-client')).default;
        const backendUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'https://securestream-backend.onrender.com';
        const socket = new SockJS(`${backendUrl}/ws-threats`);
        stompClient = new Client({
          webSocketFactory: () => socket as any,
          debug: () => {},
          onConnect: () => {
            stompClient.subscribe(`/topic/threats/${orgId}`, (msg: any) => {
              try {
                const data = JSON.parse(msg.body);
                if (data.latitude && data.longitude) {
                  setPings(prev => [...prev.slice(-20), {
                    id: data.id + '-' + Date.now(),
                    lat: data.latitude,
                    lng: data.longitude,
                    severity: data.severity,
                    countryCode: data.countryCode
                  }]);
                }
              } catch (_) {}
            });
          },
        });
        stompClient.activate();
      } catch (_) {}
    };
    connectWS();
    return () => { if (stompClient) stompClient.deactivate(); };
  }, [orgId]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 40, color: "#94a3b8" }}>
        <RefreshCw size={18} className="spin" /> Loading Geo-IP Mapping...
      </div>
    );
  }

  const maxCount = stats?.topCountries[0]?.count || 1;
  const mapW = 800, mapH = 400;

  return (
    <div style={{ padding: "0 20px 40px", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#db2777,#f43f5e)",
          borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Globe size={20} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "#e2e8f0", fontWeight: 700 }}>Global Threat Map</h2>
          <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>Real-time Origin Tracking & Geo-IP Analysis</p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
        {/* SVG Map */}
        <div style={{ flex: 1, background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: "1px solid rgba(244,63,94,0.15)", borderRadius: 16, overflow: "hidden", position: "relative" }}>

          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 8,
            background: "rgba(15,23,42,0.85)", padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
            <Crosshair size={14} color="#f43f5e" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", letterSpacing: "0.1em" }}>LIVE TRACKING ACTIVE</span>
          </div>

          <svg viewBox={`0 0 ${mapW} ${mapH}`} style={{ width: "100%", height: "100%" }}
            xmlns="http://www.w3.org/2000/svg">
            {/* Ocean */}
            <rect width={mapW} height={mapH} fill="#0f172a" />
            {/* Grid lines */}
            {[...Array(12)].map((_, i) => (
              <line key={`v${i}`} x1={(i / 12) * mapW} y1={0} x2={(i / 12) * mapW} y2={mapH}
                stroke="rgba(148,163,184,0.05)" strokeWidth={1} />
            ))}
            {[...Array(6)].map((_, i) => (
              <line key={`h${i}`} x1={0} y1={(i / 6) * mapH} x2={mapW} y2={(i / 6) * mapH}
                stroke="rgba(148,163,184,0.05)" strokeWidth={1} />
            ))}
            {/* Equator line */}
            <line x1={0} y1={mapH / 2} x2={mapW} y2={mapH / 2}
              stroke="rgba(148,163,184,0.1)" strokeWidth={1} strokeDasharray="4,4" />

            {/* Simplified continent shapes */}
            {/* North America */}
            <path d="M 100,60 Q 130,40 160,55 Q 175,65 170,90 Q 165,110 150,130 Q 135,150 120,145 Q 100,135 90,110 Q 80,90 100,60 Z"
              fill="#1e293b" stroke="#334155" strokeWidth={0.8} />
            {/* South America */}
            <path d="M 155,155 Q 170,145 185,155 Q 195,165 190,190 Q 185,215 175,230 Q 165,240 155,230 Q 145,215 145,190 Q 145,165 155,155 Z"
              fill="#1e293b" stroke="#334155" strokeWidth={0.8} />
            {/* Europe */}
            <path d="M 340,50 Q 360,38 390,45 Q 410,50 415,65 Q 410,80 395,82 Q 375,83 360,75 Q 345,68 340,50 Z"
              fill="#1e293b" stroke="#334155" strokeWidth={0.8} />
            {/* Africa */}
            <path d="M 355,100 Q 375,88 395,100 Q 410,115 408,145 Q 405,175 390,195 Q 375,210 360,200 Q 345,185 342,160 Q 340,130 355,100 Z"
              fill="#1e293b" stroke="#334155" strokeWidth={0.8} />
            {/* Asia */}
            <path d="M 420,40 Q 470,25 540,35 Q 590,42 620,60 Q 640,75 630,95 Q 615,110 590,115 Q 555,118 520,110 Q 490,102 465,90 Q 440,78 430,60 Q 420,50 420,40 Z"
              fill="#1e293b" stroke="#334155" strokeWidth={0.8} />
            {/* Australia */}
            <path d="M 560,200 Q 590,188 620,200 Q 638,215 635,235 Q 628,255 610,260 Q 588,262 572,248 Q 558,232 560,200 Z"
              fill="#1e293b" stroke="#334155" strokeWidth={0.8} />

            {/* Country dots from stats */}
            {stats?.topCountries.slice(0, 10).map((tc, i) => {
              // Hardcoded approximate positions for top countries
              const positions: Record<string, [number, number]> = {
                CN: [570, 80], US: [140, 85], RU: [520, 55], BR: [175, 195],
                IN: [510, 110], DE: [368, 62], FR: [352, 65], GB: [338, 58],
                KR: [618, 82], JP: [638, 88], IR: [445, 85], NG: [368, 148],
                ZA: [378, 195], AU: [595, 225], CA: [130, 60], MX: [120, 120],
              };
              const pos = positions[tc.countryCode] || [Math.random() * 700 + 50, Math.random() * 300 + 50];
              const r = 4 + (tc.count / maxCount) * 10;
              const color = i === 0 ? "#ef4444" : i === 1 ? "#f97316" : i === 2 ? "#f59e0b" : "#38bdf8";
              return (
                <g key={tc.countryCode}>
                  <circle cx={pos[0]} cy={pos[1]} r={r + 4} fill={color} opacity={0.15} />
                  <circle cx={pos[0]} cy={pos[1]} r={r} fill={color} opacity={0.8} />
                  <text x={pos[0] + r + 4} y={pos[1] + 4} fontSize={9} fill="#94a3b8">{tc.countryCode}</text>
                </g>
              );
            })}

            {/* Live threat pings */}
            {pings.map((ping) => {
              const { x, y } = latLngToXY(ping.lat, ping.lng, mapW, mapH);
              const color = ping.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b';
              return (
                <g key={ping.id}>
                  <circle cx={x} cy={y} r={10} fill={color} opacity={0.2}>
                    <animate attributeName="r" from="6" to="18" dur="1.5s" repeatCount="1" />
                    <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="1" />
                  </circle>
                  <circle cx={x} cy={y} r={4} fill={color} />
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div style={{ position: "absolute", bottom: 16, left: 16, display: "flex", gap: 16,
            background: "rgba(15,23,42,0.85)", padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
            {[['#ef4444','#1 Origin'],['#f97316','#2 Origin'],['#f59e0b','Other'],['#38bdf8','Tracked']].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                <span style={{ fontSize: 10, color: "#64748b" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
            border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <AlertCircle size={16} color="#e2e8f0" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Top Attack Origins</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {stats?.topCountries.map((tc, idx) => {
                const pct = Math.round((tc.count / maxCount) * 100);
                return (
                  <div key={tc.countryCode}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: "#cbd5e1", fontWeight: 600 }}>
                        {countryFlag(tc.countryCode)} {tc.countryName}
                      </span>
                      <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{tc.count.toLocaleString()}</span>
                    </div>
                    <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", height: 5, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%",
                        background: idx === 0 ? "#ef4444" : idx === 1 ? "#f97316" : "#f59e0b", borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Pings Card */}
          {pings.length > 0 && (
            <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
              border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <MapPin size={16} color="#f43f5e" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Live Pings</span>
                <span style={{ marginLeft: "auto", fontSize: 10, background: "rgba(244,63,94,0.1)",
                  color: "#f43f5e", padding: "2px 8px", borderRadius: 10, border: "1px solid rgba(244,63,94,0.2)" }}>
                  LIVE
                </span>
              </div>
              {pings.slice(-5).reverse().map(p => (
                <div key={p.id} style={{ fontSize: 11, color: "#64748b", padding: "4px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  {countryFlag(p.countryCode)} {p.countryCode} —{' '}
                  <span style={{ color: p.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b' }}>{p.severity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
