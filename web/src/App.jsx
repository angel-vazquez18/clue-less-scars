import React, { useEffect, useRef, useState } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8080`;
const PROTOCOL_VERSION = '1.0';

export default function App() {
  const [gameId, setGameId] = useState('NEW');
  const [name, setName] = useState('');
  const [log, setLog] = useState([]);
  const [players, setPlayers] = useState([]);
  const wsRef = useRef(null);

  const push = (line) => setLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${line}`]);

  const send = (type, payload={}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg = { type, gameId, payload, ts: new Date().toISOString(), version: PROTOCOL_VERSION };
    ws.send(JSON.stringify(msg));
  };

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => push(`WS connected → ${WS_URL}`);
    ws.onclose = () => push(`WS closed`);
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);

        let line = `← ${m.type}`;
        if (m.type === 'PLAYER_JOINED') {
            line += ` — ${m.payload?.name || 'Unknown'} joined the game`;
        } else if (m.payload?.message) {
            line += ` — ${m.payload.message}`;
        }
        push(line);

        if (m.type === 'INFO' && m.payload?.gameId && gameId === 'NEW') {
          setGameId(m.payload.gameId); // remember assigned game
        }

        // seed roster from full state
        if (m.type === 'GAME_STATE' && m.payload?.players) {
            setPlayers(m.payload.players);
        }
  
        // live updates on join/leave/changes
        if (m.type === 'LOBBY_STATE' && m.payload?.players) {
            setPlayers(m.payload.players);
        }

      } catch {
        push(`← (text) ${e.data}`);
      }
    };
  };

  const join = () => send('JOIN_GAME', { name: name || undefined });
  const ping = () => send('PING', {});
  const chat = () => {
    const text = prompt('Message to broadcast?') || '';
    send('CHAT', { message: text });
  };

  useEffect(() => { connect(); }, []); // connect on load

  return (
    <div style={{fontFamily:'ui-sans-serif', padding:16, maxWidth:720, margin:'0 auto'}}>
        <h1>Clue-Less (Skeletal)</h1>
        <p>Game ID: <code>{gameId}</code></p>
        <p>WS: <code>{WS_URL}</code></p>
        <div style={{display:'flex', gap:8, marginBottom:8}}>
            <input placeholder="Game ID (NEW to create)" value={gameId} onChange={e=>setGameId(e.target.value)} style={{flex:1}} />
            <input placeholder="Display name" value={name} onChange={e=>setName(e.target.value)} style={{flex:1}} />
            <button onClick={join}>Join</button>
            <button onClick={ping}>Ping</button>
            <button onClick={chat}>Chat</button>
        </div>
        <h3>Lobby</h3>
        <ul style={{ marginTop: 4, background: '#f9f9f9', padding: 8, borderRadius: 6 }}>
            {players.length === 0 && <li style={{ color: '#999' }}>No players yet</li>}
            {players.map(p => (
                <li key={p.id}>{p.name || 'Unknown'}</li>
            ))}
        </ul>
        <div style={{border:'1px solid #ddd', padding:8, height:300, overflow:'auto', background:'#fafafa'}}>
            {log.map((l,i)=>(<div key={i} style={{fontFamily:'monospace'}}>{l}</div>))}
        </div>
        <p style={{marginTop:8, color:'#666'}}>Open 4–6 tabs or windows to simulate multiple players. Share the same Game ID after the first player creates it.</p>
    </div>
  );
}
