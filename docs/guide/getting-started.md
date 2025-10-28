# 快速开始

本指南将帮助你在 5 分钟内开始使用 @ldesign/security。

## 安装

使用你喜欢的包管理器安装：

::: code-group

```bash [npm]
npm install -D @ldesign/security
```

```bash [yarn]
yarn add -D @ldesign/security
```

```bash [pnpm]
pnpm add -D @ldesign/security
```

:::

## 首次扫描

安装完成后，在项目根目录运行：

```bash
npx lsec scan
```

扫描完成后，你将看到类似以下的输出：

```
┌──────────────────────────────────────┐
│                                      │
│   🔒 安全扫描报告                    │
│                                      │
│   总问题数: 15                       │
│   风险等级: HIGH                     │
│   扫描耗时: 3245ms                   │
│                                      │
└──────────────────────────────────────┘

🚨 漏洞 (8):

┌─────────────────────┬──────────┬──────────────────────────────┬──────────────┐
│ 包名                │ 严重程度  │ 问题                          │ CVE          │
├─────────────────────┼──────────┼──────────────────────────────┼──────────────┤
│ lodash              │ HIGH     │ Prototype Pollution          │ CVE-2019-... │
│ express             │ MEDIUM   │ Open Redirect                │ CVE-2022-... │
│ ...                 │ ...      │ ...                          │ ...          │
└─────────────────────┴──────────┴──────────────────────────────┴──────────────┘

💡 建议:
  1. 运行 lsec fix 尝试自动修复漏洞
  2. 运行 lsec report --format html 生成详细报告
  3. 运行 lsec license 检查许可证合规性
```

## 自动修复

发现漏洞后，可以尝试自动修复：

```bash
npx lsec fix
```

这将：
- 自动升级存在漏洞的依赖到安全版本
- 修复可自动修复的代码问题
- 创建备份以便回滚

## 生成报告

生成详细的 HTML 报告：

```bash
npx lsec report --format html
```

报告将保存在 `./security-reports` 目录下，包含：
- 漏洞详情和修复建议
- 代码问题定位
- 趋势分析图表
- 合规性评估

支持的报告格式：
- `html` - 交互式 HTML 报告
- `pdf` - PDF 文档
- `json` - JSON 数据
- `yaml` - YAML 格式
- `sarif` - SARIF 格式（用于 GitHub Code Scanning）
- `markdown` - Markdown 文档
- `excel` - Excel 表格

## 配置

创建配置文件 `.securityrc.json`：

```bash
npx lsec policy --init
```

或使用交互式配置向导：

```bash
npx lsec policy --interactive
```

基础配置示例：

```json
{
  "scan": {
    "exclude": ["node_modules/**", "dist/**"],
    "severity": "medium",
    "failOn": "high"
  },
  "license": {
    "whitelist": ["MIT", "Apache-2.0", "BSD-3-Clause"],
    "blacklist": ["GPL-3.0", "AGPL-3.0"]
  },
  "notifications": {
    "enabled": true,
    "slack": {
      "webhookUrl": "https://hooks.slack.com/..."
    }
  }
}
```

## 集成到 package.json

添加 npm scripts：

```json
{
  "scripts": {
    "security:scan": "lsec scan",
    "security:check": "lsec check",
    "security:fix": "lsec fix",
    "security:report": "lsec report --format html,json",
    "security:dashboard": "lsec dashboard",
    "precommit": "lsec check"
  }
}
```

## 集成到 CI/CD

### GitHub Actions

创建 `.github/workflows/security.yml`：

```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run security scan
        run: npx lsec ci --fail-on high --sarif
      
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: security-results.sarif
```

### GitLab CI

创建或更新 `.gitlab-ci.yml`：

```yaml
security:
  stage: test
  image: node:18
  script:
    - npm ci
    - npx lsec ci --fail-on high
  artifacts:
    reports:
      sast: security-results.sarif
```

## 常用命令速查

| 命令 | 说明 |
|------|------|
| `lsec scan` | 执行完整安全扫描 |
| `lsec check` | 快速检查依赖漏洞 |
| `lsec fix` | 自动修复漏洞 |
| `lsec report` | 生成安全报告 |
| `lsec dashboard` | 启动交互式仪表板 |
| `lsec watch` | 启动持续监控 |
| `lsec compare` | 对比两次扫描结果 |
| `lsec compliance` | 检查合规性 |
| `lsec ci` | CI/CD 集成模式 |

## 下一步

- 📖 阅读[核心概念](./concepts)了解工作原理
- 🔧 查看[配置选项](../config/options)进行深度定制
- 🚀 探索[高级功能](./continuous-monitoring)
- 💻 查看[API 文档](../api/scanner)了解编程式使用
- 🔗 了解[集成方式](../integrations/overview)

## 常见问题

### 如何跳过某些扫描？

使用命令行选项：

```bash
lsec scan --skip-code --skip-secrets
```

或在配置文件中设置：

```json
{
  "scan": {
    "skipCodeAudit": true,
    "skipSecrets": true
  }
}
```

### 如何排除特定文件或目录？

在配置文件中添加排除规则：

```json
{
  "scan": {
    "exclude": [
      "node_modules/**",
      "dist/**",
      "test/**",
      "*.test.js"
    ]
  }
}
```

### 扫描时间太长怎么办？

1. 使用增量扫描
2. 排除不需要扫描的目录
3. 启用缓存
4. 调整并发数

```json
{
  "scan": {
    "incrementalScan": true,
    "maxConcurrency": 4,
    "enableCache": true
  }
}
```

### 如何在 CI 中使用？

使用 `ci` 命令，它针对 CI/CD 环境优化：

```bash
npx lsec ci --fail-on high --sarif
```

这会：
- 使用简化的输出格式
- 根据严重程度决定退出码
- 生成 SARIF 报告用于代码扫描集成
