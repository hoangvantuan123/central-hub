import React from 'react';

export default function LeftSidebar({
  theme,
  activeTab,
  setActiveTab,
  tabs,
  presetData,
  services,
  handleRunPreset,
  handleServiceAction
}) {
  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <div style={{ width: '350px', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${theme.border}` }}>
      {/* TABS HEADER */}
      <div style={{ display: 'flex', background: theme.panelHeader, borderBottom: `1px solid ${theme.border}` }}>
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              flex: 1, 
              padding: '12px 0', 
              background: activeTab === tab.id ? theme.panelBg : 'transparent', 
              color: activeTab === tab.id ? (tab.color.startsWith('#') ? tab.color : theme[tab.color] || theme.primary) : theme.textMuted, 
              border: 'none', 
              borderBottom: activeTab === tab.id ? `2px solid ${tab.color.startsWith('#') ? tab.color : theme[tab.color] || theme.primary}` : '2px solid transparent', 
              cursor: 'pointer', 
              fontSize: '11px', 
              fontWeight: 'bold', 
              transition: 'all 0.2s' 
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', background: theme.panelBg }}>
        {activeTabData && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h2 className="header-title" style={{ borderBottom: 'none' }}>
              <span style={{ color: activeTabData.color.startsWith('#') ? activeTabData.color : theme[activeTabData.color] || theme.primary, marginRight: '10px' }}>
                {activeTabData.icon}
              </span> 
              {activeTabData.title}
            </h2>
            
            {activeTabData.statusLabel && (
               <div style={{ padding: '15px 20px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.border}`, background: theme.panelHeader }}>
                  <span style={{ color: theme.textMuted }}>{activeTabData.statusLabel}:</span>
                  <span style={{ color: services[activeTabData.serviceKey] ? theme.success : theme.danger, fontWeight: 'bold' }}>
                    {services[activeTabData.serviceKey] ? 'ONLINE' : 'OFFLINE'}
                  </span>
               </div>
            )}

            <div style={{ borderTop: `1px solid ${theme.border}`, flex: 1 }}>
               {(presetData[activeTabData.dataKey] || []).map((preset) => (
                  <div key={preset.id} className="table-row" style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: theme.text }}>{preset.name}</span>
                        <div style={{ display: 'flex', gap: '5px' }}>
                           {activeTabData.viewType === 'pm2' ? (
                              <button className="btn btn-primary" onClick={() => handleRunPreset(preset)} style={{ padding: '4px 8px', fontSize: '10px' }}>▶ PLAY</button>
                           ) : (
                              <>
                                 <button className="btn btn-primary" onClick={() => handleServiceAction({ action: 'start', path: preset.path, command: preset.command, processName: preset.processName })} style={{ padding: '4px 8px', fontSize: '10px' }}>▶ RUN</button>
                                 <button className="btn btn-stop" onClick={() => handleServiceAction({ action: 'stop', processName: preset.processName })} style={{ padding: '4px 8px', fontSize: '10px' }}>■ KILL</button>
                              </>
                           )}
                        </div>
                     </div>
                     <div style={{ fontSize: '10px', color: theme.textMuted, marginTop: '4px', wordBreak: 'break-all' }}>{preset.path}</div>
                     <div style={{ fontSize: '10px', color: theme.warning, marginTop: '2px' }}>{preset.command}</div>
                  </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
