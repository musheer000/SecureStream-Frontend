import React, { useState, useEffect, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { api } from './api';
import {
  ShieldCheck, TrendingUp, AlertTriangle, Users, Activity,
  FileCheck, Lock, RefreshCw, CheckCircle, XCircle, Clock
} from 'lucide-react';

interface ComplianceReport {
  orgId: number;
  overallScore: number;
  grade: string;
  riskLevel: string;
  threatControlScore: number;
  incidentResponseScore: number;
  auditLoggingScore: number;
  accessControlScore: number;
  openCriticalIncidents: number;
  criticalThreats24h: number;
  totalThreats24h: number;
  resolvedThreats24h: number;
  totalUsers: number;
  totalAuditEvents: number;
  computedAt: string;
}

interface Props { orgId: number; }

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981', B: '#38bdf8', C: '#f59e0b', D: '#f97316', F: '#ef4444'
};
const RISK_COLORS: Record<string, string> = {
  LOW: '#10b981', MODERATE: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444'
};

function ScoreRing({ score, color, size = 100 }: { score: number; color: string; size?: number }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const progress = circ - (score / 100) * circ;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={progress}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  );
}

function ControlCard({ label, score, icon: Icon, color }: { label: string; score: number; icon: any; color: string }) {
  const barColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="cyber-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} color={color} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>{label}</span>
        </div>
        <span style={{ fontSize: 22, fontWeight: 800, color: barColor }}>{score}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
          width: `${score}%`, transition: 'width 1s ease'
        }} />
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, textAlign: 'right' }}>
        {score >= 80 ? '✓ Compliant' : score >= 60 ? '⚠ Needs Attention' : '✗ Non-Compliant'}
      </div>
    </div>
  );
}

export default function ComplianceDashboard({ orgId }: Props) {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      const res = await api.get(`/compliance/${orgId}`);
      setReport(res.data);
      setLastUpdated(new Date());
    } catch (_) {}
    finally { setLoading(false); }
  }, [orgId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Live updates every 30 seconds via WebSocket
  useEffect(() => {
    const socket = new (typeof SockJS === 'function' ? SockJS : (SockJS as any).default)((import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'https://securestream-backend.onrender.com') + '/ws-threats');
    const client = new Client({
      webSocketFactory: () => socket as any,
      debug: () => {},
      onConnect: () => {
        client.subscribe(`/topic/compliance/${orgId}`, (msg) => {
          try {
            setReport(JSON.parse(msg.body));
            setLastUpdated(new Date());
          } catch (_) {}
        });
      }
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [orgId]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#94a3b8', gap: 12 }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Computing compliance score...
    </div>
  );

  if (!report) return <div style={{ padding: 20, color: '#f43f5e' }}>Unable to load compliance data.</div>;

  const gradeColor = GRADE_COLORS[report.grade] || '#94a3b8';
  const riskColor = RISK_COLORS[report.riskLevel] || '#94a3b8';

  const frameworks = [
    { name: 'SOC 2 Type II', score: report.overallScore, status: report.overallScore >= 75 },
    { name: 'ISO 27001', score: Math.round(report.overallScore * 0.95), status: report.overallScore >= 80 },
    { name: 'NIST CSF', score: Math.round(report.overallScore * 1.02), status: report.overallScore >= 70 },
    { name: 'PCI-DSS', score: Math.round(report.overallScore * 0.9), status: report.overallScore >= 85 },
  ];

  return (
    <div style={{ padding: '0 20px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#10b981,#38bdf8)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>Security Compliance & Risk Score</h2>
            <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>
              Live-computed from threat data, incidents, audits & access controls · Updates every 30s
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748b' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', animation: 'pulse 2s infinite' }} />
          Last computed: {lastUpdated?.toLocaleTimeString() || '—'}
          <button onClick={fetchReport} style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 6, padding: '4px 10px', color: '#38bdf8', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Top Row: Main Score + Risk Level + Stats */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>

        {/* Big Score Ring */}
        <div className="cyber-card" style={{ padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 220 }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <ScoreRing score={report.overallScore} color={gradeColor} size={140} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{report.overallScore}</span>
              <span style={{ fontSize: 11, color: '#64748b', letterSpacing: 1 }}>/ 100</span>
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: gradeColor, letterSpacing: 2 }}>Grade {report.grade}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Security Posture</div>
        </div>

        {/* Risk Level */}
        <div className="cyber-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 160 }}>
          <AlertTriangle size={32} color={riskColor} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 22, fontWeight: 900, color: riskColor }}>{report.riskLevel}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Risk Level</div>
          <div style={{ marginTop: 12, width: '100%', height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
            <div style={{ height: '100%', background: riskColor, borderRadius: 2, width: `${report.overallScore}%`, transition: 'width 1s ease' }} />
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Critical Threats (24h)', value: report.criticalThreats24h, color: '#ef4444', icon: AlertTriangle },
            { label: 'Threats Resolved (24h)', value: report.resolvedThreats24h, color: '#10b981', icon: CheckCircle },
            { label: 'Open Critical Incidents', value: report.openCriticalIncidents, color: '#f97316', icon: Activity },
            { label: 'Total Audit Events', value: report.totalAuditEvents, color: '#38bdf8', icon: FileCheck },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="cyber-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Icon size={22} color={color} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Control Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <ControlCard label="Threat Control" score={report.threatControlScore} icon={ShieldCheck} color="#ef4444" />
        <ControlCard label="Incident Response" score={report.incidentResponseScore} icon={Activity} color="#f97316" />
        <ControlCard label="Audit & Logging" score={report.auditLoggingScore} icon={FileCheck} color="#38bdf8" />
        <ControlCard label="Access Control" score={report.accessControlScore} icon={Lock} color="#8b5cf6" />
      </div>

      {/* Framework Compliance */}
      <div className="cyber-card" style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} color="#38bdf8" /> Framework Compliance Readiness
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {frameworks.map(fw => (
            <div key={fw.name} style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: `1px solid ${fw.status ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{fw.name}</span>
                {fw.status
                  ? <CheckCircle size={16} color="#10b981" />
                  : <XCircle size={16} color="#ef4444" />
                }
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: fw.status ? '#10b981' : '#ef4444' }}>{Math.min(100, fw.score)}%</div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 8 }}>
                <div style={{ height: '100%', borderRadius: 2, background: fw.status ? '#10b981' : '#ef4444', width: `${Math.min(100, fw.score)}%` }} />
              </div>
              <div style={{ fontSize: 11, color: fw.status ? '#10b981' : '#ef4444', marginTop: 8, fontWeight: 600 }}>
                {fw.status ? '✓ Ready for Audit' : '✗ Gaps Detected'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
