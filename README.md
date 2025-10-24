# @ldesign/security

<div align="center">

🔒 **LDesign 安全工具**

全面的项目安全扫描、漏洞检测和防护工具

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/ldesign/ldesign)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

## ✨ 特性

### 🔍 多维度安全检测
- **多源漏洞扫描** - 集成 NPM Audit、OSV，支持 CVE 查询和 CVSS 评分
- **敏感信息检测** - 扫描硬编码的 API 密钥、密码、Token 等
- **注入攻击检测** - 检测 SQL、XSS、命令注入、SSRF 等漏洞
- **代码安全审计** - 基于 ESLint 的代码安全规则检查
- **许可证合规检查** - 检测许可证冲突和合规性问题
- **供应链分析** - 检测 typosquatting、恶意包等供应链攻击

### 📊 强大的报告功能
- **HTML 交互式报告** - 带图表和可视化的专业报告
- **JSON/YAML 报告** - 结构化数据，便于集成
- **SARIF 报告** - 支持 GitHub Code Scanning
- **SBOM 生成** - 生成 SPDX 和 CycloneDX 格式的软件物料清单

### 🛠️ 自动化和集成
- **自动修复** - 一键修复已知漏洞
- **CI/CD 集成** - 完美支持 GitHub Actions、GitLab CI 等
- **通知告警** - 支持 Webhook、Slack、钉钉、企业微信
- **策略管理** - 通过配置文件定义安全基线

## 📦 安装

```bash
pnpm add -D @ldesign/security
# 或
npm install -D @ldesign/security
# 或
yarn add -D @ldesign/security
```

## 🚀 快速开始

### CLI 使用

```bash
# 完整安全扫描
lsec scan

# 快速检查漏洞
lsec check

# 自动修复漏洞
lsec fix

# 检查许可证合规性
lsec license

# 生成 SBOM
lsec sbom --format spdx

# 生成 HTML 报告
lsec report --format html

# CI/CD 模式
lsec ci --fail-on high --sarif
```

### 完整命令列表

#### `lsec scan` - 完整安全扫描
```bash
lsec scan [选项]

选项:
  -d, --dir <directory>      项目目录 (默认: 当前目录)
  --skip-vulnerabilities     跳过漏洞扫描
  --skip-code                跳过代码审计
  --skip-secrets             跳过敏感信息扫描
  --skip-injection           跳过注入检测
  --skip-license             跳过许可证检查
  --skip-supply-chain        跳过供应链分析
```

#### `lsec check` - 快速漏洞检查
```bash
lsec check [选项]

选项:
  -d, --dir <directory>      项目目录
```

#### `lsec fix` - 自动修复
```bash
lsec fix [选项]

选项:
  -d, --dir <directory>      项目目录
  --force                    强制修复（可能破坏性更新）
```

#### `lsec license` - 许可证检查
```bash
lsec license [选项]

选项:
  -d, --dir <directory>      项目目录
  -f, --format <format>      报告格式 (text|json|html)
  -o, --output <file>        输出文件路径
```

#### `lsec sbom` - 生成 SBOM
```bash
lsec sbom [选项]

选项:
  -d, --dir <directory>      项目目录
  -f, --format <format>      格式 (spdx|cyclonedx)
  -o, --output <file>        输出文件路径
```

#### `lsec report` - 生成报告
```bash
lsec report [选项]

选项:
  -d, --dir <directory>      项目目录
  -f, --format <formats>     报告格式，多个用逗号分隔
                             (html|json|yaml|sarif)
  -o, --output <directory>   输出目录
```

#### `lsec policy` - 策略管理
```bash
lsec policy [选项]

选项:
  -d, --dir <directory>      项目目录
  --init                     初始化配置文件
  --show                     显示当前策略
  --format <format>          配置文件格式 (json|js)
```

#### `lsec ci` - CI/CD 集成
```bash
lsec ci [选项]

选项:
  -d, --dir <directory>      项目目录
  --fail-on <severity>       失败阈值 (critical|high|medium|low)
  --sarif                    生成 SARIF 报告
```

## 📚 API 使用

### 完整安全扫描

```typescript
import { SecurityScanner } from '@ldesign/security'

const scanner = new SecurityScanner({
  projectDir: './my-project',
  skipSecrets: false,
  skipInjection: false
})

const result = await scanner.scan()

console.log('风险等级:', result.riskLevel)
console.log('总问题数:', result.summary.totalIssues)
console.log('漏洞:', result.vulnerabilities)
console.log('敏感信息:', result.secrets)
console.log('注入问题:', result.injectionIssues)
console.log('许可证问题:', result.licenseIssues)
console.log('供应链问题:', result.supplyChainIssues)
```

### 多源漏洞检测

```typescript
import { VulnerabilityChecker } from '@ldesign/security'

const checker = new VulnerabilityChecker('./my-project')
const vulnerabilities = await checker.check() // 自动整合 NPM Audit 和 OSV

for (const vuln of vulnerabilities) {
  console.log(`${vuln.package}: ${vuln.severity}`)
  console.log(`  CVE: ${vuln.cve}`)
  console.log(`  CVSS: ${vuln.cvss}`)
  console.log(`  来源: ${vuln.source}`) // npm, osv
  console.log(`  可修复: ${vuln.fixAvailable}`)
}

// 自动修复
const result = await checker.fix()
console.log(`修复了 ${result.fixed} 个漏洞`)
```

### 敏感信息扫描

```typescript
import { SecretScanner } from '@ldesign/security'

const scanner = new SecretScanner('./my-project')
const secrets = await scanner.scan()

for (const secret of secrets) {
  console.log(`${secret.file}:${secret.line}`)
  console.log(`  类型: ${secret.type}`) // api-key, password, token, etc.
  console.log(`  匹配: ${secret.matched}`) // 已脱敏
  console.log(`  建议: ${secret.suggestion}`)
}
```

### 注入攻击检测

```typescript
import { InjectionDetector } from '@ldesign/security'

const detector = new InjectionDetector('./my-project')
const injections = await detector.detect()

for (const injection of injections) {
  console.log(`${injection.file}:${injection.line}`)
  console.log(`  类型: ${injection.type}`) // sql, xss, command, ssrf
  console.log(`  代码: ${injection.code}`)
  console.log(`  描述: ${injection.description}`)
  console.log(`  建议: ${injection.suggestion}`)
}
```

### 许可证检查

```typescript
import { LicenseChecker } from '@ldesign/security'

const checker = new LicenseChecker('./my-project', {
  whitelist: ['MIT', 'Apache-2.0', 'BSD-3-Clause'],
  blacklist: ['GPL-3.0'],
  allowUnknown: false
})

const result = await checker.check()

console.log(`合规: ${result.summary.compliant}`)
console.log(`不合规: ${result.summary.nonCompliant}`)
console.log(`冲突: ${result.summary.conflicts}`)

// 生成报告
const htmlReport = await checker.generateReport('html')
```

### SBOM 生成

```typescript
import { SBOMGenerator } from '@ldesign/security'

const generator = new SBOMGenerator('./my-project')

// 生成 SPDX 格式
const spdx = await generator.exportSPDX('./sbom-spdx.json')

// 生成 CycloneDX 格式
const cyclonedx = await generator.exportCycloneDX('./sbom-cyclonedx.json')
```

### 供应链分析

```typescript
import { SupplyChainAnalyzer } from '@ldesign/security'

const analyzer = new SupplyChainAnalyzer('./my-project')
const issues = await analyzer.analyze()

for (const issue of issues) {
  console.log(`${issue.package}: ${issue.type}`)
  // typosquatting, malicious, integrity, maintainer, popularity
  console.log(`  描述: ${issue.description}`)
  console.log(`  证据:`, issue.evidence)
}
```

### 生成报告

```typescript
import { HTMLReporter, JSONReporter, SARIFReporter } from '@ldesign/security'

// HTML 报告
const htmlReporter = new HTMLReporter(scanResult)
await htmlReporter.save('./security-report.html')

// JSON 报告
const jsonReporter = new JSONReporter(scanResult)
await jsonReporter.save('./security-report.json')

// SARIF 报告（GitHub Code Scanning）
const sarifReporter = new SARIFReporter(scanResult)
await sarifReporter.save('./security-results.sarif')
```

### 通知集成

```typescript
import { Notifier } from '@ldesign/security'

const notifier = new Notifier({
  enabled: true,
  slack: {
    webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
    severityFilter: ['critical', 'high']
  },
  webhook: {
    url: 'https://your-server.com/webhook',
    method: 'POST'
  }
})

await notifier.notify(scanResult)
```

## ⚙️ 配置文件

创建 `.securityrc.json` 文件来自定义安全策略：

```json
{
  "scan": {
    "exclude": [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.test.ts"
    ],
    "severity": "medium",
    "failOn": "high"
  },
  "license": {
    "whitelist": ["MIT", "Apache-2.0", "BSD-3-Clause"],
    "blacklist": ["GPL-3.0"],
    "allowUnknown": false
  },
  "notifications": {
    "enabled": true,
    "webhook": {
      "url": "https://hooks.example.com/webhook",
      "severityFilter": ["critical", "high"]
    },
    "slack": {
      "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "channel": "#security-alerts"
    }
  },
  "reports": {
    "format": ["html", "json", "sarif"],
    "output": "./security-reports",
    "includeCharts": true
  }
}
```

初始化配置文件：

```bash
lsec policy --init
```

## 🔄 CI/CD 集成

### GitHub Actions

```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run security scan
        run: npx @ldesign/security ci --fail-on high --sarif
      
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: security-results.sarif
```

### GitLab CI

```yaml
security_scan:
  stage: test
  script:
    - npm ci
    - npx @ldesign/security ci --fail-on high
  artifacts:
    reports:
      junit: security-results.sarif
```

## 📊 扫描结果示例

```
╭──────────────────────────────────────────╮
│                                          │
│   🔒 安全扫描报告                         │
│                                          │
│   总问题数: 15                            │
│   风险等级: HIGH                          │
│   扫描耗时: 4532ms                        │
│                                          │
╰──────────────────────────────────────────╯

🚨 漏洞 (5):
┌─────────────┬────────┬───────────────┬──────────┬─────┐
│ 包名        │ 严重度 │ 问题          │ CVE      │ 来源│
├─────────────┼────────┼───────────────┼──────────┼─────┤
│ lodash      │ HIGH   │ Prototype... │ CVE-2021 │ osv │
└─────────────┴────────┴───────────────┴──────────┴─────┘

🔑 敏感信息泄露 (3):
  ● AWS Access Key
    文件: src/config.ts:12
    类型: api-key

💉 注入漏洞 (2):
  ● SQL 注入
    文件: src/db/query.ts:45
    描述: SQL 查询使用字符串拼接

📄 许可证问题 (2):
  运行 'lsec license' 查看详细信息

🔗 供应链问题 (3):
  ● react-native
    类型: typosquatting
    描述: 包名与流行包 "react" 非常相似

💡 建议:
  1. 运行 lsec fix 尝试自动修复漏洞
  2. 运行 lsec report --format html 生成详细报告
  3. 运行 lsec license 检查许可证合规性
```

## 📖 风险等级说明

| 等级 | 说明 | 建议 |
|------|------|------|
| **Critical** | 严重风险 | 立即处理，可能导致严重安全事故 |
| **High** | 高风险 | 尽快处理，存在明显的安全隐患 |
| **Medium** | 中等风险 | 建议处理，可能存在安全风险 |
| **Low** | 低风险 | 可选处理，风险较小 |
| **None** | 无风险 | 未发现安全问题 |

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解详情。

## 📄 License

MIT © LDesign Team

---

<div align="center">

**[文档](https://ldesign.io/docs/security)** •
**[示例](https://github.com/ldesign/ldesign/tree/main/examples/security)** •
**[问题反馈](https://github.com/ldesign/ldesign/issues)**

</div>

