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
        
        // 图片链接匹配正则表达式
        this.imagePattern = /!\[(.*?)\]\((https?:\/\/.*?\.(png|jpg|jpeg|gif|webp))\)/gi;
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
                        // 对于HTML代码块，不进行转义
                        if (lang === 'html' || lang === 'htm' || lang === 'xml') {
                            return code;
                        }
                        
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
        // 处理图片链接
        message = this.formatImageLinks(message);
        
        // 处理代码块
        message = this.formatCodeBlocks(message);
        
        // 处理内联代码
        message = this.formatInlineCode(message);
        
        // 处理换行
        message = message.replace(/\n/g, '<br>');
        
        return message;
    }
    
    // 格式化图片链接
    formatImageLinks(message) {
        return message.replace(this.imagePattern, (match, altText, url) => {
            return `<img src="${url}" alt="${altText || '图片'}" class="max-w-[520px]" loading="lazy">`;
        });
    }
    
    // 格式化代码块
    formatCodeBlocks(message) {
        return message.replace(this.codeBlockPattern, (match, lang, code) => {
            const language = lang || 'plaintext';
            
            // 对于HTML类型的代码块，不转义内容
            let formattedCode;
            if (language.toLowerCase() === 'html' || language.toLowerCase() === 'htm' || language.toLowerCase() === 'xml') {
                formattedCode = code.trim();
            } else {
                formattedCode = this.escapeHtml(code.trim());
            }
            
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
        
        // 处理图片预览
        this.setupImagePreviews();
    }
    
    // 设置图片预览功能
    setupImagePreviews() {
        try {
            // 检查全局ImageViewer实例是否存在
            const imageViewer = window['imageViewer'];
            if (imageViewer && typeof imageViewer.setupImagePreviews === 'function') {
                imageViewer.setupImagePreviews();
            }
        } catch (e) {
            console.error('设置图片预览功能失败:', e);
        }
    }
    
    // 添加代码块复制按钮
    addCopyButtonsToCodeBlocks() {
        document.querySelectorAll('.copy-button').forEach(button => {
            if (button.getAttribute('data-listener') === 'true') return; // 避免重复添加事件监听
            
            // 克隆按钮并替换，以移除所有现有事件监听器
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
                newButton.setAttribute('data-listener', 'true');
            } else {
                button.setAttribute('data-listener', 'true');
            }
            
            // 使用正确的按钮引用
            const buttonToUse = button.parentNode ? newButton : button;
            
            buttonToUse.addEventListener('click', () => {
                const codeId = buttonToUse.getAttribute('data-code-id');
                const codeElement = document.getElementById(codeId);
                
                if (codeElement) {
                    // 获取未格式化的代码
                    const code = codeElement.textContent || '';
                    
                    // 复制到剪贴板
                    navigator.clipboard.writeText(code).then(() => {
                        // 显示Toast提示，而不是更改按钮内容
                        this.toast.success('代码已复制到剪贴板');
                        
                        // 添加按钮短暂的视觉反馈
                        const originalColor = buttonToUse.style.color || '';
                        buttonToUse.style.color = 'var(--openai-green, #10a37f)';
                        setTimeout(() => {
                            buttonToUse.style.color = originalColor;
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
            
            // 克隆按钮并替换，以移除所有现有事件监听器
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
                newButton.setAttribute('data-listener', 'true');
            } else {
                button.setAttribute('data-listener', 'true');
            }
            
            // 使用正确的按钮引用
            const buttonToUse = button.parentNode ? newButton : button;
            
            // 添加预览按钮样式
            buttonToUse.style.background = 'none';
            buttonToUse.style.border = 'none';
            buttonToUse.style.color = '#6366f1';
            buttonToUse.style.cursor = 'pointer';
            buttonToUse.style.fontSize = '0.75rem';
            buttonToUse.style.padding = '0';
            buttonToUse.style.display = 'flex';
            buttonToUse.style.alignItems = 'center';
            buttonToUse.style.gap = '0.25rem';
            
            buttonToUse.addEventListener('click', () => {
                const codeId = buttonToUse.getAttribute('data-code-id');
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
        document.querySelectorAll('.wrap-button').forEach(button => {
            if (button.getAttribute('data-listener') === 'true') return; // 避免重复添加事件监听
            
            // 克隆按钮并替换，以移除所有现有事件监听器
            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
                newButton.setAttribute('data-listener', 'true');
            } else {
                button.setAttribute('data-listener', 'true');
            }
            
            // 使用正确的按钮引用
            const buttonToUse = button.parentNode ? newButton : button;
            
            buttonToUse.addEventListener('click', () => {
                const codeId = buttonToUse.getAttribute('data-code-id');
                const codeElement = document.getElementById(codeId);
                
                if (codeElement) {
                    // 获取代码块容器
                    const codeBlock = codeElement.closest('.code-block');
                    
                    if (codeBlock) {
                        // 切换换行类
                        const wasWrapped = codeBlock.classList.contains('wrap-code');
                        codeBlock.classList.toggle('wrap-code');
                        const isWrapped = codeBlock.classList.contains('wrap-code');
                        
                        console.log(`[代码块] 切换换行状态: ${wasWrapped ? '换行' : '不换行'} -> ${isWrapped ? '换行' : '不换行'}`);
                        
                        // 更新按钮状态
                        const btnText = buttonToUse.querySelector('span');
                        if (btnText) {
                            btnText.textContent = isWrapped ? '不换行' : '换行';
                            console.log(`[代码块] 更新按钮文本为: "${btnText.textContent}"`);
                        }
                        
                        // 更新图标
                        const btnIcon = buttonToUse.querySelector('i');
                        if (btnIcon) {
                            btnIcon.className = isWrapped ? 'fas fa-align-left' : 'fas fa-text-width';
                        }
                        
                        // 触发滚动事件以确保水平滚动条正确显示
                        setTimeout(() => {
                            // 触发resize事件以确保UI正确更新
                            window.dispatchEvent(new Event('resize'));
                            
                            // 重新应用代码高亮
                            if (typeof hljs !== 'undefined') {
                                try {
                                    hljs.highlightElement(codeElement);
                                    console.log(`[代码块] 重新应用代码高亮`);
                                } catch (e) {
                                    console.error('[代码块] 重新应用代码高亮失败:', e);
                                }
                            }
                        }, 50);
                    }
                }
            });
        });
    }
} 