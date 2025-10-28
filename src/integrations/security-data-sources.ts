import { Logger } from '../utils/logger'
import { Vulnerability, Severity } from '../types'

/**
 * 安全数据源类型
 */
export type SecurityDataSource = 'github-advisory' | 'snyk' | 'nvd' | 'whitesource' | 'osv' | 'npm-audit'

/**
 * 数据源配置
 */
export interface DataSourceConfig {
  // GitHub Advisory Database
  github?: {
    enabled: boolean
    token?: string // GitHub Personal Access Token
    ecosystem?: string[] // npm, pip, rubygems, etc.
  }
  
  // Snyk
  snyk?: {
    enabled: boolean
    apiToken: string
    orgId?: string
  }
  
  // NVD (National Vulnerability Database)
  nvd?: {
    enabled: boolean
    apiKey?: string // NVD API key (optional but recommended)
  }
  
  // WhiteSource (Mend)
  whitesource?: {
    enabled: boolean
    apiKey: string
    productToken?: string
    projectToken?: string
  }
  
  // OSV (Open Source Vulnerabilities)
  osv?: {
    enabled: boolean
    ecosystem?: string[] // npm, PyPI, Go, etc.
  }
}

/**
 * 查询结果
 */
export interface VulnerabilityQuery {
  package: string
  version?: string
  ecosystem?: string
}

/**
 * 安全数据源集成器
 */
export class SecurityDataSources {
  private logger: Logger
  private config: DataSourceConfig

  constructor(config: DataSourceConfig = {}) {
    this.logger = new Logger('SecurityDataSources')
    this.config = config
  }

  /**
   * 从所有启用的数据源查询漏洞
   */
  async queryVulnerabilities(query: VulnerabilityQuery): Promise<Vulnerability[]> {
    const results: Vulnerability[] = []
    const promises: Promise<Vulnerability[]>[] = []

    // GitHub Advisory Database
    if (this.config.github?.enabled) {
      promises.push(this.queryGitHubAdvisory(query))
    }

    // Snyk
    if (this.config.snyk?.enabled) {
      promises.push(this.querySnyk(query))
    }

    // NVD
    if (this.config.nvd?.enabled) {
      promises.push(this.queryNVD(query))
    }

    // WhiteSource
    if (this.config.whitesource?.enabled) {
      promises.push(this.queryWhiteSource(query))
    }

    // OSV
    if (this.config.osv?.enabled) {
      promises.push(this.queryOSV(query))
    }

    const allResults = await Promise.allSettled(promises)
    
    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value)
      } else {
        this.logger.warn(`Data source query failed: ${result.reason}`)
      }
    }

    // 去重和合并相同漏洞
    return this.deduplicateVulnerabilities(results)
  }

  /**
   * 查询 GitHub Advisory Database
   */
  private async queryGitHubAdvisory(query: VulnerabilityQuery): Promise<Vulnerability[]> {
    this.logger.debug(`Querying GitHub Advisory for ${query.package}`)

    try {
      const graphqlQuery = `
        query($ecosystem: SecurityAdvisoryEcosystem!, $package: String!) {
          securityVulnerabilities(ecosystem: $ecosystem, package: $package, first: 100) {
            nodes {
              advisory {
                ghsaId
                summary
                description
                severity
                publishedAt
                withdrawnAt
                references {
                  url
                }
                cvss {
                  score
                  vectorString
                }
              }
              vulnerableVersionRange
              firstPatchedVersion {
                identifier
              }
              package {
                name
              }
            }
          }
        }
      `

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (this.config.github?.token) {
        headers['Authorization'] = `Bearer ${this.config.github.token}`
      }

      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: graphqlQuery,
          variables: {
            ecosystem: query.ecosystem?.toUpperCase() || 'NPM',
            package: query.package
          }
        })
      })

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`)
      }

      const data = await response.json()
      
      if (data.errors) {
        throw new Error(`GitHub GraphQL errors: ${JSON.stringify(data.errors)}`)
      }

      const vulnerabilities: Vulnerability[] = []
      const nodes = data.data?.securityVulnerabilities?.nodes || []

      for (const node of nodes) {
        const advisory = node.advisory
        
        // 跳过已撤回的公告
        if (advisory.withdrawnAt) {
          continue
        }

        // 检查版本是否受影响
        if (query.version && !this.isVersionAffected(query.version, node.vulnerableVersionRange)) {
          continue
        }

        vulnerabilities.push({
          package: query.package,
          severity: this.mapGitHubSeverity(advisory.severity),
          title: advisory.summary,
          description: advisory.description,
          recommendation: node.firstPatchedVersion 
            ? `Upgrade to ${node.firstPatchedVersion.identifier} or later`
            : 'No patch available yet',
          url: advisory.references[0]?.url || `https://github.com/advisories/${advisory.ghsaId}`,
          cve: advisory.ghsaId,
          cvss: advisory.cvss?.score,
          source: 'npm',
          fixAvailable: !!node.firstPatchedVersion,
          fixVersion: node.firstPatchedVersion?.identifier
        })
      }

      this.logger.info(`Found ${vulnerabilities.length} vulnerabilities from GitHub Advisory`)
      return vulnerabilities

    } catch (error) {
      this.logger.error(`GitHub Advisory query failed: ${error}`)
      return []
    }
  }

  /**
   * 查询 Snyk
   */
  private async querySnyk(query: VulnerabilityQuery): Promise<Vulnerability[]> {
    this.logger.debug(`Querying Snyk for ${query.package}`)

    try {
      const apiToken = this.config.snyk?.apiToken
      if (!apiToken) {
        throw new Error('Snyk API token not configured')
      }

      const ecosystem = query.ecosystem || 'npm'
      const purl = `pkg:${ecosystem}/${query.package}${query.version ? `@${query.version}` : ''}`

      const response = await fetch(`https://api.snyk.io/rest/orgs/${this.config.snyk.orgId}/packages/${encodeURIComponent(purl)}/issues?version=2024-01-01`, {
        method: 'GET',
        headers: {
          'Authorization': `token ${apiToken}`,
          'Content-Type': 'application/vnd.api+json'
        }
      })

      if (!response.ok) {
        throw new Error(`Snyk API returned ${response.status}`)
      }

      const data = await response.json()
      const vulnerabilities: Vulnerability[] = []

      for (const issue of data.data || []) {
        if (issue.attributes.type !== 'vulnerability') {
          continue
        }

        const attrs = issue.attributes
        
        vulnerabilities.push({
          package: query.package,
          severity: this.mapSnykSeverity(attrs.severity),
          title: attrs.title || attrs.problems?.[0]?.source || 'Unknown vulnerability',
          description: attrs.description || '',
          recommendation: this.extractSnykRecommendation(attrs),
          url: attrs.url || `https://snyk.io/vuln/${issue.id}`,
          cve: attrs.identifiers?.CVE?.[0],
          cvss: attrs.cvssScore,
          source: 'snyk',
          fixAvailable: !!attrs.slots?.upgrade,
          fixVersion: attrs.slots?.upgrade?.[0]
        })
      }

      this.logger.info(`Found ${vulnerabilities.length} vulnerabilities from Snyk`)
      return vulnerabilities

    } catch (error) {
      this.logger.error(`Snyk query failed: ${error}`)
      return []
    }
  }

  /**
   * 查询 NVD (National Vulnerability Database)
   */
  private async queryNVD(query: VulnerabilityQuery): Promise<Vulnerability[]> {
    this.logger.debug(`Querying NVD for ${query.package}`)

    try {
      const params = new URLSearchParams({
        keywordSearch: query.package,
        resultsPerPage: '50'
      })

      if (this.config.nvd?.apiKey) {
        params.append('apiKey', this.config.nvd.apiKey)
      }

      const response = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?${params}`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`NVD API returned ${response.status}`)
      }

      const data = await response.json()
      const vulnerabilities: Vulnerability[] = []

      for (const item of data.vulnerabilities || []) {
        const cve = item.cve
        const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || cve.metrics?.cvssMetricV2?.[0]
        
        vulnerabilities.push({
          package: query.package,
          severity: this.mapNVDSeverity(metrics?.cvssData?.baseSeverity || 'UNKNOWN'),
          title: cve.id,
          description: cve.descriptions?.find((d: any) => d.lang === 'en')?.value || '',
          recommendation: 'Check vendor advisory for patch information',
          url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
          cve: cve.id,
          cvss: metrics?.cvssData?.baseScore,
          source: 'nvd',
          fixAvailable: false
        })
      }

      this.logger.info(`Found ${vulnerabilities.length} vulnerabilities from NVD`)
      return vulnerabilities

    } catch (error) {
      this.logger.error(`NVD query failed: ${error}`)
      return []
    }
  }

  /**
   * 查询 WhiteSource (Mend)
   */
  private async queryWhiteSource(query: VulnerabilityQuery): Promise<Vulnerability[]> {
    this.logger.debug(`Querying WhiteSource for ${query.package}`)

    try {
      const apiKey = this.config.whitesource?.apiKey
      if (!apiKey) {
        throw new Error('WhiteSource API key not configured')
      }

      const requestBody = {
        requestType: 'getLibrarySecurityAlerts',
        userKey: apiKey,
        productToken: this.config.whitesource?.productToken,
        projectToken: this.config.whitesource?.projectToken,
        libraryName: query.package,
        libraryVersion: query.version
      }

      const response = await fetch('https://saas.whitesourcesoftware.com/api/v1.3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`WhiteSource API returned ${response.status}`)
      }

      const data = await response.json()
      const vulnerabilities: Vulnerability[] = []

      for (const alert of data.alerts || []) {
        vulnerabilities.push({
          package: query.package,
          severity: this.mapWhiteSourceSeverity(alert.vulnerability.severity),
          title: alert.vulnerability.name,
          description: alert.vulnerability.description || '',
          recommendation: alert.vulnerability.fixResolutionText || 'Check for updates',
          url: alert.vulnerability.url || '',
          cve: alert.vulnerability.name,
          cvss: alert.vulnerability.cvss3_severity,
          source: 'snyk',
          fixAvailable: !!alert.vulnerability.topFix,
          fixVersion: alert.vulnerability.topFix?.version
        })
      }

      this.logger.info(`Found ${vulnerabilities.length} vulnerabilities from WhiteSource`)
      return vulnerabilities

    } catch (error) {
      this.logger.error(`WhiteSource query failed: ${error}`)
      return []
    }
  }

  /**
   * 查询 OSV (Open Source Vulnerabilities)
   */
  private async queryOSV(query: VulnerabilityQuery): Promise<Vulnerability[]> {
    this.logger.debug(`Querying OSV for ${query.package}`)

    try {
      const requestBody = {
        package: {
          name: query.package,
          ecosystem: query.ecosystem || 'npm'
        },
        ...(query.version && { version: query.version })
      }

      const response = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`OSV API returned ${response.status}`)
      }

      const data = await response.json()
      const vulnerabilities: Vulnerability[] = []

      for (const vuln of data.vulns || []) {
        // 提取修复版本
        const fixVersion = vuln.affected?.[0]?.ranges?.[0]?.events
          ?.find((e: any) => e.fixed)?.fixed

        vulnerabilities.push({
          package: query.package,
          severity: this.mapOSVSeverity(vuln.severity || vuln.database_specific?.severity),
          title: vuln.summary || vuln.id,
          description: vuln.details || '',
          recommendation: fixVersion 
            ? `Upgrade to version ${fixVersion} or later`
            : 'Check vendor advisory',
          url: vuln.references?.[0]?.url || `https://osv.dev/vulnerability/${vuln.id}`,
          cve: vuln.aliases?.find((a: string) => a.startsWith('CVE-')) || vuln.id,
          source: 'osv',
          fixAvailable: !!fixVersion,
          fixVersion
        })
      }

      this.logger.info(`Found ${vulnerabilities.length} vulnerabilities from OSV`)
      return vulnerabilities

    } catch (error) {
      this.logger.error(`OSV query failed: ${error}`)
      return []
    }
  }

  /**
   * 批量查询多个包
   */
  async batchQuery(queries: VulnerabilityQuery[]): Promise<Map<string, Vulnerability[]>> {
    const results = new Map<string, Vulnerability[]>()

    const promises = queries.map(async query => {
      const vulns = await this.queryVulnerabilities(query)
      const key = `${query.package}@${query.version || 'latest'}`
      results.set(key, vulns)
    })

    await Promise.allSettled(promises)
    return results
  }

  /**
   * 去重漏洞
   */
  private deduplicateVulnerabilities(vulnerabilities: Vulnerability[]): Vulnerability[] {
    const seen = new Map<string, Vulnerability>()

    for (const vuln of vulnerabilities) {
      const key = `${vuln.cve || vuln.title}-${vuln.package}`
      
      if (!seen.has(key)) {
        seen.set(key, vuln)
      } else {
        // 合并来自不同源的信息
        const existing = seen.get(key)!
        
        // 使用更高的 CVSS 分数
        if (vuln.cvss && (!existing.cvss || vuln.cvss > existing.cvss)) {
          existing.cvss = vuln.cvss
        }

        // 合并描述信息
        if (vuln.description && !existing.description.includes(vuln.description)) {
          existing.description += '\n\n' + vuln.description
        }

        // 使用更详细的修复建议
        if (vuln.fixVersion && !existing.fixVersion) {
          existing.fixVersion = vuln.fixVersion
          existing.fixAvailable = true
        }
      }
    }

    return Array.from(seen.values())
  }

  /**
   * 版本匹配检查
   */
  private isVersionAffected(version: string, range: string): boolean {
    // 简化版本检查，实际应使用 semver 库
    // 这里仅做基本判断
    return true
  }

  /**
   * 映射 GitHub 严重程度
   */
  private mapGitHubSeverity(severity: string): Severity {
    const map: Record<string, Severity> = {
      'CRITICAL': 'critical',
      'HIGH': 'high',
      'MODERATE': 'medium',
      'MEDIUM': 'medium',
      'LOW': 'low'
    }
    return map[severity.toUpperCase()] || 'medium'
  }

  /**
   * 映射 Snyk 严重程度
   */
  private mapSnykSeverity(severity: string): Severity {
    const map: Record<string, Severity> = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    }
    return map[severity.toLowerCase()] || 'medium'
  }

  /**
   * 映射 NVD 严重程度
   */
  private mapNVDSeverity(severity: string): Severity {
    const map: Record<string, Severity> = {
      'CRITICAL': 'critical',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low'
    }
    return map[severity.toUpperCase()] || 'medium'
  }

  /**
   * 映射 WhiteSource 严重程度
   */
  private mapWhiteSourceSeverity(severity: string | number): Severity {
    if (typeof severity === 'number') {
      if (severity >= 9.0) return 'critical'
      if (severity >= 7.0) return 'high'
      if (severity >= 4.0) return 'medium'
      return 'low'
    }
    return this.mapSnykSeverity(severity)
  }

  /**
   * 映射 OSV 严重程度
   */
  private mapOSVSeverity(severity: any): Severity {
    if (!severity) return 'medium'
    
    if (typeof severity === 'string') {
      return this.mapSnykSeverity(severity)
    }

    // OSV 使用 CVSS 分数
    if (typeof severity === 'number') {
      return this.mapWhiteSourceSeverity(severity)
    }

    return 'medium'
  }

  /**
   * 提取 Snyk 修复建议
   */
  private extractSnykRecommendation(attrs: any): string {
    if (attrs.slots?.upgrade) {
      return `Upgrade to ${attrs.slots.upgrade[0]} or later`
    }
    
    if (attrs.slots?.patch) {
      return 'Apply available patch'
    }

    return 'Review and remediate manually'
  }

  /**
   * 获取数据源统计
   */
  getEnabledSources(): SecurityDataSource[] {
    const sources: SecurityDataSource[] = []
    
    if (this.config.github?.enabled) sources.push('github-advisory')
    if (this.config.snyk?.enabled) sources.push('snyk')
    if (this.config.nvd?.enabled) sources.push('nvd')
    if (this.config.whitesource?.enabled) sources.push('whitesource')
    if (this.config.osv?.enabled) sources.push('osv')
    
    return sources
  }
}

export { DataSourceConfig, VulnerabilityQuery }
