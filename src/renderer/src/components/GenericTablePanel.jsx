import React, { useRef, useEffect, useState } from 'react';

export default function GenericTablePanel({
  theme,
  isDark,
  activeTab,
  rightData,
  fetchLogs,
  fetchServiceLogs,
  activeLogId,
  handleRestartPm2,
  handleStopPm2,
  handleDeletePm2,
  handleSavePm2,
  handleServiceAction,
  services,
  logHeight,
  setLogHeight,
  logData,
  settings,
  isSmall
}) {
  const logRef = useRef(null);
  const [cfPid, setCfPid] = useState('');
  
  const cfPath = settings?.cloudflarePath || 'C:\\cloudflared';
  const cfLog = settings?.cloudflareLog || 'C:\\cloudflared.log';

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Table Header */}
      <h2 className="header-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span><span style={{ color: activeTab === 'projects' ? theme.primary : activeTab === 'nginx' ? theme.warning : activeTab === 'redis' ? theme.danger : '#f58220', marginRight: '10px' }}>▶</span> {rightData.title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {activeTab === 'projects' && (
             <div style={{ display: 'flex', gap: '10px' }}>
               <button className="btn btn-warning" onClick={handleSavePm2} style={{ padding: '4px 10px', fontSize: '10px' }}>💾 SAVE PM2</button>
             </div>
          )}
          {activeTab === 'cloudflare' && (
             <div style={{ display: 'flex', gap: '8px' }}>
               <button 
                 className="btn" 
                 onClick={() => handleServiceAction({ action: 'cf_install', path: cfPath })}
                 disabled={services?.cfServiceInstalled}
                 style={{ padding: '4px 8px', fontSize: '10px', borderColor: services?.cfServiceInstalled ? theme.border : theme.warning, color: services?.cfServiceInstalled ? theme.textMuted : theme.warning }}>
                 {services?.cfServiceInstalled ? '✓ INSTALLED' : '⚙ INSTALL'}
               </button>
               <button 
                 className="btn btn-start" 
                 onClick={() => handleServiceAction({ action: 'cf_start' })}
                 disabled={!services?.cfServiceInstalled || services?.cfServiceRunning}
                 style={{ padding: '4px 8px', fontSize: '10px', opacity: (!services?.cfServiceInstalled || services?.cfServiceRunning) ? 0.5 : 1 }}>
                 ▶ START
               </button>
               <button 
                 className="btn btn-stop" 
                 onClick={() => handleServiceAction({ action: 'cf_stop' })}
                 disabled={!services?.cfServiceRunning}
                 style={{ padding: '4px 8px', fontSize: '10px', opacity: !services?.cfServiceRunning ? 0.5 : 1 }}>
                 ■ STOP
               </button>
               <div style={{ display: 'flex', alignItems: 'center', gap: '2px', border: `1px solid ${theme.danger}`, padding: '2px', borderRadius: '4px' }}>
                 <input 
                   type="text" 
                   placeholder="PID" 
                   value={cfPid}
                   onChange={(e) => setCfPid(e.target.value)}
                   style={{ width: '50px', background: 'transparent', border: 'none', color: theme.text, fontSize: '10px', padding: '2px 4px', outline: 'none' }}
                 />
                 <button 
                   className="btn" 
                   onClick={() => {
                     if(!cfPid) return alert("Vui lòng nhập PID!");
                     handleServiceAction({ action: 'cf_force_kill', command: cfPid });
                     setCfPid('');
                   }}
                   style={{ padding: '2px 6px', fontSize: '10px', background: theme.danger, color: '#fff', border: 'none' }}>
                   KILL PID
                 </button>
               </div>
               <button 
                 className="btn" 
                 onClick={() => handleServiceAction({ action: 'cf_recovery', path: cfPath })}
                 style={{ padding: '4px 8px', fontSize: '10px', borderColor: theme.warning, color: theme.warning }}>
                 🛠 RECOVERY
               </button>
               <button 
                 className="btn" 
                 onClick={() => handleServiceAction({ action: 'cf_uninstall', path: cfPath })}
                 style={{ padding: '4px 8px', fontSize: '10px', borderColor: theme.textMuted, color: theme.textMuted }}>
                 🗑 UNINSTALL
               </button>
               <button 
                 className="btn btn-primary" 
                 onClick={() => handleServiceAction({ action: 'cf_query' })}
                 style={{ padding: '4px 8px', fontSize: '10px' }}>
                 🔍 CHECK
               </button>
               <button 
                 className="btn btn-primary" 
                 onClick={() => fetchServiceLogs(cfLog)}
                 style={{ padding: '4px 8px', fontSize: '10px' }}>
                 📑 LOGS
               </button>
               <button 
                 className="btn btn-warning" 
                 onClick={() => handleServiceAction({ action: 'open_file', path: cfLog })}
                 style={{ padding: '4px 8px', fontSize: '10px' }}>
                 📝 OPEN
               </button>
               <div style={{ 
                  fontSize: '10px', 
                  fontWeight: 'bold', 
                  padding: '4px 8px', 
                  border: `1px solid ${services?.cfStatus === 'RUNNING' ? theme.success : theme.danger}`,
                  color: services?.cfStatus === 'RUNNING' ? theme.success : theme.danger,
                  marginLeft: '5px',
                  background: services?.cfStatus === 'RUNNING' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'
               }}>
                 STATUS: {services?.cfStatus || 'UNKNOWN'}
               </div>
             </div>
          )}
          <span style={{ color: theme.textMuted }}>Nodes: {rightData.data.length}</span>
        </div>
      </h2>

      {/* PROCESS TABLE (Scrollable) */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
          <thead style={{ background: theme.tableHeader, position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th className="cell" style={{ width: '80px', color: theme.textMuted, fontWeight: 'bold', fontSize: '11px', borderBottom: `1px solid ${theme.border}` }}>PID</th>
              <th className="cell" style={{ color: theme.textMuted, fontWeight: 'bold', fontSize: '11px', borderBottom: `1px solid ${theme.border}` }}>SERVICE_ID</th>
              <th className="cell" style={{ width: isSmall ? '80px' : '100px', color: theme.textMuted, fontWeight: 'bold', fontSize: '11px', borderBottom: `1px solid ${theme.border}` }}>STATUS</th>
              {!isSmall && <th className="cell" style={{ width: '130px', color: theme.textMuted, fontWeight: 'bold', fontSize: '11px', borderBottom: `1px solid ${theme.border}` }}>CPU / MEM</th>}
              {(activeTab === 'projects' && !isSmall) && (
                <th className="cell" style={{ width: '90px', color: theme.textMuted, fontWeight: 'bold', fontSize: '11px', borderBottom: `1px solid ${theme.border}` }}>RESTARTS</th>
              )}
              <th className="cell" style={{ width: isSmall ? '120px' : '200px', color: theme.textMuted, fontWeight: 'bold', fontSize: '11px', borderBottom: `1px solid ${theme.border}` }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {rightData.data.length === 0 && (
               <tr><td colSpan={activeTab === 'projects' ? "6" : "5"} className="cell" style={{ textAlign: 'center', color: theme.textMuted, padding: '40px' }}>NO SERVICES</td></tr>
            )}
            {rightData.type === 'pm2' && rightData.data.map(p => (
               <tr key={p.pm_id} className="table-row" onClick={() => fetchLogs(p.pm_id)} style={{ background: activeLogId === p.pm_id ? theme.tableRowHover : 'transparent', cursor: 'pointer' }}>
                  <td className="cell" style={{ color: theme.textMuted, fontFamily: 'monospace' }}>[{p.pm_id}]</td>
                  <td className="cell" style={{ color: theme.text, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td className="cell">
                     <span className="status-badge" style={{ 
                         background: p.pm2_env.status === 'online' ? (isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5') : (isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2'),
                         color: p.pm2_env.status === 'online' ? theme.success : theme.danger,
                         border: `1px solid ${p.pm2_env.status === 'online' ? theme.success : theme.danger}`
                     }}>
                        {p.pm2_env.status.toUpperCase()}
                     </span>
                  </td>
                  {!isSmall && (
                     <td className="cell" style={{ color: theme.primary, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                        {p.monit ? (
                           <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '40px', textAlign: 'right' }}>{p.monit.cpu}%</div>
                              <div style={{ padding: '0 5px', color: theme.textMuted }}>/</div>
                              <div style={{ width: '45px', textAlign: 'right' }}>{(p.monit.memory / 1024 / 1024).toFixed(1)}</div>
                              <div style={{ marginLeft: '2px', fontSize: '10px' }}>MB</div>
                           </div>
                        ) : 'WAITING...'}
                     </td>
                  )}
                  {(activeTab === 'projects' && !isSmall) && (
                     <td className="cell" style={{ color: theme.warning, fontWeight: 'bold', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                        {p.pm2_env.restart_time || 0}
                     </td>
                  )}
                  <td className="cell">
                    {p.pm2_env.status === 'online' ? (
                       <div style={{ display: 'flex', gap: '5px' }}>
                         <button className="btn btn-warning" onClick={(e) => { e.stopPropagation(); handleRestartPm2(p.pm_id); }} style={{ padding: '6px 10px', fontSize: '10px' }} title="Restart">↻</button>
                         <button className="btn btn-stop" onClick={(e) => { e.stopPropagation(); handleStopPm2(p.pm_id); }} style={{ padding: '6px 10px', fontSize: '10px' }}>KILL</button>
                         <button className="btn" onClick={(e) => { e.stopPropagation(); handleDeletePm2(p.pm_id); }} style={{ padding: '6px 10px', fontSize: '10px', borderColor: theme.danger, color: theme.danger }}>🗑 DELETE</button>
                       </div>
                    ) : (
                       <div style={{ display: 'flex', gap: '5px' }}>
                         <button className="btn btn-start" onClick={(e) => { e.stopPropagation(); handleRestartPm2(p.pm_id); }} style={{ padding: '6px 10px', fontSize: '10px' }}>▶ START</button>
                         <button className="btn" onClick={(e) => { e.stopPropagation(); handleDeletePm2(p.pm_id); }} style={{ padding: '6px 10px', fontSize: '10px', borderColor: theme.danger, color: theme.danger }}>🗑 DELETE</button>
                       </div>
                    )}
                  </td>
               </tr>
            ))}
            {rightData.type === 'service' && rightData.data.map((p, idx) => (
               <tr key={p.id} className="table-row">
                  <td className="cell" style={{ color: theme.textMuted, fontFamily: 'monospace' }}>[SYS_{idx}]</td>
                  <td className="cell" style={{ color: theme.text, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td className="cell">
                     <span className="status-badge" style={{ 
                         background: p.status === 'online' ? (isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5') : (isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2'),
                         color: p.status === 'online' ? theme.success : theme.danger,
                         border: `1px solid ${p.status === 'online' ? theme.success : theme.danger}`
                     }}>
                        {p.status.toUpperCase()}
                     </span>
                  </td>
                  {!isSmall && (
                     <td className="cell" style={{ color: theme.textMuted, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                        -- / --
                     </td>
                  )}
                   <td className="cell">
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {activeTab === 'redis' ? (
                          <>
                            {p.rawStatus === 'NOT_INSTALLED' ? (
                              <button 
                                className="btn btn-primary" 
                                onClick={() => handleServiceAction({ action: 'redis_install', command: { serviceName: p.serviceName, confPath: p.confPath } })}
                                style={{ padding: '6px 10px', fontSize: '10px' }}>
                                ⚙ INSTALL
                              </button>
                            ) : (
                              <>
                                <button 
                                  className="btn btn-start" 
                                  onClick={() => handleServiceAction({ action: 'redis_start', command: { serviceName: p.serviceName } })} 
                                  disabled={p.status === 'online'}
                                  style={{ padding: '6px 10px', fontSize: '10px', opacity: p.status === 'online' ? 0.5 : 1 }}>
                                  ▶ START
                                </button>
                                <button 
                                  className="btn btn-stop" 
                                  onClick={() => handleServiceAction({ action: 'redis_stop', command: { serviceName: p.serviceName } })} 
                                  disabled={p.status === 'offline'}
                                  style={{ padding: '6px 10px', fontSize: '10px', opacity: p.status === 'offline' ? 0.5 : 1 }}>
                                  ■ STOP
                                </button>
                                <button 
                                  className="btn" 
                                  onClick={() => fetchServiceLogs(p.logPath)}
                                  style={{ padding: '6px 10px', fontSize: '10px', borderColor: theme.primary, color: theme.primary }}>
                                  📑 LOGS
                                </button>
                                <button 
                                  className="btn" 
                                  onClick={() => handleServiceAction({ action: 'open_file', path: p.confPath })}
                                  style={{ padding: '6px 10px', fontSize: '10px', borderColor: theme.warning, color: theme.warning }}>
                                  ⚙
                                </button>
                                <button 
                                  className="btn" 
                                  onClick={() => {
                                    if(window.confirm(`Gỡ cài đặt ${p.serviceName}?`)) {
                                      handleServiceAction({ action: 'redis_uninstall', command: { serviceName: p.serviceName } })
                                    }
                                  }}
                                  style={{ padding: '6px 10px', fontSize: '10px', borderColor: theme.danger, color: theme.danger }}>
                                  🗑
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <button className="btn btn-primary" onClick={() => handleServiceAction({ action: 'start', path: p.path, command: p.command, processName: p.processName })} style={{ padding: '6px 10px', fontSize: '10px' }}>▶ RUN</button>
                            <button className="btn btn-stop" onClick={() => handleServiceAction({ action: 'stop', processName: p.processName })} style={{ padding: '6px 10px', fontSize: '10px' }}>■ KILL</button>
                          </>
                        )}
                      </div>
                   </td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RESIZER DRAG HANDLE */}
      <div 
        onMouseDown={(e) => {
          e.preventDefault();
          const moveHandler = (ev) => {
            const newHeight = ((window.innerHeight - ev.clientY) / window.innerHeight) * 100;
            if (newHeight > 10 && newHeight < 80) setLogHeight(newHeight);
          };
          const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
          };
          document.addEventListener('mousemove', moveHandler);
          document.addEventListener('mouseup', upHandler);
        }}
        style={{ height: '4px', cursor: 'row-resize', background: theme.border, width: '100%', opacity: 0.8, transition: 'background 0.2s' }}
        onMouseOver={(e) => e.target.style.background = theme.primary}
        onMouseOut={(e) => e.target.style.background = theme.border}
      />

      {/* LOG VIEWER PANEL (BOTTOM) */}
      <div style={{ height: `${logHeight}%`, minHeight: '100px', background: theme.logBg, display: 'flex', flexDirection: 'column' }}>
         <div style={{ padding: '8px 15px', background: theme.panelHeader, borderBottom: `1px solid ${theme.border}`, fontSize: '11px', color: theme.textMuted, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', letterSpacing: '1px' }}>
               {activeTab === 'projects' ? (activeLogId !== null ? `TERMINAL LOGS [PID: ${activeLogId}]` : 'TERMINAL LOGS') : `OUTPUT & STATUS: ${rightData.title}`}
            </span>
            {activeTab === 'projects' && activeLogId !== null && (
               <button onClick={() => fetchLogs(activeLogId)} style={{ background: 'transparent', border: 'none', color: theme.primary, cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>
                  ↻ REFRESH LOGS
               </button>
            )}
          </div>
          <pre ref={logRef} style={{ flex: 1, margin: 0, padding: '15px', overflowY: 'auto', color: theme.logText, fontSize: '12px', fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap' }}>
            {logData || (activeTab === 'projects' ? 'Chưa chọn process hoặc không có log để hiển thị...' : 'Sẵn sàng. Vui lòng nhấn LOGS hoặc CHECK để xem chi tiết.')}
          </pre>
      </div>
    </div>
  );
}
