// ==================== 基础类型 ====================

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none'

// ==================== 扫描配置 ====================

export interface ScanOptions {
  projectDir?: string
  skipVulnerabilities?: boolean
  skipCodeAudit?: boolean
  skipDependencies?: boolean
  skipLicense?: boolean
  skipSecrets?: boolean
  skipInjection?: boolean
  skipSupplyChain?: boolean
  exclude?: string[]
  severity?: Severity
  failOn?: Severity
  /** 严格模式：遇到错误抛出异常而不是静默失败 */
  strictMode?: boolean
  /** 最大并发数，用于控制并行扫描任务的数量 */
  maxConcurrency?: number
  /** 是否在扫描结果中包含性能数据 */
  includePerformance?: boolean
  /** 是否导出性能报告到文件 */
  enablePerformanceReport?: boolean
}

// ==================== 漏洞相关 ====================

export interface Vulnerability {
  package: string
  severity: Severity
  title: string
  description: string
  recommendation: string
  url: string
  cve?: string
  cvss?: number
  source?: 'npm' | 'snyk' | 'osv' | 'nvd'
  fixAvailable?: boolean
  fixVersion?: string
}

// ==================== 代码问题相关 ====================

export interface CodeIssue {
  file: string
  line: number
  column: number
  message: string
  ruleId: string
  severity: Severity
  type?: 'security' | 'injection' | 'crypto' | 'secret'
  suggestion?: string
}

export interface SecretMatch {
  file: string
  line: number
  column: number
  type: 'api-key' | 'password' | 'token' | 'certificate' | 'private-key' | 'connection-string' | 'pii'
  matched: string
  pattern: string
  severity: Severity
  suggestion: string
}

export interface InjectionIssue {
  file: string
  line: number
  column: number
  type: 'sql' | 'xss' | 'command' | 'ssrf' | 'path-traversal'
  code: string
  severity: Severity
  description: string
  suggestion: string
}

// ==================== 依赖相关 ====================

export interface DependencyIssue {
  package: string
  version: string
  issue: string
  severity: Severity
  recommendation: string
  type?: 'outdated' | 'deprecated' | 'malicious' | 'typosquatting' | 'protocol'
}

// ==================== 许可证相关 ====================

export interface LicenseInfo {
  package: string
  version: string
  license: string
  licenseType: 'permissive' | 'copyleft' | 'proprietary' | 'unknown'
  url?: string
  compatible: boolean
  issue?: string
}

export interface LicenseCheckResult {
  compliant: LicenseInfo[]
  nonCompliant: LicenseInfo[]
  unknown: LicenseInfo[]
  conflicts: LicenseConflict[]
  summary: {
    total: number
    compliant: number
    nonCompliant: number
    unknown: number
    conflicts: number
  }
}

export interface LicenseConflict {
  package1: string
  license1: string
  package2: string
  license2: string
  reason: string
}

// ==================== SBOM 相关 ====================

export interface SBOMComponent {
  name: string
  version: string
  type: 'library' | 'application' | 'framework' | 'file'
  licenses?: string[]
  purl?: string
  cpe?: string
  hashes?: Record<string, string>
  dependencies?: string[]
}

export interface SBOM {
  format: 'spdx' | 'cyclonedx'
  version: string
  timestamp: string
  components: SBOMComponent[]
  metadata: {
    projectName: string
    projectVersion: string
    supplier?: string
    timestamp: string
  }
}

// ==================== 供应链相关 ====================

export interface SupplyChainIssue {
  package: string
  version: string
  type: 'typosquatting' | 'malicious' | 'integrity' | 'maintainer' | 'popularity'
  severity: Severity
  description: string
  evidence: string[]
  recommendation: string
  score?: number
}

// ==================== 完整性验证 ====================

export interface IntegrityCheck {
  package: string
  version: string
  algorithm: 'sha256' | 'sha384' | 'sha512'
  expected: string
  actual: string
  valid: boolean
}

// ==================== 通知配置 ====================

export interface NotificationConfig {
  enabled: boolean
  webhook?: WebhookConfig
  email?: EmailConfig
  slack?: SlackConfig
  dingtalk?: DingTalkConfig
  wecom?: WeComConfig
}

export interface WebhookConfig {
  url: string
  method?: 'POST' | 'GET'
  headers?: Record<string, string>
  severityFilter?: Severity[]
}

export interface EmailConfig {
  to: string[]
  from: string
  smtp: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
  severityFilter?: Severity[]
}

export interface SlackConfig {
  webhookUrl: string
  channel?: string
  username?: string
  severityFilter?: Severity[]
}

export interface DingTalkConfig {
  webhookUrl: string
  secret?: string
  severityFilter?: Severity[]
}

export interface WeComConfig {
  webhookUrl: string
  severityFilter?: Severity[]
}

// ==================== 报告配置 ====================

export interface ReportConfig {
  format: ReportFormat[]
  output: string
  title?: string
  template?: string
  includeCharts?: boolean
  includeDependencyGraph?: boolean
}

export type ReportFormat = 'html' | 'pdf' | 'json' | 'yaml' | 'markdown' | 'sarif'

// ==================== 策略配置 ====================

export interface SecurityPolicy {
  scan?: {
    exclude?: string[]
    include?: string[]
    severity?: Severity
    failOn?: Severity
  }
  license?: {
    whitelist?: string[]
    blacklist?: string[]
    allowUnknown?: boolean
  }
  notifications?: NotificationConfig
  schedule?: string
  reports?: ReportConfig
}

// ==================== 监控相关 ====================

export interface MetricsData {
  timestamp: string
  scanDuration: number
  totalIssues: number
  severityBreakdown: Record<Severity, number>
  vulnerabilityCount: number
  codeIssueCount: number
  dependencyIssueCount: number
  licenseIssueCount: number
  secretCount: number
  injectionCount: number
  riskLevel: RiskLevel
}

export interface ScheduleConfig {
  enabled: boolean
  cron: string
  timezone?: string
  onStart?: boolean
}

// ==================== CI/CD 集成 ====================

export interface CIConfig {
  platform: 'github' | 'gitlab' | 'jenkins' | 'azure-devops' | 'generic'
  failOnSeverity?: Severity
  uploadSarif?: boolean
  commentOnPR?: boolean
  blockOnFailure?: boolean
}

// ==================== 扫描结果 ====================

export interface SecurityScanResult {
  vulnerabilities: Vulnerability[]
  codeIssues: CodeIssue[]
  dependencyIssues: DependencyIssue[]
  licenseIssues?: LicenseInfo[]
  secrets?: SecretMatch[]
  injectionIssues?: InjectionIssue[]
  supplyChainIssues?: SupplyChainIssue[]
  integrityChecks?: IntegrityCheck[]
  riskLevel: RiskLevel
  duration: number
  timestamp: string
  summary: {
    totalIssues: number
    critical: number
    high: number
    medium: number
    low: number
  }
  metadata?: {
    projectDir: string
    scannedFiles: number
    scannedPackages: number
  }
}

