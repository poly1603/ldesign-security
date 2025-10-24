import type { SecurityScanResult, ScanOptions } from '../types'
import { VulnerabilityChecker } from './vulnerability-checker'
import { CodeAuditor } from './code-auditor'
import { DependencyScanner } from './dependency-scanner'
import { SecretScanner } from './secret-scanner'
import { InjectionDetector } from './injection-detector'
import { LicenseChecker } from './license-checker'
import { SupplyChainAnalyzer } from './supply-chain-analyzer'
import { PolicyManager } from './policy-manager'

/**
 * 安全扫描器 - 综合安全扫描
 */
export class SecurityScanner {
  private vulnerabilityChecker: VulnerabilityChecker
  private codeAuditor: CodeAuditor
  private dependencyScanner: DependencyScanner
  private secretScanner: SecretScanner
  private injectionDetector: InjectionDetector
  private licenseChecker: LicenseChecker
  private supplyChainAnalyzer: SupplyChainAnalyzer
  private policyManager: PolicyManager

  constructor(private options: ScanOptions = {}) {
    const projectDir = options.projectDir || process.cwd()
    this.vulnerabilityChecker = new VulnerabilityChecker(projectDir)
    this.codeAuditor = new CodeAuditor(projectDir)
    this.dependencyScanner = new DependencyScanner(projectDir)
    this.secretScanner = new SecretScanner(projectDir)
    this.injectionDetector = new InjectionDetector(projectDir)
    this.licenseChecker = new LicenseChecker(projectDir)
    this.supplyChainAnalyzer = new SupplyChainAnalyzer(projectDir)
    this.policyManager = new PolicyManager(projectDir)
  }

  /**
   * 执行完整安全扫描
   */
  async scan(): Promise<SecurityScanResult> {
    const startTime = Date.now()
    const projectDir = this.options.projectDir || process.cwd()

    // 加载策略配置
    const policy = await this.policyManager.load()

    // 并行执行各种扫描
    const scanTasks: Promise<any>[] = []

    // 基础扫描（始终执行）
    if (!this.options.skipVulnerabilities) {
      scanTasks.push(this.vulnerabilityChecker.check())
    } else {
      scanTasks.push(Promise.resolve([]))
    }

    if (!this.options.skipCodeAudit) {
      scanTasks.push(this.codeAuditor.audit())
    } else {
      scanTasks.push(Promise.resolve([]))
    }

    if (!this.options.skipDependencies) {
      scanTasks.push(this.dependencyScanner.scan())
    } else {
      scanTasks.push(Promise.resolve([]))
    }

    // 新增扫描
    if (!this.options.skipSecrets) {
      scanTasks.push(this.secretScanner.scan())
    } else {
      scanTasks.push(Promise.resolve([]))
    }

    if (!this.options.skipInjection) {
      scanTasks.push(this.injectionDetector.detect())
    } else {
      scanTasks.push(Promise.resolve([]))
    }

    if (!this.options.skipLicense) {
      scanTasks.push(this.licenseChecker.check())
    } else {
      scanTasks.push(Promise.resolve({ compliant: [], nonCompliant: [], unknown: [], conflicts: [], summary: { total: 0, compliant: 0, nonCompliant: 0, unknown: 0, conflicts: 0 } }))
    }

    if (!this.options.skipSupplyChain) {
      scanTasks.push(this.supplyChainAnalyzer.analyze())
    } else {
      scanTasks.push(Promise.resolve([]))
    }

    const [
      vulnerabilities,
      codeIssues,
      dependencyIssues,
      secrets,
      injectionIssues,
      licenseResult,
      supplyChainIssues
    ] = await Promise.all(scanTasks)

    const duration = Date.now() - startTime

    // 提取不合规的许可证
    const licenseIssues = [
      ...licenseResult.nonCompliant,
      ...licenseResult.unknown
    ]

    // 计算总体风险等级
    const allIssues = [
      ...vulnerabilities,
      ...codeIssues,
      ...dependencyIssues,
      ...(secrets || []),
      ...(injectionIssues || []),
      ...(supplyChainIssues || [])
    ]

    const riskLevel = this.calculateRiskLevel(allIssues)

    // 统计各个严重程度的数量
    const summary = {
      totalIssues: allIssues.length,
      critical: this.countBySeverity('critical', allIssues),
      high: this.countBySeverity('high', allIssues),
      medium: this.countBySeverity('medium', allIssues),
      low: this.countBySeverity('low', allIssues)
    }

    return {
      vulnerabilities,
      codeIssues,
      dependencyIssues,
      licenseIssues: licenseIssues.length > 0 ? licenseIssues : undefined,
      secrets: secrets && secrets.length > 0 ? secrets : undefined,
      injectionIssues: injectionIssues && injectionIssues.length > 0 ? injectionIssues : undefined,
      supplyChainIssues: supplyChainIssues && supplyChainIssues.length > 0 ? supplyChainIssues : undefined,
      riskLevel,
      duration,
      timestamp: new Date().toISOString(),
      summary,
      metadata: {
        projectDir,
        scannedFiles: codeIssues.length,
        scannedPackages: vulnerabilities.length
      }
    }
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(issues: any[]): 'critical' | 'high' | 'medium' | 'low' | 'none' {
    if (issues.length === 0) return 'none'

    // 统计各个严重程度的数量
    const critical = issues.filter(i => i.severity === 'critical').length
    const high = issues.filter(i => i.severity === 'high').length
    const medium = issues.filter(i => i.severity === 'medium').length

    // 根据严重问题的数量决定风险等级
    if (critical >= 1) return 'critical'
    if (high >= 3 || critical + high >= 5) return 'high'
    if (medium >= 5 || high >= 1) return 'medium'
    if (issues.length >= 1) return 'low'

    return 'none'
  }

  /**
   * 按严重程度统计
   */
  private countBySeverity(severity: string, issues: any[]): number {
    return issues.filter(item => item.severity === severity).length
  }

  /**
   * 获取策略管理器
   */
  getPolicyManager(): PolicyManager {
    return this.policyManager
  }

  /**
   * 获取漏洞检查器
   */
  getVulnerabilityChecker(): VulnerabilityChecker {
    return this.vulnerabilityChecker
  }

  /**
   * 获取许可证检查器
   */
  getLicenseChecker(): LicenseChecker {
    return this.licenseChecker
  }

  /**
   * 获取供应链分析器
   */
  getSupplyChainAnalyzer(): SupplyChainAnalyzer {
    return this.supplyChainAnalyzer
  }
}

