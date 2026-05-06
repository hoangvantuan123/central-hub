import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { exec } from 'child_process'
import pm2 from 'pm2'
import fs from 'fs'
import si from 'systeminformation'

// 1. Tối ưu đồ họa: Tắt tăng tốc phần cứng để chạy được trên máy cũ/máy ảo
app.disableHardwareAcceleration()

// 2. Cơ chế Single Instance: Chỉ cho phép mở 1 app duy nhất
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// Logging setup
const LOG_DIR = app.isPackaged 
  ? (process.env.PORTABLE_EXECUTABLE_DIR || dirname(app.getPath('exe')))
  : app.getAppPath()
const LOG_PATH = join(LOG_DIR, 'error.log')

function logToFile(msg) {
  try {
    const timestamp = new Date().toISOString()
    const logMsg = `[${timestamp}] ${msg}\n`
    fs.appendFileSync(LOG_PATH, logMsg)
  } catch (err) {
    console.error('Failed to write to log file:', err)
  }
}

process.on('uncaughtException', (err) => {
  logToFile(`UNCAUGHT EXCEPTION: ${err.stack || err}`)
  app.quit()
})

process.on('unhandledRejection', (reason) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`)
})
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'CENTRAL HUB',
    icon: join(__dirname, '../../resources/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Đăng ký phím F12 để mở DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  logToFile(`================================================`)
  logToFile(`Ứng dụng đang khởi động...`)
  logToFile(`Phiên bản Windows: ${process.platform} ${process.arch}`)
  logToFile(`Đường dẫn EXE: ${app.getPath('exe')}`)
  logToFile(`Thư mục Log: ${LOG_DIR}`)
  logToFile(`Đường dẫn Config: ${CONFIG_PATH}`)
  
  createWindow()
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Kết nối PM2 với cơ chế thử lại hoặc bỏ qua nếu lỗi
  pm2.connect((err) => {
    if (err) {
      logToFile(`PM2 CONNECT ERROR: ${err.message || err}. App vẫn tiếp tục chạy nhưng các tính năng PM2 sẽ bị hạn chế.`)
    } else {
      logToFile('PM2 đã kết nối thành công.')
    }
  })
})

// Xử lý khi có người cố tình mở thêm 1 instance nữa
app.on('second-instance', () => {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length) {
    if (windows[0].isMinimized()) windows[0].restore()
    windows[0].focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/* =========================================
   PM2 IPC HANDLERS
========================================= */
ipcMain.handle('pm2:list', () => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      logToFile('PM2 List Timeout: PM2 daemon might be unresponsive.')
      resolve([])
    }, 2000)

    pm2.list((err, list) => {
      clearTimeout(timeout)
      if (err) {
        logToFile(`PM2 List Error: ${err.message || err}`)
        resolve([])
      } else {
        resolve(list || [])
      }
    })
  })
})

ipcMain.handle('pm2:start', (event, { path, name }) => {
  return new Promise((resolve, reject) => {
    pm2.start({
      name: name,
      script: 'npm',
      args: 'run dev',
      cwd: path
    }, (err, apps) => {
      if (err) reject(err)
      else resolve(apps)
    })
  })
})

ipcMain.handle('pm2:stop', (event, id) => {
  return new Promise((resolve, reject) => {
    pm2.stop(id, (err, proc) => {
      if (err) reject(err)
      else resolve(proc)
    })
  })
})

ipcMain.handle('pm2:restart', (event, id) => {
  return new Promise((resolve, reject) => {
    pm2.restart(id, (err, proc) => {
      if (err) reject(err)
      else resolve(proc)
    })
  })
})

ipcMain.handle('pm2:delete', (event, id) => {
  return new Promise((resolve, reject) => {
    pm2.delete(id, (err, proc) => {
      if (err) reject(err)
      else resolve(proc)
    })
  })
})

ipcMain.handle('pm2:save', () => {
  return new Promise((resolve, reject) => {
    pm2.dump((err, stdout) => {
      if (err) {
        logToFile(`PM2 SAVE ERROR: ${err.message || err}`)
        reject(err)
      } else {
        logToFile('PM2 configuration saved successfully')
        resolve(stdout)
      }
    })
  })
})


// Chạy lệnh bash/cmd tùy chỉnh (Ví dụ: pm2 start ecosystem...)
ipcMain.handle('pm2:run-command', (event, { path, command }) => {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: path, windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
})

// Đọc 5000 ký tự cuối cùng của File Logs
function readLastBytes(filePath, bytes) {
  if (!fs.existsSync(filePath)) return `[FILE NOT FOUND] Không tìm thấy file log: ${filePath}`;
  try {
    const stat = fs.statSync(filePath);
    const start = Math.max(0, stat.size - bytes);
    const length = Math.min(bytes, stat.size);
    if (length === 0) return '[EMPTY LOG] File trống.';
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, length, start);
    fs.closeSync(fd);
    return buffer.toString('utf-8');
  } catch (e) {
    return '[ERROR] Lỗi khi đọc file: ' + e.message;
  }
}

// Đọc log của một PID
ipcMain.handle('pm2:logs', (event, id) => {
  return new Promise((resolve) => {
    pm2.describe(id, (err, desc) => {
      if (err || desc.length === 0) return resolve('Không tìm thấy Process ID này.');
      const outPath = desc[0].pm2_env.pm_out_log_path;
      const errPath = desc[0].pm2_env.pm_err_log_path;
      
      const outLogs = readLastBytes(outPath, 5000);
      const errLogs = readLastBytes(errPath, 5000);
      
      resolve(`=============== BẢN GHI LỖI (ERROR LOGS) ===============\n${errLogs}\n\n=============== BẢN GHI CHẠY (OUTPUT LOGS) ===============\n${outLogs}`);
    })
  })
})

/* =========================================
   NGINX & REDIS IPC HANDLERS
========================================= */
const checkProcess = (processName) => {
  return new Promise((resolve) => {
    exec(`tasklist /FI "IMAGENAME eq ${processName}"`, (err, stdout) => {
      if (err) return resolve(false)
      resolve(stdout.toLowerCase().includes(processName.toLowerCase()))
    })
  })
}

const killProcess = (processName) => {
  return new Promise((resolve, reject) => {
    exec(`taskkill /F /IM ${processName}`, (err) => {
      if (err) reject(err)
      else resolve(true)
    })
  })
}

const checkWindowsService = (serviceName) => {
  return new Promise((resolve) => {
    exec(`sc query "${serviceName}"`, (err, stdout) => {
      if (err || stdout.includes('1060')) return resolve('NOT_INSTALLED')
      if (stdout.includes('RUNNING')) return resolve('RUNNING')
      if (stdout.includes('STOPPED')) return resolve('STOPPED')
      if (stdout.includes('START_PENDING')) return resolve('START_PENDING')
      if (stdout.includes('STOP_PENDING')) return resolve('STOP_PENDING')
      resolve('STOPPED')
    })
  })
}

ipcMain.handle('services:status', async () => {
  const safeCheck = async (fn, defaultVal) => {
    return Promise.race([
      fn(),
      new Promise(res => setTimeout(() => res(defaultVal), 1500))
    ]).catch(() => defaultVal)
  }

  const nginx = await safeCheck(() => checkProcess('nginx.exe'), false)
  const redis = await safeCheck(() => checkProcess('redis-server.exe'), false)
  const cloudflare = await safeCheck(() => checkProcess('cloudflared.exe'), false)

  // Check specific Redis services
  const redisNodes = {
    redis_auth: await safeCheck(() => checkWindowsService('redis_auth'), 'NOT_INSTALLED'),
    redis_production: await safeCheck(() => checkWindowsService('redis_production'), 'NOT_INSTALLED'),
    redis_basic: await safeCheck(() => checkWindowsService('redis_basic'), 'NOT_INSTALLED')
  }

  const cfServiceRaw = await safeCheck(async () => {
    return new Promise((resolve) => {
      exec('sc query Cloudflared', (err, stdout) => {
        resolve(stdout || '')
      })
    })
  }, '')
  
  let cfStatus = 'STOPPED';
  if (cfServiceRaw.includes('RUNNING')) cfStatus = 'RUNNING';
  else if (cfServiceRaw.includes('STOP_PENDING')) cfStatus = 'STOP_PENDING';
  else if (cfServiceRaw.includes('START_PENDING')) cfStatus = 'START_PENDING';
  else if (cfServiceRaw.includes('PAUSED')) cfStatus = 'PAUSED';

  const cfServiceRunning = cfStatus === 'RUNNING';
  const cfServiceInstalled = !cfServiceRaw.includes('1060');

  return { 
    nginx, 
    redis, 
    cloudflare, 
    cfServiceRunning, 
    cfServiceInstalled, 
    cfStatus,
    redisNodes
  }
})

ipcMain.handle('services:action', (event, { action, path, command, processName }) => {
  return new Promise((resolve, reject) => {
    if (action === 'stop') {
      if (!processName) return reject(new Error('Cần processName để dừng'))
      killProcess(processName).then(resolve).catch(reject)
    } else if (action === 'cf_install') {
      const psCmd = `powershell -Command "Start-Process .\\cloudflared.exe -ArgumentList 'service install' -WorkingDirectory \\"${path}\\" -Verb RunAs -WindowStyle Hidden"`
      exec(psCmd, { windowsHide: true }, (err, stdout) => err ? reject(err) : resolve(stdout || 'Đã gửi lệnh cài đặt Service.'))
    } else if (action === 'cf_uninstall') {
      const psCmd = `powershell -Command "Start-Process .\\cloudflared.exe -ArgumentList 'service uninstall' -WorkingDirectory \\"${path}\\" -Verb RunAs -WindowStyle Hidden"`
      exec(psCmd, { windowsHide: true }, (err, stdout) => err ? reject(err) : resolve(stdout || 'Đã gửi lệnh gỡ cài đặt Service.'))
    } else if (action === 'cf_force_kill') {
      // Sử dụng PowerShell RunAs để tránh lỗi "Access is denied" khi kill service process
      const args = command ? `/F /PID ${command}` : '/F /IM cloudflared.exe'
      const psCmd = `powershell -Command "Start-Process taskkill -ArgumentList '${args}' -Verb RunAs -WindowStyle Hidden"`
      exec(psCmd, { windowsHide: true }, (err, stdout, stderr) => {
        resolve('Đã gửi lệnh Force Kill với quyền Admin. Vui lòng xác nhận UAC nếu có.')
      })
    } else if (action === 'cf_recovery') {
      // Chuỗi lệnh "Cứu hộ": Kill (Admin) -> Uninstall (Admin) -> Install (Admin)
      const killPsCmd = `powershell -Command "Start-Process taskkill -ArgumentList '/F /IM cloudflared.exe' -Verb RunAs -WindowStyle Hidden"`
      const uninstallCmd = `powershell -Command "Start-Process .\\cloudflared.exe -ArgumentList 'service uninstall' -WorkingDirectory \\"${path}\\" -Verb RunAs -WindowStyle Hidden"`
      const installCmd = `powershell -Command "Start-Process .\\cloudflared.exe -ArgumentList 'service install' -WorkingDirectory \\"${path}\\" -Verb RunAs -WindowStyle Hidden"`
      
      exec(killPsCmd, { windowsHide: true }, () => {
        setTimeout(() => {
          exec(uninstallCmd, { windowsHide: true }, () => {
            setTimeout(() => {
              exec(installCmd, { windowsHide: true }, (err, stdout) => {
                if (err) reject(err)
                else resolve('Hệ thống đang thực hiện chuỗi Khôi phục (Kill -> Uninstall -> Install). Vui lòng xác nhận các hộp thoại Admin hiện lên.')
              })
            }, 2000)
          })
        }, 1000)
      })
    } else if (action === 'cf_start') {
      const psCmd = `powershell -Command "Start-Process sc -ArgumentList 'start Cloudflared' -Verb RunAs -WindowStyle Hidden"`
      exec(psCmd, { windowsHide: true }, (err, stdout) => err ? reject(err) : resolve(stdout || 'Đã gửi lệnh khởi động Service.'))
    } else if (action === 'cf_stop') {
      const psCmd = `powershell -Command "Start-Process sc -ArgumentList 'stop Cloudflared' -Verb RunAs -WindowStyle Hidden"`
      exec(psCmd, { windowsHide: true }, () => {
        killProcess('cloudflared.exe').then(resolve).catch(() => resolve('Đã gửi lệnh Stop và Kill process.'))
      })
    } else if (action === 'cf_query') {
      exec('sc queryex Cloudflared', { windowsHide: true }, (err, stdout) => {
        resolve(stdout || 'Không thể lấy thông tin Service.')
      })
    } else if (action === 'open_file') {
      const { shell } = require('electron')
      shell.openPath(path).then(errMsg => {
        if (errMsg) reject(new Error(errMsg))
        else resolve(true)
      })
    } else if (action === 'redis_install') {
      const { serviceName, confPath } = command
      const binPath = `"C:\\Program Files\\Redis\\redis-server.exe" --service-run "${confPath}"`
      const psCmd = `powershell -Command "Start-Process sc.exe -ArgumentList 'create ${serviceName} binPath= \\\"${binPath}\\\" start= auto' -Verb RunAs -WindowStyle Hidden"`
      exec(psCmd, { windowsHide: true }, (err, stdout) => err ? reject(err) : resolve(stdout || `Đã gửi lệnh cài đặt ${serviceName}.`))
    } else if (action === 'redis_uninstall') {
      const { serviceName } = command
      const psCmd = `powershell -Command "Start-Process sc.exe -ArgumentList 'delete ${serviceName}' -Verb RunAs -WindowStyle Hidden"`
      exec(psCmd, { windowsHide: true }, (err, stdout) => err ? reject(err) : resolve(stdout || `Đã gửi lệnh xóa ${serviceName}.`))
    } else if (action === 'redis_start') {
      const { serviceName } = command
      const psCmd = `powershell -Command "Start-Process sc.exe -ArgumentList 'start ${serviceName}' -Verb RunAs -WindowStyle Hidden"`
      exec(psCmd, { windowsHide: true }, (err, stdout) => err ? reject(err) : resolve(stdout || `Đã gửi lệnh khởi động ${serviceName}.`))
    } else if (action === 'redis_stop') {
      const { serviceName } = command
      const psCmd = `powershell -Command "Start-Process sc.exe -ArgumentList 'stop ${serviceName}' -Verb RunAs -WindowStyle Hidden"`
      exec(psCmd, { windowsHide: true }, (err, stdout) => err ? reject(err) : resolve(stdout || `Đã gửi lệnh dừng ${serviceName}.`))
    } else if (action === 'start') {
      if (!path || !command) return reject(new Error('Cần thông tin lệnh và đường dẫn'))
      // Để lệnh chạy độc lập và hiện cửa sổ CMD cho người dùng theo dõi
      const finalCmd = command.startsWith('cloudflared') ? command.replace('cloudflared', '.\\cloudflared.exe') : command
      const psCmd = `powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \\"${path}\\" && ${finalCmd}' -WindowStyle Normal"`
      
      exec(psCmd, { windowsHide: true }, (err) => {
        if (err) reject(err)
        else resolve(true)
      })
    }
  })
})

ipcMain.handle('services:logs', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return readLastBytes(filePath, 15000)
    }
    return `File log không tồn tại:\n${filePath}`
  } catch (err) {
    return `Lỗi đọc log:\n${err.message}`
  }
})


/* =========================================
   NEW: OPTIMIZED SYSTEM MONITORING
========================================= */

// Static Info: Fetch once at startup
let staticSystemData = null;
ipcMain.handle('system:static', async () => {
  if (staticSystemData) return staticSystemData;
  try {
    const safeSi = async (fn, defaultVal) => {
      try { return await fn(); }
      catch (e) { 
        logToFile(`SI ERROR (${fn.name || 'anonymous'}): ${e.message}`);
        return defaultVal; 
      }
    };

    const [cpu, os, graphics, memLayout, baseboard, mem] = await Promise.all([
      safeSi(() => si.cpu(), {}),
      safeSi(() => si.osInfo(), {}),
      safeSi(() => si.graphics(), { controllers: [] }),
      safeSi(() => si.memLayout(), []),
      safeSi(() => si.baseboard(), {}),
      safeSi(() => si.mem(), { total: 0 })
    ]);
    staticSystemData = {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        cache: cpu.cache
      },
      os: {
        platform: os.platform,
        distro: os.distro,
        release: os.release,
        arch: os.arch,
        hostname: os.hostname
      },
      graphics: (graphics?.controllers || []).map(g => ({ model: g.model, vram: g.vram, bus: g.bus })),
      memory: {
        total: mem.total,
        layout: (memLayout || []).map(m => ({ type: m.type, clockSpeed: m.clockSpeed, size: m.size }))
      },
      baseboard: { 
        manufacturer: baseboard.manufacturer,
        model: baseboard.model 
      },
      versions: { node: process.version, pm2: pm2.version }
    };
    return staticSystemData;
  } catch (err) {
    logToFile(`Static Info Global Error: ${err.message}`);
    console.error('Static Info Error:', err);
    return null;
  }
})

// Dynamic Status: Fetch every interval
ipcMain.handle('system:status', async () => {
  try {
    const safeSi = async (fn, defaultVal) => {
      try { return await fn(); }
      catch (e) { 
        // Only log serious errors, or use a flag to avoid flooding logs
        return defaultVal; 
      }
    };

    const [currentLoad, mem, fsSize, networkStats, fsStats, ping, processes, networkInterfaces] = await Promise.all([
      safeSi(() => si.currentLoad(), { currentLoad: 0, cpus: [] }),
      safeSi(() => si.mem(), { total: 0, used: 0 }),
      safeSi(() => si.fsSize(), []),
      safeSi(() => si.networkStats(), []),
      safeSi(() => si.fsStats(), { rx_sec: 0, wx_sec: 0 }),
      // Giới hạn thời gian ping tối đa 1.5s
      Promise.race([
        si.inetLatency('8.8.8.8'),
        new Promise(res => setTimeout(() => res(0), 1500))
      ]).catch(() => 0),
      safeSi(() => si.processes(), { list: [] }),
      safeSi(() => si.networkInterfaces(), [])
    ]);

    const pm2Stats = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ count: 0, mem: 0, restarts: 0, topApps: [] }), 1500);
      pm2.list((err, list) => {
        clearTimeout(timeout);
        if (err || !list) return resolve({ count: 0, mem: 0, restarts: 0, topApps: [] });
        const totalMem = list.reduce((acc, p) => acc + (p.monit ? p.monit.memory : 0), 0);
        const totalRestarts = list.reduce((acc, p) => acc + (p.pm2_env ? p.pm2_env.restart_time : 0), 0);
        const topApps = list
          .sort((a, b) => (b.monit?.cpu || 0) - (a.monit?.cpu || 0))
          .slice(0, 15)
          .map(a => ({ name: a.name, cpu: a.monit?.cpu || 0, mem: a.monit?.memory || 0 }));
        resolve({ count: list.length, mem: totalMem, restarts: totalRestarts, topApps });
      });
    });

    return {
      cpu: {
        load: currentLoad.currentLoad,
        temp: await si.cpuTemperature().catch(() => ({ main: 0 })),
        cpus: currentLoad.cpus.map(c => c.load)
      },
      memory: {
        total: mem.total,
        used: mem.used
      },
      disks: (fsSize || []).map(fs => ({ mount: fs.mount, size: fs.size, used: fs.used, available: fs.available, type: fs.type })),
      diskIO: { rx: fsStats?.rx_sec || 0, wx: fsStats?.wx_sec || 0 },
      network: (networkStats || []).map(net => {
        const fullIface = (networkInterfaces || []).find(ni => ni.iface === net.iface);
        return {
          iface: net.iface,
          operstate: net.operstate,
          rx_sec: net.rx_sec || 0,
          tx_sec: net.tx_sec || 0,
          ip4: fullIface?.ip4 || 'N/A',
          mac: fullIface?.mac || 'N/A',
          type: fullIface?.type || 'N/A'
        };
      }),
      latency: ping,
      topProcesses: (processes?.list || []).sort((a,b) => b.cpu - a.cpu).slice(0, 5).map(p => ({
        name: p.name, cpu: p.cpu, mem: p.mem, user: p.user
      })),
      pm2: pm2Stats,
      uptime: si.time().uptime
    };
  } catch (err) {
    logToFile(`Dynamic Status Global Error: ${err.message}`);
    console.error('Dynamic Status Error:', err);
    return null;
  }
})



/* =========================================
   DYNAMIC CONFIG IPC HANDLERS
========================================= */
const CONFIG_DIR = app.isPackaged 
  ? join(process.env.PORTABLE_EXECUTABLE_DIR || dirname(app.getPath('exe')), 'config') 
  : join(app.getAppPath(), 'config')
const CONFIG_FILENAME = 'app_config.json'
const CONFIG_PATH = join(CONFIG_DIR, CONFIG_FILENAME)

const DEFAULT_CONFIG = {
  tabs: [
    {
      id: "projects",
      label: "DỰ ÁN",
      icon: "▶",
      color: "#0ea5e9",
      title: "PROJECT CLUSTERS",
      statusLabel: null,
      serviceKey: null,
      dataKey: "presetProjects",
      viewType: "pm2",
      viewTitle: "PM2_CLUSTER_VIEW"
    },
    {
      id: "nginx",
      label: "NGINX",
      icon: "▶",
      color: "#eab308",
      title: "NGINX NODE",
      statusLabel: "NET_STATUS",
      serviceKey: "nginx",
      dataKey: "presetNginx",
      viewType: "service",
      viewTitle: "NGINX_CLUSTER_VIEW"
    },
    {
      id: "redis",
      label: "REDIS",
      icon: "▶",
      color: "#ef4444",
      title: "REDIS NODE",
      statusLabel: "MEM_STATUS",
      serviceKey: "redis",
      dataKey: "presetRedis",
      viewType: "service",
      viewTitle: "REDIS_CLUSTER_VIEW"
    },
    {
      id: "cloudflare",
      label: "CLOUD",
      icon: "▶",
      color: "#f58220",
      title: "CLOUDFLARE TUNNEL",
      statusLabel: "TUNNEL_STATUS",
      serviceKey: "cloudflare",
      dataKey: "presetCloudflare",
      viewType: "service",
      viewTitle: "TUNNEL_CLUSTER_VIEW"
    },
    {
      id: "monitor",
      label: "MONITOR",
      icon: "📊",
      color: "#10b981",
      title: "HỆ THỐNG",
      statusLabel: "SYS_LOAD",
      serviceKey: null,
      dataKey: null,
      viewType: "monitor",
      viewTitle: "SYSTEM_PERFORMANCE"
    }
  ],

  services: {
    presetProjects: [
      {
        id: "TICO_1",
        name: "TICO 1",
        path: "C:\\Users\\tuanhoang\\Desktop\\platx_tienhung\\microservice\\pm2",
        command: "pm2 start prod_ecosystem.config.js"
      }
    ],
    presetNginx: [],
    presetRedis: [],
    presetCloudflare: []
  },
  settings: {
    cloudflarePath: "C:\\Users\\tuanhoang\\Desktop\\cloudflared",
    cloudflareLog: "C:\\Users\\tuanhoang\\cloudflared.log"
  }
}

ipcMain.handle('config:load', async () => {
  try {
    logToFile(`Loading config from: ${CONFIG_PATH}`)
    if (!fs.existsSync(CONFIG_DIR)) {
      logToFile(`Creating config directory: ${CONFIG_DIR}`)
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }

    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8')
      logToFile('Config file found and read.')
      return JSON.parse(data)
    } else {
      logToFile('Config file not found, creating default.')
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8')
      return DEFAULT_CONFIG
    }
  } catch (err) {
    logToFile(`CONFIG LOAD ERROR: ${err.message}`)
    console.error('Lỗi load config:', err)
    return DEFAULT_CONFIG
  }
})

ipcMain.handle('config:save', async (event, newConfig) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('config:get-path', () => CONFIG_PATH)
