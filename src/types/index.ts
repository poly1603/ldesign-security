export interface ScanOptions {
  projectDir?: string
  skipVulnerabilities?: boolean
  skipCodeAudit?: boolean
  skipDependencies?: boolean
}

export interface Vulnerability {
  package: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  recommendation: string
  url: string
}

export interface CodeIssue {
  file: string
  line: number
  column: number
  message: string
  ruleId: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export interface DependencyIssue {
  package: string
  version: string
  issue: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  recommendation: string
}

export interface SecurityScanResult {
  vulnerabilities: Vulnerability[]
  codeIssues: CodeIssue[]
  dependencyIssues: DependencyIssue[]
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none'
  duration: number
  timestamp: string
  summary: {
    totalIssues: number
    critical: number
    high: number
    medium: number
    low: number
  }
}

