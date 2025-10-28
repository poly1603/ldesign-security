// 核心扫描模块
export { SecurityScanner } from './security-scanner'
export { VulnerabilityChecker } from './vulnerability-checker'
export { CodeAuditor } from './code-auditor'
export { DependencyScanner } from './dependency-scanner'
export { SecretScanner } from './secret-scanner'
export { InjectionDetector } from './injection-detector'
export { LicenseChecker } from './license-checker'
export { SupplyChainAnalyzer } from './supply-chain-analyzer'
export { SBOMGenerator } from './sbom-generator'

// 新增：加密和 API 安全检测
export { CryptoAnalyzer } from './crypto-analyzer'
export type { CryptoIssue, CryptoAnalyzerOptions } from './crypto-analyzer'
export { APISecurityChecker } from './api-security-checker'
export type { APISecurityIssue, APISecurityCheckerOptions } from './api-security-checker'

// 智能修复
export { SmartFixer } from './smart-fixer'
export type { FixResult, FixDetail, SmartFixerOptions } from './smart-fixer'

// 合规检查
export { ComplianceChecker } from './compliance-checker'
export type { 
  ComplianceCheckResult,
  ComplianceCheck,
  ComplianceStandard,
  ComplianceCheckerOptions
} from './compliance-checker'

// 容器安全
export { ContainerScanner } from './container-scanner'
export type {
  ContainerIssue,
  ContainerScanResult,
  ContainerScannerOptions
} from './container-scanner'

// 管理和辅助功能
export { Notifier } from './notifier'
export { PolicyManager } from './policy-manager'
export { CacheManager } from './cache-manager'
export { IncrementalScanner } from './incremental-scanner'
export { Scheduler } from './scheduler'
export { ProjectManager } from './project-manager'

