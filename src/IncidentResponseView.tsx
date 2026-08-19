import React, { useState, useEffect, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { api } from './api';
import { ShieldAlert, Plus, MessageSquare, Clock, User, CheckCircle, Flame, ArrowRight, Play, BookOpen, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface IncidentNote {
  id: number;
  author: string;
  content: string;
  createdAt: string;
}

interface Incident {
  id: number;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedTo: string | null;
  playbookActions: string;
  notes: IncidentNote[];
  createdAt: string;
  updatedAt: string;
}

interface Props {
  orgId: number;
  username: string;
}

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#38bdf8'
};

const STATUS_COLS = [
  { id: 'OPEN', title: 'Open', color: '#ef4444' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: '#f59e0b' },
  { id: 'RESOLVED', title: 'Resolved', color: '#10b981' },
  { id: 'CLOSED', title: 'Closed', color: '#64748b' }
];

export default function IncidentResponseView({ orgId, username }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [newNote, setNewNote] = useState('');
  const [checkedActions, setCheckedActions] = useState<Record<string, boolean[]>>({});

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await api.get(`/incidents/org/${orgId}`);
      setIncidents(res.data);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  useEffect(() => {
    const socket = new SockJS('http://localhost:8080/ws-threats');
    const client = new Client({
      webSocketFactory: () => socket as any,
      debug: () => {},
      onConnect: () => {
        client.subscribe(`/topic/incidents/${orgId}`, (msg) => {
          try {
            const updated: Incident = JSON.parse(msg.body);
            setIncidents(prev => {
              const exists = prev.find(i => i.id === updated.id);
              if (exists) return prev.map(i => i.id === updated.id ? updated : i);
              return [updated, ...prev];
            });
            // Update selected incident in war room modal if open
            setSelectedIncident(prev => prev?.id === updated.id ? updated : prev);
          } catch (e) {}
        });
      }
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [orgId]);

  const updateStatus = async (id: number, status: string) => {
    await api.patch(`/incidents/${id}/status`, { status });
  };

  const assignSelf = async (id: number) => {
    await api.patch(`/incidents/${id}/assign`, { assignee: username });
  };

  const addNote = async (id: number) => {
    if (!newNote.trim()) return;
    await api.post(`/incidents/${id}/notes`, { content: newNote });
    setNewNote('');
  };

  const IncidentCard = ({ i }: { i: Incident }) => (
    <div
      onClick={() => setSelectedIncident(i)}
      style={{
        background: 'rgba(30,41,59,0.7)',
        border: `1px solid ${SEVERITY_COLORS[i.severity]}40`,
        borderLeft: `4px solid ${SEVERITY_COLORS[i.severity]}`,
        borderRadius: 8, padding: 14, marginBottom: 12,
        cursor: 'pointer', transition: 'all 0.2s',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
      }}
      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
        #{i.id} — {i.title}
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
        <span style={{ color: SEVERITY_COLORS[i.severity], fontWeight: 700 }}>{i.severity}</span>
        <span>•</span>
        <span>{new Date(i.createdAt).toLocaleTimeString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: i.assignedTo ? '#38bdf8' : '#64748b' }}>
          <User size={12} /> {i.assignedTo || 'Unassigned'}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#94a3b8' }}>
          <MessageSquare size={12} /> {i.notes?.length || 0}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '0 20px 40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#f43f5e,#fb923c)',
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldAlert size={20} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>
            Incident Response & Playbooks
          </h2>
          <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>
            Real-time War Room · Collaborative Investigations · Automated Playbooks
          </p>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'flex', gap: 20, flex: 1, overflowX: 'auto', minHeight: 600 }}>
        {STATUS_COLS.map(col => (
          <div key={col.id} style={{
            flex: 1, minWidth: 280,
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 12, display: 'flex', flexDirection: 'column'
          }}>
            {/* Col Header */}
            <div style={{
              padding: '14px 16px', borderBottom: `2px solid ${col.color}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{col.title}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: col.color, background: `${col.color}20`, padding: '2px 8px', borderRadius: 12 }}>
                {incidents.filter(i => i.status === col.id).length}
              </span>
            </div>
            
            {/* Col Items */}
            <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
              {incidents.filter(i => i.status === col.id).map(i => (
                <IncidentCard key={i.id} i={i} />
              ))}
              {incidents.filter(i => i.status === col.id).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 12 }}>
                  No {col.title.toLowerCase()} incidents
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* WAR ROOM MODAL via Portal */}
      {selectedIncident && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelectedIncident(null)} />
          
          <div style={{
            position: 'relative', width: '90vw', maxWidth: 980, height: '88vh', maxHeight: 750,
            background: '#0f172a', border: '1px solid #38bdf840', borderRadius: 16,
            boxShadow: '0 30px 80px rgba(0,0,0,0.9)', display: 'flex', overflow: 'hidden'
          }}>
            {/* Left Col: Incident Details & Playbook */}
            <div style={{ width: '45%', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: SEVERITY_COLORS[selectedIncident.severity], background: `${SEVERITY_COLORS[selectedIncident.severity]}20`, padding: '4px 8px', borderRadius: 4 }}>
                    {selectedIncident.severity}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>#{selectedIncident.id}</span>
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#f1f5f9' }}>{selectedIncident.title}</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{selectedIncident.description}</p>
                
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  {!selectedIncident.assignedTo ? (
                    <button onClick={() => assignSelf(selectedIncident.id)}
                      style={{ background: '#0ea5e9', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                      Assign to Me
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={14} /> Assigned to {selectedIncident.assignedTo}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Actions */}
              <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 8 }}>
                 {STATUS_COLS.map(s => (
                   <button key={s.id} onClick={() => updateStatus(selectedIncident.id, s.id)}
                     style={{
                       flex: 1, padding: '8px 0', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                       background: selectedIncident.status === s.id ? `${s.color}20` : 'transparent',
                       border: `1px solid ${selectedIncident.status === s.id ? s.color : 'rgba(255,255,255,0.2)'}`,
                       color: selectedIncident.status === s.id ? s.color : '#94a3b8'
                     }}>
                     {s.title}
                   </button>
                 ))}
              </div>

              {/* Playbook */}
              <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', fontWeight: 700, marginBottom: 8 }}>
                  <BookOpen size={16} color="#fbbf24" /> Recommended Playbook
                </div>
                {(() => {
                  try {
                    const actions: string[] = JSON.parse(selectedIncident.playbookActions);
                    const incidentKey = String(selectedIncident.id);
                    const checks = checkedActions[incidentKey] || new Array(actions.length).fill(false);
                    const doneCount = checks.filter(Boolean).length;
                    return (
                      <>
                        {/* Progress bar */}
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                            <span>Progress</span>
                            <span style={{ color: doneCount === actions.length ? '#10b981' : '#fbbf24', fontWeight: 700 }}>
                              {doneCount}/{actions.length} complete
                            </span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                            <div style={{
                              height: '100%', borderRadius: 2, transition: 'width 0.4s ease',
                              background: doneCount === actions.length ? '#10b981' : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                              width: `${actions.length > 0 ? (doneCount / actions.length) * 100 : 0}%`
                            }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {actions.map((act, idx) => {
                            const done = checks[idx] || false;
                            return (
                              <div
                                key={idx}
                                onClick={() => {
                                  const newChecks = [...checks];
                                  newChecks[idx] = !newChecks[idx];
                                  setCheckedActions(prev => ({ ...prev, [incidentKey]: newChecks }));
                                }}
                                style={{
                                  display: 'flex', gap: 10, alignItems: 'center',
                                  fontSize: 13, color: done ? '#64748b' : '#cbd5e1',
                                  background: done ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                                  padding: '10px 12px', borderRadius: 8,
                                  borderLeft: `3px solid ${done ? '#10b981' : '#0ea5e9'}`,
                                  cursor: 'pointer', transition: 'all 0.2s',
                                  textDecoration: done ? 'line-through' : 'none',
                                  userSelect: 'none'
                                }}
                              >
                                <div style={{
                                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                                  border: `2px solid ${done ? '#10b981' : '#0ea5e9'}`,
                                  background: done ? '#10b981' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                }}>
                                  {done && <CheckCircle size={12} color="#fff" />}
                                </div>
                                {act}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  } catch (e) {
                    return <div style={{ color: '#94a3b8', fontSize: 12 }}>No playbook available.</div>;
                  }
                })()}
              </div>
            </div>

            {/* Right Col: Live War Room Chat/Notes */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0b1120' }}>
               <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Flame size={18} color="#ef4444" />
                  <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>Live War Room</span>
               </div>
               
               {/* Messages */}
               <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                 {(selectedIncident.notes || []).map((n, i) => {
                   const isSystem = n.author === 'SYSTEM';
                   return (
                     <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: isSystem ? 'rgba(245,158,11,0.2)' : 'rgba(56,189,248,0.2)',
                          color: isSystem ? '#f59e0b' : '#38bdf8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700
                        }}>
                          {isSystem ? 'S' : n.author.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: isSystem ? '#f59e0b' : '#e2e8f0' }}>{n.author}</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>{new Date(n.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: '0 8px 8px 8px', display: 'inline-block' }}>
                            {n.content}
                          </div>
                        </div>
                     </div>
                   );
                 })}
                 {(!selectedIncident.notes || selectedIncident.notes.length === 0) && (
                   <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 40 }}>
                     No activities yet. Start the investigation.
                   </div>
                 )}
               </div>

               {/* Input */}
               <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 12 }}>
                 <input 
                   type="text" 
                   value={newNote}
                   onChange={e => setNewNote(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && addNote(selectedIncident.id)}
                   placeholder="Type a note or finding..."
                   style={{
                     flex: 1, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                     borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', outline: 'none'
                   }}
                 />
                 <button 
                   onClick={() => addNote(selectedIncident.id)}
                   style={{
                     background: '#0ea5e9', border: 'none', borderRadius: 8, padding: '0 16px',
                     color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                   }}>
                   <ArrowRight size={18} />
                 </button>
               </div>
            </div>
            
            {/* Close */}
            <button onClick={() => setSelectedIncident(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
