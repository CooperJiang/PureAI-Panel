// 工具类模块
import { Toast } from '../components/Toast.js';
import { HtmlPreview } from '../components/HtmlPreview.js';

// 消息格式化工具
export class MessageFormatter {
    constructor() {
        this.codeBlockPattern = /```(\w+)?\s*([\s\S]*?)```/g;
        this.inlineCodePattern = /`([^`]+)`/g;
        this.toast = new Toast();
        this.htmlPreview = new HtmlPreview();
    }
    
    // 格式化消息
    formatMessage(message) {
        if (!message) return '';
        
        // 如果有marked库可用，使用marked进行Markdown解析
        // @ts-ignore
        if (typeof marked !== 'undefined') {
            try {
                // 设置marked选项，确保代码块被正确处理
                // @ts-ignore
                marked.setOptions({
                    highlight: function(code, lang) {
                        // @ts-ignore
                        if (lang && hljs && hljs.getLanguage(lang)) {
                            // @ts-ignore
                            return hljs.highlight(code, { language: lang }).value;
                        }
                        // @ts-ignore
                        return hljs ? hljs.highlightAuto(code).value : code;
                    },
                    breaks: true,
                    gfm: true
                });
                
                // 使用marked解析Markdown
                // @ts-ignore
                let htmlContent = marked.parse(message);
                
                // 对代码块添加复制按钮
                htmlContent = this.addCopyButtonsToMarkdown(htmlContent);
                
                return htmlContent;
            } catch (e) {
                console.error('Markdown解析错误:', e);
                // 如果解析失败，回退到基本格式化
                return this.basicFormatting(message);
            }
        } else {
            // 如果没有marked库，使用基本格式化
            return this.basicFormatting(message);
        }
    }
    
    // 基本文本格式化（不使用Markdown库时的后备方案）
    basicFormatting(message) {
        // 处理代码块
        message = this.formatCodeBlocks(message);
        
        // 处理内联代码
        message = this.formatInlineCode(message);
        
        // 处理换行
        message = message.replace(/\n/g, '<br>');
        
        return message;
    }
    
    // 格式化代码块
    formatCodeBlocks(message) {
        return message.replace(this.codeBlockPattern, (match, lang, code) => {
            const language = lang || 'plaintext';
            const formattedCode = this.escapeHtml(code.trim());
            const uniqueId = 'code-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            
            // 处理HTML代码块，添加预览按钮
            if (language.toLowerCase() === 'html' || language.toLowerCase() === 'htm') {
                return `
                    <div class="code-block">
                        <div class="code-header">
                            <span>${language}</span>
                            <div class="flex">
                                <button class="wrap-button" data-code-id="${uniqueId}" title="切换换行">
                                    <i class="fas fa-text-width"></i>
                                    <span>换行</span>
                                </button>
                                <button class="preview-button mr-2" data-code-id="${uniqueId}" title="预览HTML">
                                    <i class="fas fa-eye"></i>
                                    <span>预览</span>
                                </button>
                                <button class="copy-button" data-code-id="${uniqueId}">
                                    <i class="fas fa-copy"></i>
                                    <span>复制</span>
                                </button>
                            </div>
                        </div>
                        <pre><code id="${uniqueId}" class="language-${language}">${formattedCode}</code></pre>
                    </div>
                `;
            }
            
            // 普通代码块
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span>${language}</span>
                        <div class="flex">
                            <button class="wrap-button" data-code-id="${uniqueId}" title="切换换行">
                                <i class="fas fa-text-width"></i>
                                <span>换行</span>
                            </button>
                            <button class="copy-button" data-code-id="${uniqueId}">
                                <i class="fas fa-copy"></i>
                                <span>复制</span>
                            </button>
                        </div>
                    </div>
                    <pre><code id="${uniqueId}" class="language-${language}">${formattedCode}</code></pre>
                </div>
            `;
        });
    }
    
    // 格式化内联代码
    formatInlineCode(message) {
        return message.replace(this.inlineCodePattern, (match, code) => {
            return `<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">${this.escapeHtml(code)}</code>`;
        });
    }
    
    // 为Markdown生成的代码块添加复制按钮
    addCopyButtonsToMarkdown(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // 查找所有pre>code元素
        const codeBlocks = tempDiv.querySelectorAll('pre > code');
        
        codeBlocks.forEach((codeBlock, index) => {
            const pre = codeBlock.parentElement;
            if (!pre) return;
            
            // 检查是否已经被处理过
            if (pre.parentElement && pre.parentElement.classList.contains('code-block')) {
                return;
            }
            
            // 提取语言类
            let language = 'plaintext';
            const classNames = codeBlock.className.split(' ');
            for (const className of classNames) {
                if (className.startsWith('language-')) {
                    language = className.replace('language-', '');
                    break;
                }
            }
            
            // 生成唯一ID
            const uniqueId = `code-md-${Date.now()}-${index}`;
            codeBlock.id = uniqueId;
            
            // 创建代码块容器
            const codeBlockDiv = document.createElement('div');
            codeBlockDiv.className = 'code-block';
            
            // 创建代码块头部
            const headerDiv = document.createElement('div');
            headerDiv.className = 'code-header';
            
            // 判断是否为HTML代码
            if (language.toLowerCase() === 'html' || language.toLowerCase() === 'htm') {
                headerDiv.innerHTML = `
                    <span>${language}</span>
                    <div class="flex">
                        <button class="wrap-button" data-code-id="${uniqueId}" title="切换换行">
                            <i class="fas fa-text-width"></i>
                            <span>换行</span>
                        </button>
                        <button class="preview-button mr-2" data-code-id="${uniqueId}" title="预览HTML">
                            <i class="fas fa-eye"></i>
                            <span>预览</span>
                        </button>
                        <button class="copy-button" data-code-id="${uniqueId}">
                            <i class="fas fa-copy"></i>
                            <span>复制</span>
                        </button>
                    </div>
                `;
            } else {
                headerDiv.innerHTML = `
                    <span>${language}</span>
                    <div class="flex">
                        <button class="wrap-button" data-code-id="${uniqueId}" title="切换换行">
                            <i class="fas fa-text-width"></i>
                            <span>换行</span>
                        </button>
                        <button class="copy-button" data-code-id="${uniqueId}">
                            <i class="fas fa-copy"></i>
                            <span>复制</span>
                        </button>
                    </div>
                `;
            }
            
            // 替换原始pre元素
            pre.parentNode?.insertBefore(codeBlockDiv, pre);
            codeBlockDiv.appendChild(headerDiv);
            codeBlockDiv.appendChild(pre);
        });
        
        return tempDiv.innerHTML;
    }
    
    // HTML转义
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // 添加代码块复制和预览按钮
    addCodeInteractionButtons() {
        // 确保Toast实例存在
        if (!this.toast) {
            this.toast = new Toast();
        }
        
        // 确保HtmlPreview实例存在
        if (!this.htmlPreview) {
            this.htmlPreview = new HtmlPreview();
        }
        
        // 添加复制按钮功能
        this.addCopyButtonsToCodeBlocks();
        
        // 添加预览按钮功能
        this.addPreviewButtonsToHtmlBlocks();
        
        // 添加换行按钮功能
        this.addWrapButtonsToCodeBlocks();
    }
    
    // 添加代码块复制按钮
    addCopyButtonsToCodeBlocks() {
        document.querySelectorAll('.copy-button').forEach(button => {
            if (button.getAttribute('data-listener') === 'true') return; // 避免重复添加事件监听
            
            button.setAttribute('data-listener', 'true');
            button.addEventListener('click', () => {
                const codeId = button.getAttribute('data-code-id');
                const codeElement = document.getElementById(codeId);
                
                if (codeElement) {
                    // 获取未格式化的代码
                    const code = codeElement.textContent || '';
                    
                    // 复制到剪贴板
                    navigator.clipboard.writeText(code).then(() => {
                        // 显示Toast提示，而不是更改按钮内容
                        this.toast.success('代码已复制到剪贴板');
                        
                        // 添加按钮短暂的视觉反馈
                        // @ts-ignore - 忽略HTMLElement的style类型检查
                        const originalColor = button.style.color;
                        // @ts-ignore - 忽略HTMLElement的style类型检查
                        button.style.color = 'var(--openai-green, #10a37f)';
                        setTimeout(() => {
                            // @ts-ignore - 忽略HTMLElement的style类型检查
                            button.style.color = originalColor;
                        }, 300);
                    }).catch(err => {
                        console.error('无法复制代码: ', err);
                        this.toast.error('复制失败，请重试');
                    });
                }
            });
        });
    }
    
    // 添加HTML预览按钮
    addPreviewButtonsToHtmlBlocks() {
        document.querySelectorAll('.preview-button').forEach(button => {
            if (button.getAttribute('data-listener') === 'true') return; // 避免重复添加事件监听
            
            button.setAttribute('data-listener', 'true');
            
            // 添加预览按钮样式
            // @ts-ignore - 忽略HTMLElement的style类型检查
            button.style.background = 'none';
            // @ts-ignore - 忽略HTMLElement的style类型检查
            button.style.border = 'none';
            // @ts-ignore - 忽略HTMLElement的style类型检查
            button.style.color = '#6366f1';
            // @ts-ignore - 忽略HTMLElement的style类型检查
            button.style.cursor = 'pointer';
            // @ts-ignore - 忽略HTMLElement的style类型检查
            button.style.fontSize = '0.75rem';
            // @ts-ignore - 忽略HTMLElement的style类型检查
            button.style.padding = '0';
            // @ts-ignore - 忽略HTMLElement的style类型检查
            button.style.display = 'flex';
            // @ts-ignore - 忽略HTMLElement的style类型检查
            button.style.alignItems = 'center';
            // @ts-ignore - 忽略HTMLElement的style类型检查
            button.style.gap = '0.25rem';
            
            button.addEventListener('click', () => {
                const codeId = button.getAttribute('data-code-id');
                const codeElement = document.getElementById(codeId);
                
                if (codeElement) {
                    const htmlCode = codeElement.textContent || '';
                    if (htmlCode.trim()) {
                        this.htmlPreview.showPreview(htmlCode);
                    }
                }
            });
        });
    }
    
    // 添加代码换行切换按钮
    addWrapButtonsToCodeBlocks() {
        // 查找所有换行按钮
        const wrapButtons = document.querySelectorAll('.wrap-button');
        
        wrapButtons.forEach(button => {
            if (!(button instanceof HTMLElement)) return;
            
            // 移除现有事件监听器
            button.replaceWith(button.cloneNode(true));
            const newButton = document.querySelector(`.wrap-button[data-code-id="${button.dataset.codeId}"]`);
            
            if (newButton && newButton instanceof HTMLElement) {
                newButton.addEventListener('click', () => {
                    const codeId = newButton.dataset.codeId;
                    const codeElement = document.getElementById(codeId);
                    
                    if (codeElement) {
                        // 获取代码块容器
                        const codeBlock = codeElement.closest('.code-block');
                        
                        if (codeBlock) {
                            // 切换换行类
                            codeBlock.classList.toggle('wrap-code');
                            
                            // 更新按钮状态
                            const isWrapped = codeBlock.classList.contains('wrap-code');
                            const btnText = newButton.querySelector('span');
                            if (btnText) {
                                btnText.textContent = isWrapped ? '不换行' : '换行';
                            }
                            
                            // 更新图标
                            const btnIcon = newButton.querySelector('i');
                            if (btnIcon) {
                                btnIcon.className = isWrapped ? 'fas fa-align-left' : 'fas fa-text-width';
                            }
                        }
                    }
                });
            }
        });
    }
} 