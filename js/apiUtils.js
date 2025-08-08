// API工具方法集合

/**
 * 获取最近一次请求的token用量
 * @param {Object} lastTokenUsage
 * @returns {Object|null}
 */
export function getLastTokenUsage(lastTokenUsage) {
    return lastTokenUsage;
}

/**
 * 格式化消息数组为API所需格式
 * @param {Array} messages
 * @returns {Array}
 */
export function formatMessages(messages) {
    if (!messages || messages.length === 0) {
        return [];
    }
    return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata
    }));
}

/**
 * 尝试修复不完整的JSON数据
 * @param {string} jsonStr
 * @returns {Object} - {success, data, error}
 */
export function tryFixJson(jsonStr) {
    let fixedJson = jsonStr;
    let result = { success: false, data: null, error: null };
    try {
        const data = JSON.parse(jsonStr);
        return { success: true, data, error: null };
    } catch (e) {}
    try {
        if (jsonStr.endsWith('"') && !jsonStr.endsWith('}"')) {
            fixedJson = jsonStr + '}';
            const data = JSON.parse(fixedJson);
            return { success: true, data, error: null };
        }
    } catch (e) {}
    try {
        if (!jsonStr.endsWith('}') && jsonStr.includes(':{')) {
            fixedJson = jsonStr + '}}';
            const data = JSON.parse(fixedJson);
            return { success: true, data, error: null };
        }
    } catch (e) {}
    try {
        if (!jsonStr.startsWith('{')) {
            const startIdx = jsonStr.indexOf('{');
            if (startIdx > 0) {
                fixedJson = jsonStr.substring(startIdx);
                if (!fixedJson.endsWith('}')) {
                    fixedJson = fixedJson + '}';
                }
                const data = JSON.parse(fixedJson);
                return { success: true, data, error: null };
            }
        }
    } catch (e) {}
    result.error = new Error('无法修复JSON数据');
    return result;
}

/**
 * 处理流式消息，确保HTML代码块被完整捕获
 * @param {string} content
 * @returns {string}
 */
export function processHtmlCodeBlocks(content) {
    if (!content) return content;
    if (content.includes('```html') || content.includes('```htm')) {
        const htmlBlockStarts = content.match(/```html|```htm/g) || [];
        const htmlBlockEnds = content.match(/```\s*(?:$|[\r\n])/g) || [];
        if (htmlBlockStarts.length > htmlBlockEnds.length) {
            return content;
        }
    }
    return content;
}

/**
 * 安全处理SSE数据行
 * @param {string} line
 * @param {Function} onContent
 * @param {Object} context - { _isInReasoningMode }
 * @returns {boolean}
 */
export function processSSELine(line, onContent, context) {
    if (!line.trim()) return false;
    if (!line.startsWith('data: ')) return false;
    if (line === 'data: [DONE]') {
        if (context && context._isInReasoningMode) {
            onContent && onContent('</think>');
            context._isInReasoningMode = false;
        }
        return true;
    }
    try {
        const messageData = extractMessageData(line);
        if (!messageData) return false;
        const { content, isFunctionCall, isThinking } = messageData;
        if (isThinking && !context._isInReasoningMode) {
            context._isInReasoningMode = true;
            onContent && onContent('<think>' + content);
            return true;
        } else if (isThinking && context._isInReasoningMode) {
            onContent && onContent(content);
            return true;
        } else if (context._isInReasoningMode && !isThinking) {
            onContent && onContent('</think>' + content);
            context._isInReasoningMode = false;
            return true;
        }
        const processedContent = processHtmlCodeBlocks(content);
        if (isFunctionCall) {
            onContent && onContent(content);
        } else if (processedContent) {
            onContent && onContent(processedContent);
        }
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * 从API响应行中提取消息数据
 * @param {string} line
 * @returns {Object|null}
 */
export function extractMessageData(line) {
    const jsonStr = line.substring(6);
    let parseResult;
    try {
        const data = JSON.parse(jsonStr);
        parseResult = { success: true, data, error: null };
    } catch (jsonError) {
        parseResult = tryFixJson(jsonStr);
    }
    if (!parseResult.success) {
        return null;
    }
    let content = parseResult.data.choices?.[0]?.delta?.content || '';
    const functionCall = parseResult.data.choices?.[0]?.delta?.function_call;
    const isFunctionCall = !!functionCall;
    const reasoningContent = parseResult.data.choices?.[0]?.delta?.reasoning_content || '';
    const isThinking = !!reasoningContent;
    if (reasoningContent) {
        content = reasoningContent;
    }
    if (isFunctionCall) {
        const functionName = functionCall.name || '';
        const functionArgs = functionCall.arguments || '{}';
        content = functionName ? `<function-call name="${functionName}">${functionArgs}</function-call>` : content;
    }
    return {
        content,
        isFunctionCall,
        isThinking,
        raw: parseResult.data
    };
}

/**
 * 整理上下文消息，返回用于API请求的消息数组
 * @param {Array} messages - 全部消息
 * @param {Object} conversationManager - 对话管理器
 * @param {boolean} contextEnabled - 是否启用上下文
 * @returns {Array}
 */
export function getContextMessages(messages, conversationManager, contextEnabled) {
    let contextMessages = [];
    const shouldUseContext = contextEnabled === true || contextEnabled === 'true';
    if (shouldUseContext && conversationManager) {
        const afterBreakpoint = conversationManager.getMessagesAfterBreakpoint();
        contextMessages = Array.isArray(afterBreakpoint) ? afterBreakpoint : [];
    } else {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user' && messages[i].content !== '') {
                contextMessages = [messages[i]];
                break;
            }
        }
        if (conversationManager) {
            conversationManager.setContextBreakpoint();
        }
    }
    return contextMessages;
} 