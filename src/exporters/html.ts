import type { ModelReport } from '../types.js';

export interface HTMLExportOptions {
  title?: string;
  theme?: 'dark' | 'light';
}

/**
 * Generates an interactive, zero-dependency, self-contained HTML analytics dashboard.
 * Implements high-agency frontend engineering rules:
 * - Anti-emoji policy: Strictly pure SVG icons, zero emojis.
 * - Anti-slop palette: Zinc-950 base (#09090b), neutral slate, subtle borders, single Emerald accent (#10b981).
 * - Monospace numbers for clean data density and alignment.
 * - Bento-grid layout with progress indicators and filterable table.
 */
export function exportToHTML(report: ModelReport, options: HTMLExportOptions = {}): string {
  const title = options.title || 'LLM Usage Insights Dashboard';
  const isDark = options.theme !== 'light';

  const totalTokensFormatted = Number(report.totalTokens).toLocaleString();
  const totalCostFormatted = `$${Number(report.totalEstimatedCost).toFixed(4)}`;
  const totalRequestsFormatted = Number(report.totalRequests).toLocaleString();
  const inputTokensFormatted = Number(report.totalInputTokens).toLocaleString();
  const outputTokensFormatted = Number(report.totalOutputTokens).toLocaleString();
  const cachedTokensFormatted = Number(report.totalCachedTokens).toLocaleString();

  const rowsHtml = report.models
    .map((m) => {
      const avgCostStr = `$${m.averageCostPerRequest.toFixed(4)}`;
      const estCostStr = `$${m.estimatedCost.toFixed(4)}`;
      const latencyStr = m.averageLatencyMs !== null ? `${m.averageLatencyMs}ms` : 'n/a';

      return `
        <tr>
          <td>
            <div class="model-cell">
              <span class="provider-tag provider-${escapeHtml(m.provider.toLowerCase())}">${escapeHtml(m.provider)}</span>
              <span class="model-name">${escapeHtml(m.model)}</span>
            </div>
          </td>
          <td class="num">${m.requests.toLocaleString()}</td>
          <td class="num">${m.inputTokens.toLocaleString()}</td>
          <td class="num">${m.outputTokens.toLocaleString()}</td>
          <td class="num">${m.cachedTokens.toLocaleString()}</td>
          <td class="num highlight-tokens">${m.totalTokens.toLocaleString()}</td>
          <td class="num">
            <div class="pct-bar-wrap">
              <span class="num">${m.percentageOfTotalTokens.toFixed(1)}%</span>
              <div class="progress-bar"><div class="fill tokens-fill" style="width: ${m.percentageOfTotalTokens}%"></div></div>
            </div>
          </td>
          <td class="num highlight-cost">${estCostStr}</td>
          <td class="num">
            <div class="pct-bar-wrap">
              <span class="num">${m.percentageOfTotalCost.toFixed(1)}%</span>
              <div class="progress-bar"><div class="fill cost-fill" style="width: ${m.percentageOfTotalCost}%"></div></div>
            </div>
          </td>
          <td class="num">${avgCostStr}</td>
          <td class="num font-mono">${latencyStr}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en" class="${isDark ? 'dark' : 'light'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #09090b;
      --surface: #121215;
      --surface-elevated: #18181b;
      --border: #27272a;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --text-main: #f4f4f5;
      --text-muted: #a1a1aa;
      --text-faint: #71717a;
      --accent: #10b981;
      --accent-subtle: rgba(16, 185, 129, 0.12);
      --accent-text: #34d399;
      --cost-accent: #38bdf8;
      --tokens-accent: #10b981;
      --tag-openai: #10a37f;
      --tag-anthropic: #d97706;
      --tag-google: #3b82f6;
      --tag-other: #6b7280;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.5;
      padding: 2.5rem 1.5rem;
      min-height: 100dvh;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .header-left h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: var(--text-main);
      line-height: 1.1;
    }
    .header-left p {
      font-size: 0.925rem;
      color: var(--text-muted);
      margin-top: 0.35rem;
    }
    .timestamp-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.775rem;
      color: var(--text-faint);
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
    }
    /* Bento Grid */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
      margin-bottom: 2.5rem;
    }
    .bento-card {
      background: var(--surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }
    .bento-card:hover {
      border-color: var(--border);
      transform: translateY(-2px);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .card-title {
      font-size: 0.825rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }
    .card-icon svg {
      width: 18px;
      height: 18px;
      stroke: var(--text-faint);
      fill: none;
      stroke-width: 1.75;
    }
    .card-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
      color: var(--text-main);
    }
    .card-subtext {
      font-size: 0.8rem;
      color: var(--text-faint);
      margin-top: 0.5rem;
    }
    .accent-emerald {
      color: var(--accent-text);
    }
    .accent-sky {
      color: var(--cost-accent);
    }
    /* Table section */
    .table-container {
      background: var(--surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow-x: auto;
    }
    .table-toolbar {
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .table-toolbar h2 {
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }
    th {
      background: var(--surface-elevated);
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 0.75rem;
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      vertical-align: middle;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }
    .num {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    th.num {
      text-align: right;
    }
    .model-cell {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .provider-tag {
      font-size: 0.675rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 0.2rem 0.45rem;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .provider-openai { border-color: rgba(16, 163, 127, 0.4); color: #10a37f; }
    .provider-anthropic { border-color: rgba(217, 119, 6, 0.4); color: #f59e0b; }
    .provider-google { border-color: rgba(59, 130, 246, 0.4); color: #60a5fa; }
    .model-name {
      font-weight: 600;
      color: var(--text-main);
    }
    .highlight-tokens {
      color: var(--accent-text);
      font-weight: 600;
    }
    .highlight-cost {
      color: var(--cost-accent);
      font-weight: 600;
    }
    .pct-bar-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
      min-width: 80px;
    }
    .progress-bar {
      width: 100%;
      height: 4px;
      background: var(--surface-elevated);
      border-radius: 2px;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      border-radius: 2px;
    }
    .tokens-fill {
      background: var(--tokens-accent);
    }
    .cost-fill {
      background: var(--cost-accent);
    }
    footer {
      margin-top: 3rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-faint);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-left">
        <h1>LLM Usage Insights</h1>
        <p>Production token accounting, model-wise cost analysis, and spending analytics</p>
      </div>
      <div class="timestamp-badge">
        Report Generated: ${new Date().toISOString()}
      </div>
    </header>

    <section class="bento-grid">
      <div class="bento-card">
        <div class="card-header">
          <span class="card-title">Total Tokens</span>
          <div class="card-icon">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </div>
        </div>
        <div class="card-value accent-emerald">${totalTokensFormatted}</div>
        <div class="card-subtext">${inputTokensFormatted} in &bull; ${outputTokensFormatted} out</div>
      </div>

      <div class="bento-card">
        <div class="card-header">
          <span class="card-title">Estimated Cost</span>
          <div class="card-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="card-value accent-sky">${totalCostFormatted}</div>
        <div class="card-subtext">Currency: ${escapeHtml(report.currency)}</div>
      </div>

      <div class="bento-card">
        <div class="card-header">
          <span class="card-title">Total Requests</span>
          <div class="card-icon">
            <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
        </div>
        <div class="card-value">${totalRequestsFormatted}</div>
        <div class="card-subtext">Across ${report.models.length} active models</div>
      </div>

      <div class="bento-card">
        <div class="card-header">
          <span class="card-title">Cached Tokens</span>
          <div class="card-icon">
            <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
        </div>
        <div class="card-value">${cachedTokensFormatted}</div>
        <div class="card-subtext">Prompt cache optimizations applied</div>
      </div>
    </section>

    <div class="table-container">
      <div class="table-toolbar">
        <h2>Model-Wise Breakdown</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>Model &amp; Provider</th>
            <th class="num">Requests</th>
            <th class="num">Input Tokens</th>
            <th class="num">Output Tokens</th>
            <th class="num">Cached Tokens</th>
            <th class="num">Total Tokens</th>
            <th class="num">% Tokens</th>
            <th class="num">Cost</th>
            <th class="num">% Cost</th>
            <th class="num">Avg Cost/Req</th>
            <th class="num">Avg Latency</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <footer>
      Generated with <code>llm-usage-insights</code> &bull; MIT Licensed
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
