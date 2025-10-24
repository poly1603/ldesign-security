import fs from 'fs-extra'
import { BaseReporter } from './base-reporter'
import type { SecurityScanResult } from '../types'

/**
 * SARIF 报告生成器
 * SARIF (Static Analysis Results Interchange Format) 是一个标准化的静态分析结果格式
 * 支持 GitHub Code Scanning 等平台
 */
export class SARIFReporter extends BaseReporter {
  constructor(result: SecurityScanResult) {
    super(result)
  }

  /**
   * 生成 SARIF 报告
   */
  async generate(): Promise<string> {
    const sarifDoc = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: '@ldesign/security',
              version: '1.0.0',
              informationUri: 'https://github.com/ldesign/ldesign',
              rules: this.generateRules()
            }
          },
          results: this.generateResults(),
          columnKind: 'utf16CodeUnits'
        }
      ]
    }

    return JSON.stringify(sarifDoc, null, 2)
  }

  /**
   * 生成规则列表
   */
  private generateRules(): any[] {
    const rules = new Set<string>()
    const ruleMap = new Map<string, any>()

    // 从代码问题收集规则
    for (const issue of this.result.codeIssues) {
      if (!rules.has(issue.ruleId)) {
        rules.add(issue.ruleId)
        ruleMap.set(issue.ruleId, {
          id: issue.ruleId,
          name: issue.ruleId,
          shortDescription: {
            text: issue.message
          },
          fullDescription: {
            text: issue.message
          },
          defaultConfiguration: {
            level: this.mapSeverityToLevel(issue.severity)
          },
          properties: {
            tags: ['security'],
            precision: 'high'
          }
        })
      }
    }

    // 添加漏洞规则
    if (this.result.vulnerabilities.length > 0) {
      ruleMap.set('security/vulnerability', {
        id: 'security/vulnerability',
        name: 'Dependency Vulnerability',
        shortDescription: {
          text: 'Known security vulnerability in dependency'
        },
        fullDescription: {
          text: 'This dependency has a known security vulnerability'
        },
        defaultConfiguration: {
          level: 'error'
        },
        properties: {
          tags: ['security', 'vulnerability'],
          precision: 'high'
        }
      })
    }

    // 添加敏感信息规则
    if (this.result.secrets && this.result.secrets.length > 0) {
      ruleMap.set('security/secret', {
        id: 'security/secret',
        name: 'Exposed Secret',
        shortDescription: {
          text: 'Exposed secret or credential in code'
        },
        fullDescription: {
          text: 'Hardcoded secret or credential found in source code'
        },
        defaultConfiguration: {
          level: 'error'
        },
        properties: {
          tags: ['security', 'secret'],
          precision: 'high'
        }
      })
    }

    // 添加注入规则
    if (this.result.injectionIssues && this.result.injectionIssues.length > 0) {
      ruleMap.set('security/injection', {
        id: 'security/injection',
        name: 'Injection Vulnerability',
        shortDescription: {
          text: 'Potential injection vulnerability'
        },
        fullDescription: {
          text: 'Code may be vulnerable to injection attacks'
        },
        defaultConfiguration: {
          level: 'error'
        },
        properties: {
          tags: ['security', 'injection'],
          precision: 'high'
        }
      })
    }

    return Array.from(ruleMap.values())
  }

  /**
   * 生成结果列表
   */
  private generateResults(): any[] {
    const results: any[] = []

    // 代码问题
    for (const issue of this.result.codeIssues) {
      results.push({
        ruleId: issue.ruleId,
        level: this.mapSeverityToLevel(issue.severity),
        message: {
          text: issue.message
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: issue.file,
                uriBaseId: '%SRCROOT%'
              },
              region: {
                startLine: issue.line,
                startColumn: issue.column
              }
            }
          }
        ],
        properties: {
          severity: issue.severity
        }
      })
    }

    // 漏洞
    for (const vuln of this.result.vulnerabilities) {
      results.push({
        ruleId: 'security/vulnerability',
        level: this.mapSeverityToLevel(vuln.severity),
        message: {
          text: `${vuln.package}: ${vuln.title}`
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: 'package.json',
                uriBaseId: '%SRCROOT%'
              }
            }
          }
        ],
        properties: {
          severity: vuln.severity,
          package: vuln.package,
          cve: vuln.cve,
          cvss: vuln.cvss,
          recommendation: vuln.recommendation,
          url: vuln.url
        }
      })
    }

    // 敏感信息
    if (this.result.secrets) {
      for (const secret of this.result.secrets) {
        results.push({
          ruleId: 'security/secret',
          level: this.mapSeverityToLevel(secret.severity),
          message: {
            text: `Exposed ${secret.type}: ${secret.pattern}`
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: secret.file,
                  uriBaseId: '%SRCROOT%'
                },
                region: {
                  startLine: secret.line,
                  startColumn: secret.column
                }
              }
            }
          ],
          properties: {
            severity: secret.severity,
            type: secret.type,
            suggestion: secret.suggestion
          }
        })
      }
    }

    // 注入问题
    if (this.result.injectionIssues) {
      for (const injection of this.result.injectionIssues) {
        results.push({
          ruleId: 'security/injection',
          level: this.mapSeverityToLevel(injection.severity),
          message: {
            text: `${injection.type.toUpperCase()} Injection: ${injection.description}`
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: injection.file,
                  uriBaseId: '%SRCROOT%'
                },
                region: {
                  startLine: injection.line,
                  startColumn: injection.column
                }
              }
            }
          ],
          properties: {
            severity: injection.severity,
            type: injection.type,
            suggestion: injection.suggestion,
            code: injection.code
          }
        })
      }
    }

    return results
  }

  /**
   * 映射严重程度到 SARIF 级别
   */
  private mapSeverityToLevel(severity: string): 'error' | 'warning' | 'note' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error'
      case 'medium':
        return 'warning'
      case 'low':
        return 'note'
      default:
        return 'warning'
    }
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
    return 'sarif'
  }
}


