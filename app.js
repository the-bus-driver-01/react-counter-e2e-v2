/**
 * Fake Claude API — Dashboard Application
 *
 * Vanilla JS client for testing and monitoring the local proxy server.
 * No build tools, no frameworks, no dependencies.
 */

(function () {
  'use strict';

  // ── DOM references ──────────────────────────────────────────────────────────

  const els = {
    statusBadge:   document.getElementById('status-badge'),
    baseUrl:       document.getElementById('base-url'),
    baseUrlInput:  document.getElementById('base-url-input'),
    serverStatus:  document.getElementById('server-status'),
    btnCheck:      document.getElementById('btn-check'),
    modelSelect:   document.getElementById('model-select'),
    streamToggle:  document.getElementById('stream-toggle'),
    maxTokens:     document.getElementById('max-tokens'),
    systemPrompt:  document.getElementById('system-prompt'),
    chatArea:      document.getElementById('chat-area'),
    chatEmpty:     document.getElementById('chat-empty'),
    userInput:     document.getElementById('user-input'),
    btnSend:       document.getElementById('btn-send'),
    btnClear:      document.getElementById('btn-clear'),
    logList:       document.getElementById('log-list'),
    logCount:      document.getElementById('log-count'),
  };

  // ── State ───────────────────────────────────────────────────────────────────

  /** @type {{ role: string, content: string }[]} */
  let conversationHistory = [];
  let requestLog = [];
  let sending = false;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getBaseUrl() {
    return els.baseUrlInput.value.replace(/\/+$/, '');
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour12: false });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Status Check ────────────────────────────────────────────────────────────

  async function checkStatus() {
    const base = getBaseUrl();
    els.statusBadge.textContent = 'Checking…';
    els.statusBadge.className = 'header__badge';
    els.serverStatus.textContent = 'Checking…';
    els.baseUrl.textContent = base;

    try {
      // The server responds 404 to GET / but that still proves it's alive
      const resp = await fetch(base + '/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'fake-key', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      // Any response (even 500) means server is running
      els.statusBadge.textContent = 'Online';
      els.statusBadge.className = 'header__badge header__badge--online';
      els.serverStatus.textContent = `Responding (HTTP ${resp.status})`;
    } catch (err) {
      els.statusBadge.textContent = 'Offline';
      els.statusBadge.className = 'header__badge header__badge--offline';
      els.serverStatus.textContent = err.message || 'Connection failed';
    }
  }

  // ── Request Logging ─────────────────────────────────────────────────────────

  function addLogEntry(method, path, status, durationMs) {
    const entry = { method, path, status, durationMs, time: new Date() };
    requestLog.unshift(entry);
    if (requestLog.length > 50) requestLog.pop();
    renderLog();
  }

  function renderLog() {
    els.logCount.textContent = requestLog.length;

    if (requestLog.length === 0) {
      els.logList.innerHTML = '<p class="log-empty">No requests yet</p>';
      return;
    }

    els.logList.innerHTML = requestLog.map(entry => {
      const statusClass = entry.status < 400 ? 'log-entry__status--ok' : 'log-entry__status--err';
      return `<div class="log-entry">
        <div>
          <span class="log-entry__method">${entry.method}</span>
          <span>${escapeHtml(entry.path)}</span>
        </div>
        <div>
          <span class="log-entry__status ${statusClass}">${entry.status}</span>
          <span class="log-entry__time">${entry.durationMs}ms · ${formatTime(entry.time)}</span>
        </div>
      </div>`;
    }).join('');
  }

  // ── Chat Rendering ─────────────────────────────────────────────────────────

  function appendChatMessage(role, text, meta) {
    if (els.chatEmpty) els.chatEmpty.remove();

    const div = document.createElement('div');
    div.className = `chat-msg chat-msg--${role}`;

    const roleLabel = role === 'user' ? 'You' : role === 'error' ? 'Error' : 'Assistant';
    div.innerHTML = `
      <div class="chat-msg__role">${roleLabel}</div>
      <div class="chat-msg__text">${escapeHtml(text)}</div>
      ${meta ? `<div class="chat-msg__meta">${escapeHtml(meta)}</div>` : ''}
    `;

    els.chatArea.appendChild(div);
    els.chatArea.scrollTop = els.chatArea.scrollHeight;
    return div;
  }

  function createStreamingMessage() {
    if (els.chatEmpty) els.chatEmpty.remove();

    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg--assistant';
    div.innerHTML = `
      <div class="chat-msg__role">Assistant <span class="streaming-indicator"></span></div>
      <div class="chat-msg__text"></div>
      <div class="chat-msg__meta"></div>
    `;
    els.chatArea.appendChild(div);
    els.chatArea.scrollTop = els.chatArea.scrollHeight;
    return div;
  }

  // ── API Calls ───────────────────────────────────────────────────────────────

  function buildRequestBody(userText) {
    conversationHistory.push({ role: 'user', content: userText });

    const body = {
      model: els.modelSelect.value,
      max_tokens: parseInt(els.maxTokens.value, 10) || 1024,
      messages: [...conversationHistory],
      stream: els.streamToggle.checked,
    };

    const sys = els.systemPrompt.value.trim();
    if (sys) body.system = sys;

    return body;
  }

  /** Non-streaming request */
  async function sendNonStreaming(body) {
    const base = getBaseUrl();
    const start = performance.now();

    const resp = await fetch(base + '/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'fake-key',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const elapsed = Math.round(performance.now() - start);
    const data = await resp.json();

    addLogEntry('POST', '/v1/messages', resp.status, elapsed);

    if (data.type === 'error') {
      throw new Error(data.error?.message || 'Unknown error');
    }

    // Extract text from content blocks
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const toolCalls = (data.content || []).filter(b => b.type === 'tool_use');
    let display = text;
    if (toolCalls.length > 0) {
      const toolInfo = toolCalls.map(t => `[tool_use: ${t.name}(${JSON.stringify(t.input)})]`).join('\n');
      display = display ? display + '\n' + toolInfo : toolInfo;
    }

    const meta = `${elapsed}ms · ${data.usage?.input_tokens || '?'} in / ${data.usage?.output_tokens || '?'} out · stop: ${data.stop_reason}`;

    conversationHistory.push({ role: 'assistant', content: text || display });
    appendChatMessage('assistant', display || '(empty response)', meta);
  }

  /** Streaming request (SSE) */
  async function sendStreaming(body) {
    const base = getBaseUrl();
    const start = performance.now();

    const resp = await fetch(base + '/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'fake-key',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const elapsed = Math.round(performance.now() - start);
      addLogEntry('POST', '/v1/messages', resp.status, elapsed);
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${resp.status}`);
    }

    const msgDiv = createStreamingMessage();
    const textEl = msgDiv.querySelector('.chat-msg__text');
    const metaEl = msgDiv.querySelector('.chat-msg__meta');

    let fullText = '';
    let stopReason = '';
    let outputTokens = 0;
    const toolUseBlocks = [];
    let currentBlockType = null;
    let currentToolName = '';
    let currentToolInput = '';

    // Parse SSE stream
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6);
        if (!jsonStr.trim()) continue;

        let event;
        try { event = JSON.parse(jsonStr); } catch { continue; }

        switch (event.type) {
          case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
              currentBlockType = 'tool_use';
              currentToolName = event.content_block.name;
              currentToolInput = '';
            } else {
              currentBlockType = 'text';
            }
            break;

          case 'content_block_delta':
            if (event.delta?.type === 'text_delta') {
              fullText += event.delta.text;
              textEl.textContent = fullText;
              els.chatArea.scrollTop = els.chatArea.scrollHeight;
            } else if (event.delta?.type === 'input_json_delta') {
              currentToolInput += event.delta.partial_json;
            }
            break;

          case 'content_block_stop':
            if (currentBlockType === 'tool_use') {
              let parsedInput = {};
              try { parsedInput = JSON.parse(currentToolInput); } catch {}
              toolUseBlocks.push({ name: currentToolName, input: parsedInput });
            }
            currentBlockType = null;
            break;

          case 'message_delta':
            stopReason = event.delta?.stop_reason || '';
            outputTokens = event.usage?.output_tokens || 0;
            break;
        }
      }
    }

    const elapsed = Math.round(performance.now() - start);
    addLogEntry('POST', '/v1/messages (stream)', resp.status, elapsed);

    // Append tool use info
    if (toolUseBlocks.length > 0) {
      const toolInfo = toolUseBlocks.map(t => `[tool_use: ${t.name}(${JSON.stringify(t.input)})]`).join('\n');
      fullText = fullText ? fullText + '\n' + toolInfo : toolInfo;
      textEl.textContent = fullText;
    }

    if (!fullText) textEl.textContent = '(empty response)';

    // Remove streaming indicator and add meta
    const indicator = msgDiv.querySelector('.streaming-indicator');
    if (indicator) indicator.remove();
    metaEl.textContent = `${elapsed}ms · ${outputTokens} out · stop: ${stopReason}`;

    conversationHistory.push({ role: 'assistant', content: fullText });
  }

  // ── Event Handlers ──────────────────────────────────────────────────────────

  async function handleSend() {
    const text = els.userInput.value.trim();
    if (!text || sending) return;

    sending = true;
    els.btnSend.disabled = true;
    els.btnSend.textContent = 'Sending…';

    appendChatMessage('user', text);
    els.userInput.value = '';

    const body = buildRequestBody(text);

    try {
      if (body.stream) {
        await sendStreaming(body);
      } else {
        await sendNonStreaming(body);
      }
    } catch (err) {
      appendChatMessage('error', err.message);
      // Remove failed message from history
      conversationHistory.pop();
    } finally {
      sending = false;
      els.btnSend.disabled = false;
      els.btnSend.textContent = 'Send';
      els.userInput.focus();
    }
  }

  function handleClear() {
    conversationHistory = [];
    els.chatArea.innerHTML = '<div class="chat-empty" id="chat-empty">Send a message to get started</div>';
  }

  // ── Keyboard shortcut: Enter to send, Shift+Enter for newline ──────────────

  els.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // ── Bind events ─────────────────────────────────────────────────────────────

  els.btnSend.addEventListener('click', handleSend);
  els.btnClear.addEventListener('click', handleClear);
  els.btnCheck.addEventListener('click', checkStatus);

  // Update base URL display when input changes
  els.baseUrlInput.addEventListener('input', () => {
    els.baseUrl.textContent = getBaseUrl();
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  checkStatus();
})();