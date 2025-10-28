---
layout: home

hero:
  name: "@ldesign/security"
  text: 企业级安全扫描工具
  tagline: 全面、智能、易用的 Node.js 项目安全解决方案
  image:
    src: /logo.svg
    alt: LDesign Security
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看 GitHub
      link: https://github.com/ldesign/security

features:
  - icon: 🔍
    title: 全面的安全扫描
    details: 支持漏洞扫描、代码审计、敏感信息检测、注入攻击检测、加密安全、API 安全等多维度安全检查
  
  - icon: 🤖
    title: 智能自动修复
    details: 基于 AI 的智能修复引擎，自动修复依赖漏洞、代码问题和配置缺陷，支持预览和回滚
  
  - icon: 📊
    title: 丰富的报告格式
    details: 支持 HTML、PDF、JSON、YAML、SARIF、Markdown、Excel 等多种报告格式，满足不同场景需求
  
  - icon: 🔄
    title: 持续监控
    details: 实时文件监听、Git Hooks 集成、定时扫描、增量检测，7x24 小时保护您的代码安全
  
  - icon: 🏛️
    title: 合规性检查
    details: 支持 OWASP Top 10、PCI DSS、GDPR、SOC 2、CIS Benchmarks 等主流安全合规标准
  
  - icon: 🐳
    title: 容器安全
    details: Dockerfile 最佳实践检查、镜像漏洞扫描、容器配置审计，保障容器化应用安全
  
  - icon: 🔗
    title: 无缝集成
    details: 支持 GitHub、GitLab、Jenkins、VS Code 等主流开发工具，轻松融入现有工作流
  
  - icon: 📈
    title: 交互式仪表板
    details: 实时数据可视化、趋势分析、对比报告、WebSocket 实时推送，全方位掌握安全态势
  
  - icon: 🌐
    title: 多数据源聚合
    details: 集成 GitHub Advisory、Snyk、NVD、WhiteSource、OSV 等多个漏洞数据库，覆盖更全面
  
  - icon: ⚡
    title: 高性能
    details: 并行扫描、增量检测、智能缓存、流式处理，即使大型项目也能快速完成扫描
  
  - icon: 🎯
    title: 精准检测
    details: 300+ 检测规则、低误报率、上下文感知分析，确保检测结果准确可靠
  
  - icon: 🔧
    title: 高度可扩展
    details: 插件架构、自定义规则引擎、Webhook 集成、REST API，灵活满足定制化需求
---

## 快速开始

### 安装

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

### 基础使用

```bash
# 执行完整安全扫描
npx lsec scan

# 快速检查漏洞
npx lsec check

# 自动修复漏洞
npx lsec fix

# 生成 HTML 报告
npx lsec report --format html

# 启动交互式仪表板
npx lsec dashboard
```

### 编程式使用

```typescript
import { SecurityScanner } from '@ldesign/security'

const scanner = new SecurityScanner({
  projectPath: process.cwd()
})

const result = await scanner.scan()
console.log(`发现 ${result.vulnerabilities.length} 个漏洞`)
```

## 为什么选择 @ldesign/security？

### 🎯 全面覆盖

从依赖漏洞到代码缺陷，从配置问题到容器安全，一站式解决所有安全问题。

### 🚀 开箱即用

零配置启动，智能默认设置，5 分钟内即可完成首次扫描。

### 💼 企业就绪

支持多项目管理、策略配置、审计日志、合规报告等企业级特性。

### 🔄 持续集成

完美集成 CI/CD 流程，支持 GitHub Actions、GitLab CI、Jenkins 等主流平台。

### 📊 可视化

交互式 Web 仪表板，实时监控、趋势分析、对比报告，一目了然。

## 主要特性对比

| 特性 | @ldesign/security | npm audit | Snyk | OWASP Dependency-Check |
|------|-------------------|-----------|------|------------------------|
| 依赖漏洞扫描 | ✅ | ✅ | ✅ | ✅ |
| 代码审计 | ✅ | ❌ | ✅ | ❌ |
| 敏感信息检测 | ✅ | ❌ | ❌ | ❌ |
| 注入攻击检测 | ✅ | ❌ | ✅ | ❌ |
| 加密安全检查 | ✅ | ❌ | ✅ | ❌ |
| API 安全检查 | ✅ | ❌ | ✅ | ❌ |
| 容器安全 | ✅ | ❌ | ✅ | ❌ |
| 合规性检查 | ✅ | ❌ | ✅ | ❌ |
| 智能修复 | ✅ | ✅ | ✅ | ❌ |
| 持续监控 | ✅ | ❌ | ✅ | ❌ |
| 交互式仪表板 | ✅ | ❌ | ✅ | ❌ |
| 多数据源聚合 | ✅ | ❌ | ✅ | ✅ |
| 开源免费 | ✅ | ✅ | ❌ | ✅ |

## 社区

- [GitHub Discussions](https://github.com/ldesign/security/discussions) - 提问和讨论
- [GitHub Issues](https://github.com/ldesign/security/issues) - 报告 Bug 和功能请求
- [贡献指南](./contributing) - 了解如何为项目做贡献

## 许可证

[MIT](https://github.com/ldesign/security/blob/main/LICENSE)
