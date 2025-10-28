import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '@ldesign/security',
  description: '企业级 Node.js 安全扫描工具',
  base: '/security/',
  
  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: '指南', link: '/guide/introduction' },
      { text: '配置', link: '/config/options' },
      { text: 'API', link: '/api/scanner' },
      { text: 'CLI', link: '/cli/commands' },
      { text: '集成', link: '/integrations/overview' },
      {
        text: 'v2.0.0',
        items: [
          { text: '更新日志', link: '/changelog' },
          { text: '贡献指南', link: '/contributing' }
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '介绍', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '核心概念', link: '/guide/concepts' },
            { text: '最佳实践', link: '/guide/best-practices' }
          ]
        },
        {
          text: '功能',
          items: [
            { text: '漏洞扫描', link: '/guide/vulnerability-scanning' },
            { text: '代码审计', link: '/guide/code-audit' },
            { text: '敏感信息检测', link: '/guide/sensitive-detection' },
            { text: '注入攻击检测', link: '/guide/injection-detection' },
            { text: '加密安全检查', link: '/guide/crypto-analysis' },
            { text: 'API 安全检查', link: '/guide/api-security' },
            { text: '容器安全', link: '/guide/container-security' },
            { text: '合规检查', link: '/guide/compliance' }
          ]
        },
        {
          text: '高级功能',
          items: [
            { text: '持续监控', link: '/guide/continuous-monitoring' },
            { text: '智能修复', link: '/guide/smart-fixing' },
            { text: '对比分析', link: '/guide/comparison' },
            { text: '交互式仪表板', link: '/guide/dashboard' },
            { text: '多项目管理', link: '/guide/multi-project' }
          ]
        }
      ],
      
      '/config/': [
        {
          text: '配置',
          items: [
            { text: '配置选项', link: '/config/options' },
            { text: '扫描配置', link: '/config/scan' },
            { text: '报告配置', link: '/config/reports' },
            { text: '策略配置', link: '/config/policies' },
            { text: '通知配置', link: '/config/notifications' },
            { text: '集成配置', link: '/config/integrations' }
          ]
        }
      ],
      
      '/api/': [
        {
          text: 'API 参考',
          items: [
            { text: 'SecurityScanner', link: '/api/scanner' },
            { text: 'VulnerabilityChecker', link: '/api/vulnerability-checker' },
            { text: 'CryptoAnalyzer', link: '/api/crypto-analyzer' },
            { text: 'APISecurityChecker', link: '/api/api-security-checker' },
            { text: 'SmartFixer', link: '/api/smart-fixer' },
            { text: 'ComplianceChecker', link: '/api/compliance-checker' },
            { text: 'ContinuousMonitor', link: '/api/continuous-monitor' },
            { text: 'ContainerScanner', link: '/api/container-scanner' }
          ]
        },
        {
          text: '报告器',
          items: [
            { text: 'HTMLReporter', link: '/api/html-reporter' },
            { text: 'ComparisonReporter', link: '/api/comparison-reporter' },
            { text: '其他报告器', link: '/api/other-reporters' }
          ]
        },
        {
          text: '集成',
          items: [
            { text: 'GitPlatformIntegration', link: '/api/git-platform' },
            { text: 'SecurityDataSources', link: '/api/data-sources' },
            { text: 'InteractiveDashboard', link: '/api/dashboard' }
          ]
        }
      ],
      
      '/cli/': [
        {
          text: 'CLI 命令',
          items: [
            { text: '命令概览', link: '/cli/commands' },
            { text: 'scan', link: '/cli/scan' },
            { text: 'check', link: '/cli/check' },
            { text: 'fix', link: '/cli/fix' },
            { text: 'watch', link: '/cli/watch' },
            { text: 'dashboard', link: '/cli/dashboard' },
            { text: 'compare', link: '/cli/compare' },
            { text: 'compliance', link: '/cli/compliance' },
            { text: 'report', link: '/cli/report' },
            { text: 'ci', link: '/cli/ci' }
          ]
        }
      ],
      
      '/integrations/': [
        {
          text: '集成',
          items: [
            { text: '集成概览', link: '/integrations/overview' },
            { text: 'GitHub Actions', link: '/integrations/github-actions' },
            { text: 'GitLab CI', link: '/integrations/gitlab-ci' },
            { text: 'Jenkins', link: '/integrations/jenkins' },
            { text: 'VS Code', link: '/integrations/vscode' },
            { text: 'Webhooks', link: '/integrations/webhooks' },
            { text: 'Slack', link: '/integrations/slack' },
            { text: 'Git Hooks', link: '/integrations/git-hooks' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ldesign/security' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 LDesign Team'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/ldesign/security/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    }
  },

  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  }
})
