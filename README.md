# @ldesign/security

LDesign 安全工具 - 全面的依赖安全扫描、漏洞检测和代码审计工具。

## 特性

- 🔒 依赖漏洞扫描
- 🔍 代码安全审计
- 📊 安全风险评估
- 🛠️ 自动修复建议
- 📦 依赖安全检查
- 🚨 实时安全告警
- 📈 详细报告生成

## 安装

```bash
pnpm add -D @ldesign/security
```

## 使用

### CLI 方式

```bash
# 完整安全扫描
ldesign-security scan
lsec scan

# 仅检查依赖漏洞
ldesign-security check

# 自动修复漏洞
ldesign-security fix

# 指定项目目录
ldesign-security scan --dir /path/to/project
```

### API 方式

```typescript
import { SecurityScanner, VulnerabilityChecker, CodeAuditor, DependencyScanner } from '@ldesign/security'

// 完整安全扫描
const scanner = new SecurityScanner({ projectDir: './my-project' })
const result = await scanner.scan()

console.log('扫描结果:', result)
console.log('风险等级:', result.riskLevel)
console.log('总问题数:', result.summary.totalIssues)
console.log('漏洞:', result.vulnerabilities)
console.log('代码问题:', result.codeIssues)
console.log('依赖问题:', result.dependencyIssues)

// 仅检查漏洞
const vulnChecker = new VulnerabilityChecker('./my-project')
const vulnerabilities = await vulnChecker.check()

for (const vuln of vulnerabilities) {
  console.log(`${vuln.package}: ${vuln.severity} - ${vuln.title}`)
}

// 修复漏洞
const fixResult = await vulnChecker.fix()
if (fixResult.success) {
  console.log('漏洞已修复')
}

// 代码审计
const auditor = new CodeAuditor('./my-project')
const codeIssues = await auditor.audit()

for (const issue of codeIssues) {
  console.log(`${issue.file}:${issue.line} - ${issue.message}`)
}

// 依赖扫描
const depScanner = new DependencyScanner('./my-project')
const depIssues = await depScanner.scan()

for (const issue of depIssues) {
  console.log(`${issue.package}: ${issue.issue}`)
  console.log(`建议: ${issue.recommendation}`)
}
```

## 扫描结果示例

```
╭────────────────────────────────────────╮
│                                        │
│   🔒 安全扫描报告                       │
│                                        │
│   总问题数: 12                          │
│   风险等级: HIGH                        │
│   扫描耗时: 3542ms                      │
│                                        │
╰────────────────────────────────────────╯

🚨 发现 5 个漏洞:

┌─────────────┬──────────┬────────────────┬──────────────┐
│ 包名        │ 严重程度  │ 问题           │ 建议         │
├─────────────┼──────────┼────────────────┼──────────────┤
│ lodash      │ HIGH     │ Prototype...   │ Update to... │
│ axios       │ MEDIUM   │ SSRF...        │ Update to... │
└─────────────┴──────────┴────────────────┴──────────────┘

⚠️  发现 3 个代码安全问题:

┌──────────────┬─────────┬────────────────┐
│ 文件         │ 位置    │ 问题           │
├──────────────┼─────────┼────────────────┤
│ src/utils.ts │ 45:12   │ Unsafe eval... │
└──────────────┴─────────┴────────────────┘

📦 发现 4 个依赖问题:

  ● node-fetch@2.6.0
    使用了存在漏洞的版本
    建议: 更新到 2.6.7 或更高版本
```

## API 文档

### SecurityScanner

安全扫描器主类。

#### 方法

- `scan()` - 执行完整安全扫描，返回详细报告

### VulnerabilityChecker

漏洞检查器。

#### 方法

- `check()` - 检查依赖漏洞
- `fix()` - 尝试自动修复漏洞

### CodeAuditor

代码审计器。

#### 方法

- `audit(patterns?)` - 审计代码安全问题

### DependencyScanner

依赖扫描器。

#### 方法

- `scan()` - 扫描依赖安全问题

## 风险等级说明

- **Critical**: 严重风险，需要立即处理
- **High**: 高风险，应尽快处理
- **Medium**: 中等风险，建议处理
- **Low**: 低风险，可选处理
- **None**: 无风险

## License

MIT

