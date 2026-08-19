import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, CheckCheck, AlertTriangle, Zap, Shield, Info, ShieldAlert } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { api } from './api';

interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: string;
}

interface Props {
  orgId: number;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; accent: string; label: string }> = {
  CRITICAL_THREAT: { icon: <AlertTriangle size={15} />, accent: '#ef4444', label: 'CRITICAL' },
  COORDINATED:     { icon: <Zap size={15} />,           accent: '#a78bfa', label: 'COORDINATED' },
  HIGH_RISK:       { icon: <ShieldAlert size={15} />,   accent: '#fb923c', label: 'HIGH RISK' },
  BLACKLIST:       { icon: <Shield size={15} />,        accent: '#f43f5e', label: 'BLACKLIST' },
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell({ orgId }: Props) {
  const [open, setOpen]                     = useState(false);
  const [notifications, setNotifications]   = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [ringing, setRinging]               = useState(false);
  const panelRef                            = useRef<HTMLDivElement>(null);

  /* ─── Fetch on mount ──────────────────────────────────────── */
  const fetchNotifications = useCallback(async () => {
    try {
      const [nr, cr] = await Promise.all([
        api.get(`/notifications/org/${orgId}`),
        api.get(`/notifications/org/${orgId}/unread-count`),
      ]);
      setNotifications(nr.data);
      setUnreadCount(Number(cr.data.unreadCount) || 0);
    } catch (_) {}
  }, [orgId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  /* ─── WebSocket live feed ─────────────────────────────────── */
  useEffect(() => {
    const sock   = new (typeof SockJS === 'function' ? SockJS : (SockJS as any).default)((import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'https://securestream-backend.onrender.com') + '/ws-threats');
    const client = new Client({
      webSocketFactory: () => sock as any,
      debug: () => {},
      onConnect: () => {
        client.subscribe(`/topic/notifications/${orgId}`, (msg) => {
          try {
            const n: AppNotification = JSON.parse(msg.body);
            setNotifications(prev => [n, ...prev.slice(0, 49)]);
            setUnreadCount(prev => prev + 1);
            setRinging(true);
            setTimeout(() => setRinging(false), 700);
          } catch (_) {}
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [orgId]);

  /* ─── Close on outside click is handled by the Portal Overlay ──────────────────────────────── */

  const markAllRead = async () => {
    try {
      await api.patch(`/notifications/org/${orgId}/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (_) {}
  };

  const markOne = async (id: number, alreadyRead: boolean) => {
    if (alreadyRead) return;
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_) {}
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* ── Bell Button ─────────────────────────────────────── */}
      <button
        onClick={() => { setOpen(o => !o); }}
        title="Notifications"
        style={{
          position: 'relative',
          background: unreadCount > 0 ? 'rgba(251,191,36,0.12)' : 'rgba(100,116,139,0.1)',
          border: unreadCount > 0 ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(100,116,139,0.2)',
          borderRadius: 10,
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s',
          boxShadow: unreadCount > 0 ? '0 0 12px rgba(251,191,36,0.25)' : 'none',
        }}
      >
        <Bell
          size={18}
          color={unreadCount > 0 ? '#fbbf24' : '#94a3b8'}
          style={{
            display: 'block',
            animation: ringing ? 'bellRing 0.7s ease' : 'none',
          }}
        />
        {unreadCount > 0 && (
          <span style={{
            background: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            borderRadius: 99,
            minWidth: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1,
            boxShadow: '0 0 8px rgba(239,68,68,0.7)',
            letterSpacing: 0,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel via Portal to escape Navbar backdrop-filter bugs ── */}
      {open && createPortal(
        <div style={{ position: 'absolute', zIndex: 9999 }}>
          {/* Dark overlay */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 9999,
            }}
          />

          {/* Panel */}
          <div
            style={{
              position: 'fixed',
              top: 72,
              right: 20,
              width: 400,
              maxHeight: 'calc(100vh - 100px)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',

              background: '#0f172a',
              border: '1px solid rgba(251,191,36,0.35)',
              borderRadius: 16,
              boxShadow: '0 30px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.1)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: '#1e293b',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(251,191,36,0.15)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bell size={16} color="#fbbf24" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Notifications</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'rgba(16,185,129,0.12)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      color: '#34d399',
                      padding: '5px 12px', borderRadius: 7,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: 'rgba(100,116,139,0.1)',
                    border: '1px solid rgba(100,116,139,0.2)',
                    color: '#94a3b8',
                    borderRadius: 7, padding: '5px 8px',
                    cursor: 'pointer', display: 'flex',
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <Bell size={40} color="#334155" style={{ display: 'block', margin: '0 auto 14px' }} />
                  <div style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>No notifications yet</div>
                  <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>Alerts will appear here in real-time</div>
                </div>
              ) : notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? { icon: <Info size={15} />, accent: '#38bdf8', label: 'INFO' };
                return (
                  <div
                    key={n.id}
                    onClick={() => markOne(n.id, n.read)}
                    style={{
                      display: 'flex',
                      gap: 14,
                      padding: '14px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: n.read ? '#0f172a' : '#1e293b',
                      cursor: n.read ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                      alignItems: 'flex-start',
                      borderLeft: n.read ? '3px solid transparent' : `3px solid ${cfg.accent}`,
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: `${cfg.accent}18`,
                      border: `1px solid ${cfg.accent}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: cfg.accent,
                      flexShrink: 0,
                    }}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800,
                          color: cfg.accent,
                          letterSpacing: '0.1em',
                          background: `${cfg.accent}18`,
                          padding: '2px 7px', borderRadius: 4,
                          border: `1px solid ${cfg.accent}30`,
                          whiteSpace: 'nowrap',
                        }}>
                          {cfg.label}
                        </span>
                        <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: n.read ? '#94a3b8' : '#f1f5f9', marginBottom: 3, lineHeight: 1.3 }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, wordBreak: 'break-all' }}>
                        {n.message}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: cfg.accent,
                        boxShadow: `0 0 6px ${cfg.accent}`,
                        flexShrink: 0, marginTop: 4,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div style={{
                padding: '10px 20px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: '#1e293b',
                fontSize: 11, color: '#64748b', textAlign: 'center',
                flexShrink: 0,
              }}>
                Showing last {notifications.length} notifications · Click to mark as read
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes bellRing {
          0%   { transform: rotate(0deg); }
          15%  { transform: rotate(-25deg); }
          30%  { transform: rotate(25deg); }
          45%  { transform: rotate(-20deg); }
          60%  { transform: rotate(20deg); }
          75%  { transform: rotate(-10deg); }
          90%  { transform: rotate(10deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
