import type { SecurityScanResult, ScanOptions } from '../types'
import { VulnerabilityChecker } from './vulnerability-checker'
import { CodeAuditor } from './code-auditor'
import { DependencyScanner } from './dependency-scanner'

/**
 * 安全扫描器 - 综合安全扫描
 */
export class SecurityScanner {
  private vulnerabilityChecker: VulnerabilityChecker
  private codeAuditor: CodeAuditor
  private dependencyScanner: DependencyScanner
  
  constructor(private options: ScanOptions = {}) {
    const projectDir = options.projectDir || process.cwd()
    this.vulnerabilityChecker = new VulnerabilityChecker(projectDir)
    this.codeAuditor = new CodeAuditor(projectDir)
    this.dependencyScanner = new DependencyScanner(projectDir)
  }
  
  /**
   * 执行完整安全扫描
   */
  async scan(): Promise<SecurityScanResult> {
    const startTime = Date.now()
    
    // 并行执行各种扫描
    const [vulnerabilities, codeIssues, dependencyIssues] = await Promise.all([
      this.vulnerabilityChecker.check(),
      this.codeAuditor.audit(),
      this.dependencyScanner.scan()
    ])
    
    const duration = Date.now() - startTime
    
    // 计算总体风险等级
    const riskLevel = this.calculateRiskLevel(
      vulnerabilities.length,
      codeIssues.length,
      dependencyIssues.length
    )
    
    return {
      vulnerabilities,
      codeIssues,
      dependencyIssues,
      riskLevel,
      duration,
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: vulnerabilities.length + codeIssues.length + dependencyIssues.length,
        critical: this.countBySeverity('critical', vulnerabilities, codeIssues),
        high: this.countBySeverity('high', vulnerabilities, codeIssues),
        medium: this.countBySeverity('medium', vulnerabilities, codeIssues),
        low: this.countBySeverity('low', vulnerabilities, codeIssues)
      }
    }
  }
  
  /**
   * 计算风险等级
   */
  private calculateRiskLevel(vulnCount: number, codeCount: number, depCount: number): 'critical' | 'high' | 'medium' | 'low' | 'none' {
    const total = vulnCount + codeCount + depCount
    
    if (total === 0) return 'none'
    if (total >= 10 || vulnCount >= 5) return 'critical'
    if (total >= 5 || vulnCount >= 3) return 'high'
    if (total >= 2) return 'medium'
    return 'low'
  }
  
  /**
   * 按严重程度统计
   */
  private countBySeverity(severity: string, ...lists: any[][]): number {
    return lists.reduce((count, list) => {
      return count + list.filter(item => item.severity === severity).length
    }, 0)
  }
}

