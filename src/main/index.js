import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { exec } from 'child_process'
import pm2 from 'pm2'
import fs from 'fs'
import si from 'systeminformation'


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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  pm2.connect((err) => {
    if (err) {
      console.error(err)
      process.exit(2)
    }
  })
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
  return new Promise((resolve, reject) => {
    pm2.list((err, list) => {
      if (err) reject(err)
      else resolve(list)
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
    exec('pm2 save', { windowsHide: true }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
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
  const nginx = await checkProcess('nginx.exe')
  const redis = await checkProcess('redis-server.exe')
  const cloudflare = await checkProcess('cloudflared.exe')

  // Check specific Redis services
  const redisNodes = {
    redis_auth: await checkWindowsService('redis_auth'),
    redis_production: await checkWindowsService('redis_production'),
    redis_basic: await checkWindowsService('redis_basic')
  }

  const cfServiceRaw = await new Promise((resolve) => {
    exec('sc query Cloudflared', (err, stdout) => {
      resolve(stdout || '')
    })
  })
  
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
    const [cpu, os, graphics, memLayout, baseboard, mem] = await Promise.all([
      si.cpu(),
      si.osInfo(),
      si.graphics(),
      si.memLayout(),
      si.baseboard(),
      si.mem()
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
    console.error('Static Info Error:', err);
    return null;
  }
});

// Dynamic Status: Fetch every interval
ipcMain.handle('system:status', async () => {
  try {
    const [currentLoad, mem, fsSize, networkStats, fsStats, ping, processes, networkInterfaces] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.fsStats(),
      si.inetLatency('8.8.8.8'),
      si.processes(),
      si.networkInterfaces()
    ]);

    const pm2Stats = await new Promise((resolve) => {
      pm2.list((err, list) => {
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
    console.error('Dynamic Status Error:', err);
    return null;
  }
});



/* =========================================
   DYNAMIC CONFIG IPC HANDLERS
========================================= */
const CONFIG_DIR = app.isPackaged 
  ? join(dirname(app.getPath('exe')), 'config') 
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
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }

    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8')
      return JSON.parse(data)
    } else {
      // Nếu chưa có file config, tạo file mặc định
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8')
      return DEFAULT_CONFIG
    }
  } catch (err) {
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
