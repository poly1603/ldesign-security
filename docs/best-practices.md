# 最佳实践

本文档提供使用 @ldesign/security 的最佳实践和建议。

## 扫描策略

### 1. 定期扫描

建议每天至少扫描一次：

```bash
# 设置定时任务
lsec monitor --cron "0 0 * * *" --on-start
```

### 2. CI/CD 集成

在每次 PR 和主分支提交时运行扫描：

```yaml
# .github/workflows/security.yml
on: [push, pull_request]
jobs:
  security:
    steps:
      - run: lsec ci --fail-on high --sarif
```

### 3. 增量扫描

对于大型项目，使用增量扫描提升速度：

```typescript
import { IncrementalScanner } from '@ldesign/security'

const scanner = new IncrementalScanner()
const result = await scanner.scanIncremental({
  since: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
})
```

## 安全配置

### 1. 严格的失败阈值

在生产环境使用严格的失败阈值：

```json
{
  "scan": {
    "failOn": "medium"
  }
}
```

### 2. 许可证白名单

明确指定允许的许可证：

```json
{
  "license": {
    "whitelist": ["MIT", "Apache-2.0", "BSD-3-Clause"],
    "allowUnknown": false
  }
}
```

### 3. 排除测试文件

避免扫描测试文件中的示例代码：

```json
{
  "scan": {
    "exclude": [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/tests/**",
      "**/__tests__/**"
    ]
  }
}
```

## 报告管理

### 1. 多格式报告

生成多种格式的报告：

```bash
lsec report --format html,json,markdown,sarif
```

### 2. 报告存档

保留历史报告用于对比：

```bash
lsec report --output ./security-reports/$(date +%Y-%m-%d)
```

### 3. 趋势分析

定期查看趋势分析：

```bash
lsec history --trend
```

## 性能优化

### 1. 使用缓存

启用缓存加速重复扫描：

```typescript
import { CacheManager } from '@ldesign/security'

const cache = new CacheManager()
// 缓存会自动工作
```

### 2. 并行扫描

对于monorepo，使用多项目并行扫描：

```bash
lsec projects --scan-all
```

### 3. 跳过不需要的扫描

按需跳过某些扫描模块：

```bash
lsec scan --skip-code --skip-license
```

## 通知配置

### 1. 只通知严重问题

```json
{
  "notifications": {
    "enabled": true,
    "slack": {
      "webhookUrl": "https://hooks.slack.com/...",
      "severityFilter": ["critical", "high"]
    }
  }
}
```

### 2. 多渠道通知

配置多个通知渠道：

```json
{
  "notifications": {
    "enabled": true,
    "slack": { ... },
    "dingtalk": { ... },
    "webhook": { ... }
  }
}
```

## 团队协作

### 1. 共享配置

将 `.securityrc.json` 提交到 Git：

```bash
git add .securityrc.json
git commit -m "Add security scanning configuration"
```

### 2. 基线管理

设置安全基线：

```typescript
const scanner = new IncrementalScanner()
const result = await scanner.scan()
await scanner.saveBaseline(result)
```

### 3. 定期审查

建议每周审查安全报告：

```bash
# 查看最近7天的扫描历史
lsec history --limit 7
```

## 常见问题

### Q: 扫描速度慢怎么办？

A: 使用增量扫描和缓存：
```bash
lsec scan --skip-code  # 跳过代码审计
```

### Q: 如何减少误报？

A: 调整排除规则：
```json
{
  "scan": {
    "exclude": [
      "**/examples/**",
      "**/demo/**"
    ]
  }
}
```

### Q: 如何集成到现有工作流？

A: 使用 package.json scripts：
```json
{
  "scripts": {
    "security": "lsec scan",
    "security:fix": "lsec fix",
    "security:report": "lsec report --format html"
  }
}
```

## 安全建议

1. **立即修复 Critical 问题**
2. **一周内修复 High 问题**
3. **一个月内修复 Medium 问题**
4. **定期审查 Low 问题**
5. **保持依赖更新**
6. **定期更新安全工具**
7. **团队安全培训**
8. **建立安全响应流程**

## 更多资源

- [配置指南](./configuration.md)
- [CLI 参考](./cli-reference.md)
- [故障排查](./troubleshooting.md)
- [示例项目](../examples/)

