import React, { useEffect, useState, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Globe, Crosshair, AlertCircle, RefreshCw } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { api } from './api';

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

interface ThreatPing {
  id: string;
  lat: number;
  lng: number;
  severity: string;
  countryCode: string;
}

interface TopCountry {
  countryCode: string;
  countryName: string;
  count: number;
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

  useEffect(() => {
    const socket = new SockJS('http://localhost:8080/ws-threats');
    const client = new Client({
      webSocketFactory: () => socket as any,
      debug: () => {},
      onConnect: () => {
        client.subscribe(`/topic/threats/${orgId}`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            if (data.latitude && data.longitude) {
              const newPing = {
                id: data.id + "-" + Date.now(),
                lat: data.latitude,
                lng: data.longitude,
                severity: data.severity,
                countryCode: data.countryCode
              };
              setPings(prev => [...prev.slice(-15), newPing]); // Keep up to 15 pings on map
            }
          } catch (_) {}
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [orgId]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 40, color: "#94a3b8" }}>
        <RefreshCw size={18} className="spin" /> Loading Geo-IP Mapping...
      </div>
    );
  }

  const maxCount = stats?.topCountries[0]?.count || 1;

  return (
    <div style={{ padding: "0 20px 40px", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#db2777,#f43f5e)",
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Globe size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: "#e2e8f0", fontWeight: 700 }}>
              Global Threat Map
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>
              Real-time Origin Tracking & Geo-IP Analysis
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
        {/* Map Container */}
        <div style={{ flex: 1, background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
          border: "1px solid rgba(244,63,94,0.15)", borderRadius: 16, overflow: "hidden", position: "relative" }}>
          
          <div style={{ position: "absolute", top: 20, left: 20, display: "flex", alignItems: "center", gap: 8,
            background: "rgba(15,23,42,0.8)", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
            <Crosshair size={14} color="#f43f5e" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f43f5e", letterSpacing: "0.1em" }}>LIVE TRACKING ACTIVE</span>
          </div>

          <ComposableMap projection="geoMercator" projectionConfig={{ scale: 140 }}
            style={{ width: "100%", height: "100%" }}>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#334155", outline: "none" },
                      pressed: { fill: "#475569", outline: "none" }
                    }}
                  />
                ))
              }
            </Geographies>
            {pings.map((ping) => (
              <Marker key={ping.id} coordinates={[ping.lng, ping.lat]}>
                <g className="ping-anim">
                  <circle r={8} fill={ping.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'} opacity={0.6} />
                  <circle r={4} fill={ping.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'} />
                </g>
              </Marker>
            ))}
          </ComposableMap>
        </div>

        {/* Sidebar */}
        <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <div style={{ background: "linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))",
            border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <AlertCircle size={16} color="#e2e8f0" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Top Attack Origins</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {stats?.topCountries.map((tc, idx) => {
                const pct = Math.round((tc.count / maxCount) * 100);
                return (
                  <div key={tc.countryCode}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: "#cbd5e1", fontWeight: 600 }}>
                        {idx + 1}. {tc.countryName} <span style={{ color: "#64748b", marginLeft: 4 }}>{tc.countryCode}</span>
                      </span>
                      <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{tc.count.toLocaleString()}</span>
                    </div>
                    <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", height: 6, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: idx === 0 ? "#ef4444" : idx === 1 ? "#f97316" : "#f59e0b",
                        borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping-fade {
          0% { transform: scale(0.5); opacity: 1; }
          70% { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(3); opacity: 0; }
        }
        .ping-anim circle:first-child {
          animation: ping-fade 1.5s cubic-bezier(0, 0, 0.2, 1) forwards;
          transform-origin: center;
        }
      `}</style>
    </div>
  );
}
