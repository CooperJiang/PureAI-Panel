# PureAI Panel CSS模块化重构

## 概述

为了提高代码的可维护性和组织性，我们将原有的单一`style.css`文件拆分为多个模块化的CSS文件。每个组件和功能区域现在都有自己的CSS文件，使样式更易于维护和更新。

## 文件结构

CSS文件夹现在包含以下文件：

- **main.css**: 主CSS文件，负责导入所有其他CSS模块
- **base.css**: 基础样式，包含通用元素、动画和变量
- **layout.css**: 页面布局和响应式设计
- **chat-message.css**: 聊天消息组件样式
- **markdown.css**: Markdown内容渲染样式
- **code-block.css**: 代码块和代码高亮样式
- **sidebar.css**: 侧边栏和对话列表样式
- **modals.css**: 各种模态窗口的样式
- **buttons.css**: 按钮和交互元素
- **model-dropdown.css**: 模型选择下拉菜单样式

## 使用方式

现在只需在HTML中引入`main.css`文件即可，该文件会通过`@import`指令自动加载所有其他CSS模块：

```html
<link rel="stylesheet" href="css/main.css">
```

## 模块说明

### base.css
包含基本样式设置，如滚动条、动画、颜色变量等通用元素。这些样式适用于整个应用程序。

### layout.css
定义主要的页面布局结构，包括响应式设计的媒体查询和调整。

### chat-message.css
包含聊天消息的所有样式，包括消息气泡、用户头像定位、消息操作按钮等。

### markdown.css
定义Markdown渲染的样式，包括标题、段落、列表、表格和链接的格式。

### code-block.css
代码块的样式，包括语法高亮、代码块头部、复制按钮等。

### sidebar.css
侧边栏的样式，包括对话列表、置顶对话、边栏折叠等功能。

### modals.css
各种模态窗口的样式，包括设置模态窗口、图片查看器、HTML预览等。

### buttons.css
定义各种按钮和控制元素的样式，包括普通按钮、图标按钮等。

### model-dropdown.css
模型选择下拉菜单的样式，包括列表项、选中状态等。

## 主题支持

所有CSS模块都支持亮色和暗色主题。暗色主题在所有文件中通过`[data-theme="dark"]`选择器实现。

## 维护和扩展

- 修改特定组件样式时，只需编辑相应的CSS文件
- 添加新组件时，可以创建新的CSS文件并在main.css中导入
- 全局样式更改应在base.css中进行

通过这种模块化方法，我们显著提高了代码的可维护性和可读性，同时保持了所有现有功能的完整性。 