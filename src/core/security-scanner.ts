import path from 'path'
import type { SecurityScanResult, ScanOptions } from '../types'
import { VulnerabilityChecker } from './vulnerability-checker'
import { CodeAuditor } from './code-auditor'
import { DependencyScanner } from './dependency-scanner'
import { SecretScanner } from './secret-scanner'
import { InjectionDetector } from './injection-detector'
import { LicenseChecker } from './license-checker'
import { SupplyChainAnalyzer } from './supply-chain-analyzer'
import { PolicyManager } from './policy-manager'
import { PerformanceMonitor } from '../utils/performance'
import { logger } from '../utils/logger'
import { ParallelExecutor } from '../utils/parallel'

/**
 * 安全扫描器 - 综合安全扫描
 * 
 * @description
 * 这是主要的安全扫描器，整合了所有安全检查模块：
 * - 漏洞检测（NPM Audit + OSV）
 * - 代码安全审计
 * - 依赖扫描
 * - 敏感信息检测
 * - 注入攻击检测
 * - 许可证合规检查
 * - 供应链安全分析
 * 
 * 支持性能监控、并发控制和详细的扫描结果报告。
 * 
 * @example
 * ```typescript
 * const scanner = new SecurityScanner({
 *   projectDir: './my-project',
 *   skipSecrets: false,
 *   skipInjection: false
 * })
 * 
 * const result = await scanner.scan()
 * 
 * console.log('风险等级:', result.riskLevel)
 * console.log('总问题数:', result.summary.totalIssues)
 * console.log('扫描耗时:', result.duration, 'ms')
 * 
 * // 如果启用了性能监控
 * if (result.performance) {
 *   console.log('性能报告:', result.performance.summary)
 * }
 * ```
 */
export class SecurityScanner {
  private logger = logger.child('SecurityScanner')
  private perfMonitor = new PerformanceMonitor()
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
   * 
   * @description
   * 执行所有启用的安全检查模块，并生成综合报告。
   * 使用并发限制策略优化性能，避免资源耗尽。
   * 支持性能监控以分析各个扫描模块的执行时间。
   * 
   * @returns {Promise<SecurityScanResult>} 完整的安全扫描结果
   * 
   * @example
   * ```typescript
   * const result = await scanner.scan()
   * 
   * // 检查风险等级
   * if (result.riskLevel === 'critical' || result.riskLevel === 'high') {
   *   console.error('发现高危安全问题！')
   * }
   * 
   * // 查看详细问题
   * result.vulnerabilities.forEach(vuln => {
   *   console.log(`漏洞: ${vuln.package} - ${vuln.title}`)
   * })
   * ```
   */
  async scan(): Promise<SecurityScanResult> {
    this.perfMonitor.start('total_scan')
    this.logger.info('开始执行安全扫描...')

    const projectDir = this.options.projectDir || process.cwd()

    // 加载策略配置
    const policy = await this.policyManager.load()

    // 创建扫描任务（使用 thunk 以延迟执行）
    const scanTaskCreators: Array<() => Promise<any>> = []

    // 基础扫描（始终执行）
    if (!this.options.skipVulnerabilities) {
      scanTaskCreators.push(async () => {
        this.perfMonitor.start('vulnerability_check')
        const result = await this.vulnerabilityChecker.check()
        this.perfMonitor.end('vulnerability_check', { count: result.length })
        return result
      })
    } else {
      scanTaskCreators.push(() => Promise.resolve([]))
    }

    if (!this.options.skipCodeAudit) {
      scanTaskCreators.push(async () => {
        this.perfMonitor.start('code_audit')
        const result = await this.codeAuditor.audit()
        this.perfMonitor.end('code_audit', { count: result.length })
        return result
      })
    } else {
      scanTaskCreators.push(() => Promise.resolve([]))
    }

    if (!this.options.skipDependencies) {
      scanTaskCreators.push(async () => {
        this.perfMonitor.start('dependency_scan')
        const result = await this.dependencyScanner.scan()
        this.perfMonitor.end('dependency_scan', { count: result.length })
        return result
      })
    } else {
      scanTaskCreators.push(() => Promise.resolve([]))
    }

    // 新增扫描
    if (!this.options.skipSecrets) {
      scanTaskCreators.push(async () => {
        this.perfMonitor.start('secret_scan')
        const result = await this.secretScanner.scan()
        this.perfMonitor.end('secret_scan', { count: result.length })
        return result
      })
    } else {
      scanTaskCreators.push(() => Promise.resolve([]))
    }

    if (!this.options.skipInjection) {
      scanTaskCreators.push(async () => {
        this.perfMonitor.start('injection_detection')
        const result = await this.injectionDetector.detect()
        this.perfMonitor.end('injection_detection', { count: result.length })
        return result
      })
    } else {
      scanTaskCreators.push(() => Promise.resolve([]))
    }

    if (!this.options.skipLicense) {
      scanTaskCreators.push(async () => {
        this.perfMonitor.start('license_check')
        const result = await this.licenseChecker.check()
        this.perfMonitor.end('license_check', {
          compliant: result.summary.compliant,
          nonCompliant: result.summary.nonCompliant
        })
        return result
      })
    } else {
      scanTaskCreators.push(() => Promise.resolve({
        compliant: [],
        nonCompliant: [],
        unknown: [],
        conflicts: [],
        summary: { total: 0, compliant: 0, nonCompliant: 0, unknown: 0, conflicts: 0 }
      }))
    }

    if (!this.options.skipSupplyChain) {
      scanTaskCreators.push(async () => {
        this.perfMonitor.start('supply_chain_analysis')
        const result = await this.supplyChainAnalyzer.analyze()
        this.perfMonitor.end('supply_chain_analysis', { count: result.length })
        return result
      })
    } else {
      scanTaskCreators.push(() => Promise.resolve([]))
    }

    // 使用并发限制执行扫描任务（默认最多同时执行3个）
    const maxConcurrency = (this.options as any).maxConcurrency || 3
    this.logger.info(`使用并发限制 ${maxConcurrency} 执行扫描任务...`)

    const results = await ParallelExecutor.allWithLimit(scanTaskCreators, maxConcurrency)

    const [
      vulnerabilities,
      codeIssues,
      dependencyIssues,
      secrets,
      injectionIssues,
      licenseResult,
      supplyChainIssues
    ] = results

    const duration = this.perfMonitor.end('total_scan')

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

    this.logger.info(`扫描完成，耗时 ${duration}ms，发现 ${summary.totalIssues} 个问题`)

    // 如果启用了性能报告，导出性能数据
    if ((this.options as any).enablePerformanceReport) {
      const perfPath = path.join(projectDir, '.security-perf.json')
      await this.perfMonitor.export(perfPath)
      this.logger.info(`性能报告已导出到: ${perfPath}`)
    }

    const result: SecurityScanResult = {
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

    // 添加性能数据（如果启用）
    if ((this.options as any).includePerformance) {
      (result as any).performance = this.perfMonitor.getReport()
    }

    return result
  }

  /**
   * 获取性能监控器
   * 
   * @description
   * 返回当前的性能监控器实例，用于访问详细的性能指标。
   * 
   * @returns {PerformanceMonitor} 性能监控器实例
   * 
   * @example
   * ```typescript
   * const scanner = new SecurityScanner({ projectDir: './' })
   * await scanner.scan()
   * 
   * const perfMonitor = scanner.getPerformanceMonitor()
   * const report = perfMonitor.getReport()
   * console.log('扫描性能:', report.summary)
   * ```
   */
  getPerformanceMonitor(): PerformanceMonitor {
    return this.perfMonitor
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

