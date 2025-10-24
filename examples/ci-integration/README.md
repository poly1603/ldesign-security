# CI/CD 集成示例

本示例展示如何在不同的 CI/CD 平台上集成 @ldesign/security。

## GitHub Actions

参考 `.github/workflows/security.yml` 文件。

### 基础配置

```yaml
name: Security Scan
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx @ldesign/security ci --fail-on high --sarif
      - uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: security-results.sarif
```

### 高级配置

- ✅ SARIF 上传到 GitHub Security
- ✅ PR 评论
- ✅ 报告artifact上传
- ✅ 定时扫描
- ✅ 失败阈值控制

## GitLab CI

创建 `.gitlab-ci.yml`:

```yaml
security_scan:
  stage: test
  image: node:18
  script:
    - npm ci
    - npx @ldesign/security ci --fail-on high
  artifacts:
    when: always
    reports:
      junit: security-results.sarif
    paths:
      - security-reports/
  only:
    - merge_requests
    - main
```

## Jenkins

创建 `Jenkinsfile`:

```groovy
pipeline {
  agent any
  
  stages {
    stage('Install') {
      steps {
        sh 'npm ci'
      }
    }
    
    stage('Security Scan') {
      steps {
        sh 'npx @ldesign/security ci --fail-on high --sarif'
      }
    }
    
    stage('Publish Report') {
      steps {
        publishHTML([
          reportDir: 'security-reports',
          reportFiles: '*.html',
          reportName: 'Security Report'
        ])
      }
    }
  }
  
  post {
    always {
      archiveArtifacts artifacts: 'security-reports/**'
    }
  }
}
```

## Azure DevOps

创建 `azure-pipelines.yml`:

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '18.x'
  
  - script: npm ci
    displayName: 'Install dependencies'
  
  - script: npx @ldesign/security ci --fail-on high --sarif
    displayName: 'Run security scan'
  
  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: 'security-reports'
      ArtifactName: 'security-reports'
```

## CircleCI

创建 `.circleci/config.yml`:

```yaml
version: 2.1

jobs:
  security-scan:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: npm ci
      - run:
          name: Run security scan
          command: npx @ldesign/security ci --fail-on high
      - store_artifacts:
          path: security-reports
          destination: security-reports

workflows:
  version: 2
  build:
    jobs:
      - security-scan
```

## Docker

使用 Docker 运行扫描：

```bash
docker run --rm \
  -v $(pwd):/workspace \
  -v $(pwd)/security-reports:/reports \
  ldesign/security:latest \
  scan --dir /workspace
```

## 本地测试

在提交前本地测试 CI 配置：

```bash
# 模拟 CI 环境
npx @ldesign/security ci --fail-on high --sarif
```

## 通知集成

### Slack 通知

在 GitHub Actions 中添加 Slack 通知：

```yaml
- name: Notify Slack
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: 'Security scan failed!'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 钉钉通知

```bash
# 在扫描后发送钉钉通知
lsec scan && curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"msgtype":"text","text":{"content":"Security scan completed"}}' \
  https://oapi.dingtalk.com/robot/send?access_token=XXX
```

## 最佳实践

1. **失败阈值** - 根据项目阶段设置合适的阈值
2. **并行运行** - 与其他测试并行运行节省时间
3. **缓存依赖** - 缓存 node_modules 加速CI
4. **定期扫描** - 除了PR触发，还要定时扫描
5. **报告存档** - 保存历史报告用于对比

## 故障排查

### CI 扫描失败

1. 检查 Node.js 版本（需要 16+）
2. 确保依赖已正确安装
3. 查看详细日志
4. 检查网络连接（OSV API）

### SARIF 上传失败

1. 确保有 `security-events: write` 权限
2. 检查 SARIF 文件是否生成
3. 验证 SARIF 格式

## 更多资源

- [GitHub Actions 文档](https://docs.github.com/actions)
- [GitLab CI 文档](https://docs.gitlab.com/ee/ci/)
- [Jenkins 文档](https://www.jenkins.io/doc/)

