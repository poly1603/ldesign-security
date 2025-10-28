import express, { Express, Request, Response } from 'express'
import { Server } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { SecurityScanner } from '../core/scanner'
import { ScanHistory } from '../storage/scan-history'
import { Logger } from '../utils/logger'
import { ScanResult, ScanOptions, Severity } from '../types'
import { join } from 'path'
import { readFileSync } from 'fs'

/**
 * Dashboard 配置
 */
export interface DashboardConfig {
  port?: number
  host?: string
  enableWebSocket?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  enableAuth?: boolean
  auth?: {
    username: string
    password: string
  }
}

/**
 * WebSocket 消息类型
 */
interface WSMessage {
  type: 'scan-update' | 'scan-complete' | 'scan-error' | 'stats-update'
  data: any
  timestamp: string
}

/**
 * 交互式 Dashboard
 */
export class InteractiveDashboard {
  private app: Express
  private server?: Server
  private wss?: WebSocketServer
  private scanner: SecurityScanner
  private history: ScanHistory
  private logger: Logger
  private config: DashboardConfig
  private clients: Set<WebSocket> = new Set()

  constructor(
    private projectPath: string,
    config: DashboardConfig = {}
  ) {
    this.logger = new Logger('InteractiveDashboard')
    this.scanner = new SecurityScanner()
    this.history = new ScanHistory()

    this.config = {
      port: 3000,
      host: 'localhost',
      enableWebSocket: true,
      autoRefresh: true,
      refreshInterval: 30000,
      enableAuth: false,
      ...config
    }

    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      next()
    })

    // 简单身份验证
    if (this.config.enableAuth) {
      this.app.use((req, res, next) => {
        const auth = req.headers.authorization
        
        if (!auth) {
          res.status(401).json({ error: 'Authentication required' })
          return
        }

        const [type, credentials] = auth.split(' ')
        if (type !== 'Basic') {
          res.status(401).json({ error: 'Invalid authentication type' })
          return
        }

        const decoded = Buffer.from(credentials, 'base64').toString()
        const [username, password] = decoded.split(':')

        if (
          username !== this.config.auth?.username ||
          password !== this.config.auth?.password
        ) {
          res.status(401).json({ error: 'Invalid credentials' })
          return
        }

        next()
      })
    }

    // 错误处理
    this.app.use((err: any, req: Request, res: Response, next: any) => {
      this.logger.error(`Error handling request: ${err.message}`)
      res.status(500).json({ error: 'Internal server error' })
    })
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 主页面
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML())
    })

    // API: 获取最新扫描结果
    this.app.get('/api/scan/latest', async (req, res) => {
      try {
        const latest = await this.history.getLatest()
        res.json(latest || { message: 'No scan results available' })
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })

    // API: 获取扫描历史
    this.app.get('/api/scan/history', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50
        const history = await this.history.getHistory(limit)
        res.json(history)
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })

    // API: 获取统计信息
    this.app.get('/api/stats', async (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30
        const stats = await this.history.getStatistics(days)
        res.json(stats)
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })

    // API: 触发新扫描
    this.app.post('/api/scan/trigger', async (req, res) => {
      try {
        const options: ScanOptions = {
          projectPath: this.projectPath,
          ...req.body
        }

        // 异步执行扫描
        this.performScan(options)
          .then(() => this.logger.info('Scan completed'))
          .catch(err => this.logger.error(`Scan failed: ${err}`))

        res.json({ message: 'Scan started', status: 'in-progress' })
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })

    // API: 按严重程度过滤漏洞
    this.app.get('/api/vulnerabilities/filter', async (req, res) => {
      try {
        const severity = req.query.severity as Severity
        const latest = await this.history.getLatest()
        
        if (!latest) {
          res.json([])
          return
        }

        const filtered = latest.vulnerabilities.filter(v => v.severity === severity)
        res.json(filtered)
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })

    // API: 搜索漏洞
    this.app.get('/api/vulnerabilities/search', async (req, res) => {
      try {
        const query = (req.query.q as string || '').toLowerCase()
        const latest = await this.history.getLatest()
        
        if (!latest) {
          res.json([])
          return
        }

        const results = latest.vulnerabilities.filter(v =>
          v.title.toLowerCase().includes(query) ||
          v.package.toLowerCase().includes(query) ||
          v.description.toLowerCase().includes(query) ||
          v.cve?.toLowerCase().includes(query)
        )

        res.json(results)
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })

    // API: 获取趋势数据
    this.app.get('/api/trends', async (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30
        const trends = await this.history.getTrends(days)
        res.json(trends)
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })

    // API: 比较两次扫描
    this.app.get('/api/compare', async (req, res) => {
      try {
        const id1 = req.query.id1 as string
        const id2 = req.query.id2 as string

        if (!id1 || !id2) {
          res.status(400).json({ error: 'Both id1 and id2 are required' })
          return
        }

        const scan1 = await this.history.getById(id1)
        const scan2 = await this.history.getById(id2)

        if (!scan1 || !scan2) {
          res.status(404).json({ error: 'One or both scans not found' })
          return
        }

        const comparison = this.compareScanResults(scan1, scan2)
        res.json(comparison)
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })

    // API: 删除扫描记录
    this.app.delete('/api/scan/:id', async (req, res) => {
      try {
        await this.history.delete(req.params.id)
        res.json({ message: 'Scan deleted successfully' })
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })

    // API: 清空历史记录
    this.app.delete('/api/scan/history/clear', async (req, res) => {
      try {
        await this.history.clear()
        res.json({ message: 'History cleared successfully' })
      } catch (error) {
        res.status(500).json({ error: (error as Error).message })
      }
    })
  }

  /**
   * 启动 Dashboard
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          this.logger.info(
            `Dashboard started at http://${this.config.host}:${this.config.port}`
          )

          // 启动 WebSocket 服务器
          if (this.config.enableWebSocket && this.server) {
            this.setupWebSocket()
          }

          resolve()
        })

        this.server.on('error', reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 停止 Dashboard
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 关闭 WebSocket
      if (this.wss) {
        this.wss.close()
      }

      // 关闭 HTTP 服务器
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            reject(err)
          } else {
            this.logger.info('Dashboard stopped')
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * 设置 WebSocket
   */
  private setupWebSocket(): void {
    if (!this.server) return

    this.wss = new WebSocketServer({ server: this.server })

    this.wss.on('connection', (ws: WebSocket) => {
      this.logger.info('WebSocket client connected')
      this.clients.add(ws)

      ws.on('close', () => {
        this.logger.info('WebSocket client disconnected')
        this.clients.delete(ws)
      })

      ws.on('error', (error) => {
        this.logger.error(`WebSocket error: ${error}`)
        this.clients.delete(ws)
      })

      // 发送初始数据
      this.sendWSMessage(ws, {
        type: 'scan-update',
        data: { message: 'Connected to dashboard' },
        timestamp: new Date().toISOString()
      })
    })
  }

  /**
   * 发送 WebSocket 消息
   */
  private sendWSMessage(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * 广播消息到所有客户端
   */
  private broadcast(message: WSMessage): void {
    for (const client of this.clients) {
      this.sendWSMessage(client, message)
    }
  }

  /**
   * 执行扫描
   */
  private async performScan(options: ScanOptions): Promise<ScanResult> {
    this.broadcast({
      type: 'scan-update',
      data: { status: 'started' },
      timestamp: new Date().toISOString()
    })

    try {
      const result = await this.scanner.scan(options)

      // 保存到历史记录
      await this.history.save(result)

      this.broadcast({
        type: 'scan-complete',
        data: result,
        timestamp: new Date().toISOString()
      })

      return result
    } catch (error) {
      this.broadcast({
        type: 'scan-error',
        data: { error: (error as Error).message },
        timestamp: new Date().toISOString()
      })

      throw error
    }
  }

  /**
   * 比较扫描结果
   */
  private compareScanResults(scan1: ScanResult, scan2: ScanResult) {
    const vulns1 = new Set(scan1.vulnerabilities.map(v => `${v.package}:${v.cve || v.title}`))
    const vulns2 = new Set(scan2.vulnerabilities.map(v => `${v.package}:${v.cve || v.title}`))

    const added = scan2.vulnerabilities.filter(v => 
      !vulns1.has(`${v.package}:${v.cve || v.title}`)
    )

    const removed = scan1.vulnerabilities.filter(v => 
      !vulns2.has(`${v.package}:${v.cve || v.title}`)
    )

    const common = scan2.vulnerabilities.filter(v => 
      vulns1.has(`${v.package}:${v.cve || v.title}`)
    )

    return {
      scan1: {
        id: scan1.metadata?.projectDir || 'unknown',
        timestamp: scan1.timestamp,
        totalVulnerabilities: scan1.vulnerabilities.length
      },
      scan2: {
        id: scan2.metadata?.projectDir || 'unknown',
        timestamp: scan2.timestamp,
        totalVulnerabilities: scan2.vulnerabilities.length
      },
      changes: {
        added: added.length,
        removed: removed.length,
        unchanged: common.length
      },
      details: {
        added,
        removed,
        common: common.length
      }
    }
  }

  /**
   * 生成 Dashboard HTML
   */
  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Dashboard - @ldesign/security</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    h1 { font-size: 2rem; margin-bottom: 10px; }
    .subtitle { opacity: 0.9; font-size: 1rem; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #1e293b;
      padding: 25px;
      border-radius: 12px;
      border: 1px solid #334155;
    }
    .stat-value {
      font-size: 2.5rem;
      font-weight: bold;
      margin: 10px 0;
    }
    .stat-label { color: #94a3b8; font-size: 0.9rem; }
    .critical { color: #ef4444; }
    .high { color: #f97316; }
    .medium { color: #eab308; }
    .low { color: #3b82f6; }
    .actions {
      display: flex;
      gap: 15px;
      margin-bottom: 30px;
    }
    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.3s;
    }
    button:hover { background: #5a67d8; transform: translateY(-2px); }
    .filters {
      background: #1e293b;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }
    input, select {
      background: #0f172a;
      border: 1px solid #334155;
      color: #e2e8f0;
      padding: 10px 15px;
      border-radius: 8px;
      font-size: 0.95rem;
    }
    .vulnerabilities {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
    }
    .vuln-item {
      background: #0f172a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
      border-left: 4px solid #667eea;
    }
    .vuln-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 10px;
    }
    .vuln-title { font-size: 1.1rem; font-weight: 600; }
    .vuln-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .loading {
      text-align: center;
      padding: 60px;
      font-size: 1.2rem;
      color: #94a3b8;
    }
    .chart-container {
      background: #1e293b;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 30px;
    }
    canvas { max-height: 400px; }
    .status-indicator {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .status-connected { background: #22c55e; }
    .status-disconnected { background: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🛡️ Security Dashboard</h1>
      <div class="subtitle">
        <span class="status-indicator status-connected"></span>
        Real-time security monitoring powered by @ldesign/security
      </div>
    </header>

    <div class="actions">
      <button onclick="triggerScan()">🔍 Run Scan</button>
      <button onclick="refreshData()">🔄 Refresh</button>
      <button onclick="exportReport()">📥 Export Report</button>
    </div>

    <div class="stats" id="stats">
      <div class="stat-card">
        <div class="stat-label">Total Vulnerabilities</div>
        <div class="stat-value" id="total-vulns">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Critical</div>
        <div class="stat-value critical" id="critical-vulns">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">High</div>
        <div class="stat-value high" id="high-vulns">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Medium</div>
        <div class="stat-value medium" id="medium-vulns">-</div>
      </div>
    </div>

    <div class="filters">
      <input type="text" id="search" placeholder="🔍 Search vulnerabilities..." onkeyup="searchVulnerabilities()">
      <select id="severity-filter" onchange="filterBySeverity()">
        <option value="">All Severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>

    <div class="vulnerabilities">
      <h2 style="margin-bottom: 20px;">Vulnerabilities</h2>
      <div id="vuln-list" class="loading">Loading...</div>
    </div>
  </div>

  <script>
    let ws;
    const API_BASE = '';

    // WebSocket 连接
    function connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(\`\${protocol}//\${window.location.host}\`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        document.querySelector('.status-indicator').className = 'status-indicator status-connected';
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWSMessage(message);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        document.querySelector('.status-indicator').className = 'status-indicator status-disconnected';
        setTimeout(connectWebSocket, 5000);
      };
    }

    function handleWSMessage(message) {
      if (message.type === 'scan-complete') {
        refreshData();
      }
    }

    async function refreshData() {
      try {
        const response = await fetch(\`\${API_BASE}/api/scan/latest\`);
        const data = await response.json();
        updateDashboard(data);
      } catch (error) {
        console.error('Failed to refresh data:', error);
      }
    }

    function updateDashboard(data) {
      if (!data.vulnerabilities) return;

      document.getElementById('total-vulns').textContent = data.vulnerabilities.length;
      document.getElementById('critical-vulns').textContent = 
        data.vulnerabilities.filter(v => v.severity === 'critical').length;
      document.getElementById('high-vulns').textContent = 
        data.vulnerabilities.filter(v => v.severity === 'high').length;
      document.getElementById('medium-vulns').textContent = 
        data.vulnerabilities.filter(v => v.severity === 'medium').length;

      renderVulnerabilities(data.vulnerabilities);
    }

    function renderVulnerabilities(vulnerabilities) {
      const list = document.getElementById('vuln-list');
      if (!vulnerabilities || vulnerabilities.length === 0) {
        list.innerHTML = '<div class="loading">No vulnerabilities found 🎉</div>';
        return;
      }

      list.innerHTML = vulnerabilities.map(v => \`
        <div class="vuln-item">
          <div class="vuln-header">
            <div class="vuln-title">\${v.title}</div>
            <span class="vuln-badge \${v.severity}">\${v.severity.toUpperCase()}</span>
          </div>
          <div><strong>Package:</strong> \${v.package}</div>
          \${v.cve ? \`<div><strong>CVE:</strong> \${v.cve}</div>\` : ''}
          <div style="margin-top: 10px; color: #94a3b8;">\${v.description}</div>
          <div style="margin-top: 10px;"><strong>Recommendation:</strong> \${v.recommendation}</div>
        </div>
      \`).join('');
    }

    async function triggerScan() {
      try {
        await fetch(\`\${API_BASE}/api/scan/trigger\`, { method: 'POST' });
        alert('Scan started!');
      } catch (error) {
        alert('Failed to trigger scan');
      }
    }

    async function searchVulnerabilities() {
      const query = document.getElementById('search').value;
      if (query.length < 2) {
        refreshData();
        return;
      }

      try {
        const response = await fetch(\`\${API_BASE}/api/vulnerabilities/search?q=\${encodeURIComponent(query)}\`);
        const results = await response.json();
        renderVulnerabilities(results);
      } catch (error) {
        console.error('Search failed:', error);
      }
    }

    async function filterBySeverity() {
      const severity = document.getElementById('severity-filter').value;
      if (!severity) {
        refreshData();
        return;
      }

      try {
        const response = await fetch(\`\${API_BASE}/api/vulnerabilities/filter?severity=\${severity}\`);
        const results = await response.json();
        renderVulnerabilities(results);
      } catch (error) {
        console.error('Filter failed:', error);
      }
    }

    function exportReport() {
      window.location.href = \`\${API_BASE}/api/scan/latest\`;
    }

    // 初始化
    connectWebSocket();
    refreshData();
    setInterval(refreshData, ${this.config.refreshInterval});
  </script>
</body>
</html>
    `
  }
}

export { DashboardConfig }
