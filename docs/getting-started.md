# 快速开始

欢迎使用 @ldesign/security！本指南将帮助您快速上手。

## 安装

### NPM
```bash
npm install -D @ldesign/security
```

### PNPM
```bash
pnpm add -D @ldesign/security
```

### Yarn
```bash
yarn add -D @ldesign/security
```

## 基础使用

### 1. 执行扫描

最简单的使用方式：

```bash
npx lsec scan
```

这将执行完整的安全扫描，包括：
- ✅ 依赖漏洞检测
- ✅ 敏感信息扫描
- ✅ 注入攻击检测
- ✅ 代码安全审计
- ✅ 许可证合规检查
- ✅ 供应链分析

### 2. 生成报告

```bash
npx lsec report --format html
```

这将生成一个美观的 HTML 报告，保存在 `./security-reports/` 目录。

### 3. 自动修复

如果发现可修复的漏洞：

```bash
npx lsec fix
```

## 配置

### 创建配置文件

```bash
npx lsec policy --init
```

这将创建 `.securityrc.json` 配置文件。

### 示例配置

```json
{
  "scan": {
    "exclude": ["**/node_modules/**", "**/dist/**"],
    "failOn": "high"
  },
  "license": {
    "whitelist": ["MIT", "Apache-2.0"],
    "blacklist": ["GPL-3.0"]
  },
  "reports": {
    "format": ["html", "json"],
    "output": "./security-reports"
  }
}
```

## 常用场景

### 场景 1：本地开发

```bash
# 快速检查
lsec check

# 修复问题
lsec fix

# 查看详细报告
lsec report --format html
```

### 场景 2：CI/CD 集成

```bash
# 在 CI 中运行
lsec ci --fail-on high --sarif
```

### 场景 3：定期监控

```bash
# 启动定时扫描（每天凌晨）
lsec monitor --cron "0 0 * * *"
```

### 场景 4：多项目管理

```bash
# 扫描所有项目
lsec projects --scan-all
```

## API 使用

```typescript
import { SecurityScanner } from '@ldesign/security'

const scanner = new SecurityScanner({ projectDir: './' })
const result = await scanner.scan()

console.log(`风险等级: ${result.riskLevel}`)
console.log(`总问题数: ${result.summary.totalIssues}`)
```

## 下一步

- 📖 查看 [配置指南](./configuration.md)
- 📖 查看 [CLI 参考](./cli-reference.md)
- 📖 查看 [最佳实践](./best-practices.md)
- 📖 查看 [API 文档](../api/)

