import { useState } from 'react';

interface LoginProps {
  onLogin: (pass: string, role?: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [pass, setPass] = useState('');
  const [role, setRole] = useState<'luke' | 'viewer'>('viewer');
  
  const handleSubmit = () => {
    onLogin(pass, role);
  };
  
  return (
    <div style={{ 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      height: '100vh', background: '#0f0f0f', color: '#fff', fontFamily: 'Inter, sans-serif' 
    }}>
      <div style={{ background: '#262626', padding: '40px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <h1 style={{ marginBottom: '20px', background: 'linear-gradient(90deg, #f97316, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>⚡ Mission Control</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>Access Mode</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'luke' | 'viewer')}
            style={{ 
              padding: '10px', borderRadius: '6px', border: '1px solid #444', 
              background: '#1a1a1a', color: '#fff', width: '250px', outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="viewer">Viewer (Read-only)</option>
            <option value="luke">Luke / Chief of Staff (Full Access)</option>
          </select>
        </div>
        
        <input 
          type="password" 
          placeholder="Enter Access Key" 
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          style={{ 
            padding: '12px', borderRadius: '6px', border: '1px solid #444', 
            background: '#1a1a1a', color: '#fff', width: '250px', marginBottom: '20px', outline: 'none' 
          }}
        />
        <br />
        <button 
          onClick={handleSubmit}
          style={{ 
            padding: '12px 30px', borderRadius: '6px', border: 'none', 
            background: '#f97316', color: '#fff', fontWeight: 'bold', cursor: 'pointer' 
          }}
        >
          Access Terminal
        </button>
        
        {role === 'luke' && (
          <p style={{ marginTop: '15px', fontSize: '12px', color: '#4ade80' }}>
            ✅ Approve permissions enabled
          </p>
        )}
      </div>
    </div>
  );
}
