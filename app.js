/**
 * Fake Claude API — Chat UI
 * Renders content blocks (text, tool_use, tool_result) from the Anthropic Messages API.
 */

// ── Configuration ─────────────────────────────────────────────────────────────

const API_BASE = window.location.origin;
const API_KEY = "fake-key";

// ── DOM refs ──────────────────────────────────────────────────────────────────

const messagesEl = document.getElementById("messages");
const emptyState = document.getElementById("empty-state");
const inputForm = document.getElementById("input-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const modelSelect = document.getElementById("model-select");
const streamToggle = document.getElementById("stream-toggle");
const statusDot = document.getElementById("connection-status");

// Conversation history for multi-turn
let conversationHistory = [];

// ── Auto-resize textarea ──────────────────────────────────────────────────────

userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + "px";
});

// Submit on Enter (Shift+Enter for newline)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    inputForm.dispatchEvent(new Event("submit"));
  }
});

// ── Content rendering ─────────────────────────────────────────────────────────

/**
 * Renders an array of content blocks into a container element.
 * Handles: text, tool_use, tool_result blocks.
 */
function renderContentBlocks(container, content) {
  if (typeof content === "string") {
    // Simple string content
    const block = document.createElement("div");
    block.className = "content-block content-text";
    block.textContent = content;
    container.appendChild(block);
    return;
  }

  if (!Array.isArray(content)) return;

  for (const block of content) {
    const el = document.createElement("div");
    el.className = "content-block";

    switch (block.type) {
      case "text":
        el.classList.add("content-text");
        renderTextContent(el, block.text);
        break;

      case "tool_use":
        el.classList.add("content-tool-use");
        renderToolUse(el, block);
        break;

      case "tool_result":
        el.classList.add("content-tool-result");
        renderToolResult(el, block);
        break;

      default:
        el.classList.add("content-text");
        el.textContent = JSON.stringify(block, null, 2);
    }

    container.appendChild(el);
  }
}

/**
 * Renders text content with basic formatting (code blocks, inline code).
 */
function renderTextContent(container, text) {
  if (!text) return;

  // Split on fenced code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  for (const part of parts) {
    if (part.startsWith("```") && part.endsWith("```")) {
      // Fenced code block
      const pre = document.createElement("pre");
      // Strip the ``` markers and optional language tag
      const inner = part.slice(3, -3);
      const newlineIdx = inner.indexOf("\n");
      pre.textContent = newlineIdx >= 0 ? inner.slice(newlineIdx + 1) : inner;
      container.appendChild(pre);
    } else {
      // Regular text — handle inline code
      const span = document.createElement("span");
      const inlineParts = part.split(/(`[^`]+`)/g);
      for (const ip of inlineParts) {
        if (ip.startsWith("`") && ip.endsWith("`")) {
          const code = document.createElement("code");
          code.textContent = ip.slice(1, -1);
          span.appendChild(code);
        } else {
          span.appendChild(document.createTextNode(ip));
        }
      }
      container.appendChild(span);
    }
  }
}

/**
 * Renders a tool_use content block.
 */
function renderToolUse(container, block) {
  // Header with tool name
  const header = document.createElement("div");
  header.className = "tool-use-header";
  header.innerHTML = `<span class="tool-icon">⚙</span> Tool call: ${escapeHtml(block.name)}`;
  container.appendChild(header);

  // Tool input as formatted JSON
  const inputEl = document.createElement("div");
  inputEl.className = "tool-use-input";
  inputEl.textContent = JSON.stringify(block.input, null, 2);
  container.appendChild(inputEl);
}

/**
 * Renders a tool_result content block.
 */
function renderToolResult(container, block) {
  const header = document.createElement("div");
  header.className = "tool-result-header";
  header.textContent = `Tool result (${block.tool_use_id || "unknown"})`;
  container.appendChild(header);

  const contentEl = document.createElement("div");
  contentEl.className = "tool-result-content";
  if (block.is_error) {
    contentEl.classList.add("tool-result-error");
  }

  // Content can be a string or array of blocks
  if (typeof block.content === "string") {
    contentEl.textContent = block.content;
  } else if (Array.isArray(block.content)) {
    for (const sub of block.content) {
      if (sub.type === "text") {
        contentEl.textContent += sub.text;
      } else {
        contentEl.textContent += JSON.stringify(sub, null, 2);
      }
    }
  }

  container.appendChild(contentEl);
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Message UI helpers ────────────────────────────────────────────────────────

function hideEmptyState() {
  if (emptyState) emptyState.style.display = "none";
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Adds a user message bubble to the UI.
 */
function addUserMessage(text) {
  hideEmptyState();
  const msg = document.createElement("div");
  msg.className = "message user";
  msg.textContent = text;
  messagesEl.appendChild(msg);
  scrollToBottom();
}

/**
 * Adds an assistant message bubble. Returns the content container for updates.
 */
function addAssistantMessage() {
  const msg = document.createElement("div");
  msg.className = "message assistant";

  const label = document.createElement("div");
  label.className = "role-label";
  label.textContent = "Assistant";
  msg.appendChild(label);

  const contentContainer = document.createElement("div");
  contentContainer.className = "content-container";
  msg.appendChild(contentContainer);

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.style.display = "none";
  msg.appendChild(meta);

  messagesEl.appendChild(msg);
  scrollToBottom();

  return { messageEl: msg, contentContainer, meta };
}

/**
 * Adds a loading indicator.
 */
function addLoadingIndicator() {
  const msg = document.createElement("div");
  msg.className = "message assistant loading";
  msg.id = "loading-indicator";

  const label = document.createElement("div");
  label.className = "role-label";
  label.textContent = "Assistant";
  msg.appendChild(label);

  const dots = document.createElement("span");
  dots.className = "dots";
  dots.textContent = "Thinking";
  msg.appendChild(dots);

  messagesEl.appendChild(msg);
  scrollToBottom();
  return msg;
}

function removeLoadingIndicator() {
  const el = document.getElementById("loading-indicator");
  if (el) el.remove();
}

function addErrorMessage(text) {
  const msg = document.createElement("div");
  msg.className = "message error";
  msg.textContent = text;
  messagesEl.appendChild(msg);
  scrollToBottom();
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Sends a non-streaming request and renders the response.
 */
async function sendNonStreaming(messages, model) {
  const response = await fetch(`${API_BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Sends a streaming request and renders content blocks as they arrive.
 */
async function sendStreaming(messages, model, contentContainer, meta) {
  const response = await fetch(`${API_BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // Accumulated state for streaming
  let fullContent = [];
  let currentBlockIndex = -1;
  let currentBlockEl = null;
  let currentBlockText = "";
  let currentBlockType = null;
  let currentToolInput = "";
  let usage = null;
  let stopReason = null;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from the buffer
    const lines = buffer.split("\n");
    buffer = lines.pop(); // Keep incomplete line in buffer

    let eventType = null;

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ") && eventType) {
        const data = JSON.parse(line.slice(6));

        switch (eventType) {
          case "content_block_start":
            currentBlockIndex = data.index;
            currentBlockType = data.content_block.type;
            currentBlockText = "";
            currentToolInput = "";

            currentBlockEl = document.createElement("div");
            currentBlockEl.className = "content-block";

            if (currentBlockType === "text") {
              currentBlockEl.classList.add("content-text");
            } else if (currentBlockType === "tool_use") {
              currentBlockEl.classList.add("content-tool-use");
              const header = document.createElement("div");
              header.className = "tool-use-header";
              header.innerHTML = `<span class="tool-icon">⚙</span> Tool call: ${escapeHtml(data.content_block.name || "unknown")}`;
              currentBlockEl.appendChild(header);

              // Store tool name/id for later
              currentBlockEl.dataset.toolName = data.content_block.name || "";
              currentBlockEl.dataset.toolId = data.content_block.id || "";
            }

            contentContainer.appendChild(currentBlockEl);
            scrollToBottom();
            break;

          case "content_block_delta":
            if (data.delta.type === "text_delta") {
              currentBlockText += data.delta.text;
              // Re-render text content (handles code blocks)
              currentBlockEl.innerHTML = "";
              if (currentBlockType === "text") {
                renderTextContent(currentBlockEl, currentBlockText);
              }
              scrollToBottom();
            } else if (data.delta.type === "input_json_delta") {
              currentToolInput += data.delta.partial_json;
            }
            break;

          case "content_block_stop": {
            if (currentBlockType === "text") {
              fullContent.push({ type: "text", text: currentBlockText });
            } else if (currentBlockType === "tool_use") {
              let parsedInput = {};
              try {
                parsedInput = JSON.parse(currentToolInput);
              } catch { /* empty */ }

              // Render the tool input
              const inputEl = document.createElement("div");
              inputEl.className = "tool-use-input";
              inputEl.textContent = JSON.stringify(parsedInput, null, 2);
              currentBlockEl.appendChild(inputEl);

              fullContent.push({
                type: "tool_use",
                id: currentBlockEl.dataset.toolId,
                name: currentBlockEl.dataset.toolName,
                input: parsedInput,
              });
              scrollToBottom();
            }
            currentBlockEl = null;
            currentBlockType = null;
            break;
          }

          case "message_delta":
            stopReason = data.delta?.stop_reason || null;
            if (data.usage) usage = data.usage;
            break;
        }

        eventType = null;
      }
    }
  }

  // Show usage metadata
  if (usage) {
    meta.style.display = "flex";
    meta.textContent = `${usage.output_tokens} output tokens · stop: ${stopReason || "unknown"}`;
  }

  return { content: fullContent, stop_reason: stopReason };
}

// ── Form submission ───────────────────────────────────────────────────────────

inputForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  // Clear input
  userInput.value = "";
  userInput.style.height = "auto";
  sendBtn.disabled = true;

  // Add user message to conversation and UI
  conversationHistory.push({ role: "user", content: text });
  addUserMessage(text);

  const model = modelSelect.value;
  const useStreaming = streamToggle.checked;

  if (useStreaming) {
    // Streaming path
    const { contentContainer, meta } = addAssistantMessage();

    try {
      const result = await sendStreaming(conversationHistory, model, contentContainer, meta);
      // Add assistant response to conversation history
      if (result.content.length > 0) {
        conversationHistory.push({ role: "assistant", content: result.content });
      }
    } catch (err) {
      addErrorMessage(`Error: ${err.message}`);
    }
  } else {
    // Non-streaming path
    const loading = addLoadingIndicator();

    try {
      const response = await sendNonStreaming(conversationHistory, model);
      removeLoadingIndicator();

      const { contentContainer, meta } = addAssistantMessage();
      renderContentBlocks(contentContainer, response.content);

      // Show usage metadata
      if (response.usage) {
        meta.style.display = "flex";
        meta.textContent = `${response.usage.input_tokens} in · ${response.usage.output_tokens} out · stop: ${response.stop_reason || "unknown"}`;
      }

      // Add to conversation history
      conversationHistory.push({ role: "assistant", content: response.content });

      scrollToBottom();
    } catch (err) {
      removeLoadingIndicator();
      addErrorMessage(`Error: ${err.message}`);
    }
  }

  sendBtn.disabled = false;
  userInput.focus();
});

// ── Server status check ───────────────────────────────────────────────────────

async function checkServerStatus() {
  try {
    // A quick OPTIONS request to see if the server is up
    const res = await fetch(`${API_BASE}/v1/messages`, { method: "OPTIONS" });
    statusDot.className = "status connected";
    statusDot.title = "Server connected";
  } catch {
    statusDot.className = "status error";
    statusDot.title = "Server unreachable";
  }
}

// Check on load and periodically
checkServerStatus();
setInterval(checkServerStatus, 30000);