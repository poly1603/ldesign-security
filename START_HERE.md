# 🎯 START HERE - 从这里开始

<div align="center">

**欢迎使用 @ldesign/security v2.0！**

🔒 企业级安全工具 • 35+功能模块 • 7种报告格式 • 11个CLI命令

</div>

---

## 🚀 3分钟快速开始

### 1. 安装（30秒）
```bash
pnpm add -D @ldesign/security
```

### 2. 扫描（1分钟）
```bash
npx lsec scan
```

### 3. 查看报告（1分钟）
```bash
npx lsec report --format html
```

打开 `./security-reports/*.html` 查看详细报告！

---

## 📚 文档导航

### 🎓 新手入门（必读）
1. **[README.md](./README.md)** - 项目概述和基础使用
2. **[快速开始](./docs/getting-started.md)** - 详细的入门指南
3. **[最佳实践](./docs/best-practices.md)** - 推荐的使用方式

### ⚙️ 进阶配置
4. **[配置指南](./docs/configuration.md)** - 所有配置选项详解
5. **[CLI 参考](./docs/cli-reference.md)** - 命令行工具完整参考

### 🎓 示例项目
6. **[基础扫描](./examples/basic-scan/)** - 最简单的使用示例
7. **[自定义规则](./examples/custom-rules/)** - 如何添加自定义规则
8. **[CI/CD集成](./examples/ci-integration/)** - 多平台CI集成

### 📊 项目文档
9. **[CHANGELOG](./CHANGELOG.md)** - 版本更新历史
10. **[项目总览](./PROJECT_OVERVIEW.md)** - 完整的项目结构
11. **[最终报告](./🏆_FINAL_SUCCESS_REPORT.md)** - 项目完成总结

---

## 🎯 常见使用场景

### 场景 1：本地开发 ✅
```bash
# 快速检查
lsec check

# 自动修复
lsec fix

# 查看报告
lsec report --format html
```

### 场景 2：CI/CD 集成 ✅
```bash
# GitHub Actions
lsec ci --fail-on high --sarif

# GitLab CI
lsec ci --fail-on high
```

### 场景 3：定期监控 ✅
```bash
# 每天扫描
lsec monitor --cron "0 0 * * *" --on-start
```

### 场景 4：多项目管理 ✅
```bash
# 扫描所有项目
lsec projects --scan-all

# 查看历史趋势
lsec history --trend
```

### 场景 5：Docker 部署 ✅
```bash
docker-compose up
```

---

## ✨ 核心功能速览

### 🔍 7大扫描模块
1. ✅ 多源漏洞检测（NPM + OSV）
2. ✅ 敏感信息扫描（15+模式）
3. ✅ 注入攻击检测（5种类型）
4. ✅ 代码安全审计
5. ✅ 许可证合规检查
6. ✅ 供应链安全分析
7. ✅ SBOM 生成

### 📊 7种报告格式
1. ✅ HTML（交互式）
2. ✅ JSON（结构化）
3. ✅ YAML（可读）
4. ✅ SARIF（GitHub）
5. ✅ PDF（专业）
6. ✅ Markdown（GitHub风格）
7. ✅ Excel（分析）

### 🚀 性能优化
1. ✅ 智能缓存（LRU）
2. ✅ 增量扫描（Git）
3. ✅ 并行处理（Worker）

### 🏢 企业功能
1. ✅ 历史记录和趋势分析
2. ✅ 多项目批量管理
3. ✅ 定时调度监控
4. ✅ 策略配置管理

---

## 💡 推荐学习路径

### 路径 1：快速上手（30分钟）
1. 阅读 [README.md](./README.md)
2. 运行 `lsec scan`
3. 查看 HTML 报告
4. 尝试 `lsec fix`

### 路径 2：深入学习（2小时）
1. 阅读 [快速开始](./docs/getting-started.md)
2. 阅读 [配置指南](./docs/configuration.md)
3. 尝试所有 CLI 命令
4. 运行示例项目

### 路径 3：进阶应用（1天）
1. 阅读 [最佳实践](./docs/best-practices.md)
2. 学习自定义规则
3. 集成到 CI/CD
4. 配置监控和通知

### 路径 4：专家级（持续）
1. 开发自定义插件
2. 扩展规则引擎
3. 贡献代码
4. 优化性能

---

## 🎁 特色功能

### ⭐ 多源漏洞聚合
业界首个同时集成 NPM Audit 和 OSV 的工具

### ⚡ 智能缓存系统
LRU 策略 + 文件哈希 + 持久化，性能提升 50%+

### 📈 Git 增量扫描
只扫描变更文件，大型项目友好

### 📊 完整的历史追踪
趋势分析、基线对比、数据导出

### 🔌 强大的扩展性
插件系统 + 自定义规则 + OWASP Top 10

### 🌍 国际化支持
中文、English、日本語

---

## 🆘 需要帮助？

### 快速帮助
- 📖 查看 [快速开始](./docs/getting-started.md)
- 💻 查看 [CLI 参考](./docs/cli-reference.md)
- 🎓 查看 [示例项目](./examples/)

### 遇到问题？
1. 检查 [配置指南](./docs/configuration.md)
2. 查看 [最佳实践](./docs/best-practices.md)
3. 搜索 [问题列表](https://github.com/ldesign/ldesign/issues)
4. 提交新问题

### 想要贡献？
- 查看 CONTRIBUTING.md
- Fork 项目
- 提交 PR

---

## 📞 联系方式

- **GitHub**: https://github.com/ldesign/ldesign
- **文档**: https://ldesign.io/docs/security
- **问题**: https://github.com/ldesign/ldesign/issues
- **邮箱**: security@ldesign.io

---

## 🎉 立即体验

```bash
# 一行命令开始使用
npx @ldesign/security scan

# 查看所有命令
npx lsec --help

# 生成配置文件
npx lsec policy --init

# 生成美观报告
npx lsec report --format html
```

---

<div align="center">

**准备好了吗？让我们开始保护您的代码安全！** 🔒

[立即使用](./README.md) • [查看文档](./docs/) • [示例项目](./examples/)

---

**@ldesign/security v2.0.0**

*功能强大 • 简单易用 • 企业级品质*

</div>

