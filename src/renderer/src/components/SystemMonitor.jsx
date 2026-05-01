import React, { useState, useEffect } from 'react'

const SystemMonitor = ({ theme }) => {
  const [staticData, setStaticData] = useState(null)
  const [dynamicData, setDynamicData] = useState(null)
  const [history, setHistory] = useState({ cpu: [], mem: [], net: [] })

  useEffect(() => {
    // Fetch static data once
    window.systemAPI.getStaticStatus().then(setData => {
      setStaticData(setData)
    })

    const fetchDynamicData = async () => {
      try {
        const stats = await window.systemAPI.getStatus()
        if (stats) {
          setDynamicData(stats)
          setHistory(prev => {
            const newCpu = [...prev.cpu, stats.cpu.load].slice(-100)
            const newMem = [...prev.mem, (stats.memory.used / (staticData?.memory?.total || stats.memory.total)) * 100].slice(-100)
            const netLoad = stats.network.reduce((a, b) => a + b.rx_sec + b.tx_sec, 0)
            const newNet = [...prev.net, netLoad].slice(-100)
            return { cpu: newCpu, mem: newMem, net: newNet }
          })
        }
      } catch (err) {
        console.error('Fetch System Error:', err)
      }
    }

    fetchDynamicData()
    const timer = setInterval(fetchDynamicData, 3000)
    return () => clearInterval(timer)
  }, [staticData?.memory?.total])

  if (!staticData || !dynamicData) return (
    <div style={{ 
      height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', background: theme.bg, color: theme.primary, fontFamily: 'Consolas, monospace'
    }}>
      <div style={{ 
        width: '40px', height: '40px', border: `3px solid ${theme.border}`, borderTopColor: theme.primary, 
        borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px'
      }} />
      <div style={{ letterSpacing: '2px', fontSize: '12px' }}>OPTIMIZING SYSTEM DASHBOARD...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const formatBytes = (bytes) => {
    if (bytes === 0 || !bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24))
    const h = Math.floor((seconds % (3600 * 24)) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${d}d ${h}h ${m}m`
  }

  const StatCard = ({ title, value, subValue, color, extra }) => (
    <div style={{ 
      background: theme.inputBg, border: `1px solid ${theme.border}`, padding: '10px 15px', 
      flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '0'
    }}>
      <span style={{ fontSize: '9px', color: theme.textMuted, fontWeight: 'bold', letterSpacing: '1px' }}>{title}</span>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color: color, whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontSize: '8px', color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subValue}</div>
      {extra && <div style={{ fontSize: '8px', color: theme.primary, marginTop: '2px', fontWeight: 'bold' }}>{extra}</div>}
    </div>
  )

  const ActivityTimeline = ({ data, color, title, unit = '%' }) => {
    const maxVal = Math.max(...data, 1)
    return (
      <div style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.border}`, padding: '10px', display: 'flex', flexDirection: 'column', minWidth: '0', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <span style={{ fontSize: '8px', color: theme.textMuted, fontWeight: 'bold', letterSpacing: '1px' }}>{title}</span>
          <span style={{ fontSize: '8px', color: color, fontWeight: 'bold' }}>{unit === '%' ? data[data.length-1]?.toFixed(1) + '%' : formatBytes(data[data.length-1])}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '1px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
             <div style={{ borderTop: `1px dashed ${theme.border}`, width: '100%', opacity: 0.3 }} />
             <div style={{ borderTop: `1px dashed ${theme.border}`, width: '100%', opacity: 0.1 }} />
          </div>
          {data.map((v, i) => (
            <div key={i} style={{ flex: 1, height: `${(v / maxVal) * 100}%`, background: color, opacity: 0.2 + (i / data.length) * 0.8, borderRadius: '1px' }} />
          ))}
        </div>
      </div>
    )
  }

  const CoreGauge = ({ load, index }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (load / 100) * circumference;
    const color = load > 85 ? theme.danger : load > 60 ? theme.warning : theme.primary;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '5px' }}>
        <svg width="45" height="45" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="22.5" cy="22.5" r={radius} stroke={theme.border} strokeWidth="3" fill="transparent" />
          <circle cx="22.5" cy="22.5" r={radius} stroke={color} strokeWidth="3" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
          <text x="22.5" y="-22.5" transform="rotate(90)" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '8px', fontWeight: 'bold', fill: theme.text }}>{load.toFixed(0)}%</text>
        </svg>
        <div style={{ fontSize: '7px', color: theme.textMuted, fontWeight: 'bold' }}>C{index}</div>
      </div>
    );
  };

  return (
    <div style={{ 
      height: '100%', width: '100%', display: 'flex', flexDirection: 'column', 
      gap: '10px', padding: '15px', background: theme.bg, 
      boxSizing: 'border-box', overflow: 'hidden'
    }}>
      {/* Row 1: Key Stats */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <StatCard title="CPU LOAD" value={`${dynamicData.cpu.load.toFixed(1)}%`} subValue={`${staticData.cpu.brand}`} color={theme.primary} extra={dynamicData.cpu.temp.main > 0 ? `${dynamicData.cpu.temp.main.toFixed(0)}°C` : 'N/A'} />
        <StatCard title="MEMORY" value={`${((dynamicData.memory.used / dynamicData.memory.total) * 100).toFixed(1)}%`} subValue={`${formatBytes(dynamicData.memory.used)} / ${formatBytes(dynamicData.memory.total)}`} color={theme.warning} />
        <StatCard title="DISK I/O" value={`R: ${formatBytes(dynamicData.diskIO.rx)}/s`} subValue={`W: ${formatBytes(dynamicData.diskIO.wx)}/s`} color={theme.success} />
        <StatCard title="NETWORK" value={`${formatBytes(dynamicData.network.reduce((a, b) => a + b.rx_sec, 0))}/s`} subValue={`Ping: ${dynamicData.latency ? dynamicData.latency + 'ms' : '...'}`} color="#06b6d4" />
        <StatCard title="PM2 APPS" value={dynamicData.pm2.count} subValue={`Mem: ${formatBytes(dynamicData.pm2.mem)}`} color="#f43f5e" />
        <StatCard title="UPTIME" value={formatUptime(dynamicData.uptime)} subValue={staticData.os.hostname} color="#a855f7" />
      </div>

      {/* Row 2: CPU CORES */}
      <div style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, padding: '10px 15px' }}>
        <div style={{ fontSize: '9px', fontWeight: 'bold', color: theme.textMuted, marginBottom: '5px', letterSpacing: '1px' }}>CPU CORES UTILIZATION</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-start' }}>
          {dynamicData.cpu.cpus.map((load, i) => (
            <CoreGauge key={i} load={load} index={i} />
          ))}
        </div>
      </div>

      {/* Row 3: Bottom Grid */}
      <div style={{ flex: 1, display: 'flex', gap: '10px', overflow: 'hidden' }}>
        <div style={{ flex: 1.5, background: theme.inputBg, border: `1px solid ${theme.border}`, padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px', overflowY: 'auto' }}>
           <div style={{ fontSize: '9px', fontWeight: 'bold', color: theme.textMuted }}>APP PERFORMANCE (PM2)</div>
           {dynamicData.pm2.topApps.map((app, i) => (
              <div key={i} style={{ padding: '8px 10px', background: theme.panelBg, borderLeft: `3px solid ${theme.primary}`, display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '9px', fontWeight: 'bold' }}>{app.name}</div>
                <div style={{ textAlign: 'right', fontSize: '9px' }}>
                  <div style={{ color: theme.primary, fontWeight: 'bold' }}>{app.cpu.toFixed(1)}%</div>
                  <div style={{ color: theme.textMuted, fontSize: '8px' }}>{formatBytes(app.mem)}</div>
                </div>
              </div>
            ))}
        </div>

        <div style={{ flex: 1.2, background: theme.inputBg, border: `1px solid ${theme.border}`, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: theme.textMuted, letterSpacing: '1px' }}>STORAGE STATUS</div>
          {dynamicData.disks.filter(d => d.size > 0).map((disk, i) => {
            const usagePercent = (disk.used / disk.size) * 100;
            const barColor = usagePercent > 90 ? theme.danger : usagePercent > 70 ? theme.warning : theme.primary;
            return (
              <div key={i} style={{ padding: '10px', background: theme.panelBg, borderLeft: `3px solid ${barColor}`, borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12px', color: theme.text, letterSpacing: '1px' }}>{disk.mount}</span>
                  <span style={{ color: barColor, fontSize: '10px', fontWeight: 'bold' }}>{usagePercent.toFixed(1)}%</span>
                </div>
                
                <div style={{ height: '4px', background: theme.border, marginBottom: '6px' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${usagePercent}%`, 
                      background: barColor,
                      transition: 'width 1s ease'
                    }} 
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: theme.textMuted }}>
                   <span>{formatBytes(disk.used)} USED / {formatBytes(disk.available)} FREE</span>
                   <span style={{ opacity: 0.7 }}>TOTAL: {formatBytes(disk.size)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
          <div style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, padding: '10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: theme.textMuted, marginBottom: '5px' }}>ACTIVE NETWORK</div>
            {dynamicData.network.filter(n => n.operstate === 'up').slice(0, 1).map((net, i) => (
              <div key={i} style={{ fontSize: '9px' }}>
                <div style={{ fontWeight: 'bold', color: theme.primary }}>{net.iface} [{net.ip4}]</div>
                <div style={{ fontSize: '7px', color: theme.textMuted }}>MAC: {net.mac}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.border}`, padding: '10px', fontSize: '9px' }}>
            <div style={{ fontWeight: 'bold', color: theme.textMuted, marginBottom: '5px' }}>IDENTITY & VERSIONS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div>MB: <span style={{ color: theme.primary }}>{staticData.baseboard.model}</span></div>
              <div>Node: <span style={{ color: theme.success }}>{staticData.versions.node}</span></div>
              <div>PM2: <span style={{ color: theme.success }}>v{staticData.versions.pm2}</span></div>
              <div style={{ marginTop: '3px', color: theme.textMuted }}>{staticData.os.distro} ({staticData.os.arch})</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Timelines */}
      <div style={{ display: 'flex', gap: '10px', height: '100px' }}>
        <ActivityTimeline data={history.cpu} color={theme.primary} title="CPU ACTIVITY" />
        <ActivityTimeline data={history.mem} color={theme.warning} title="MEMORY ACTIVITY" />
        <ActivityTimeline data={history.net} color={theme.success} title="NETWORK ACTIVITY" unit="B/s" />
      </div>
    </div>
  )
}

export default SystemMonitor
