import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pm2API', {
  getList: () => ipcRenderer.invoke('pm2:list'),
  startProject: (data) => ipcRenderer.invoke('pm2:start', data),
  stopProject: (id) => ipcRenderer.invoke('pm2:stop', id),
  restartProject: (id) => ipcRenderer.invoke('pm2:restart', id),
  deleteProject: (id) => ipcRenderer.invoke('pm2:delete', id),
  savePm2: () => ipcRenderer.invoke('pm2:save'),
  getLogs: (id) => ipcRenderer.invoke('pm2:logs', id),
  runCommand: (data) => ipcRenderer.invoke('pm2:run-command', data)
})

contextBridge.exposeInMainWorld('servicesAPI', {
  getStatus: () => ipcRenderer.invoke('services:status'),
  serviceAction: (data) => ipcRenderer.invoke('services:action', data),
  getLogs: (path) => ipcRenderer.invoke('services:logs', path)
})

contextBridge.exposeInMainWorld('configAPI', {
  load: () => ipcRenderer.invoke('config:load'),
  save: (config) => ipcRenderer.invoke('config:save', config),
  getPath: () => ipcRenderer.invoke('config:get-path')
})

contextBridge.exposeInMainWorld('systemAPI', {
  getStaticStatus: () => ipcRenderer.invoke('system:static'),
  getStatus: () => ipcRenderer.invoke('system:status')
})
