import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import type { SBOM, SBOMComponent } from '../types'

/**
 * SBOM 生成器 - 生成软件物料清单
 */
export class SBOMGenerator {
  constructor(private projectDir: string = process.cwd()) { }

  /**
   * 生成 SBOM
   */
  async generate(format: 'spdx' | 'cyclonedx' = 'spdx'): Promise<SBOM> {
    const components = await this.scanComponents()
    const packageJson = await this.getPackageJson()

    const sbom: SBOM = {
      format,
      version: format === 'spdx' ? 'SPDX-2.3' : 'CycloneDX-1.4',
      timestamp: new Date().toISOString(),
      components,
      metadata: {
        projectName: packageJson.name || 'unknown',
        projectVersion: packageJson.version || '0.0.0',
        supplier: packageJson.author || 'Unknown',
        timestamp: new Date().toISOString()
      }
    }

    return sbom
  }

  /**
   * 扫描所有组件
   */
  private async scanComponents(): Promise<SBOMComponent[]> {
    const components: SBOMComponent[] = []

    try {
      const packageJson = await this.getPackageJson()
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      const nodeModulesPath = path.join(this.projectDir, 'node_modules')

      for (const [pkgName, version] of Object.entries(allDeps)) {
        const component = await this.getComponentInfo(nodeModulesPath, pkgName, version as string)
        if (component) {
          components.push(component)
        }
      }

      return components
    } catch (error) {
      console.warn('组件扫描失败:', error)
      return []
    }
  }

  /**
   * 获取组件信息
   */
  private async getComponentInfo(
    nodeModulesPath: string,
    pkgName: string,
    version: string
  ): Promise<SBOMComponent | null> {
    try {
      const pkgPath = path.join(nodeModulesPath, pkgName, 'package.json')
      const pkgJson = await fs.readJSON(pkgPath)

      // 计算包的哈希值
      const hashes = await this.calculateHashes(path.join(nodeModulesPath, pkgName))

      // 提取许可证
      const licenses = this.extractLicenses(pkgJson)

      // 生成 PURL (Package URL)
      const purl = `pkg:npm/${pkgName}@${pkgJson.version || version}`

      // 提取依赖关系
      const dependencies = Object.keys({
        ...pkgJson.dependencies,
        ...pkgJson.peerDependencies
      })

      return {
        name: pkgName,
        version: pkgJson.version || version,
        type: 'library',
        licenses,
        purl,
        hashes,
        dependencies: dependencies.length > 0 ? dependencies : undefined
      }
    } catch (error) {
      return null
    }
  }

  /**
   * 计算包的哈希值
   */
  private async calculateHashes(pkgPath: string): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {}

    try {
      // 尝试读取 package.json 文件计算哈希
      const pkgJsonPath = path.join(pkgPath, 'package.json')
      const content = await fs.readFile(pkgJsonPath, 'utf-8')

      // SHA-256
      hashes['SHA-256'] = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex')

      // SHA-512
      hashes['SHA-512'] = crypto
        .createHash('sha512')
        .update(content)
        .digest('hex')

      return hashes
    } catch (error) {
      return {}
    }
  }

  /**
   * 提取许可证信息
   */
  private extractLicenses(pkgJson: any): string[] {
    const licenses: string[] = []

    if (pkgJson.license) {
      if (typeof pkgJson.license === 'string') {
        licenses.push(pkgJson.license)
      } else if (typeof pkgJson.license === 'object' && pkgJson.license.type) {
        licenses.push(pkgJson.license.type)
      }
    }

    if (pkgJson.licenses && Array.isArray(pkgJson.licenses)) {
      for (const license of pkgJson.licenses) {
        if (typeof license === 'string') {
          licenses.push(license)
        } else if (license.type) {
          licenses.push(license.type)
        }
      }
    }

    return licenses.length > 0 ? licenses : ['UNKNOWN']
  }

  /**
   * 获取 package.json
   */
  private async getPackageJson(): Promise<any> {
    const packageJsonPath = path.join(this.projectDir, 'package.json')
    return await fs.readJSON(packageJsonPath)
  }

  /**
   * 导出为 SPDX 格式
   */
  async exportSPDX(outputPath?: string): Promise<string> {
    const sbom = await this.generate('spdx')
    const spdxDoc = this.convertToSPDX(sbom)
    const content = JSON.stringify(spdxDoc, null, 2)

    if (outputPath) {
      await fs.writeFile(outputPath, content, 'utf-8')
    }

    return content
  }

  /**
   * 导出为 CycloneDX 格式
   */
  async exportCycloneDX(outputPath?: string): Promise<string> {
    const sbom = await this.generate('cyclonedx')
    const cycloneDxDoc = this.convertToCycloneDX(sbom)
    const content = JSON.stringify(cycloneDxDoc, null, 2)

    if (outputPath) {
      await fs.writeFile(outputPath, content, 'utf-8')
    }

    return content
  }

  /**
   * 转换为 SPDX 格式
   */
  private convertToSPDX(sbom: SBOM): any {
    return {
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: sbom.metadata.projectName,
      documentNamespace: `https://sbom.example.com/${sbom.metadata.projectName}/${sbom.metadata.projectVersion}/${Date.now()}`,
      creationInfo: {
        created: sbom.timestamp,
        creators: [`Tool: @ldesign/security`],
        licenseListVersion: '3.20'
      },
      packages: sbom.components.map((comp, index) => ({
        SPDXID: `SPDXRef-Package-${index}`,
        name: comp.name,
        versionInfo: comp.version,
        downloadLocation: `https://registry.npmjs.org/${comp.name}/-/${comp.name}-${comp.version}.tgz`,
        filesAnalyzed: false,
        licenseConcluded: comp.licenses?.[0] || 'NOASSERTION',
        licenseDeclared: comp.licenses?.[0] || 'NOASSERTION',
        copyrightText: 'NOASSERTION',
        externalRefs: [
          {
            referenceCategory: 'PACKAGE-MANAGER',
            referenceType: 'purl',
            referenceLocator: comp.purl
          }
        ],
        checksums: Object.entries(comp.hashes || {}).map(([algorithm, value]) => ({
          algorithm: algorithm.replace('-', ''),
          checksumValue: value
        }))
      })),
      relationships: sbom.components.map((comp, index) => ({
        spdxElementId: 'SPDXRef-DOCUMENT',
        relationshipType: 'DESCRIBES',
        relatedSpdxElement: `SPDXRef-Package-${index}`
      }))
    }
  }

  /**
   * 转换为 CycloneDX 格式
   */
  private convertToCycloneDX(sbom: SBOM): any {
    return {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      serialNumber: `urn:uuid:${this.generateUUID()}`,
      version: 1,
      metadata: {
        timestamp: sbom.timestamp,
        tools: [
          {
            vendor: 'LDesign',
            name: '@ldesign/security',
            version: '1.0.0'
          }
        ],
        component: {
          type: 'application',
          name: sbom.metadata.projectName,
          version: sbom.metadata.projectVersion
        }
      },
      components: sbom.components.map(comp => ({
        type: comp.type,
        name: comp.name,
        version: comp.version,
        purl: comp.purl,
        licenses: comp.licenses?.map(license => ({
          license: {
            id: license
          }
        })),
        hashes: Object.entries(comp.hashes || {}).map(([alg, value]) => ({
          alg: alg.replace('-', ''),
          content: value
        }))
      })),
      dependencies: sbom.components
        .filter(comp => comp.dependencies && comp.dependencies.length > 0)
        .map(comp => ({
          ref: comp.purl,
          dependsOn: comp.dependencies?.map(dep => `pkg:npm/${dep}`)
        }))
    }
  }

  /**
   * 生成 UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * 验证 SBOM
   */
  async validate(sbom: SBOM): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!sbom.metadata.projectName) {
      errors.push('Project name is required')
    }

    if (!sbom.metadata.projectVersion) {
      errors.push('Project version is required')
    }

    if (!sbom.components || sbom.components.length === 0) {
      errors.push('No components found')
    }

    for (const comp of sbom.components) {
      if (!comp.name) {
        errors.push(`Component missing name`)
      }
      if (!comp.version) {
        errors.push(`Component ${comp.name} missing version`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}


