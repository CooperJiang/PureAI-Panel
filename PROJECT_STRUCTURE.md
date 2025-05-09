# PureAI Panel 项目结构

本文档描述了 PureAI Panel 项目的文件和目录结构，帮助开发者快速理解项目组织方式。

## 目录结构

```
PureAI-Panel/
├── css/                    # 样式文件
│   ├── base.css            # 基础样式、变量和主题定义
│   ├── chat-message.css    # 聊天消息相关样式
│   └── modules/            # 各功能模块样式
│       ├── animations.css  # 动画相关样式
│       ├── code-block.css  # 代码块样式
│       ├── markdown.css    # Markdown 渲染样式
│       └── modal.css       # 模态框和弹窗样式
├── js/                     # JavaScript 文件
│   ├── api.js              # API 接口和请求处理
│   ├── app.js              # 应用主入口
│   ├── components/         # UI 组件
│   │   ├── ChatMessage.js  # 聊天消息组件
│   │   ├── HtmlPreview.js  # HTML 预览组件
│   │   ├── Settings.js     # 设置组件
│   │   └── Toast.js        # 通知提示组件
│   ├── ui/                 # UI 控制器
│   │   ├── ChatUI.js       # 聊天界面控制器
│   │   ├── CodeBlockManager.js # 代码块管理器
│   │   ├── MessageHandler.js   # 消息处理器
│   │   ├── SettingsUI.js   # 设置界面控制器
│   │   └── StreamManager.js # 流式响应管理器
│   └── utils.js            # 工具函数和格式化器
├── vendor/                 # 第三方库（可选）
│   ├── highlight/          # 代码高亮库
│   ├── marked/             # Markdown 解析库
│   └── fontawesome/        # 图标库
├── index.html              # 应用主页面
├── favicon.ico             # 网站图标
├── README.md               # 项目说明
├── LICENSE                 # 开源协议
├── .gitignore              # Git 忽略文件
└── PROJECT_STRUCTURE.md    # 本文件，项目结构说明
```

## 主要文件说明

### 前端入口

- `index.html`: 应用主页面，包含基本 HTML 结构和脚本/样式引用

### CSS 文件

- `css/base.css`: 定义颜色变量、基础样式和主题（亮色/暗色）
- `css/chat-message.css`: 聊天界面和消息气泡的样式
- `css/modules/animations.css`: 各种动画效果，包括光标闪烁、过渡效果等
- `css/modules/code-block.css`: 代码块显示和交互相关样式
- `css/modules/markdown.css`: Markdown 内容渲染样式
- `css/modules/modal.css`: 模态框、对话框和设置面板样式

### JavaScript 文件

- `js/api.js`: 处理与后端 API 的通信，包括发送消息和获取响应
- `js/app.js`: 应用初始化和全局状态管理
- `js/utils.js`: 工具函数，包括 Markdown 解析、代码格式化等

#### 组件 (js/components/)

- `ChatMessage.js`: 聊天消息组件，负责消息的渲染和交互
- `HtmlPreview.js`: HTML 预览组件，用于实时预览 HTML 代码
- `Settings.js`: 设置组件，管理用户配置
- `Toast.js`: 通知提示组件，显示操作反馈

#### UI 控制器 (js/ui/)

- `ChatUI.js`: 整体聊天界面控制器，协调各组件
- `CodeBlockManager.js`: 代码块管理器，处理代码高亮和交互
- `MessageHandler.js`: 消息处理器，管理消息的创建和更新
- `SettingsUI.js`: 设置界面控制器，管理设置界面
- `StreamManager.js`: 流式响应管理器，处理流式文本动画

## 数据流

1. 用户输入消息 → ChatUI.js
2. ChatUI.js → api.js 发送请求
3. api.js 接收流式响应 → StreamManager.js
4. StreamManager.js 更新 UI → MessageHandler.js
5. MessageHandler.js 渲染消息 → ChatMessage.js
6. 代码块渲染 → CodeBlockManager.js

## 扩展指南

### 添加新主题

1. 在 `css/base.css` 中添加新的颜色变量
2. 创建新的主题切换逻辑，参考现有的亮色/暗色切换实现

### 添加新的 API 服务

1. 在 `js/api.js` 中添加新的 API 客户端
2. 在 `js/components/Settings.js` 中添加相应的配置选项
3. 更新 UI 和选择逻辑

### 添加新功能

1. 在适当的 CSS 模块中添加相关样式
2. 根据需要创建新的组件或更新现有组件
3. 在 UI 控制器中添加相应的逻辑
4. 更新主页面以包含新功能 