import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { Users, Activity, AlertTriangle, Clock, Moon, CheckCircle, XCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from './api';

interface UserRisk {
  username: string;
  totalLogins: number;
  failures: number;
  offHours: number;
  failRate: number;
  riskScore: number;
  riskLabel: string;
}

interface HourlyPoint { hour: string; count: number; }

interface RecentLogin {
  username: string;
  sourceIp: string;
  countryCode: string;
  success: boolean;
  offHours: boolean;
  loggedAt: string;
  hourOfDay: number;
}

interface Analytics {
  hourlyActivity: HourlyPoint[];
  userRiskTable: UserRisk[];
  totalLogins24h: number;
  failedLogins24h: number;
  offHoursLogins24h: number;
  recentActivity: RecentLogin[];
}

const RISK_COLOR = (label: string) => {
  switch (label) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH':     return '#f97316';
    case 'ELEVATED': return '#f59e0b';
    default:         return '#10b981';
  }
};

export default function UserBehaviorView({ orgId }: { orgId: number }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/behavior/analytics/${orgId}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const card = (children: React.ReactNode, border = 'rgba(255,255,255,0.06)') => (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))',
      border: `1px solid ${border}`, borderRadius: 16, padding: 20
    }}>
      {children}
    </div>
  );

  const hdr = (icon: React.ReactNode, title: string, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40, color: '#94a3b8' }}>
      <RefreshCw size={18} className="spin" /> Loading User Behavior Analytics...
    </div>
  );

  const successRate = data && data.totalLogins24h > 0
    ? Math.round(((data.totalLogins24h - data.failedLogins24h) / data.totalLogins24h) * 100)
    : 100;

  return (
    <div style={{ padding: '0 20px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>
              User Behavior Analytics
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>
              Login Patterns · Risk Scoring · Anomaly Detection
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          style={{ display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)',
            color: '#38bdf8', padding: '6px 14px', borderRadius: 8, fontSize: 12,
            fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Top Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'TOTAL LOGINS (24H)', value: data?.totalLogins24h ?? 0, icon: <Activity size={16} />, color: '#38bdf8' },
          { label: 'FAILED LOGINS',      value: data?.failedLogins24h ?? 0, icon: <XCircle size={16} />, color: '#ef4444' },
          { label: 'OFF-HOURS LOGINS',   value: data?.offHoursLogins24h ?? 0, icon: <Moon size={16} />, color: '#a78bfa' },
          { label: 'SUCCESS RATE',       value: `${successRate}%`, icon: <CheckCircle size={16} />, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.95))',
            border: `1px solid ${s.color}22`, borderRadius: 16, padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em' }}>{s.label}</span>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color: s.color, fontFamily: 'monospace',
              textShadow: `0 0 20px ${s.color}55` }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Middle Row: Hourly Activity + User Risk Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Hourly Login Activity */}
        {card(<>
          {hdr(<Clock size={15} />, 'Hourly Login Activity (Last 24h)', '#38bdf8')}
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data?.hourlyActivity ?? []} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="hour" stroke="#334155" fontSize={9} tickLine={false} minTickGap={24} />
                <YAxis stroke="#334155" fontSize={9} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#38bdf8', fontWeight: 700 }}
                />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]}
                  style={{ filter: 'drop-shadow(0 0 4px rgba(14,165,233,0.4))' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>, 'rgba(56,189,248,0.12)')}

        {/* User Risk Table */}
        {card(<>
          {hdr(<ShieldAlert size={15} />, 'User Risk Scores (Last 7 Days)', '#f97316')}
          {(data?.userRiskTable?.length ?? 0) === 0 ? (
            <div style={{ color: '#475569', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
              No login activity recorded yet. Log in a few times to see analytics.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data?.userRiskTable ?? []).map(u => {
                const color = RISK_COLOR(u.riskLabel);
                return (
                  <div key={u.username} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: `${color}0a`, border: `1px solid ${color}25`, borderRadius: 10,
                    borderLeft: `3px solid ${color}`
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, background: `${color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color, flexShrink: 0,
                      fontFamily: 'monospace'
                    }}>
                      {u.riskScore}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{u.username}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: '0.08em',
                          background: `${color}18`, padding: '2px 8px', borderRadius: 4 }}>
                          {u.riskLabel}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#64748b' }}>
                        <span>🔑 {u.totalLogins} logins</span>
                        <span>❌ {u.failures} fails ({u.failRate}%)</span>
                        <span>🌙 {u.offHours} off-hours</span>
                      </div>
                      <div style={{ marginTop: 6, width: '100%', background: 'rgba(255,255,255,0.05)', height: 4, borderRadius: 2 }}>
                        <div style={{ width: `${u.riskScore}%`, height: '100%', background: color,
                          borderRadius: 2, boxShadow: `0 0 6px ${color}`, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>, 'rgba(249,115,22,0.12)')}
      </div>

      {/* Bottom Row: Recent Login Feed */}
      {card(<>
        {hdr(<Activity size={15} />, 'Live Login Activity Feed', '#10b981')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(data?.recentActivity?.length ?? 0) === 0 ? (
            <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
              No login activity recorded yet.
            </div>
          ) : (data?.recentActivity ?? []).map((l, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 8,
              background: l.success ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${l.success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}`,
              borderLeft: `3px solid ${l.success ? '#10b981' : '#ef4444'}`
            }}>
              <div style={{ flexShrink: 0 }}>
                {l.success
                  ? <CheckCircle size={16} color="#10b981" />
                  : <XCircle size={16} color="#ef4444" />
                }
              </div>
              <div style={{ flex: 1, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', minWidth: 100 }}>{l.username}</span>
                <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{l.sourceIp}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: 'rgba(255,255,255,0.05)',
                  padding: '2px 7px', borderRadius: 4 }}>{l.countryCode}</span>
                {l.offHours && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.1)',
                    padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(167,139,250,0.2)' }}>
                    🌙 OFF-HOURS
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>
                {new Date(l.loggedAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </>, 'rgba(16,185,129,0.12)')}
    </div>
  );
}
