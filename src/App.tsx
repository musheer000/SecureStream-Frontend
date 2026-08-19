import React, { useState, useEffect, useCallback } from 'react';
import { api, setTokens, getRefreshToken } from './api';
import ThreatDashboard from './ThreatDashboard';
import UserManagement from './UserManagement';
import ReportsView from './ReportsView';
import AuditLogView from './AuditLogView';
import IntelligenceView from './IntelligenceView';
import GeoMapView from './GeoMapView';
import NotificationBell from './NotificationBell';
import UserBehaviorView from './UserBehaviorView';
import IncidentResponseView from './IncidentResponseView';
import ApiIntegrationView from './ApiIntegrationView';
import ComplianceDashboard from './ComplianceDashboard';
import { useTheme, ThemeProvider } from './ThemeContext';
import { 
  Shield, 
  Lock, 
  Key, 
  UserCheck, 
  User, 
  CheckCircle2, 
  Circle, 
  Activity, 
  Zap, 
  LogOut,
  Mail,
  UserPlus,
  LayoutDashboard,
  Users,
  FileText,
  Terminal as TerminalIcon,
  Cpu as CpuIcon,
  Globe,
  UserCheck2,
  Target,
  Webhook,
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';

interface AuthUser {
  username: string;
  email: string;
  role: string;
  loginTime?: string;
  sessionId?: string;
}

interface ThemeProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  isDark: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

export function AppInner({ theme, toggleTheme, isDark, colors }: ThemeProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [orgId] = useState<number>(1); // Default org
  const [currentMenu, setCurrentMenu] = useState<'dashboard' | 'users' | 'reports' | 'audit' | 'intelligence' | 'map' | 'behavior' | 'incident' | 'api' | 'compliance'>('dashboard');

  // Form state
  const [persona, setPersona] = useState<'ADMIN' | 'ANALYST' | 'VIEWER'>('ANALYST');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [empId, setEmpId] = useState('');
  const [department, setDepartment] = useState('');
  
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Logs & API Output
  const [statusLog, setStatusLog] = useState<string>('SYSTEM READY: SecureStream Engine initialized on Port 8080');
  const [apiResponse, setApiResponse] = useState<string>('Awaiting security authentication request...');

  // Checklist completion states
  const [checklist, setChecklist] = useState({
    register: false,
    login: false,
    bcrypt: false,
    jwtAccess: false,
    jwtFilter: false,
    refreshToken: false,
    tokenRotation: false,
    protectedApi: false,
    roleSecurity: false,
  });

  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setStatusLog('SECURITY ALERT: Session expired or manually terminated.');
    };
    window.addEventListener('auth_logout', handleLogout);
    return () => window.removeEventListener('auth_logout', handleLogout);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setStatusLog(`REGISTRATION INITIATED: Creating new ${persona} user [${username}]...`);
    
    try {
      const payload: any = { username, email, password, role: persona };
      if (persona === 'ANALYST') payload.empId = empId;
      if (persona === 'VIEWER') payload.department = department;
      const res = await api.post('/auth/register', payload);
      const data = res.data;

      setTokens(data.accessToken, data.refreshToken);
      setUser({ 
        username: data.username, 
        email: data.email, 
        role: data.role,
        loginTime: new Date().toLocaleTimeString(),
        sessionId: 'SS-REG-' + Math.floor(100000 + Math.random() * 900000)
      });
      setCurrentMenu('dashboard');
      
      setChecklist(prev => ({
        ...prev,
        register: true,
        bcrypt: true,
        jwtAccess: !!data.accessToken,
        refreshToken: !!data.refreshToken,
      }));

      setStatusLog(`SUCCESS: Account registered successfully!\n✓ BCrypt password hash stored in DB\n✓ Issued HMAC SHA-512 JWT Access & Refresh Tokens`);
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      
      const errorMsg = err.response?.data || err.message;
      setStatusLog(`ERROR: Registration failed - Validation Error`);
      setApiResponse(JSON.stringify(errorMsg, null, 2));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setStatusLog(`AUTHENTICATION INITIATED: Sending credentials to /auth/login as [${username}]...`);
    
    try {
      const { data } = await api.post('/auth/login', { username, password });
      
      setTokens(data.accessToken, data.refreshToken);
      setUser({ 
        username: data.username, 
        email: data.email, 
        role: data.role,
        loginTime: new Date().toLocaleTimeString(),
        sessionId: 'SS-SES-' + Math.floor(100000 + Math.random() * 900000)
      });
      setCurrentMenu('dashboard');

      setChecklist(prev => ({
        ...prev,
        login: true,
        bcrypt: true,
        jwtAccess: !!data.accessToken,
        refreshToken: !!data.refreshToken,
      }));

      setStatusLog(`SUCCESS: Authentication Verified!\n✓ BCrypt password check passed\n✓ Issued Bearer Access Token & Redis Session Refresh Token`);
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      const isLocked = errorMsg.includes('locked');
      if (isLocked) {
        setStatusLog(`CRITICAL ERROR: Account Locked! Maximum failed attempts exceeded.`);
      } else {
        setStatusLog(`ERROR: Authentication Failed - ${errorMsg}`);
      }
      setApiResponse(JSON.stringify(err.response?.data || { error: err.message }, null, 2));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const testTokenRotation = async () => {
    const currentRefresh = getRefreshToken();
    if (!currentRefresh) {
      setStatusLog('WARNING: No Refresh Token found. Register or Login first.');
      return;
    }

    try {
      setStatusLog('TOKEN ROTATION: Dispatching Refresh Token to /auth/refresh-token...');
      const res = await api.post('/auth/refresh-token', { refreshToken: currentRefresh });
      const data = res.data;
      
      setTokens(data.accessToken, data.refreshToken);

      setChecklist(prev => ({
        ...prev,
        tokenRotation: true,
        refreshToken: true,
      }));

      setStatusLog(`ROTATION COMPLETE: Old refresh token invalidated in store!\n✓ Issued fresh Access Token & new Refresh Token pair.`);
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setStatusLog(`ERROR: Token Rotation Failed - ${err.response?.data?.message || err.message}`);
      setApiResponse(JSON.stringify(err.response?.data || { error: err.message }, null, 2));
    }
  };

  const testProtectedApi = async (endpoint: string, label: string) => {
    try {
      setStatusLog(`SECURITY CHECK: Requesting ${endpoint} with Authorization: Bearer Header...`);
      const res = await api.get(endpoint);

      setChecklist(prev => ({
        ...prev,
        jwtFilter: true,
        protectedApi: true,
        roleSecurity: endpoint.includes('analyst') || endpoint.includes('admin') ? true : prev.roleSecurity,
      }));

      setStatusLog(`ACCESS GRANTED: ${label}\n✓ JwtAuthenticationFilter validated signature & Spring Security @PreAuthorize rules satisfied.`);
      setApiResponse(JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      const status = err.response?.status;
      setStatusLog(`ACCESS DENIED (${status}): Security filter rejected request for ${endpoint}. Role insufficient or token invalid.`);
      setApiResponse(JSON.stringify(err.response?.data || { status, error: 'Forbidden / Unauthorized Access' }, null, 2));
    }
  };

  const handleResolve = useCallback(async (threatId: number) => {
    try {
      await api.patch(`/threats/${threatId}/resolve`);
    } catch (e) {
      console.error('Failed to resolve threat:', e);
    }
  }, []);

  const handleLogout = async () => {
    try {
      const currentRefresh = getRefreshToken();
      if (currentRefresh) {
        await api.post('/auth/logout', { refreshToken: currentRefresh });
      }
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      setTokens(null, null);
      setUser(null);
      setStatusLog('SESSION TERMINATED: Tokens cleared from storage and globally revoked.');
      setApiResponse('Awaiting next authentication attempt...');
    }
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Professional Navbar */}
      <nav className="navbar" style={{ flexShrink: 0 }}>
        <div className="brand">
          <div className="brand-icon-wrapper">
            <Shield size={24} color="#06b6d4" />
          </div>
          <div>
            <div className="brand-title">SecureStream</div>
            <div className="brand-subtitle">Real-Time Threat Intelligence Engine</div>
          </div>
        </div>

        {user ? (
          <div className="user-profile-badge">
            <NotificationBell orgId={orgId} />
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                color: isDark ? '#fbbf24' : '#38bdf8', transition: 'all 0.3s'
              }}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              <span style={{ fontSize: 11, fontWeight: 600 }}>{isDark ? 'Light' : 'Dark'}</span>
            </button>
            <span className={`role-pill role-${user.role.toLowerCase()}`}>{user.role}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{user.username}</span>
            <button className="cyber-btn cyber-btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={handleLogout}>
              <LogOut size={14} /> Exit
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.textSub }}>
            <Activity size={16} color="#06b6d4" /> Security Gateway v1.0
          </div>
        )}
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: colors.bg }}>
        {user ? (
          <>
            {/* Sidebar Navigation */}
            <aside style={{
              width: 240, background: colors.sidebarBg,
              borderRight: `1px solid ${colors.border}`, padding: '20px 0',
              display: 'flex', flexDirection: 'column', gap: 8,
              overflowY: 'auto', overflowX: 'hidden'
            }}>
              <div style={{ padding: '0 20px', fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: '0.1em', marginBottom: 10 }}>MAIN MENU</div>
              
              <button
                onClick={() => setCurrentMenu('dashboard')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: currentMenu === 'dashboard' ? 'rgba(56,189,248,0.1)' : 'transparent',
                  color: currentMenu === 'dashboard' ? '#38bdf8' : colors.textSub, border: 'none', borderRight: currentMenu === 'dashboard' ? '3px solid #38bdf8' : '3px solid transparent',
                  cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'dashboard' ? 600 : 400, fontSize: 14, transition: 'all 0.2s'
                }}
              >
                <LayoutDashboard size={18} /> Threat Dashboard
              </button>

              {(user.role === 'ADMIN' || user.role === 'ANALYST') && (
                <button
                  onClick={() => setCurrentMenu('reports')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: currentMenu === 'reports' ? 'rgba(56,189,248,0.1)' : 'transparent',
                    color: currentMenu === 'reports' ? '#38bdf8' : colors.textSub, border: 'none', borderRight: currentMenu === 'reports' ? '3px solid #38bdf8' : '3px solid transparent',
                    cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'reports' ? 600 : 400, fontSize: 14, transition: 'all 0.2s'
                  }}
                >
                  <FileText size={18} /> Daily Reports
                </button>
              )}

              {user.role === 'ADMIN' && (
                <>
                  <button
                    onClick={() => setCurrentMenu('users')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: currentMenu === 'users' ? 'rgba(56,189,248,0.1)' : 'transparent',
                      color: currentMenu === 'users' ? '#38bdf8' : colors.textSub, border: 'none', borderRight: currentMenu === 'users' ? '3px solid #38bdf8' : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'users' ? 600 : 400, fontSize: 14, transition: 'all 0.2s'
                    }}
                  >
                    <Users size={18} /> User Management
                  </button>
                  <button
                    onClick={() => setCurrentMenu('audit')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: currentMenu === 'audit' ? 'rgba(56,189,248,0.1)' : 'transparent',
                      color: currentMenu === 'audit' ? '#38bdf8' : colors.textSub, border: 'none', borderRight: currentMenu === 'audit' ? '3px solid #38bdf8' : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'audit' ? 600 : 400, fontSize: 14, transition: 'all 0.2s'
                    }}
                  >
                    <TerminalIcon size={18} /> Audit Logs
                  </button>
                </>
              )}
              {/* Intelligence — ADMIN & ANALYST */}
              {(user.role === 'ADMIN' || user.role === 'ANALYST') && (
                <>
                  <button
                    onClick={() => setCurrentMenu('intelligence')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                      background: currentMenu === 'intelligence' ? 'rgba(99,102,241,0.12)' : 'transparent',
                      color: currentMenu === 'intelligence' ? '#818cf8' : colors.textSub,
                      border: 'none', borderRight: currentMenu === 'intelligence' ? '3px solid #818cf8' : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'intelligence' ? 600 : 400,
                      fontSize: 14, transition: 'all 0.2s'
                    }}
                  >
                    <CpuIcon size={18} /> ARIA Engine
                  </button>
                  <button
                    onClick={() => setCurrentMenu('map')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                      background: currentMenu === 'map' ? 'rgba(244,63,94,0.12)' : 'transparent',
                      color: currentMenu === 'map' ? '#f43f5e' : colors.textSub,
                      border: 'none', borderRight: currentMenu === 'map' ? '3px solid #f43f5e' : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'map' ? 600 : 400,
                      fontSize: 14, transition: 'all 0.2s'
                    }}
                  >
                    <Globe size={18} /> Global Threat Map
                  </button>
                  {/* User Behavior — ADMIN & ANALYST */}
                  <button
                    onClick={() => setCurrentMenu('behavior')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                      background: currentMenu === 'behavior' ? 'rgba(14,165,233,0.12)' : 'transparent',
                      color: currentMenu === 'behavior' ? '#0ea5e9' : colors.textSub,
                      border: 'none', borderRight: currentMenu === 'behavior' ? '3px solid #0ea5e9' : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'behavior' ? 600 : 400,
                      fontSize: 14, transition: 'all 0.2s'
                    }}
                  >
                    <UserCheck2 size={18} /> User Behavior
                  </button>
                  {/* Phase 10: Incident Response — ADMIN & ANALYST */}
                  <button
                    onClick={() => setCurrentMenu('incident')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                      background: currentMenu === 'incident' ? 'rgba(239,68,68,0.12)' : 'transparent',
                      color: currentMenu === 'incident' ? '#ef4444' : colors.textSub,
                      border: 'none', borderRight: currentMenu === 'incident' ? '3px solid #ef4444' : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'incident' ? 600 : 400,
                      fontSize: 14, transition: 'all 0.2s'
                    }}
                  >
                    <Target size={18} /> Incident Response
                  </button>
                  {/* Phase 11: API Integration — ADMIN ONLY */}
                  {user.role === 'ADMIN' && (
                    <button
                      onClick={() => setCurrentMenu('api')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                        background: currentMenu === 'api' ? 'rgba(217,70,239,0.12)' : 'transparent',
                        color: currentMenu === 'api' ? '#d946ef' : colors.textSub,
                        border: 'none', borderRight: currentMenu === 'api' ? '3px solid #d946ef' : '3px solid transparent',
                        cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'api' ? 600 : 400,
                        fontSize: 14, transition: 'all 0.2s'
                      }}
                    >
                      <Webhook size={18} /> API Integrations
                    </button>
                  )}
                  {/* Phase 12: Compliance — ADMIN & ANALYST */}
                  <button
                    onClick={() => setCurrentMenu('compliance')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                      background: currentMenu === 'compliance' ? 'rgba(16,185,129,0.12)' : 'transparent',
                      color: currentMenu === 'compliance' ? '#10b981' : colors.textSub,
                      border: 'none', borderRight: currentMenu === 'compliance' ? '3px solid #10b981' : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left', fontWeight: currentMenu === 'compliance' ? 600 : 400,
                      fontSize: 14, transition: 'all 0.2s'
                    }}
                  >
                    <ShieldCheck size={18} /> Compliance Score
                  </button>
                </>
              )}
            </aside>

            {/* Main Content Area */}
            <main style={{ flex: 1, padding: '20px 0', overflowY: 'auto', background: colors.bg }}>
              {currentMenu === 'dashboard' && (
                <ThreatDashboard
                  orgId={orgId}
                  userRole={user.role}
                  username={user.username}
                  onResolve={handleResolve}
                />
              )}
              {currentMenu === 'users' && user.role === 'ADMIN' && <UserManagement theme={theme} />}
              {currentMenu === 'reports' && (user.role === 'ADMIN' || user.role === 'ANALYST') && <ReportsView />}
              {currentMenu === 'audit' && user.role === 'ADMIN' && <AuditLogView />}
              {currentMenu === 'intelligence' && (user.role === 'ADMIN' || user.role === 'ANALYST') && (
                <IntelligenceView orgId={orgId} userRole={user.role} />
              )}
              {currentMenu === 'map' && (user.role === 'ADMIN' || user.role === 'ANALYST') && (
                <GeoMapView orgId={orgId} />
              )}
              {currentMenu === 'behavior' && (user.role === 'ADMIN' || user.role === 'ANALYST') && (
                <UserBehaviorView orgId={orgId} />
              )}
              {currentMenu === 'incident' && (user.role === 'ADMIN' || user.role === 'ANALYST') && (
                <IncidentResponseView orgId={orgId} username={user.username} />
              )}
              {currentMenu === 'api' && user.role === 'ADMIN' && (
                <ApiIntegrationView orgId={orgId} />
              )}
              {currentMenu === 'compliance' && (user.role === 'ADMIN' || user.role === 'ANALYST') && (
                <ComplianceDashboard orgId={orgId} />
              )}
            </main>
          </>
        ) : (
          /* ── Auth Forms + Checklist ── */
          <div className="main-grid" style={{ overflowY: 'auto', flex: 1 }}>
          {/* Left Column: Form & Security Controls */}
          <div className="cyber-card">
            <>
              {/* Persona Selection */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button
                  className={`cyber-btn ${persona === 'ANALYST' ? '' : 'cyber-btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => { setPersona('ANALYST'); setActiveTab('login'); setUsername('analyst_sec'); setPassword('Analyst123!'); }}
                >
                  <Shield size={16} /> Analyst
                </button>
                <button
                  className={`cyber-btn ${persona === 'VIEWER' ? '' : 'cyber-btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => { setPersona('VIEWER'); setActiveTab('login'); setUsername('viewer_audit'); setPassword('Viewer123!'); }}
                >
                  <User size={16} /> Viewer
                </button>
                <button
                  className={`cyber-btn ${persona === 'ADMIN' ? '' : 'cyber-btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => { setPersona('ADMIN'); setActiveTab('login'); setUsername('Musheer'); setPassword('Sm50738789@'); }}
                >
                  <Key size={16} /> Admin
                </button>
              </div>

              <div className="tab-switcher">
                <button
                  className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
                  onClick={() => setActiveTab('login')}
                >
                  <Lock size={16} /> {persona.charAt(0) + persona.slice(1).toLowerCase()} Login
                </button>
                {persona !== 'ADMIN' && (
                  <button
                    className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
                    onClick={() => setActiveTab('register')}
                  >
                    <UserPlus size={16} /> Register {persona.charAt(0) + persona.slice(1).toLowerCase()}
                  </button>
                )}
              </div>

              {activeTab === 'register' && persona !== 'ADMIN' ? (
                <form onSubmit={handleRegister}>
                  <div className="card-header">
                    <h2 className="card-title"><UserCheck size={20} color="#06b6d4" /> Register {persona.charAt(0) + persona.slice(1).toLowerCase()} Account</h2>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Username</label>
                    <div className="input-wrapper">
                      <User className="input-icon" size={18} />
                      <input
                        className="cyber-input"
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        placeholder={persona === 'ANALYST' ? 'e.g. analyst_sec' : 'e.g. viewer_audit'}
                      />
                    </div>
                  </div>

                  {persona === 'ANALYST' && (
                    <div className="form-field">
                      <label className="form-label">Employee ID</label>
                      <div className="input-wrapper">
                        <Shield className="input-icon" size={18} />
                        <input className="cyber-input" type="text" value={empId} onChange={e => setEmpId(e.target.value)} required placeholder="e.g. EMP-9923" />
                      </div>
                    </div>
                  )}

                  {persona === 'VIEWER' && (
                    <div className="form-field">
                      <label className="form-label">Organization / Department</label>
                      <div className="input-wrapper">
                        <Activity className="input-icon" size={18} />
                        <input className="cyber-input" type="text" value={department} onChange={e => setDepartment(e.target.value)} required placeholder="e.g. Global Auditing Dept" />
                      </div>
                    </div>
                  )}

                  <div className="form-field">
                    <label className="form-label">Email Address</label>
                    <div className="input-wrapper">
                      <Mail className="input-icon" size={18} />
                      <input
                        className="cyber-input"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder={persona === 'ANALYST' ? 'analyst@securestream.io' : 'viewer@securestream.io'}
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Password (Strict Requirements)</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={18} />
                      <input className="cyber-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                    </div>
                    {password.length > 0 && (
                      <div style={{ fontSize: 11, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: password.length >= 8 ? '#10b981' : '#f43f5e' }}>{password.length >= 8 ? '✓' : '○'} Min 8 characters</span>
                        <span style={{ color: /[A-Z]/.test(password) ? '#10b981' : '#f43f5e' }}>{/[A-Z]/.test(password) ? '✓' : '○'} Uppercase letter</span>
                        <span style={{ color: /[a-z]/.test(password) ? '#10b981' : '#f43f5e' }}>{/[a-z]/.test(password) ? '✓' : '○'} Lowercase letter</span>
                        <span style={{ color: /[0-9]/.test(password) ? '#10b981' : '#f43f5e' }}>{/[0-9]/.test(password) ? '✓' : '○'} Number</span>
                        <span style={{ color: /[@#$%^&+=!]/.test(password) ? '#10b981' : '#f43f5e' }}>{/[@#$%^&+=!]/.test(password) ? '✓' : '○'} Special character (@#$%^&+=!)</span>
                      </div>
                    )}
                  </div>

                  <div className="form-field">
                    <label className="form-label">Selected Persona</label>
                    <div className="input-wrapper">
                      <Shield className="input-icon" size={18} />
                      <input className="cyber-input" type="text" value={persona} disabled style={{ backgroundColor: '#1e293b', color: colors.textSub }} />
                    </div>
                  </div>

                  <button type="submit" className="cyber-btn" disabled={isAuthLoading || !Object.values({ length: password.length >= 8, uppercase: /[A-Z]/.test(password), lowercase: /[a-z]/.test(password), number: /[0-9]/.test(password), special: /[@#$%^&+=!]/.test(password) }).every(Boolean)} style={{ opacity: isAuthLoading ? 0.7 : 1 }}>
                    <UserPlus size={18} className={isAuthLoading ? "spin" : ""} /> {isAuthLoading ? "Creating Account..." : `Create ${persona.charAt(0) + persona.slice(1).toLowerCase()} Account`}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className={isShaking ? "shake" : ""}>
                  <div className="card-header">
                    <h2 className="card-title"><Lock size={20} color="#06b6d4" /> {persona.charAt(0) + persona.slice(1).toLowerCase()} Login</h2>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Username</label>
                    <div className="input-wrapper">
                      <User className="input-icon" size={18} />
                      <input className="cyber-input" type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Enter username" />
                    </div>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Password</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={18} />
                      <input className="cyber-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                    </div>
                  </div>

                  <button type="submit" className="cyber-btn" style={{ marginTop: 10, opacity: isAuthLoading ? 0.7 : 1 }} disabled={isAuthLoading}>
                    <Zap size={18} className={isAuthLoading ? "spin" : ""} /> {isAuthLoading ? "Authenticating..." : "Authenticate & Issue Token"}
                  </button>
                </form>
              )}
            </>
          </div>

          {/* Right Column: SecureStream Auth Checklist Status */}
          <div className="cyber-card">
            <div className="card-header">
              <h2 className="card-title"><Shield size={20} color="#06b6d4" /> SECURESTREAM AUTH CHECKLIST</h2>
            </div>

            <div className="checklist-container" style={{ marginBottom: 20 }}>
              {([
                ['register', 'Register', checklist.register ? 'VERIFIED' : 'PENDING'],
                ['login', 'Login', checklist.login ? 'VERIFIED' : 'PENDING'],
                ['bcrypt', 'BCrypt Password Hash', checklist.bcrypt ? 'ENCRYPTED' : 'PENDING'],
                ['jwtAccess', 'JWT Access Token', checklist.jwtAccess ? 'ISSUED' : 'PENDING'],
                ['jwtFilter', 'JWT Security Filter', checklist.jwtFilter ? 'INTERCEPTED' : 'PENDING'],
                ['refreshToken', 'Refresh Token Store', checklist.refreshToken ? 'STORED' : 'PENDING'],
                ['tokenRotation', 'Token Rotation', checklist.tokenRotation ? 'ROTATED' : 'PENDING'],
                ['protectedApi', 'Protected API', checklist.protectedApi ? 'PASSED' : 'PENDING'],
                ['roleSecurity', 'Role Security (@PreAuthorize)', checklist.roleSecurity ? 'ENFORCED' : 'PENDING'],
              ] as [keyof typeof checklist, string, string][]).map(([key, label, badge]) => (
                <div key={key} className={`checklist-row ${checklist[key] ? 'completed' : ''}`}>
                  <span className="checklist-label">
                    {checklist[key] ? <CheckCircle2 color="#10b981" size={18} /> : <Circle color="#64748b" size={18} />} {label}
                  </span>
                  <span className={`status-badge ${checklist[key] ? 'success' : 'pending'}`}>{badge}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <span className="form-label">Security Audit Console</span>
              <div className="terminal-box">{statusLog}</div>
            </div>

            <div>
              <span className="form-label">Live API Response</span>
              <div className="terminal-box" style={{ color: '#a7f3d0' }}>{apiResponse}</div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export function App() {
  const { theme, toggleTheme, isDark, colors } = useTheme();

  // patch light-mode body background
  React.useEffect(() => {
    document.body.style.background = colors.bg;
  }, [colors.bg]);

  // Re-export so inner component has access to theme
  return <AppInner theme={theme} toggleTheme={toggleTheme} isDark={isDark} colors={colors} />;
}

export default function AppWithProvider() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

