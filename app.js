/**
 * Fake Claude API — Dashboard & Test Console
 *
 * Vanilla JS — no frameworks, no build tools, no dependencies.
 * Talks to the local fake-claude-api proxy server.
 */

// ── DOM References ──────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

const dom = {
  statusDot:    $("#status-indicator"),
  statusText:   $("#status-text"),
  infoEndpoint: $("#info-endpoint"),
  infoStatus:   $("#info-status"),
  baseUrl:      $("#base-url"),
  model:        $("#model-select"),
  prompt:       $("#prompt-input"),
  streamToggle: $("#stream-toggle"),
  sendBtn:      $("#send-btn"),
  clearBtn:     $("#clear-btn"),
  form:         $("#test-form"),
  responseMeta: $("#response-meta"),
  responseOut:  $("#response-output"),
  logList:      $("#log-list"),
  clearLogBtn:  $("#clear-log-btn"),
};

// ── State ───────────────────────────────────────────────────────────────────────

let isRequesting = false;
let activeController = null; // AbortController for in-flight requests

// ── Server Health Check ─────────────────────────────────────────────────────────

/**
 * Ping the server to check if it's online.
 */
async function checkServerStatus() {
  const baseUrl = dom.baseUrl.value.replace(/\/+$/, "");
  dom.infoEndpoint.textContent = baseUrl;

  try {
    const res = await fetch(baseUrl, { method: "GET", signal: AbortSignal.timeout(3000) });
    if (res.ok || res.status === 404) {
      setStatus("online", "Online");
    } else {
      setStatus("offline", `HTTP ${res.status}`);
    }
  } catch {
    setStatus("offline", "Offline");
  }
}

function setStatus(state, label) {
  dom.statusDot.className = `status-dot status-dot--${state}`;
  dom.statusText.textContent = label;
  dom.infoStatus.textContent = label;
}

// ── Request Handling ────────────────────────────────────────────────────────────

/**
 * Build the Messages API request body.
 */
function buildRequestBody() {
  return {
    model: dom.model.value,
    max_tokens: 1024,
    messages: [{ role: "user", content: dom.prompt.value.trim() }],
    stream: dom.streamToggle.checked,
  };
}

/**
 * Send a non-streaming request.
 */
async function sendNonStreaming(url, body, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "fake-key", "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
    signal,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  // Extract text from content blocks
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return { text, meta: data };
}

/**
 * Send a streaming (SSE) request and progressively update the UI.
 */
async function sendStreaming(url, body, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "fake-key", "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error?.message || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  dom.responseOut.textContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      try {
        const event = JSON.parse(jsonStr);
        if (event.type === "content_block_delta" && event.delta?.text) {
          fullText += event.delta.text;
          dom.responseOut.textContent = fullText;
          // Auto-scroll to bottom
          dom.responseOut.scrollTop = dom.responseOut.scrollHeight;
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }

  return { text: fullText, meta: null };
}

/**
 * Main send handler.
 */
async function handleSend(e) {
  e.preventDefault();

  const prompt = dom.prompt.value.trim();
  if (!prompt || isRequesting) return;

  const baseUrl = dom.baseUrl.value.replace(/\/+$/, "");
  const url = `${baseUrl}/v1/messages`;
  const body = buildRequestBody();
  const streaming = body.stream;

  // UI: set loading state
  isRequesting = true;
  dom.sendBtn.disabled = true;
  dom.sendBtn.textContent = "Sending…";
  dom.responseOut.innerHTML = '<span class="placeholder">Waiting for response…</span>';
  dom.responseMeta.textContent = "";

  activeController = new AbortController();
  const startTime = performance.now();
  const logEntry = addLogEntry(prompt);

  try {
    const { text, meta } = streaming
      ? await sendStreaming(url, body, activeController.signal)
      : await sendNonStreaming(url, body, activeController.signal);

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

    if (!streaming) {
      dom.responseOut.textContent = text || "(empty response)";
    }

    dom.responseMeta.textContent = `Model: ${body.model} | Stream: ${streaming} | Time: ${elapsed}s`;
    updateLogEntry(logEntry, "ok", `${elapsed}s`);
  } catch (err) {
    if (err.name === "AbortError") {
      dom.responseOut.textContent = "(request cancelled)";
      updateLogEntry(logEntry, "error", "Cancelled");
    } else {
      dom.responseOut.textContent = `Error: ${err.message}`;
      updateLogEntry(logEntry, "error", err.message);
    }
  } finally {
    isRequesting = false;
    activeController = null;
    dom.sendBtn.disabled = false;
    dom.sendBtn.textContent = "Send Request";
  }
}

// ── Request Log ─────────────────────────────────────────────────────────────────

function addLogEntry(prompt) {
  // Remove the "No requests yet" placeholder
  const empty = dom.logList.querySelector(".log-list__empty");
  if (empty) empty.remove();

  const li = document.createElement("li");
  li.className = "log-list__item";

  const time = new Date().toLocaleTimeString();
  li.innerHTML = `
    <span class="log-list__time">${time}</span>
    <span class="log-list__status log-list__status--pending">…</span>
    <span class="log-list__detail">${escapeHtml(prompt.slice(0, 80))}</span>
  `;

  dom.logList.prepend(li);
  return li;
}

function updateLogEntry(li, status, detail) {
  const statusEl = li.querySelector(".log-list__status");
  statusEl.textContent = status === "ok" ? "OK" : "ERR";
  statusEl.className = `log-list__status log-list__status--${status}`;

  const detailEl = li.querySelector(".log-list__detail");
  detailEl.textContent += ` — ${detail}`;
}

function clearLog() {
  dom.logList.innerHTML = '<li class="log-list__empty">No requests yet.</li>';
}

// ── Utilities ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ── Event Listeners ─────────────────────────────────────────────────────────────

dom.form.addEventListener("submit", handleSend);

dom.clearBtn.addEventListener("click", () => {
  dom.responseOut.innerHTML = '<span class="placeholder">Response will appear here…</span>';
  dom.responseMeta.textContent = "";
});

dom.clearLogBtn.addEventListener("click", clearLog);

// Re-check server status when base URL changes
dom.baseUrl.addEventListener("change", checkServerStatus);

// ── Init ────────────────────────────────────────────────────────────────────────

checkServerStatus();
// Poll server status every 15 seconds
setInterval(checkServerStatus, 15_000);