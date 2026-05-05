import React, { useState, useEffect, useMemo } from 'react'
import { getTheme } from './config/theme'
import LeftSidebar from './components/LeftSidebar'
import GenericTablePanel from './components/GenericTablePanel'
import SystemMonitor from './components/SystemMonitor'


function App() {
  const [appConfig, setAppConfig] = useState(null)
  const [isDark, setIsDark] = useState(true)
  const theme = useMemo(() => getTheme(isDark), [isDark])
  
  const [processes, setProcesses] = useState([])
  const [path, setPath] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  const [services, setServices] = useState({ nginx: false, redis: false, cloudflare: false })
  const [activeTab, setActiveTab] = useState(null)
  const [logHeight, setLogHeight] = useState(35)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      if (window.innerWidth < 1000) setIsSidebarOpen(false)
      else setIsSidebarOpen(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isSmall = windowWidth < 1000

  const rightData = useMemo(() => {
    if (!appConfig || !activeTab) return { title: '', data: [], type: '' }
    const { tabs, services: presetData } = appConfig

    const tab = tabs.find(t => t.id === activeTab)
    if (!tab) return { title: '', data: [], type: '' }

    if (tab.viewType === 'pm2') {
      return { title: tab.viewTitle, data: processes, type: 'pm2' }
    }

    // Service type
    const rawData = presetData[tab.dataKey] || []
    
    if (tab.id === 'redis' && services.redisNodes) {
      return {
        title: tab.viewTitle,
        data: rawData.map(p => ({ 
          ...p, 
          status: (services.redisNodes[p.serviceName] || '').toLowerCase().includes('running') ? 'online' : 'offline',
          rawStatus: services.redisNodes[p.serviceName] || 'NOT_INSTALLED'
        })),
        type: 'service'
      }
    }

    const status = services[tab.serviceKey] ? 'online' : 'offline'
    return { 
      title: tab.viewTitle, 
      data: rawData.map(p => ({ ...p, status })), 
      type: 'service' 
    }
  }, [activeTab, appConfig, processes, services])

  const [logData, setLogData] = useState('')
  const [activeLogId, setActiveLogId] = useState(null)

  const fetchData = async () => {
    try {
      const pm2List = await window.pm2API.getList()
      setProcesses(pm2List)
      const svcs = await window.servicesAPI.getStatus()
      setServices(svcs)
    } catch (e) {
      console.error(e)
    }
  }

  const loadInitialConfig = async () => {
    try {
      const cfg = await window.configAPI.load()
      setAppConfig(cfg)
      // Mặc định mở tab monitor khi khởi động
      setActiveTab('monitor')

    } catch (err) {
      console.error('Failed to load config:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialConfig()
    fetchData()
    const timer = setInterval(fetchData, 3000)
    return () => clearInterval(timer)
  }, [])

  if (loading || !appConfig) {
    return (
      <div style={{ background: '#000', height: '100vh', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Consolas, monospace' }}>
        LOADING CONFIGURATION...
      </div>
    )
  }

  const { tabs, services: presetData } = appConfig

  /* PM2 Handlers */
  const handleRunPm2 = async () => {
    if (!path || !name) return alert('NHẬP THIẾU THÔNG TIN')
    setLoading(true)
    try {
      await window.pm2API.startProject({ path, name })
      setPath('')
      setName('')
      fetchData()
    } catch (err) {
      alert('LỖI: ' + err.message)
    } finally { setLoading(false) }
  }

  const handleStopPm2 = async (id) => {
    try {
      await window.pm2API.stopProject(id)
      fetchData()
      if (activeLogId === id) setLogData('')
    } catch (err) {
      alert('LỖI DỪNG: ' + err.message)
    }
  }

  const handleRestartPm2 = async (id) => {
    try {
      await window.pm2API.restartProject(id)
      fetchData()
    } catch (err) {
      alert('LỖI RESTART: ' + err.message)
    }
  }

  const handleDeletePm2 = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn XÓA tiến trình này khỏi PM2?')) return
    try {
      await window.pm2API.deleteProject(id)
      fetchData()
      if (activeLogId === id) setLogData('')
    } catch (err) {
      alert('LỖI XÓA: ' + err.message)
    }
  }

  const handleSavePm2 = async () => {
    try {
      await window.pm2API.savePm2()
      alert('✅ Đã LƯU cấu hình PM2 thành công (pm2 save)!')
    } catch (err) {
      alert('LỖI LƯU: ' + err.message)
    }
  }

  /* Preset Run Handlers */
  const handleRunPreset = async (preset) => {
    setLoading(true)
    try {
      await window.pm2API.runCommand({ path: preset.path, command: preset.command })
      setTimeout(fetchData, 1500)
    } catch (err) {
      alert(`LỖI CHẠY ${preset.name}: ` + err.message)
    } finally { setLoading(false) }
  }

  /* Logs Handlers */
  const fetchLogs = async (id) => {
    setActiveLogId(id)
    setLogData('Đang tải log...')
    const logs = await window.pm2API.getLogs(id)
    setLogData(logs)
  }

  const fetchServiceLogs = async (path) => {
    setLogData('Đang tải system log...')
    const logs = await window.servicesAPI.getLogs(path)
    setLogData(logs)
  }

  const handleServiceAction = async ({ action, path, command, processName }) => {
    try {
      const result = await window.servicesAPI.serviceAction({ action, path, command, processName })
      
      let msg = "Thao tác thành công!"
      if(action === 'cf_install') msg = "Đã gửi lệnh CÀI ĐẶT Cloudflare Service! Vui lòng xác nhận quyền Admin trên Windows."
      if(action === 'cf_uninstall') msg = "Đã gửi lệnh GỠ CÀI ĐẶT Cloudflare Service!"
      if(action === 'cf_force_kill') msg = "Đã thực hiện KILL PID Cloudflared!"
      if(action === 'cf_recovery') msg = "Đang thực hiện chuỗi KHÔI PHỤC Service... Vui lòng đợi!"
      if(action === 'cf_query') msg = "Đã lấy thông tin chi tiết Service (sc queryex)!"
      if(action === 'cf_start') msg = "Đã gửi lệnh KHỞI CHẠY (Start) Cloudflare Service!"
      if(action === 'cf_stop') msg = "Đã gửi lệnh DỪNG (Stop) Cloudflare Service!"
      if(action === 'start') msg = `Đã kích hoạt tiến trình: ${processName || command}`
      if(action === 'stop') msg = `Đã yêu cầu dừng tiến trình: ${processName}`
      
      if(action !== 'open_file' && action !== 'start') alert(msg)

      if(action.startsWith('cf_')) {
        setLogData(`[ACTION: ${action}]\n${result || 'Lệnh đã thực thi.'}`)
      }

      setTimeout(fetchData, 1500)
    } catch (err) {
      alert(`LỖI: ` + err.message)
      setLogData(`[ERROR]\n${err.message}`)
    }
  }

  return (
    <div style={{
       background: theme.bg, height: '100vh', width: '100vw', color: theme.text, 
       fontFamily: "'Segoe UI', Consolas, monospace", display: 'flex', flexDirection: 'column',
       transition: 'all 0.3s'
    }}>
       <style>{`
         * { box-sizing: border-box; }
         body { margin: 0; padding: 0; overflow: hidden; background: ${theme.bg}; }
         ::-webkit-scrollbar { width: 6px; height: 6px; }
         ::-webkit-scrollbar-track { background: ${theme.bg}; border-left: 1px solid ${theme.border}; }
         ::-webkit-scrollbar-thumb { background: #64748b; }
         ::-webkit-scrollbar-thumb:hover { background: ${theme.primary}; }
         
         input:focus, button:focus { outline: none; }
         
         .panel { background: ${theme.panelBg}; display: flex; flex-direction: column; }
         .header-title { padding: 12px 20px; background: ${theme.panelHeader}; border-bottom: 1px solid ${theme.border}; margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: ${theme.textMuted}; display: flex; align-items: center; }
         
         .input-box { background: ${theme.inputBg}; border: 1px solid ${theme.border}; color: ${theme.primary}; padding: 10px 15px; width: 100%; font-family: Consolas, monospace; font-size: 13px; transition: all 0.2s; }
         .input-box:focus { border-color: ${theme.primary}; background: ${theme.inputFocus}; }
         .input-box::placeholder { color: #94a3b8; }

         .btn { border: 1px solid ${theme.border}; padding: 10px 15px; cursor: pointer; text-transform: uppercase; font-size: 11px; font-weight: bold; letter-spacing: 1px; transition: all 0.2s; font-family: Consolas, monospace; }
         .btn:active { transform: scale(0.95); }
         
         .btn-primary { background: ${theme.inputBg}; color: ${theme.primary}; border-color: ${theme.primary}; }
         .btn-primary:hover { background: ${theme.primary}; color: #fff; box-shadow: 0 0 10px rgba(14, 165, 233, 0.4); }
         
         .btn-start { background: ${theme.inputBg}; color: ${theme.success}; border-color: ${theme.success}; }
         .btn-start:hover { background: ${theme.success}; color: #fff; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }
         
         .btn-stop { background: ${theme.inputBg}; color: ${theme.danger}; border-color: ${theme.danger}; }
         .btn-stop:hover { background: ${theme.danger}; color: #fff; box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); }
         
         .btn-warning { background: ${theme.inputBg}; color: ${theme.warning}; border-color: ${theme.warning}; }
         .btn-warning:hover { background: ${theme.warning}; color: #fff; box-shadow: 0 0 10px rgba(234, 179, 8, 0.4); }
         
         .table-row { border-bottom: 1px solid ${theme.border}; transition: background 0.2s; }
         .table-row:hover { background: ${theme.tableRowHover}; }
         .cell { padding: 12px 15px; font-size: 13px; }
         
         .status-badge { display: inline-block; padding: 4px 8px; font-size: 10px; font-weight: bold; letter-spacing: 1px; }
       `}</style>
       
       <header style={{ borderBottom: `1px solid ${theme.border}`, background: theme.panelBg, padding: '0 20px', display: 'flex', alignItems: 'center', height: '50px', zIndex: 100 }}>
         {isSmall && (
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{ background: 'transparent', border: 'none', color: theme.text, fontSize: '20px', cursor: 'pointer', marginRight: '15px', display: 'flex', alignItems: 'center' }}>
              {isSidebarOpen ? '✕' : '☰'}
            </button>
         )}
         <h1 style={{ margin: 0, fontSize: isSmall ? '13px' : '15px', textTransform: 'uppercase', letterSpacing: '3px', color: theme.text, fontWeight: 'bold' }}>
           <span style={{ color: theme.primary }}>CENTRAL HUB</span>
         </h1>
         <div style={{ flex: 1 }}></div>
         
         <div style={{ display: 'flex', gap: '8px', marginRight: isSmall ? '5px' : '20px' }}>
            {!isSmall && (
               <>
                  <button 
                    onClick={() => setActiveTab('projects')}
                    style={{ 
                      background: activeTab === 'projects' ? theme.primary : 'transparent', 
                      border: `1px solid ${theme.border}`, 
                      color: activeTab === 'projects' ? '#fff' : theme.primary, 
                      padding: '5px 15px', 
                      cursor: 'pointer', 
                      fontSize: '11px', 
                      fontWeight: 'bold',
                      borderRadius: '4px'
                    }}>
                    🚀 RUN SERVER
                  </button>

                  <button 
                    onClick={() => setActiveTab('monitor')}
                    style={{ 
                      background: activeTab === 'monitor' ? theme.primary : 'transparent', 
                      border: `1px solid ${theme.border}`, 
                      color: activeTab === 'monitor' ? '#fff' : theme.success, 
                      padding: '5px 15px', 
                      cursor: 'pointer', 
                      fontSize: '11px', 
                      fontWeight: 'bold',
                      borderRadius: '4px'
                    }}>
                    📊 MONITOR
                  </button>
               </>
            )}
            
            <button 
              onClick={async () => {
                const path = await window.configAPI.getPath()
                window.servicesAPI.serviceAction({ action: 'open_file', path })
              }} 
              style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.warning, padding: '5px 12px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px' }}>
               ⚙ CONFIG
            </button>
         </div>

         <button onClick={() => setIsDark(!isDark)} style={{ marginRight: isSmall ? '5px' : '20px', background: 'transparent', border: `1px solid ${theme.border}`, color: theme.text, padding: '5px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            {isDark ? '☀' : '☾'}
         </button>

         {!isSmall && <div style={{ fontSize: '12px', color: theme.success, letterSpacing: '1px', fontWeight: 'bold' }}>● ACTIVE</div>}
       </header>

       <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
         {(activeTab !== 'monitor' && (isSidebarOpen || !isSmall)) && (
           <div style={{ 
              position: isSmall ? 'absolute' : 'relative',
              left: 0, top: 0, bottom: 0,
              width: isSmall ? '280px' : '350px',
              zIndex: 50,
              background: theme.panelBg,
              boxShadow: isSmall ? '5px 0 15px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.3s'
           }}>
             <LeftSidebar 
                theme={theme}
                activeTab={activeTab}
                setActiveTab={(t) => { setActiveTab(t); if(isSmall) setIsSidebarOpen(false); }}
                tabs={tabs}
                presetData={presetData}
                services={services}
                handleRunPreset={handleRunPreset}
                handleServiceAction={handleServiceAction}
             />
           </div>
         )}

         {isSmall && isSidebarOpen && (
            <div 
              onClick={() => setIsSidebarOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} 
            />
         )}

          <div className="panel" style={{ flex: 1, overflow: 'hidden' }}>

             {activeTab === 'monitor' ? (
                <SystemMonitor theme={theme} />
             ) : (
                <GenericTablePanel 
                   theme={theme}
                   isDark={isDark}
                   activeTab={activeTab}
                   rightData={rightData}
                   fetchLogs={fetchLogs}
                   fetchServiceLogs={fetchServiceLogs}
                   activeLogId={activeLogId}
                   handleRestartPm2={handleRestartPm2}
                   handleStopPm2={handleStopPm2}
                   handleDeletePm2={handleDeletePm2}
                   handleSavePm2={handleSavePm2}
                   handleServiceAction={handleServiceAction}
                   services={services}
                   logHeight={logHeight}
                   setLogHeight={setLogHeight}
                   logData={logData}
                   settings={appConfig.settings}
                   isSmall={isSmall}
                />
             )}
          </div>
       </div>
    </div>
  )
}

export default App
