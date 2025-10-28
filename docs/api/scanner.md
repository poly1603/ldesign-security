# SecurityScanner

`SecurityScanner` 是主要的安全扫描器类，协调所有扫描模块并生成综合报告。

## 导入

```typescript
import { SecurityScanner } from '@ldesign/security'
```

## 构造函数

### `new SecurityScanner(options?)`

创建一个新的扫描器实例。

#### 参数

- `options` - 扫描选项（可选）

```typescript
interface ScanOptions {
  projectPath?: string           // 项目路径，默认为当前目录
  skipVulnerabilities?: boolean  // 跳过漏洞扫描
  skipCodeAudit?: boolean        // 跳过代码审计
  skipDependencies?: boolean     // 跳过依赖分析
  skipLicense?: boolean          // 跳过许可证检查
  skipSecrets?: boolean          // 跳过敏感信息检测
  skipInjection?: boolean        // 跳过注入检测
  skipSupplyChain?: boolean      // 跳过供应链分析
  exclude?: string[]             // 排除的文件模式
  severity?: Severity            // 最低严重程度
  failOn?: Severity              // 失败阈值
  strictMode?: boolean           // 严格模式
  maxConcurrency?: number        // 最大并发数
  includePerformance?: boolean   // 包含性能数据
  enablePerformanceReport?: boolean // 导出性能报告
}
```

#### 示例

```typescript
// 使用默认选项
const scanner = new SecurityScanner()

// 自定义选项
const scanner = new SecurityScanner({
  projectPath: '/path/to/project',
  exclude: ['node_modules/**', 'test/**'],
  severity: 'medium',
  maxConcurrency: 4
})
```

## 方法

### `scan(options?): Promise<ScanResult>`

执行安全扫描。

#### 参数

- `options` - 额外的扫描选项（可选），会合并到构造函数选项中

#### 返回值

返回 Promise，解析为扫描结果：

```typescript
interface ScanResult {
  vulnerabilities: Vulnerability[]      // 漏洞列表
  codeIssues: CodeIssue[]              // 代码问题
  dependencyIssues: DependencyIssue[]  // 依赖问题
  licenseIssues?: LicenseInfo[]        // 许可证问题
  secrets?: SecretMatch[]              // 敏感信息
  injectionIssues?: InjectionIssue[]   // 注入问题
  supplyChainIssues?: SupplyChainIssue[] // 供应链问题
  integrityChecks?: IntegrityCheck[]   // 完整性检查
  riskLevel: RiskLevel                 // 风险等级
  duration: number                     // 扫描耗时
  timestamp: string                    // 时间戳
  summary: {
    totalIssues: number
    critical: number
    high: number
    medium: number
    low: number
  }
  metadata?: {
    projectDir: string
    scannedFiles: number
    scannedPackages: number
  }
}
```

#### 示例

```typescript
const scanner = new SecurityScanner({
  projectPath: process.cwd()
})

const result = await scanner.scan()

console.log(`发现 ${result.vulnerabilities.length} 个漏洞`)
console.log(`风险等级: ${result.riskLevel}`)
console.log(`扫描耗时: ${result.duration}ms`)
```

### `scanVulnerabilities(): Promise<Vulnerability[]>`

仅扫描依赖漏洞。

#### 示例

```typescript
const scanner = new SecurityScanner()
const vulnerabilities = await scanner.scanVulnerabilities()

vulnerabilities.forEach(vuln => {
  console.log(`${vuln.package}: ${vuln.title} (${vuln.severity})`)
})
```

### `scanCode(): Promise<CodeIssue[]>`

仅扫描代码问题。

#### 示例

```typescript
const scanner = new SecurityScanner()
const issues = await scanner.scanCode()

issues.forEach(issue => {
  console.log(`${issue.file}:${issue.line} - ${issue.message}`)
})
```

### `scanSecrets(): Promise<SecretMatch[]>`

仅扫描敏感信息泄露。

#### 示例

```typescript
const scanner = new SecurityScanner()
const secrets = await scanner.scanSecrets()

secrets.forEach(secret => {
  console.log(`Found ${secret.type} in ${secret.file}:${secret.line}`)
})
```

## 完整使用示例

### 基础扫描

```typescript
import { SecurityScanner } from '@ldesign/security'

async function basicScan() {
  const scanner = new SecurityScanner({
    projectPath: process.cwd()
  })

  const result = await scanner.scan()

  // 输出摘要
  console.log('扫描完成!')
  console.log(`总问题数: ${result.summary.totalIssues}`)
  console.log(`风险等级: ${result.riskLevel}`)
  
  // 输出严重漏洞
  const critical = result.vulnerabilities.filter(v => v.severity === 'critical')
  if (critical.length > 0) {
    console.log('\n严重漏洞:')
    critical.forEach(v => {
      console.log(`- ${v.package}: ${v.title}`)
    })
  }
}

basicScan()
```

### 自定义过滤

```typescript
import { SecurityScanner } from '@ldesign/security'

async function customScan() {
  const scanner = new SecurityScanner({
    projectPath: process.cwd(),
    exclude: [
      'node_modules/**',
      'dist/**',
      'test/**',
      '*.test.ts'
    ],
    severity: 'medium', // 仅报告 medium 及以上
    maxConcurrency: 4   // 限制并发数
  })

  const result = await scanner.scan()

  // 过滤可修复的漏洞
  const fixable = result.vulnerabilities.filter(v => v.fixAvailable)
  console.log(`可修复的漏洞: ${fixable.length}`)

  return result
}
```

### 增量扫描

```typescript
import { SecurityScanner } from '@ldesign/security'
import { execSync } from 'child_process'

async function incrementalScan() {
  // 获取变更的文件
  const changedFiles = execSync('git diff --name-only HEAD~1 HEAD', {
    encoding: 'utf-8'
  }).split('\n').filter(Boolean)

  const scanner = new SecurityScanner({
    projectPath: process.cwd(),
    // 仅扫描变更的文件
    include: changedFiles
  })

  const result = await scanner.scan()
  console.log(`扫描了 ${changedFiles.length} 个变更文件`)
  
  return result
}
```

### 与报告器集成

```typescript
import { SecurityScanner, HTMLReporter, JSONReporter } from '@ldesign/security'

async function scanAndReport() {
  const scanner = new SecurityScanner()
  const result = await scanner.scan()

  // 生成 HTML 报告
  const htmlReporter = new HTMLReporter(result)
  await htmlReporter.save('security-report.html')

  // 生成 JSON 报告
  const jsonReporter = new JSONReporter(result)
  await jsonReporter.save('security-report.json')

  console.log('报告已生成')
}
```

### 错误处理

```typescript
import { SecurityScanner, SecurityError } from '@ldesign/security'

async function scanWithErrorHandling() {
  const scanner = new SecurityScanner({
    projectPath: process.cwd(),
    strictMode: true // 严格模式下遇到错误会抛出异常
  })

  try {
    const result = await scanner.scan()
    
    // 检查是否超过失败阈值
    if (result.summary.critical > 0 || result.summary.high > 0) {
      console.error('发现严重或高危漏洞!')
      process.exit(1)
    }

    return result
  } catch (error) {
    if (error instanceof SecurityError) {
      console.error('安全扫描错误:', error.message)
      console.error('详情:', error.details)
    } else {
      console.error('未知错误:', error)
    }
    throw error
  }
}
```

### 并行扫描多个项目

```typescript
import { SecurityScanner } from '@ldesign/security'

async function scanMultipleProjects() {
  const projects = [
    '/path/to/project1',
    '/path/to/project2',
    '/path/to/project3'
  ]

  const results = await Promise.all(
    projects.map(async projectPath => {
      const scanner = new SecurityScanner({ projectPath })
      const result = await scanner.scan()
      return { projectPath, result }
    })
  )

  // 汇总结果
  const totalIssues = results.reduce(
    (sum, { result }) => sum + result.summary.totalIssues,
    0
  )

  console.log(`总共发现 ${totalIssues} 个问题`)
  
  results.forEach(({ projectPath, result }) => {
    console.log(`${projectPath}: ${result.summary.totalIssues} 个问题`)
  })

  return results
}
```

### 监听扫描进度

```typescript
import { SecurityScanner } from '@ldesign/security'
import { EventEmitter } from 'events'

async function scanWithProgress() {
  const scanner = new SecurityScanner()

  // 监听扫描事件
  scanner.on('scan:start', () => {
    console.log('开始扫描...')
  })

  scanner.on('scan:progress', ({ current, total, module }) => {
    console.log(`扫描进度: ${current}/${total} - ${module}`)
  })

  scanner.on('scan:complete', ({ duration }) => {
    console.log(`扫描完成，耗时 ${duration}ms`)
  })

  const result = await scanner.scan()
  return result
}
```

## 相关内容

- [VulnerabilityChecker](./vulnerability-checker) - 漏洞检查器
- [CryptoAnalyzer](./crypto-analyzer) - 加密安全分析器
- [APISecurityChecker](./api-security-checker) - API 安全检查器
- [HTMLReporter](./html-reporter) - HTML 报告生成器
- [配置选项](../config/options) - 详细配置说明
