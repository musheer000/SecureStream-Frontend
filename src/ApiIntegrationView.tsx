import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { api } from './api';
import { Key, Terminal, Code2, Copy, Check, Trash2, Activity, Play, CheckCircle2, Webhook, Zap } from 'lucide-react';

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  keySecret?: string; // only returned once on creation
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiLog {
  timestamp: string;
  apiKeyName: string;
  method: string;
  endpoint: string;
  status: number;
  latencyMs: number;
  payloadSnippet: string;
}

interface Props {
  orgId: number;
}

export default function ApiIntegrationView({ orgId }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await api.get(`/integration/keys/${orgId}`);
      setKeys(res.data);
    } catch (_) {}
  }, [orgId]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  useEffect(() => {
    const socket = new SockJS('http://localhost:8080/ws-threats');
    const client = new Client({
      webSocketFactory: () => socket as any,
      debug: () => {},
      onConnect: () => {
        client.subscribe(`/topic/api-logs/${orgId}`, (msg) => {
          try {
            const log: ApiLog = JSON.parse(msg.body);
            setLogs(prev => [...prev, log].slice(-100)); // keep last 100
          } catch (e) {}
        });
      }
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [orgId]);

  useEffect(() => {
    // Auto scroll logs
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const generateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const res = await api.post(`/integration/keys/${orgId}`, { name: newKeyName });
    setJustCreatedKey(res.data.keySecret);
    setNewKeyName('');
    fetchKeys();
  };

  const revokeKey = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this API key? This action is irreversible and integrations using this key will immediately fail.')) return;
    await api.patch(`/integration/keys/${id}/revoke`);
    fetchKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: '0 20px 40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#8b5cf6,#d946ef)',
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Webhook size={20} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>
            API & Integrations
          </h2>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
            Manage API Keys · Integrate External SIEMs · Live API Traffic Monitor
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        
        {/* Left Col: Keys Management */}
        <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Create Key Card */}
          <div className="cyber-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f1f5f9', fontWeight: 700, marginBottom: 16 }}>
              <Key size={18} color="#d946ef" /> Generate API Key
            </div>
            <form onSubmit={generateKey} style={{ display: 'flex', gap: 12 }}>
              <input 
                type="text" 
                placeholder="Key Name (e.g., Splunk Ingest, Datadog)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                style={{
                  flex: 1, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', outline: 'none'
                }}
              />
              <button 
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', border: 'none', borderRadius: 8,
                  padding: '0 20px', color: '#fff', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                }}>
                Generate
              </button>
            </form>

            {justCreatedKey && (
              <div style={{ marginTop: 16, padding: 16, background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                  <CheckCircle2 size={16} /> Key Generated Successfully
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                  Please copy this secret key now. You will not be able to see it again.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, padding: 10, background: '#0f172a', borderRadius: 6, color: '#f1f5f9', fontFamily: 'monospace', letterSpacing: 1, fontSize: 13 }}>
                    {justCreatedKey}
                  </div>
                  <button 
                    onClick={() => copyToClipboard(justCreatedKey)}
                    style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '0 12px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {copied ? <Check size={14} color="#10b981"/> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Keys List */}
          <div className="cyber-card" style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f1f5f9', fontWeight: 700, marginBottom: 16 }}>
              <Code2 size={18} color="#0ea5e9" /> Active API Keys
            </div>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {keys.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>No API keys generated yet.</div>}
              {keys.map(key => (
                <div key={key.id} style={{
                  padding: 16, background: 'rgba(15,23,42,0.6)', border: `1px solid ${key.status === 'ACTIVE' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{key.name}</span>
                      {key.status === 'ACTIVE' ? (
                        <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>ACTIVE</span>
                      ) : (
                        <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>REVOKED</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8', marginBottom: 4 }}>{key.keyPrefix}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                    </div>
                  </div>
                  {key.status === 'ACTIVE' && (
                    <button onClick={() => revokeKey(key.id)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, transition: 'all 0.2s' }}>
                      <Trash2 size={14} /> Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Live Terminal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            background: '#020617', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 12,
            boxShadow: '0 0 30px rgba(14,165,233,0.05)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
                <Terminal size={14} /> LIVE API TRAFFIC
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 11, fontWeight: 700 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} /> LISTENING ON /api/v1/external
              </div>
            </div>
            
            <div style={{ padding: 16, overflowY: 'auto', flex: 1, fontFamily: '"Fira Code", "Cascadia Code", monospace', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {logs.length === 0 ? (
                <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                   <Zap size={14} /> Waiting for external API requests... (Simulating automatically)
                </div>
              ) : logs.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                  <span style={{ color: '#475569', minWidth: 65 }}>{new Date(log.timestamp).toLocaleTimeString([], {hour12: false})}</span>
                  <span style={{ color: log.status === 200 ? '#10b981' : '#ef4444', fontWeight: 700, minWidth: 40 }}>{log.status}</span>
                  <span style={{ color: '#d946ef', minWidth: 40 }}>{log.method}</span>
                  <span style={{ color: '#38bdf8', minWidth: 150 }}>{log.endpoint}</span>
                  <span style={{ color: '#fbbf24', minWidth: 40 }}>{log.latencyMs}ms</span>
                  <span style={{ color: '#94a3b8' }}>[Key: {log.apiKeyName}]</span>
                  <span style={{ color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.payloadSnippet}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
