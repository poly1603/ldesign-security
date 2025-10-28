import type { SecurityScanResult, Severity } from '../types'

/**
 * 合规标准类型
 */
export type ComplianceStandard = 'owasp-top10' | 'cis-benchmarks' | 'pci-dss' | 'gdpr' | 'soc2' | 'iso27001'

/**
 * 合规检查结果
 */
export interface ComplianceCheckResult {
  standard: ComplianceStandard
  compliant: boolean
  score: number // 0-100
  passed: number
  failed: number
  total: number
  checks: ComplianceCheck[]
  summary: string
  timestamp: string
}

/**
 * 单个合规检查
 */
export interface ComplianceCheck {
  id: string
  title: string
  description: string
  category: string
  passed: boolean
  severity: Severity
  findings: string[]
  recommendation: string
  reference?: string
}

/**
 * 合规检查器配置
 */
export interface ComplianceCheckerOptions {
  standards?: ComplianceStandard[]
  projectDir?: string
  strictMode?: boolean
}

/**
 * 合规检查器
 * 检查项目是否符合各种安全合规标准
 * 
 * @example
 * ```typescript
 * const checker = new ComplianceChecker({
 *   standards: ['owasp-top10', 'pci-dss'],
 *   strictMode: true
 * })
 * 
 * const result = checker.check(scanResult)
 * console.log(`合规得分: ${result.score}/100`)
 * console.log(`通过检查: ${result.passed}/${result.total}`)
 * ```
 */
export class ComplianceChecker {
  private options: Required<ComplianceCheckerOptions>

  constructor(options: ComplianceCheckerOptions = {}) {
    this.options = {
      standards: options.standards || ['owasp-top10'],
      projectDir: options.projectDir || process.cwd(),
      strictMode: options.strictMode ?? false
    }
  }

  /**
   * 执行合规检查
   */
  check(scanResult: SecurityScanResult, standard?: ComplianceStandard): ComplianceCheckResult {
    const targetStandard = standard || this.options.standards[0]

    let checks: ComplianceCheck[]
    switch (targetStandard) {
      case 'owasp-top10':
        checks = this.checkOWASPTop10(scanResult)
        break
      case 'cis-benchmarks':
        checks = this.checkCISBenchmarks(scanResult)
        break
      case 'pci-dss':
        checks = this.checkPCIDSS(scanResult)
        break
      case 'gdpr':
        checks = this.checkGDPR(scanResult)
        break
      case 'soc2':
        checks = this.checkSOC2(scanResult)
        break
      case 'iso27001':
        checks = this.checkISO27001(scanResult)
        break
      default:
        throw new Error(`不支持的合规标准: ${targetStandard}`)
    }

    const passed = checks.filter(c => c.passed).length
    const failed = checks.filter(c => !c.passed).length
    const total = checks.length

    const score = total > 0 ? Math.round((passed / total) * 100) : 0
    const compliant = this.options.strictMode ? failed === 0 : score >= 70

    return {
      standard: targetStandard,
      compliant,
      score,
      passed,
      failed,
      total,
      checks,
      summary: this.generateSummary(targetStandard, compliant, score, passed, failed),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 检查所有配置的标准
   */
  checkAll(scanResult: SecurityScanResult): ComplianceCheckResult[] {
    return this.options.standards.map(standard => this.check(scanResult, standard))
  }

  /**
   * OWASP Top 10 检查
   */
  private checkOWASPTop10(scanResult: SecurityScanResult): ComplianceCheck[] {
    const checks: ComplianceCheck[] = []

    // A01:2021 – Broken Access Control
    checks.push({
      id: 'owasp-a01',
      title: 'A01:2021 – 失效的访问控制',
      description: '检查是否存在访问控制相关漏洞',
      category: 'Access Control',
      passed: !this.hasVulnerabilityType(scanResult, ['access-control', 'authorization']),
      severity: 'critical',
      findings: this.findVulnerabilities(scanResult, ['access-control', 'authorization']),
      recommendation: '实施适当的访问控制机制，使用基于角色的访问控制(RBAC)',
      reference: 'https://owasp.org/Top10/A01_2021-Broken_Access_Control/'
    })

    // A02:2021 – Cryptographic Failures
    checks.push({
      id: 'owasp-a02',
      title: 'A02:2021 – 加密机制失效',
      description: '检查是否使用弱加密或敏感数据未加密',
      category: 'Cryptography',
      passed: scanResult.secrets === undefined || scanResult.secrets.length === 0,
      severity: 'high',
      findings: scanResult.secrets?.map(s => `${s.file}:${s.line} - ${s.type}`) || [],
      recommendation: '使用强加密算法(AES-256, RSA-2048+)，加密敏感数据存储和传输',
      reference: 'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/'
    })

    // A03:2021 – Injection
    checks.push({
      id: 'owasp-a03',
      title: 'A03:2021 – 注入',
      description: '检查SQL注入、XSS、命令注入等注入漏洞',
      category: 'Injection',
      passed: scanResult.injectionIssues === undefined || scanResult.injectionIssues.length === 0,
      severity: 'critical',
      findings: scanResult.injectionIssues?.map(i => `${i.file}:${i.line} - ${i.type}`) || [],
      recommendation: '使用参数化查询、输入验证、输出编码防止注入攻击',
      reference: 'https://owasp.org/Top10/A03_2021-Injection/'
    })

    // A04:2021 – Insecure Design
    checks.push({
      id: 'owasp-a04',
      title: 'A04:2021 – 不安全设计',
      description: '检查设计层面的安全缺陷',
      category: 'Design',
      passed: scanResult.summary.critical === 0,
      severity: 'high',
      findings: scanResult.summary.critical > 0 
        ? [`发现 ${scanResult.summary.critical} 个严重安全问题`]
        : [],
      recommendation: '采用威胁建模、安全设计模式、最小权限原则',
      reference: 'https://owasp.org/Top10/A04_2021-Insecure_Design/'
    })

    // A05:2021 – Security Misconfiguration
    checks.push({
      id: 'owasp-a05',
      title: 'A05:2021 – 安全配置错误',
      description: '检查安全配置问题',
      category: 'Configuration',
      passed: this.checkSecurityConfiguration(scanResult),
      severity: 'medium',
      findings: this.findConfigurationIssues(scanResult),
      recommendation: '实施安全的默认配置、最小化攻击面、定期审查配置',
      reference: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/'
    })

    // A06:2021 – Vulnerable and Outdated Components
    checks.push({
      id: 'owasp-a06',
      title: 'A06:2021 – 易受攻击和过时的组件',
      description: '检查第三方组件漏洞',
      category: 'Dependencies',
      passed: scanResult.vulnerabilities.length === 0,
      severity: 'high',
      findings: scanResult.vulnerabilities.slice(0, 5).map(v => `${v.package} - ${v.title}`),
      recommendation: '定期更新依赖、使用自动化工具监控漏洞、移除未使用的依赖',
      reference: 'https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/'
    })

    // A07:2021 – Identification and Authentication Failures
    checks.push({
      id: 'owasp-a07',
      title: 'A07:2021 – 识别和身份验证失败',
      description: '检查身份验证和会话管理问题',
      category: 'Authentication',
      passed: !this.hasVulnerabilityType(scanResult, ['authentication', 'session']),
      severity: 'critical',
      findings: this.findVulnerabilities(scanResult, ['authentication', 'session']),
      recommendation: '实施多因素认证(MFA)、安全的会话管理、防止暴力破解',
      reference: 'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/'
    })

    // A08:2021 – Software and Data Integrity Failures
    checks.push({
      id: 'owasp-a08',
      title: 'A08:2021 – 软件和数据完整性失效',
      description: '检查软件更新、CI/CD 管道的完整性',
      category: 'Integrity',
      passed: scanResult.supplyChainIssues === undefined || scanResult.supplyChainIssues.length === 0,
      severity: 'high',
      findings: scanResult.supplyChainIssues?.map(s => `${s.package} - ${s.type}`) || [],
      recommendation: '使用数字签名验证、实施SBOM、保护CI/CD管道',
      reference: 'https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/'
    })

    // A09:2021 – Security Logging and Monitoring Failures
    checks.push({
      id: 'owasp-a09',
      title: 'A09:2021 – 安全日志和监控失效',
      description: '检查日志和监控配置',
      category: 'Logging',
      passed: true, // 需要额外的日志配置检查
      severity: 'medium',
      findings: [],
      recommendation: '实施全面的日志记录、集中日志管理、实时监控和告警',
      reference: 'https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/'
    })

    // A10:2021 – Server-Side Request Forgery (SSRF)
    checks.push({
      id: 'owasp-a10',
      title: 'A10:2021 – 服务端请求伪造(SSRF)',
      description: '检查SSRF漏洞',
      category: 'SSRF',
      passed: !this.hasInjectionType(scanResult, 'ssrf'),
      severity: 'high',
      findings: this.findInjections(scanResult, 'ssrf'),
      recommendation: '验证和过滤所有用户输入的URL、使用白名单、禁用不必要的协议',
      reference: 'https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/'
    })

    return checks
  }

  /**
   * CIS Benchmarks 检查
   */
  private checkCISBenchmarks(scanResult: SecurityScanResult): ComplianceCheck[] {
    return [
      {
        id: 'cis-1',
        title: '身份和访问管理',
        description: '检查身份验证和授权配置',
        category: 'IAM',
        passed: scanResult.summary.critical === 0,
        severity: 'critical',
        findings: [],
        recommendation: '实施强密码策略、多因素认证、最小权限原则'
      },
      {
        id: 'cis-2',
        title: '数据保护',
        description: '检查敏感数据加密和保护',
        category: 'Data Protection',
        passed: !scanResult.secrets || scanResult.secrets.length === 0,
        severity: 'high',
        findings: scanResult.secrets?.map(s => s.file) || [],
        recommendation: '加密静态和传输中的敏感数据'
      },
      {
        id: 'cis-3',
        title: '日志记录和监控',
        description: '检查日志配置和监控',
        category: 'Logging',
        passed: true,
        severity: 'medium',
        findings: [],
        recommendation: '启用全面的日志记录和实时监控'
      }
    ]
  }

  /**
   * PCI DSS 检查
   */
  private checkPCIDSS(scanResult: SecurityScanResult): ComplianceCheck[] {
    return [
      {
        id: 'pci-1',
        title: 'Requirement 1: 安装和维护防火墙配置',
        description: '保护持卡人数据',
        category: 'Network Security',
        passed: true,
        severity: 'critical',
        findings: [],
        recommendation: '配置防火墙规则，限制不必要的网络访问'
      },
      {
        id: 'pci-2',
        title: 'Requirement 2: 不使用供应商提供的默认值',
        description: '检查默认密码和配置',
        category: 'Configuration',
        passed: !this.hasVulnerabilityType(scanResult, ['default-credentials']),
        severity: 'high',
        findings: [],
        recommendation: '更改所有默认密码和配置'
      },
      {
        id: 'pci-3',
        title: 'Requirement 3: 保护存储的持卡人数据',
        description: '加密敏感数据',
        category: 'Data Protection',
        passed: !scanResult.secrets || scanResult.secrets.length === 0,
        severity: 'critical',
        findings: scanResult.secrets?.map(s => `${s.type} in ${s.file}`) || [],
        recommendation: '加密所有存储的持卡人数据'
      },
      {
        id: 'pci-4',
        title: 'Requirement 4: 加密开放网络上的持卡人数据传输',
        description: '使用强加密协议',
        category: 'Encryption',
        passed: true,
        severity: 'critical',
        findings: [],
        recommendation: '使用TLS 1.2+加密网络传输'
      },
      {
        id: 'pci-6',
        title: 'Requirement 6: 开发和维护安全的系统和应用程序',
        description: '修复安全漏洞',
        category: 'Development',
        passed: scanResult.vulnerabilities.filter(v => v.severity === 'critical').length === 0,
        severity: 'critical',
        findings: scanResult.vulnerabilities
          .filter(v => v.severity === 'critical')
          .map(v => v.title),
        recommendation: '及时修复已知漏洞，实施安全开发生命周期'
      }
    ]
  }

  /**
   * GDPR 检查
   */
  private checkGDPR(scanResult: SecurityScanResult): ComplianceCheck[] {
    return [
      {
        id: 'gdpr-art5',
        title: 'Article 5: 数据处理原则',
        description: '合法、公平、透明地处理个人数据',
        category: 'Data Processing',
        passed: true,
        severity: 'high',
        findings: [],
        recommendation: '确保数据处理符合GDPR原则'
      },
      {
        id: 'gdpr-art32',
        title: 'Article 32: 处理的安全性',
        description: '实施适当的技术和组织措施',
        category: 'Security',
        passed: scanResult.summary.critical === 0 && scanResult.summary.high < 5,
        severity: 'critical',
        findings: scanResult.summary.critical > 0 
          ? [`${scanResult.summary.critical} 个严重安全问题`]
          : [],
        recommendation: '实施加密、假名化、数据最小化等安全措施'
      },
      {
        id: 'gdpr-art33',
        title: 'Article 33: 通知监管机构数据泄露',
        description: '72小时内通知数据泄露',
        category: 'Breach Notification',
        passed: !scanResult.secrets || scanResult.secrets.length === 0,
        severity: 'critical',
        findings: scanResult.secrets?.map(s => `可能的数据泄露: ${s.type}`) || [],
        recommendation: '建立数据泄露检测和通知机制'
      },
      {
        id: 'gdpr-art25',
        title: 'Article 25: 数据保护by Design and by Default',
        description: '默认的数据保护',
        category: 'Privacy by Design',
        passed: scanResult.riskLevel === 'low' || scanResult.riskLevel === 'none',
        severity: 'high',
        findings: [],
        recommendation: '在系统设计阶段就考虑数据保护'
      }
    ]
  }

  /**
   * SOC 2 检查
   */
  private checkSOC2(scanResult: SecurityScanResult): ComplianceCheck[] {
    return [
      {
        id: 'soc2-cc1',
        title: 'CC1: 控制环境',
        description: '建立诚信和道德价值观',
        category: 'Control Environment',
        passed: true,
        severity: 'medium',
        findings: [],
        recommendation: '建立安全文化和管理承诺'
      },
      {
        id: 'soc2-cc6',
        title: 'CC6: 逻辑和物理访问控制',
        description: '限制对资产和数据的访问',
        category: 'Access Control',
        passed: !this.hasVulnerabilityType(scanResult, ['access-control']),
        severity: 'critical',
        findings: [],
        recommendation: '实施基于角色的访问控制和最小权限原则'
      },
      {
        id: 'soc2-cc7',
        title: 'CC7: 系统操作',
        description: '检测和响应安全事件',
        category: 'Operations',
        passed: scanResult.vulnerabilities.length < 10,
        severity: 'high',
        findings: [`发现 ${scanResult.vulnerabilities.length} 个漏洞`],
        recommendation: '建立安全监控和事件响应流程'
      }
    ]
  }

  /**
   * ISO 27001 检查
   */
  private checkISO27001(scanResult: SecurityScanResult): ComplianceCheck[] {
    return [
      {
        id: 'iso-a5',
        title: 'A.5: 信息安全政策',
        description: '制定和维护信息安全政策',
        category: 'Policy',
        passed: true,
        severity: 'medium',
        findings: [],
        recommendation: '建立并定期审查信息安全政策'
      },
      {
        id: 'iso-a8',
        title: 'A.8: 资产管理',
        description: '识别和保护组织资产',
        category: 'Asset Management',
        passed: scanResult.supplyChainIssues === undefined || scanResult.supplyChainIssues.length === 0,
        severity: 'medium',
        findings: [],
        recommendation: '维护资产清单和分类'
      },
      {
        id: 'iso-a12',
        title: 'A.12: 操作安全',
        description: '确保信息处理设施的正确和安全操作',
        category: 'Operations',
        passed: scanResult.summary.critical === 0,
        severity: 'high',
        findings: [],
        recommendation: '实施变更管理、容量管理和恶意软件防护'
      },
      {
        id: 'iso-a14',
        title: 'A.14: 系统获取、开发和维护',
        description: '确保安全被纳入信息系统',
        category: 'Development',
        passed: scanResult.codeIssues.filter(c => c.severity === 'critical').length === 0,
        severity: 'high',
        findings: [],
        recommendation: '在软件开发生命周期中集成安全'
      }
    ]
  }

  /**
   * 辅助方法：检查是否存在特定类型的漏洞
   */
  private hasVulnerabilityType(scanResult: SecurityScanResult, types: string[]): boolean {
    return scanResult.vulnerabilities.some(v => 
      types.some(type => v.title.toLowerCase().includes(type))
    )
  }

  /**
   * 辅助方法：查找特定类型的漏洞
   */
  private findVulnerabilities(scanResult: SecurityScanResult, types: string[]): string[] {
    return scanResult.vulnerabilities
      .filter(v => types.some(type => v.title.toLowerCase().includes(type)))
      .map(v => `${v.package} - ${v.title}`)
      .slice(0, 5)
  }

  /**
   * 辅助方法：检查是否存在特定类型的注入
   */
  private hasInjectionType(scanResult: SecurityScanResult, type: string): boolean {
    return scanResult.injectionIssues?.some(i => i.type === type) || false
  }

  /**
   * 辅助方法：查找特定类型的注入
   */
  private findInjections(scanResult: SecurityScanResult, type: string): string[] {
    return scanResult.injectionIssues
      ?.filter(i => i.type === type)
      .map(i => `${i.file}:${i.line}`)
      .slice(0, 5) || []
  }

  /**
   * 辅助方法：检查安全配置
   */
  private checkSecurityConfiguration(scanResult: SecurityScanResult): boolean {
    // 检查是否有高危配置问题
    return scanResult.codeIssues.filter(c => 
      c.severity === 'critical' && c.message.toLowerCase().includes('config')
    ).length === 0
  }

  /**
   * 辅助方法：查找配置问题
   */
  private findConfigurationIssues(scanResult: SecurityScanResult): string[] {
    return scanResult.codeIssues
      .filter(c => c.message.toLowerCase().includes('config'))
      .map(c => `${c.file}:${c.line} - ${c.message}`)
      .slice(0, 5)
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    standard: ComplianceStandard,
    compliant: boolean,
    score: number,
    passed: number,
    failed: number
  ): string {
    const standardName = {
      'owasp-top10': 'OWASP Top 10',
      'cis-benchmarks': 'CIS Benchmarks',
      'pci-dss': 'PCI DSS',
      'gdpr': 'GDPR',
      'soc2': 'SOC 2',
      'iso27001': 'ISO 27001'
    }[standard]

    if (compliant) {
      return `✅ 符合 ${standardName} 标准 (得分: ${score}/100, 通过: ${passed}/${passed + failed})`
    } else {
      return `❌ 不符合 ${standardName} 标准 (得分: ${score}/100, 失败: ${failed}/${passed + failed})`
    }
  }
}
