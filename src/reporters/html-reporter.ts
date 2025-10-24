import fs from 'fs-extra'
import { BaseReporter } from './base-reporter'
import type { SecurityScanResult } from '../types'

/**
 * HTML 报告生成器
 */
export class HTMLReporter extends BaseReporter {
  constructor(result: SecurityScanResult) {
    super(result)
  }

  /**
   * 生成 HTML 报告
   */
  async generate(): Promise<string> {
    const riskScore = this.calculateRiskScore()
    const riskColor = this.getRiskColor(this.result.riskLevel)

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Scan Report - ${this.result.metadata?.projectDir || 'Project'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f7fa;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 { font-size: 2.5em; margin-bottom: 10px; }
    .header p { font-size: 1.1em; opacity: 0.9; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-left: 4px solid #667eea;
    }
    .stat-card h3 { color: #666; font-size: 0.9em; margin-bottom: 10px; text-transform: uppercase; }
    .stat-card .value { font-size: 2.5em; font-weight: bold; color: #333; }
    .stat-card .label { color: #999; font-size: 0.9em; margin-top: 5px; }
    .risk-indicator {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 0.9em;
      background: ${riskColor};
      color: white;
      margin-top: 10px;
    }
    .section {
      background: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      font-size: 1.8em;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 3px solid #667eea;
    }
    .severity-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: bold;
      text-transform: uppercase;
    }
    .severity-critical { background: #dc3545; color: white; }
    .severity-high { background: #fd7e14; color: white; }
    .severity-medium { background: #ffc107; color: #333; }
    .severity-low { background: #17a2b8; color: white; }
    .issue-list { list-style: none; }
    .issue-item {
      padding: 20px;
      margin-bottom: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .issue-item h4 { margin-bottom: 10px; color: #333; }
    .issue-item p { margin: 8px 0; color: #666; }
    .issue-item code {
      background: #e9ecef;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
      font-family: 'Courier New', monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #495057;
    }
    tr:hover { background: #f8f9fa; }
    .chart-container {
      margin: 30px 0;
      text-align: center;
    }
    .chart {
      display: inline-block;
      width: 300px;
      height: 300px;
      position: relative;
    }
    .chart-legend {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      padding: 30px;
      color: #999;
      font-size: 0.9em;
    }
    .no-issues {
      text-align: center;
      padding: 60px;
      color: #28a745;
      font-size: 1.3em;
    }
    .no-issues svg {
      width: 100px;
      height: 100px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 Security Scan Report</h1>
      <p>Generated: ${this.formatTimestamp(this.result.timestamp)}</p>
      <p>Scan Duration: ${this.formatDuration(this.result.duration)}</p>
      ${this.result.metadata?.projectDir ? `<p>Project: ${this.result.metadata.projectDir}</p>` : ''}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Issues</h3>
        <div class="value">${this.result.summary.totalIssues}</div>
        <div class="label">Security issues found</div>
        <div class="risk-indicator">${this.result.riskLevel.toUpperCase()} RISK</div>
      </div>
      
      <div class="stat-card">
        <h3>Risk Score</h3>
        <div class="value">${riskScore}</div>
        <div class="label">Out of 100</div>
      </div>
      
      <div class="stat-card">
        <h3>Critical Issues</h3>
        <div class="value" style="color: #dc3545;">${this.result.summary.critical}</div>
        <div class="label">Require immediate attention</div>
      </div>
      
      <div class="stat-card">
        <h3>High Issues</h3>
        <div class="value" style="color: #fd7e14;">${this.result.summary.high}</div>
        <div class="label">Should be fixed soon</div>
      </div>
    </div>

    ${this.generateSeverityChart()}
    
    ${this.result.vulnerabilities.length > 0 ? this.generateVulnerabilitiesSection() : ''}
    ${this.result.codeIssues.length > 0 ? this.generateCodeIssuesSection() : ''}
    ${this.result.secrets && this.result.secrets.length > 0 ? this.generateSecretsSection() : ''}
    ${this.result.injectionIssues && this.result.injectionIssues.length > 0 ? this.generateInjectionSection() : ''}
    ${this.result.dependencyIssues.length > 0 ? this.generateDependencyIssuesSection() : ''}
    ${this.result.licenseIssues && this.result.licenseIssues.length > 0 ? this.generateLicenseSection() : ''}
    ${this.result.supplyChainIssues && this.result.supplyChainIssues.length > 0 ? this.generateSupplyChainSection() : ''}
    
    ${this.result.summary.totalIssues === 0 ? this.generateNoIssuesSection() : ''}

    <div class="footer">
      <p>Report generated by @ldesign/security</p>
      <p>🔒 Keep your code secure!</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * 生成严重程度图表
   */
  private generateSeverityChart(): string {
    const total = this.result.summary.totalIssues
    if (total === 0) return ''

    const critical = this.result.summary.critical
    const high = this.result.summary.high
    const medium = this.result.summary.medium
    const low = this.result.summary.low

    return `
    <div class="section">
      <h2>📊 Severity Distribution</h2>
      <div class="chart-container">
        <svg class="chart" viewBox="0 0 200 200">
          ${this.generatePieChart(critical, high, medium, low)}
        </svg>
        <div class="chart-legend">
          <div class="legend-item">
            <div class="legend-color" style="background: #dc3545;"></div>
            <span>Critical: ${critical} (${((critical / total) * 100).toFixed(1)}%)</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #fd7e14;"></div>
            <span>High: ${high} (${((high / total) * 100).toFixed(1)}%)</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #ffc107;"></div>
            <span>Medium: ${medium} (${((medium / total) * 100).toFixed(1)}%)</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #17a2b8;"></div>
            <span>Low: ${low} (${((low / total) * 100).toFixed(1)}%)</span>
          </div>
        </div>
      </div>
    </div>
    `
  }

  /**
   * 生成饼图 SVG
   */
  private generatePieChart(critical: number, high: number, medium: number, low: number): string {
    const total = critical + high + medium + low
    if (total === 0) return ''

    const colors = ['#dc3545', '#fd7e14', '#ffc107', '#17a2b8']
    const values = [critical, high, medium, low]

    let currentAngle = 0
    let paths = ''

    for (let i = 0; i < values.length; i++) {
      if (values[i] === 0) continue

      const percentage = values[i] / total
      const angle = percentage * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle

      const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180)
      const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180)
      const x2 = 100 + 80 * Math.cos((endAngle - 90) * Math.PI / 180)
      const y2 = 100 + 80 * Math.sin((endAngle - 90) * Math.PI / 180)

      const largeArc = angle > 180 ? 1 : 0

      paths += `
        <path d="M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z" 
              fill="${colors[i]}" stroke="white" stroke-width="2"/>
      `

      currentAngle += angle
    }

    return paths
  }

  /**
   * 生成漏洞部分
   */
  private generateVulnerabilitiesSection(): string {
    return `
    <div class="section">
      <h2>🚨 Vulnerabilities (${this.result.vulnerabilities.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>Severity</th>
            <th>Title</th>
            <th>CVE</th>
            <th>Source</th>
            <th>Fix Available</th>
          </tr>
        </thead>
        <tbody>
          ${this.result.vulnerabilities.map(vuln => `
            <tr>
              <td><code>${vuln.package}</code></td>
              <td><span class="severity-badge severity-${vuln.severity}">${vuln.severity}</span></td>
              <td>${vuln.title}</td>
              <td>${vuln.cve ? `<a href="https://nvd.nist.gov/vuln/detail/${vuln.cve}" target="_blank">${vuln.cve}</a>` : '-'}</td>
              <td>${vuln.source || 'npm'}</td>
              <td>${vuln.fixAvailable ? '✅ Yes' : '❌ No'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `
  }

  /**
   * 生成代码问题部分
   */
  private generateCodeIssuesSection(): string {
    return `
    <div class="section">
      <h2>⚠️ Code Issues (${this.result.codeIssues.length})</h2>
      <ul class="issue-list">
        ${this.result.codeIssues.slice(0, 50).map(issue => `
          <li class="issue-item">
            <h4>
              <span class="severity-badge severity-${issue.severity}">${issue.severity}</span>
              ${issue.message}
            </h4>
            <p><strong>File:</strong> <code>${issue.file}:${issue.line}:${issue.column}</code></p>
            <p><strong>Rule:</strong> ${issue.ruleId}</p>
            ${issue.suggestion ? `<p><strong>Suggestion:</strong> ${issue.suggestion}</p>` : ''}
          </li>
        `).join('')}
        ${this.result.codeIssues.length > 50 ? `<p style="text-align: center; color: #999;">... and ${this.result.codeIssues.length - 50} more issues</p>` : ''}
      </ul>
    </div>
    `
  }

  /**
   * 生成敏感信息部分
   */
  private generateSecretsSection(): string {
    return `
    <div class="section">
      <h2>🔑 Exposed Secrets (${this.result.secrets!.length})</h2>
      <ul class="issue-list">
        ${this.result.secrets!.map(secret => `
          <li class="issue-item">
            <h4>
              <span class="severity-badge severity-${secret.severity}">${secret.severity}</span>
              ${secret.pattern}
            </h4>
            <p><strong>File:</strong> <code>${secret.file}:${secret.line}:${secret.column}</code></p>
            <p><strong>Type:</strong> ${secret.type}</p>
            <p><strong>Matched:</strong> <code>${secret.matched}</code></p>
            <p><strong>Suggestion:</strong> ${secret.suggestion}</p>
          </li>
        `).join('')}
      </ul>
    </div>
    `
  }

  /**
   * 生成注入问题部分
   */
  private generateInjectionSection(): string {
    return `
    <div class="section">
      <h2>💉 Injection Vulnerabilities (${this.result.injectionIssues!.length})</h2>
      <ul class="issue-list">
        ${this.result.injectionIssues!.map(injection => `
          <li class="issue-item">
            <h4>
              <span class="severity-badge severity-${injection.severity}">${injection.severity}</span>
              ${injection.type.toUpperCase()} Injection
            </h4>
            <p><strong>File:</strong> <code>${injection.file}:${injection.line}:${injection.column}</code></p>
            <p><strong>Description:</strong> ${injection.description}</p>
            <p><strong>Code:</strong> <code>${this.escapeHtml(injection.code)}</code></p>
            <p><strong>Suggestion:</strong> ${injection.suggestion}</p>
          </li>
        `).join('')}
      </ul>
    </div>
    `
  }

  /**
   * 生成依赖问题部分
   */
  private generateDependencyIssuesSection(): string {
    return `
    <div class="section">
      <h2>📦 Dependency Issues (${this.result.dependencyIssues.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>Version</th>
            <th>Severity</th>
            <th>Issue</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          ${this.result.dependencyIssues.map(issue => `
            <tr>
              <td><code>${issue.package}</code></td>
              <td>${issue.version}</td>
              <td><span class="severity-badge severity-${issue.severity}">${issue.severity}</span></td>
              <td>${issue.issue}</td>
              <td>${issue.recommendation}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `
  }

  /**
   * 生成许可证部分
   */
  private generateLicenseSection(): string {
    const nonCompliant = this.result.licenseIssues!.filter(l => !l.compatible)
    if (nonCompliant.length === 0) return ''

    return `
    <div class="section">
      <h2>📄 License Issues (${nonCompliant.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>Version</th>
            <th>License</th>
            <th>Type</th>
            <th>Issue</th>
          </tr>
        </thead>
        <tbody>
          ${nonCompliant.map(license => `
            <tr>
              <td><code>${license.package}</code></td>
              <td>${license.version}</td>
              <td>${license.license}</td>
              <td>${license.licenseType}</td>
              <td>${license.issue || 'Non-compliant'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `
  }

  /**
   * 生成供应链部分
   */
  private generateSupplyChainSection(): string {
    return `
    <div class="section">
      <h2>🔗 Supply Chain Issues (${this.result.supplyChainIssues!.length})</h2>
      <ul class="issue-list">
        ${this.result.supplyChainIssues!.map(issue => `
          <li class="issue-item">
            <h4>
              <span class="severity-badge severity-${issue.severity}">${issue.severity}</span>
              ${issue.package}@${issue.version}
            </h4>
            <p><strong>Type:</strong> ${issue.type}</p>
            <p><strong>Description:</strong> ${issue.description}</p>
            <p><strong>Evidence:</strong></p>
            <ul>
              ${issue.evidence.map(e => `<li>${e}</li>`).join('')}
            </ul>
            <p><strong>Recommendation:</strong> ${issue.recommendation}</p>
          </li>
        `).join('')}
      </ul>
    </div>
    `
  }

  /**
   * 生成无问题部分
   */
  private generateNoIssuesSection(): string {
    return `
    <div class="section no-issues">
      <svg viewBox="0 0 100 100" fill="#28a745">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="5"/>
        <path d="M 30 50 L 45 65 L 70 35" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h2>🎉 No Security Issues Detected!</h2>
      <p>Your project looks secure. Keep up the good work!</p>
    </div>
    `
  }

  /**
   * 获取风险颜色
   */
  private getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return '#dc3545'
      case 'high': return '#fd7e14'
      case 'medium': return '#ffc107'
      case 'low': return '#17a2b8'
      case 'none': return '#28a745'
      default: return '#6c757d'
    }
  }

  /**
   * 转义 HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /**
   * 保存到文件
   */
  async save(outputPath: string): Promise<void> {
    const content = await this.generate()
    await fs.writeFile(outputPath, content, 'utf-8')
  }

  /**
   * 获取格式
   */
  getFormat(): string {
    return 'html'
  }
}


