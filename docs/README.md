# @ldesign/security 文档

这是 @ldesign/security 的完整文档站点。

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run docs:dev

# 构建文档
npm run docs:build

# 预览构建结果
npm run docs:preview
```

## 文档结构

```
docs/
├── .vitepress/
│   └── config.ts         # VitePress 配置
├── guide/                # 指南
│   ├── introduction.md   # 介绍
│   ├── getting-started.md # 快速开始
│   ├── concepts.md       # 核心概念
│   └── ...
├── config/               # 配置
│   ├── options.md        # 配置选项
│   └── ...
├── api/                  # API 参考
│   ├── scanner.md        # SecurityScanner
│   └── ...
├── cli/                  # CLI 命令
│   ├── commands.md       # 命令概览
│   └── ...
├── integrations/         # 集成
│   ├── overview.md       # 集成概览
│   └── ...
└── index.md              # 首页
```

## 贡献文档

欢迎贡献文档！请参考 [贡献指南](../CONTRIBUTING.md)。

### 文档规范

- 使用 Markdown 格式
- 代码示例使用语法高亮
- 提供完整可运行的示例
- 保持简洁清晰
- 使用中文

### 添加新页面

1. 在相应目录创建 `.md` 文件
2. 在 `.vitepress/config.ts` 中添加导航和侧边栏配置
3. 确保链接正确
4. 本地预览检查

## 许可证

[MIT](../LICENSE)
