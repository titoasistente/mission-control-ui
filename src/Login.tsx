import { useState } from 'react';

export default function Login({ onLogin }: { onLogin: (pass: string) => void }) {
  const [pass, setPass] = useState('');
  return (
    <div style={{ 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      height: '100vh', background: '#0f0f0f', color: '#fff', fontFamily: 'Inter, sans-serif' 
    }}>
      <div style={{ background: '#262626', padding: '40px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <h1 style={{ marginBottom: '20px', background: 'linear-gradient(90deg, #f97316, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>⚡ Mission Control</h1>
        <input 
          type="password" 
          placeholder="Enter Access Key" 
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onLogin(pass)}
          style={{ 
            padding: '12px', borderRadius: '6px', border: '1px solid #444', 
            background: '#1a1a1a', color: '#fff', width: '250px', marginBottom: '20px', outline: 'none' 
          }}
        />
        <br />
        <button 
          onClick={() => onLogin(pass)}
          style={{ 
            padding: '12px 30px', borderRadius: '6px', border: 'none', 
            background: '#f97316', color: '#fff', fontWeight: 'bold', cursor: 'pointer' 
          }}
        >
          Access Terminal
        </button>
      </div>
    </div>
  );
}
