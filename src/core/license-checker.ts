import fs from 'fs-extra'
import path from 'path'
import { execa } from 'execa'
import type { LicenseInfo, LicenseCheckResult, LicenseConflict } from '../types'

/**
 * 许可证检查器 - 扫描依赖包许可证并检测冲突
 */
export class LicenseChecker {
  // 宽松许可证白名单
  private static PERMISSIVE_LICENSES = [
    'MIT',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'ISC',
    '0BSD',
    'Unlicense',
    'CC0-1.0'
  ]

  // Copyleft 许可证
  private static COPYLEFT_LICENSES = [
    'GPL-2.0',
    'GPL-3.0',
    'AGPL-3.0',
    'LGPL-2.1',
    'LGPL-3.0',
    'MPL-2.0',
    'EPL-1.0',
    'EPL-2.0'
  ]

  // 专有许可证
  private static PROPRIETARY_LICENSES = [
    'UNLICENSED',
    'COMMERCIAL',
    'Proprietary'
  ]

  private whitelist: string[]
  private blacklist: string[]
  private allowUnknown: boolean

  constructor(
    private projectDir: string = process.cwd(),
    options: {
      whitelist?: string[]
      blacklist?: string[]
      allowUnknown?: boolean
    } = {}
  ) {
    this.whitelist = options.whitelist || LicenseChecker.PERMISSIVE_LICENSES
    this.blacklist = options.blacklist || []
    this.allowUnknown = options.allowUnknown ?? false
  }

  /**
   * 检查许可证
   */
  async check(): Promise<LicenseCheckResult> {
    try {
      const licenses = await this.scanLicenses()
      const compliant: LicenseInfo[] = []
      const nonCompliant: LicenseInfo[] = []
      const unknown: LicenseInfo[] = []

      for (const license of licenses) {
        if (!license.license || license.license === 'UNKNOWN') {
          license.compatible = this.allowUnknown
          license.issue = 'License information not found'
          unknown.push(license)
        } else if (this.isCompliant(license.license)) {
          license.compatible = true
          compliant.push(license)
        } else {
          license.compatible = false
          license.issue = this.getIssueReason(license.license)
          nonCompliant.push(license)
        }
      }

      const conflicts = this.detectConflicts(licenses)

      return {
        compliant,
        nonCompliant,
        unknown,
        conflicts,
        summary: {
          total: licenses.length,
          compliant: compliant.length,
          nonCompliant: nonCompliant.length,
          unknown: unknown.length,
          conflicts: conflicts.length
        }
      }
    } catch (error) {
      console.warn('许可证检查失败:', error)
      return {
        compliant: [],
        nonCompliant: [],
        unknown: [],
        conflicts: [],
        summary: {
          total: 0,
          compliant: 0,
          nonCompliant: 0,
          unknown: 0,
          conflicts: 0
        }
      }
    }
  }

  /**
   * 扫描所有依赖的许可证
   */
  private async scanLicenses(): Promise<LicenseInfo[]> {
    const licenses: LicenseInfo[] = []

    try {
      // 读取 package.json
      const packageJsonPath = path.join(this.projectDir, 'package.json')
      const packageJson = await fs.readJSON(packageJsonPath)

      // 获取所有依赖
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      // 检查 node_modules 中的许可证
      const nodeModulesPath = path.join(this.projectDir, 'node_modules')

      for (const [pkgName, version] of Object.entries(allDeps)) {
        const licenseInfo = await this.getLicenseInfo(nodeModulesPath, pkgName, version as string)
        licenses.push(licenseInfo)
      }

      return licenses
    } catch (error) {
      return []
    }
  }

  /**
   * 获取单个包的许可证信息
   */
  private async getLicenseInfo(
    nodeModulesPath: string,
    pkgName: string,
    version: string
  ): Promise<LicenseInfo> {
    try {
      const pkgPath = path.join(nodeModulesPath, pkgName, 'package.json')
      const pkgJson = await fs.readJSON(pkgPath)

      const license = this.normalizeLicense(pkgJson.license || 'UNKNOWN')
      const licenseType = this.getLicenseType(license)

      return {
        package: pkgName,
        version: pkgJson.version || version,
        license,
        licenseType,
        url: pkgJson.homepage || pkgJson.repository?.url || '',
        compatible: false
      }
    } catch (error) {
      return {
        package: pkgName,
        version,
        license: 'UNKNOWN',
        licenseType: 'unknown',
        compatible: false
      }
    }
  }

  /**
   * 规范化许可证名称
   */
  private normalizeLicense(license: any): string {
    if (typeof license === 'string') {
      return license.trim()
    }

    if (typeof license === 'object' && license.type) {
      return license.type
    }

    if (Array.isArray(license) && license.length > 0) {
      return license.map(l => typeof l === 'string' ? l : l.type).join(' OR ')
    }

    return 'UNKNOWN'
  }

  /**
   * 获取许可证类型
   */
  private getLicenseType(license: string): LicenseInfo['licenseType'] {
    if (LicenseChecker.PERMISSIVE_LICENSES.includes(license)) {
      return 'permissive'
    }

    if (LicenseChecker.COPYLEFT_LICENSES.includes(license)) {
      return 'copyleft'
    }

    if (LicenseChecker.PROPRIETARY_LICENSES.includes(license)) {
      return 'proprietary'
    }

    return 'unknown'
  }

  /**
   * 检查许可证是否合规
   */
  private isCompliant(license: string): boolean {
    // 检查黑名单
    if (this.blacklist.some(bl => license.includes(bl))) {
      return false
    }

    // 检查白名单
    return this.whitelist.some(wl => license.includes(wl))
  }

  /**
   * 获取不合规原因
   */
  private getIssueReason(license: string): string {
    if (this.blacklist.some(bl => license.includes(bl))) {
      return `License ${license} is in blacklist`
    }

    return `License ${license} is not in whitelist`
  }

  /**
   * 检测许可证冲突
   */
  private detectConflicts(licenses: LicenseInfo[]): LicenseConflict[] {
    const conflicts: LicenseConflict[] = []

    // 检查 GPL 与其他许可证的冲突
    const gplLicenses = licenses.filter(l =>
      l.license.includes('GPL') && !l.license.includes('LGPL')
    )

    const proprietaryLicenses = licenses.filter(l =>
      l.licenseType === 'proprietary'
    )

    for (const gpl of gplLicenses) {
      for (const prop of proprietaryLicenses) {
        conflicts.push({
          package1: gpl.package,
          license1: gpl.license,
          package2: prop.package,
          license2: prop.license,
          reason: 'GPL license conflicts with proprietary license'
        })
      }
    }

    // 检查 AGPL 与任何非 AGPL 许可证的冲突（如果是网络应用）
    const agplLicenses = licenses.filter(l => l.license.includes('AGPL'))

    if (agplLicenses.length > 0) {
      const nonAgplLicenses = licenses.filter(l => !l.license.includes('AGPL'))

      for (const agpl of agplLicenses) {
        for (const other of nonAgplLicenses.slice(0, 5)) { // 限制冲突数量
          conflicts.push({
            package1: agpl.package,
            license1: agpl.license,
            package2: other.package,
            license2: other.license,
            reason: 'AGPL requires all combined work to be AGPL'
          })
        }
      }
    }

    return conflicts
  }

  /**
   * 生成许可证报告
   */
  async generateReport(format: 'text' | 'json' | 'html' = 'text'): Promise<string> {
    const result = await this.check()

    if (format === 'json') {
      return JSON.stringify(result, null, 2)
    }

    if (format === 'html') {
      return this.generateHtmlReport(result)
    }

    // Text format
    let report = '=== License Compliance Report ===\n\n'
    report += `Total Packages: ${result.summary.total}\n`
    report += `Compliant: ${result.summary.compliant}\n`
    report += `Non-Compliant: ${result.summary.nonCompliant}\n`
    report += `Unknown: ${result.summary.unknown}\n`
    report += `Conflicts: ${result.summary.conflicts}\n\n`

    if (result.nonCompliant.length > 0) {
      report += '--- Non-Compliant Licenses ---\n'
      result.nonCompliant.forEach(lic => {
        report += `${lic.package}@${lic.version}: ${lic.license} - ${lic.issue}\n`
      })
      report += '\n'
    }

    if (result.conflicts.length > 0) {
      report += '--- License Conflicts ---\n'
      result.conflicts.forEach(conflict => {
        report += `${conflict.package1} (${conflict.license1}) <-> ${conflict.package2} (${conflict.license2})\n`
        report += `  Reason: ${conflict.reason}\n`
      })
    }

    return report
  }

  /**
   * 生成 HTML 报告
   */
  private generateHtmlReport(result: LicenseCheckResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>License Compliance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    .compliant { color: green; }
    .non-compliant { color: red; }
    .unknown { color: orange; }
  </style>
</head>
<body>
  <h1>License Compliance Report</h1>
  <p>Total Packages: ${result.summary.total}</p>
  <p class="compliant">Compliant: ${result.summary.compliant}</p>
  <p class="non-compliant">Non-Compliant: ${result.summary.nonCompliant}</p>
  <p class="unknown">Unknown: ${result.summary.unknown}</p>
  ${result.nonCompliant.length > 0 ? `
    <h2>Non-Compliant Licenses</h2>
    <table>
      <tr><th>Package</th><th>Version</th><th>License</th><th>Issue</th></tr>
      ${result.nonCompliant.map(lic => `
        <tr>
          <td>${lic.package}</td>
          <td>${lic.version}</td>
          <td>${lic.license}</td>
          <td>${lic.issue}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''}
  ${result.conflicts.length > 0 ? `
    <h2>License Conflicts</h2>
    <table>
      <tr><th>Package 1</th><th>License 1</th><th>Package 2</th><th>License 2</th><th>Reason</th></tr>
      ${result.conflicts.map(conflict => `
        <tr>
          <td>${conflict.package1}</td>
          <td>${conflict.license1}</td>
          <td>${conflict.package2}</td>
          <td>${conflict.license2}</td>
          <td>${conflict.reason}</td>
        </tr>
      `).join('')}
    </table>
  ` : ''}
</body>
</html>
    `.trim()
  }
}


