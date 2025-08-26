import React, { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import api from '../api/client'
import { AuthProvider, useAuth } from '../context/AuthContext'

function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('admin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const handleLogin = async () => {
    setLoading(true); setError('')
    try { await login(email, password) } catch { setError('Login failed') } finally { setLoading(false) }
  }
  return (
    <div className='login-card' style={{ maxWidth: 860, margin:'8vh auto', padding: 24, background:'#0e142b', border:'1px solid #1f2a52', borderRadius: 10 }}>
      <div style={{ display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ flex:'1 1 320px' }}>
          <h1 style={{ margin: 0 }}>Mikrotik Syslogs Server</h1>
          <p style={{ color:'#8aa0c7' }}>Centralized syslog collection for MikroTik devices with powerful search, filters, alert rules, and CSV/JSON export.</p>
          <ul style={{ color:'#b7c6ea', marginTop: 8 }}>
            <li>Search by IP, identity, severity and keywords</li>
            <li>Role-based access with user management</li>
            <li>Purge old logs safely by age and filters</li>
            <li>Email/SMS alert rules by severity/keywords</li>
          </ul>
        </div>
        <div style={{ flex:'0 0 320px', background:'#0b1020', padding:16, borderRadius:8, border:'1px solid #1f2a52' }}>
          <h2 style={{ marginTop:0 }}>Sign in</h2>
          <div className='row' style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input placeholder='Email' value={email} onChange={e=>setEmail(e.target.value)} style={{ padding:'10px 12px', borderRadius:6, border:'1px solid #253462', background:'#0f1632', color:'#dbe7ff' }} />
            <input placeholder='Password' type='password' value={password} onChange={e=>setPassword(e.target.value)} style={{ padding:'10px 12px', borderRadius:6, border:'1px solid #253462', background:'#0f1632', color:'#dbe7ff' }} />
            <button onClick={handleLogin} disabled={loading} style={{ padding:'10px 12px', borderRadius:6, background:'#5b8cff', border:'none', color:'#fff', fontWeight:600 }}>{loading ? 'Signing in...' : 'Login'}</button>
            {error && <div style={{ color:'salmon' }}>{error}</div>}
            <p style={{ marginTop:8, color:'#8aa0c7' }}>Default admin: admin@example.com / admin</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertsManager() {
  const [rules, setRules] = useState([])
  const [form, setForm] = useState({ name:'', deviceIp:'', minSeverity:'', keyword:'', emailTo:'', smsTo:'', enabled:true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function load() { const res = await api.get('/alerts'); setRules(res.data) }
  useEffect(()=>{ load() }, [])
  async function save() {
    setSaving(true); setError('')
    try {
      await api.post('/alerts', form)
      setForm({ name:'', deviceIp:'', minSeverity:'', keyword:'', emailTo:'', smsTo:'', enabled:true })
      await load()
    } catch (e) { setError('Failed to save alert (are you logged in as Admin?)') }
    finally { setSaving(false) }
  }
  async function remove(id) { try { await api.delete(`/alerts/${id}`); load() } catch { setError('Delete failed') } }
  return (
    <div className='page'>
      <h2>Alerts</h2>
      <div className='toolbar'>
        <input placeholder='Name' value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
        <input placeholder='Device IP' value={form.deviceIp} onChange={e=>setForm({...form, deviceIp:e.target.value})}/>
        <select value={form.minSeverity} onChange={e=>setForm({...form, minSeverity:e.target.value})}>
          <option value=''>Min Severity</option>
          {['EMERGENCY','ALERT','CRITICAL','ERROR','WARNING','NOTICE','INFO','DEBUG'].map(s=> <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder='Keyword' value={form.keyword} onChange={e=>setForm({...form, keyword:e.target.value})}/>
        <input placeholder='Email To' value={form.emailTo} onChange={e=>setForm({...form, emailTo:e.target.value})}/>
        <input placeholder='SMS To' value={form.smsTo} onChange={e=>setForm({...form, smsTo:e.target.value})}/>
        <label><input type='checkbox' checked={form.enabled} onChange={e=>setForm({...form, enabled:e.target.checked})}/> Enabled</label>
        <button disabled={saving} onClick={save}>{saving? 'Saving...' : 'Create'}</button>
      </div>
      {error && <div style={{ color:'salmon', marginTop:6 }}>{error}</div>}
      <ul>
        {rules.map(r=> (
          <li key={r.id}>
            <strong>{r.name}</strong> {r.deviceIp || 'Any'} {r.minSeverity || 'Any'} {r.keyword || ''} {r.emailTo || ''} {r.smsTo || ''} [{r.enabled ? 'on' : 'off'}]
            <button onClick={()=>remove(r.id)} style={{ marginLeft: 8 }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Charts() {
  const [data, setData] = useState({ volume: [], errorsByDevice: [] })
  const [range, setRange] = useState({ start:'', end:'' })
  const [loading, setLoading] = useState(false)
  const load = async () => {
    setLoading(true)
    try { const res = await api.get('/logs/stats', { params: range }); setData(res.data) }
    finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [])
  return (
    <div className='page'>
      <h2>Charts</h2>
      <div className='toolbar'>
        <input type='datetime-local' value={range.start} onChange={e=>setRange({...range, start:e.target.value})}/>
        <input type='datetime-local' value={range.end} onChange={e=>setRange({...range, end:e.target.value})}/>
        <button onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      </div>
      <div style={{ display:'flex', gap:24, marginTop: 12, flexWrap:'wrap' }}>
        <div>
          <h4>Volume per hour</h4>
          <div style={{ display:'flex', gap:2, alignItems:'flex-end', height: 120, border: '1px solid #1f2a52', padding: 4 }}>
            {data.volume.map((b,i)=>{
              const max = Math.max(...data.volume.map(v=>Number(v.c)||0),1)
              const h = Math.round((Number(b.c)/max)*110)
              return <div key={i} title={`${b.c} @ ${new Date(b.bucket).toLocaleString()}`} style={{ width:6, height:h, background:'#4e79a7' }}/>
            })}
          </div>
        </div>
        <div>
          <h4>Errors by device</h4>
          <table>
            <thead><tr><th>Device</th><th>Errors</th><th>Total</th></tr></thead>
            <tbody>
              {data.errorsByDevice.map((r,i)=> (
                <tr key={i}><td>{r.deviceIp}</td><td>{r.errors}</td><td>{r.total}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function LogDetails({ log, onClose }) {
  if (!log) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ background:'#fff', width:600, maxWidth:'90%', margin:'10% auto', padding:16 }} onClick={e=>e.stopPropagation()}>
        <h3>Log Details</h3>
        <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(log, null, 2)}</pre>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function LogsView() {
  const { token } = useAuth()
  const [logs, setLogs] = useState([])
  const [query, setQuery] = useState({ q:'', deviceIp:'', deviceIdentity:'', severity:'', start:'', end:'' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState(null)

  const socket = useMemo(()=> io('/', { transports:['websocket'], auth: { token } }), [token])
  useEffect(()=>{ return ()=> socket.close() }, [socket])

  useEffect(()=>{
    socket.on('log:new', (log)=>{
      setLogs(prev => [log, ...prev].slice(0, 500))
    })
  }, [socket])

  async function fetchLogs(pageNum=1) {
    const params = { ...query, page: pageNum, pageSize: 100 }
    const res = await api.get('/logs', { params })
    setLogs(res.data.items)
    setTotal(res.data.total)
    setPage(res.data.page)
  }

  useEffect(()=>{ if (token) fetchLogs(1) }, [token])
  // Reset to page 1 on any filter change, fetch immediately
  useEffect(()=>{ if (token) fetchLogs(1) }, [query.deviceIp, query.deviceIdentity, query.severity, query.q, query.start, query.end])

  const exportUrl = (format) => `/api/logs/export?format=${format}&deviceIp=${encodeURIComponent(query.deviceIp)}&deviceIdentity=${encodeURIComponent(query.deviceIdentity)}&severity=${encodeURIComponent(query.severity)}&q=${encodeURIComponent(query.q)}&start=${encodeURIComponent(query.start)}&end=${encodeURIComponent(query.end)}`

const download = async (format) => {
  const params = { ...query, format }
  const res = await api.get('/logs/export', { params, responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `logs.${format}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

  return (
    <div className='page logs'>
      <h2>Logs</h2>
      <div className='toolbar'>
        <input placeholder='Device IP' value={query.deviceIp} onChange={e=>setQuery({...query, deviceIp:e.target.value})}/>
        <input placeholder='Identity (hostname/app)' value={query.deviceIdentity} onChange={e=>setQuery({...query, deviceIdentity:e.target.value})}/>
        <select value={query.severity} onChange={e=>setQuery({...query, severity:e.target.value})}>
          <option value=''>Any Severity</option>
          {['EMERGENCY','ALERT','CRITICAL','ERROR','WARNING','NOTICE','INFO','DEBUG','UNKNOWN'].map(s=> <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder='Keyword' value={query.q} onChange={e=>setQuery({...query, q:e.target.value})}/>
        <input type='datetime-local' value={query.start} onChange={e=>setQuery({...query, start:e.target.value})}/>
        <input type='datetime-local' value={query.end} onChange={e=>setQuery({...query, end:e.target.value})}/>
        <button onClick={()=>fetchLogs(1)}>Search</button>
        <button onClick={()=>download('csv')}>Export CSV</button>
        <button onClick={()=>download('json')}>Export JSON</button>
      </div>

      <div className='table-wrap'>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>IP</th>
              <th>Identity</th>
              <th>Severity</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, idx) => {
              // Use server-provided identity (or backend fallback from Device.name)
              const identity = l.deviceIdentity || ''
              const rowNumber = (page - 1) * 100 + (idx + 1)
              return (
                <tr key={l.id} onClick={()=>setSelected(l)}>
                  <td>{rowNumber}</td>
                  <td>{new Date(l.timestamp).toLocaleString()}</td>
                  <td>{l.deviceIp}</td>
                  <td>{identity}</td>
                  <td><span className={`sev sev-${(l.severity||'').toLowerCase()}`}>{l.severity}</span></td>
                  <td><code>{l.message}</code></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className='pager'>
        <button disabled={page<=1} onClick={()=>fetchLogs(page-1)}>Prev</button>
        <span>Page {page}</span>
        <button disabled={(page*100)>=total} onClick={()=>fetchLogs(page+1)}>Next</button>
      </div>

      <LogDetails log={selected} onClose={()=>setSelected(null)} />
    </div>
  )
}

function Settings() {
  const [values, setValues] = useState({ WAN_IP:'', SYSLOG_PORT:'514', SYSLOG_HOST:'0.0.0.0', MT_USER:'', MT_PASS:'', MT_API_PORT:'8728', MT_HTTP_PORT:'80', MT_HTTPS_PORT:'' })
  const [saved, setSaved] = useState('')
  async function load() { const res = await api.get('/settings'); setValues(res.data) }
  useEffect(()=>{ load() }, [])
  async function save() { await api.post('/settings', values); setSaved('Saved. UDP changes require backend restart. MikroTik credentials apply immediately.'); setTimeout(()=>setSaved(''), 4000) }
  return (
    <div style={{ padding: 16 }}>
      <h2>Settings</h2>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <input placeholder='Public WAN IP' value={values.WAN_IP} onChange={e=>setValues({...values, WAN_IP:e.target.value})}/>
        <input placeholder='Syslog UDP Host' value={values.SYSLOG_HOST} onChange={e=>setValues({...values, SYSLOG_HOST:e.target.value})}/>
        <input placeholder='Syslog UDP Port' value={values.SYSLOG_PORT} onChange={e=>setValues({...values, SYSLOG_PORT:e.target.value})}/>
      </div>
      <div className='toolbar' style={{ marginTop: 12 }}>
        <div>
          <h3 style={{ margin: '4px 0' }}>MikroTik Credentials</h3>
          <p style={{ margin: 0, color: '#8aa0c7' }}>These credentials are used to query /system/identity on all monitored MikroTiks. They must be identical across devices.</p>
        </div>
        <input placeholder='MikroTik Username' value={values.MT_USER} onChange={e=>setValues({...values, MT_USER:e.target.value})}/>
        <input placeholder='MikroTik Password' type='password' value={values.MT_PASS} onChange={e=>setValues({...values, MT_PASS:e.target.value})}/>
        <input placeholder='MikroTik API Port (default: 8728)' value={values.MT_API_PORT} onChange={e=>setValues({...values, MT_API_PORT:e.target.value})}/>
        <input placeholder='MikroTik HTTP Port (default: 80)' value={values.MT_HTTP_PORT} onChange={e=>setValues({...values, MT_HTTP_PORT:e.target.value})}/>
        <input placeholder='MikroTik HTTPS Port (default: 443)' value={values.MT_HTTPS_PORT} onChange={e=>setValues({...values, MT_HTTPS_PORT:e.target.value})}/>
        <button onClick={save}>Save</button>
      </div>
      <p style={{ color:'#8aa0c7' }}>Note: Changing UDP host/port requires backend restart. Configure devices to send syslog to {values.WAN_IP || 'your-public-ip'}:{values.SYSLOG_PORT}. Credentials are stored encrypted.</p>
      {saved && <div style={{ color:'green' }}>{saved}</div>}
    </div>
  )
}

function Users() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ email:'', password:'', role:'VIEWER' })
  const [error, setError] = useState('')
  async function load() { try { const res = await api.get('/users'); setUsers(res.data) } catch { setError('Load users failed (Admin only)') } }
  useEffect(()=>{ load() }, [])
  async function create() { try { await api.post('/users', form); setForm({ email:'', password:'', role:'VIEWER' }); load() } catch { setError('Create failed') } }
  async function remove(id) { try { await api.delete(`/users/${id}`); load() } catch { setError('Delete failed') } }
  return (
    <div className='page'>
      <h2>Users</h2>
      <div className='toolbar'>
        <input placeholder='Email' value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
        <input placeholder='Password' type='password' value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
        <select value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
          {['ADMIN','EDITOR','VIEWER'].map(r=> <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={create}>Create</button>
      </div>
      {error && <div style={{ color:'salmon', marginTop:6 }}>{error}</div>}
      <table>
        <thead><tr><th>Email</th><th>Role</th><th>Created</th><th/></tr></thead>
        <tbody>
          {users.map(u=> (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{new Date(u.createdAt).toLocaleString()}</td>
              <td><button onClick={()=>remove(u.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DevicesManager() {
  const [devices, setDevices] = useState([])
  const [fetchingIps, setFetchingIps] = useState(new Set())
  const [msg, setMsg] = useState('')
  
  async function loadDevices() {
    try {
      const res = await api.get('/devices')
      setDevices(res.data)
    } catch (error) {
      setMsg('Failed to load devices')
    }
  }
  
  useEffect(() => { loadDevices() }, [])
  
  const fetchIdentity = async (ip) => {
    setFetchingIps(prev => new Set([...prev, ip]))
    setMsg(`Connecting to ${ip} and running /system identity print...`)
    
    const source = new AbortController()
    const timeoutId = setTimeout(() => source.abort(), 50000) // backend caps ~45s
    try {
      const res = await api.post(`/devices/fetch-identity/${encodeURIComponent(ip)}`, {}, { signal: source.signal })
      
      if (res.data.success) {
        setMsg(`✅ ${res.data.message}`)
        await loadDevices() // Refresh the devices list
      } else {
        setMsg(`❌ ${res.data.message || res.data.error}`)
      }
    } catch (error) {
      const aborted = error.name === 'CanceledError' || error.message?.includes('canceled')
      const errorMsg = aborted ? 'Request timed out' : (error.response?.data?.message || error.response?.data?.error || error.message)
      setMsg(`❌ Failed to fetch identity from ${ip}: ${errorMsg}`)
    } finally {
      clearTimeout(timeoutId)
      setFetchingIps(prev => {
        const newSet = new Set(prev)
        newSet.delete(ip)
        return newSet
      })
    }
  }
  
  return (
    <div className='page'>
      <h2>Devices</h2>
      <div className='toolbar'>
        <button onClick={loadDevices}>Refresh Devices</button>
        {msg && <span style={{ marginLeft: 8, color: msg.startsWith('✅') ? '#3ecf8e' : msg.startsWith('❌') ? '#ff5b5b' : '#8aa0c7' }}>{msg}</span>}
      </div>
      
      <div className='table-wrap' style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>IP Address</th>
              <th>Identity/Name</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => {
              const isFetching = fetchingIps.has(device.ip)
              return (
                <tr key={device.id}>
                  <td><strong>{device.ip}</strong></td>
                  <td>
                    {device.name ? (
                      <span style={{color:'#3ecf8e', fontWeight:'bold'}}>{device.name}</span>
                    ) : (
                      <em style={{color:'#8aa0c7'}}>Not fetched</em>
                    )}
                  </td>
                  <td>{new Date(device.updatedAt || device.createdAt).toLocaleString()}</td>
                  <td>
                    <button 
                      disabled={isFetching} 
                      onClick={() => fetchIdentity(device.ip)}
                      style={{ 
                        fontSize: '12px', 
                        padding: '6px 12px',
                        background: device.name ? '#8aa0c7' : '#5b8cff',
                        opacity: isFetching ? 0.6 : 1
                      }}
                    >
                      {isFetching ? 'Fetching...' : device.name ? 'Re-fetch' : 'Fetch Identity'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {devices.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#8aa0c7' }}>
          <p>No devices detected yet.</p>
          <p>Devices will appear here automatically when they send syslog messages.</p>
        </div>
      )}
    </div>
  )
}

function Debug() {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState('fetch-identity.log')
  const [lines, setLines] = useState([])
  const [n, setN] = useState(500)
  const [msg, setMsg] = useState('')
  const loadFiles = async () => { try { const res = await api.get('/debug/logs'); setFiles(res.data.logs||[]) } catch { setFiles([]) } }
  const load = async (name=selected) => { try { const res = await api.get(`/debug/logs/${encodeURIComponent(name)}?lines=${n}`); setLines(res.data.lines||[]) } catch { setLines([]) } }
  const clear = async () => { try { await api.delete(`/debug/logs/${encodeURIComponent(selected)}`); setMsg('Cleared'); setTimeout(()=>setMsg(''),1500); load() } catch { setMsg('Failed to clear') } }
  useEffect(()=>{ loadFiles() }, [])
  useEffect(()=>{ load(selected) }, [selected, n])
  return (
    <div className='page'>
      <h2>Debug Logs</h2>
      <div className='toolbar'>
        <select value={selected} onChange={e=>setSelected(e.target.value)}>
          {files.map(f=> <option key={f.name} value={f.name}>{f.name} ({f.size} bytes)</option>)}
        </select>
        <input type='number' min='50' max='5000' value={n} onChange={e=>setN(Number(e.target.value)||500)} />
        <button onClick={()=>load(selected)}>Refresh</button>
        <button onClick={clear} style={{background:'#ff5b5b'}}>Clear</button>
        {msg && <span style={{color:'#8aa0c7'}}>{msg}</span>}
      </div>
      <div className='table-wrap' style={{maxHeight:'65vh'}}>
        <pre style={{ margin:0, padding:12, whiteSpace:'pre-wrap' }}>
          {lines.map((l,i)=> <div key={i}><code>{l}</code></div>)}
        </pre>
      </div>
    </div>
  )
}

function LogsCleanup() {
  const options = [
    { label: '7 days', days: 7 },
    { label: '2 weeks', days: 14 },
    { label: '1 month', days: 30 },
    { label: '3 months', days: 90 },
    { label: '6 months', days: 180 },
  ]
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [filters, setFilters] = useState({ deviceIp:'', deviceIdentity:'', severity:'' })
  const run = async (days) => {
    setBusy(true); setMsg('')
    try {
      const res = await api.post('/logs/cleanup', { days, ...filters })
      setMsg(`Deleted ${res.data.deleted} logs older than ${res.data.olderThanDays} days`)
    } catch { setMsg('Cleanup failed (Admin only)') }
    finally { setBusy(false) }
  }
  return (
    <div className='page'>
      <h2>Purge Logs</h2>
      <div className='toolbar'>
        <input placeholder='Device IP (optional)' value={filters.deviceIp} onChange={e=>setFilters({...filters, deviceIp:e.target.value})}/>
        <input placeholder='Identity (optional)' value={filters.deviceIdentity} onChange={e=>setFilters({...filters, deviceIdentity:e.target.value})}/>
        <select value={filters.severity} onChange={e=>setFilters({...filters, severity:e.target.value})}>
          <option value=''>Any Severity</option>
          {['EMERGENCY','ALERT','CRITICAL','ERROR','WARNING','NOTICE','INFO','DEBUG','UNKNOWN'].map(s=> <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className='toolbar' style={{ marginTop: 12 }}>
        <span>Remove logs older than:</span>
        {options.map(o=> <button key={o.days} disabled={busy} onClick={()=>run(o.days)}>{o.label}</button>)}
        <button disabled={busy} style={{ marginLeft: 8, background:'#ff5b5b' }} onClick={async ()=>{ setBusy(true); setMsg(''); try { const res = await api.post('/logs/cleanup-all'); setMsg(`Deleted ${res.data.deleted} logs (all)`)} catch { setMsg('Clear all failed (Admin only)') } finally { setBusy(false) } }}>Clear ALL logs</button>
        <button disabled={busy} style={{ marginLeft: 8 }} onClick={async ()=>{ setBusy(true); setMsg(''); try { const res = await api.post('/logs/normalize-identity-api'); setMsg(`Normalized identity for ${res.data.resolved}/${res.data.ips} devices, updated ${res.data.updated} logs`) } catch { setMsg('Normalize failed (Admin only)') } finally { setBusy(false) } }}>Normalize identities via API</button>
        {msg && <span style={{ marginLeft: 8, color:'#8aa0c7' }}>{msg}</span>}
      </div>
    </div>
  )
}

function Dashboard() {
  const [tab, setTab] = useState('logs')
  const { user } = useAuth()
  const isAdmin = (user?.role === 'ADMIN')
  return (
    <div>
      <div className='toolbar' style={{ marginTop: 12 }}>
        <button onClick={()=>setTab('logs')}>Logs</button>
        <button onClick={()=>setTab('alerts')}>Alerts</button>
        <button onClick={()=>setTab('charts')}>Charts</button>
        {isAdmin && <button onClick={()=>setTab('devices')}>Devices</button>}
        {isAdmin && <button onClick={()=>setTab('purge')}>Purge</button>}
        {isAdmin && <button onClick={()=>setTab('users')}>Users</button>}
        {isAdmin && <button onClick={()=>setTab('settings')}>Settings</button>}
        {isAdmin && <button onClick={()=>setTab('debug')}>Debug</button>}
      </div>
      {tab==='logs' && (<LogsView />)}
      {tab==='alerts' && <AlertsManager />}
      {tab==='charts' && <Charts />}
      {isAdmin && tab==='devices' && <DevicesManager />}
      {isAdmin && tab==='purge' && <LogsCleanup />}
      {isAdmin && tab==='users' && <Users />}
      {isAdmin && tab==='settings' && <Settings />}
      {isAdmin && tab==='debug' && <Debug />}
    
    </div>
  )
}

function AppInner() {
  const { token, logout } = useAuth()
  return token ? (
    <div className='app-shell'>
      <header>
        <h1>Syslog Portal</h1>
        <button onClick={logout}>Logout</button>
      </header>
      <Dashboard/>
    </div>
  ) : <Login/>
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner/>
      <style>{`
        :root { --bg:#0b1020; --panel:#111a32; --muted:#8aa0c7; --accent:#5b8cff; --text:#e7efff; --danger:#ff5b5b; --warn:#ffb85b; --ok:#3ecf8e; }
        * { box-sizing: border-box; }
        body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: var(--bg); color: var(--text); }
        input, select, button { padding:8px 10px; border-radius:8px; border:1px solid #253055; background:#0f1730; color: var(--text); }
        button { background: linear-gradient(135deg, var(--accent), #7ca6ff); border:none; color:#fff; cursor:pointer; box-shadow: 0 6px 16px rgba(91,140,255,.3) }
        button:disabled { opacity:.5; cursor:not-allowed }
        a { color: var(--accent); text-decoration: none; }
        .app-shell header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #1c274a; background:#0e162e; position:sticky; top:0; z-index:5 }
        .page { padding:16px; }
        .toolbar { display:flex; gap:8px; flex-wrap:wrap; padding:12px; background:#0e1731; border:1px solid #1f2a52; border-radius:12px; }
        .table-wrap { margin-top:12px; max-height:60vh; overflow:auto; border:1px solid #1f2a52; border-radius:12px; }
        table { width:100%; border-collapse: collapse; }
        thead tr { background:#0d1530; position:sticky; top:0 }
        th, td { text-align:left; padding:10px; border-bottom:1px solid #1a2447; }
        tr:hover { background:#0e1a3a }
        code { color:#b8c8ff }
        .pager { margin-top:10px; display:flex; align-items:center; gap:10px }
        .sev { padding:2px 8px; border-radius:999px; font-size:12px; }
        .sev-error, .sev-critical, .sev-alert, .sev-emergency { background:rgba(255,91,91,.15); color:#ff9b9b; border:1px solid rgba(255,91,91,.35) }
        .sev-warning, .sev-notice { background:rgba(255,184,91,.15); color:#ffd29a; border:1px solid rgba(255,184,91,.35) }
        .sev-info, .sev-debug, .sev-unknown { background:rgba(94,140,255,.15); color:#b8ccff; border:1px solid rgba(94,140,255,.35) }
        /* Login card */
        .login-card { max-width:420px; margin:8% auto; background:#0f1732; padding:24px; border-radius:16px; border:1px solid #1f2a52; box-shadow: 0 20px 60px rgba(0,0,0,.35) }
        .login-card h2 { margin-top:0 }
        .login-card .row { display:flex; flex-direction:column; gap:8px; margin-bottom:10px }
      `}</style>
    </AuthProvider>
  )
}