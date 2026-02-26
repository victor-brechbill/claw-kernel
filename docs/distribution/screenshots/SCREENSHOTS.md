# Distribution Screenshots

This directory should contain screenshots of key screens for the distribution documentation. Screenshots help new users understand what to expect at each step.

## Required Screenshots

Capture each of the following and save as PNG files in this directory.

### 1. Onboarding (`01-onboarding.png`)

**What to capture:** The `openclaw onboard` CLI wizard running in a terminal.

**Key elements to show:**

- The welcome prompt
- Channel selection step
- API key configuration step

**Where referenced:** [Installation Guide](../installation.md)

---

### 2. Gateway Running (`02-gateway-running.png`)

**What to capture:** Terminal output after running `openclaw gateway start`.

**Key elements to show:**

- Gateway startup messages
- WebSocket address (`ws://127.0.0.1:18789`)
- Channel connection confirmation
- "Gateway is running" status

**Where referenced:** [Installation Guide](../installation.md)

---

### 3. SETUP.md Checklist (`03-setup-checklist.png`)

**What to capture:** The SETUP.md file rendered in a code editor or markdown viewer.

**Key elements to show:**

- The full 10-item checklist
- Mix of checked and unchecked items (showing progress)
- Clear section headers

**Where referenced:** [Setup Walkthrough](../setup-walkthrough.md)

---

### 4. Dashboard Home (`04-dashboard-home.png`)

**What to capture:** The claw-interface dashboard home screen.

**Key elements to show:**

- Agent status indicator (online/idle)
- Status console with recent activity
- Active sessions widget
- Navigation bar

**Where referenced:** [Setup Walkthrough](../setup-walkthrough.md#1-install-the-dashboard)

---

### 5. Kanban Board (`05-kanban-board.png`)

**What to capture:** The kanban board with sample cards in different columns.

**Key elements to show:**

- All 4 columns (Backlog, In Progress, Review, Done)
- At least one card per column
- Card details visible (title, type, priority)
- Drag-and-drop in action (if possible)

**Where referenced:** [Setup Walkthrough](../setup-walkthrough.md#10-test-interface--workflow)

---

### 6. System Monitoring (`06-system-monitoring.png`)

**What to capture:** The system page of the dashboard.

**Key elements to show:**

- Activity heatmap grid
- Cron job status listing
- Sub-agent console output
- System health metrics

**Where referenced:** [Troubleshooting](../troubleshooting.md)

---

### 7. Agent Workflows (`07-agent-workflows.png`)

**What to capture:** The dashboard showing an active developer agent session.

**Key elements to show:**

- Agent session in progress
- Status messages updating
- Task card linked to the active session

**Where referenced:** [Setup Walkthrough](../setup-walkthrough.md#10-test-interface--workflow)

---

### 8. Doctor Output (`08-doctor-output.png`)

**What to capture:** Terminal output from `openclaw doctor`.

**Key elements to show:**

- Health check categories (config, services, channels)
- Pass/fail indicators
- Any warnings or recommendations

**Where referenced:** [Troubleshooting](../troubleshooting.md#quick-diagnostics)

---

## Screenshot Guidelines

- **Resolution:** 1280x800 or higher
- **Format:** PNG
- **Content:** Remove any personal information (API keys, tokens, email addresses, real usernames)
- **Annotations:** Use arrows or highlights sparingly to call attention to key elements
- **Theme:** Use the default terminal/dashboard theme for consistency
- **File names:** Use the exact filenames listed above

## How to Add Screenshots to Docs

Reference screenshots in markdown with relative paths:

```markdown
![Dashboard Home](./screenshots/04-dashboard-home.png)
```

Or with a caption:

```markdown
<figure>
  <img src="./screenshots/04-dashboard-home.png" alt="Dashboard home screen showing agent status">
  <figcaption>The dashboard home screen with live agent status</figcaption>
</figure>
```
