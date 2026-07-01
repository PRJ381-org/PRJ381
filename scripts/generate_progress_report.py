#!/usr/bin/env python3
"""
PRJ381 weekly progress report generator.

What it does:
  1. Pulls tasks from the configured ClickUp list (via the ClickUp v2 API).
  2. Builds a Markdown progress report for the past 7 days.
  3. Rewrites the block between the PROGRESS-REPORT markers in README.md.
  4. Writes a dated snapshot to reports/progress-YYYY-MM-DD.md.
  5. Posts an Adaptive Card summary to the Teams channel via a Power Automate
     "Workflows" webhook.

Everything is driven by environment variables so no secrets live in the repo.

Required env:
  CLICKUP_API_TOKEN   - ClickUp personal API token (GitHub secret)
  TEAMS_WEBHOOK_URL   - Power Automate Workflows webhook URL (GitHub secret)
Optional env (sensible defaults baked in for this project):
  CLICKUP_LIST_ID     - default 901522811227 (the Group 3 list)
  REPO_SLUG           - e.g. "zaRivalz/PRJ381" (used to build report links)
  DEFAULT_BRANCH      - default "main"
  WINDOW_DAYS         - default 7
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

# --- Config -----------------------------------------------------------------

CLICKUP_TOKEN = os.environ.get("CLICKUP_API_TOKEN", "").strip()
TEAMS_WEBHOOK = os.environ.get("TEAMS_WEBHOOK_URL", "").strip()
# Report scope: whole space by default (future-proof as lists/folders get added).
# Set CLICKUP_LIST_ID to narrow to a single list if ever needed.
TEAM_ID = os.environ.get("CLICKUP_TEAM_ID", "90152515539").strip()
SPACE_ID = os.environ.get("CLICKUP_SPACE_ID", "901510780768").strip()
LIST_ID = os.environ.get("CLICKUP_LIST_ID", "").strip()
REPO_SLUG = os.environ.get("REPO_SLUG", "zaRivalz/PRJ381").strip()
DEFAULT_BRANCH = os.environ.get("DEFAULT_BRANCH", "main").strip()
WINDOW_DAYS = int(os.environ.get("WINDOW_DAYS", "7"))

README_PATH = "README.md"
START_MARKER = "<!-- PROGRESS-REPORT:START -->"
END_MARKER = "<!-- PROGRESS-REPORT:END -->"

# SA time for human-friendly dates in the report.
SAST = timezone(timedelta(hours=2))
NOW = datetime.now(SAST)
WINDOW_START = NOW - timedelta(days=WINDOW_DAYS)


# --- ClickUp helpers --------------------------------------------------------

def _ms_to_dt(value):
    """ClickUp timestamps are strings of milliseconds since epoch (or None)."""
    if not value:
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, SAST)
    except (ValueError, TypeError):
        return None


def fetch_clickup_tasks(token):
    """Page through every task across the space (or a single list if set).

    Uses ClickUp's "filtered team tasks" endpoint so that any lists/folders
    added later are covered automatically. Includes closed tasks and subtasks.
    """
    tasks = []
    page = 0
    while True:
        params = [
            ("page", str(page)),
            ("include_closed", "true"),
            ("subtasks", "true"),
        ]
        if LIST_ID:
            params.append(("list_ids[]", LIST_ID))
        elif SPACE_ID:
            params.append(("space_ids[]", SPACE_ID))
        url = (
            f"https://api.clickup.com/api/v2/team/{TEAM_ID}/task?"
            + urllib.parse.urlencode(params)
        )
        req = urllib.request.Request(url, headers={"Authorization": token})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            print(f"::error::ClickUp API {exc.code}: {body}", file=sys.stderr)
            raise
        batch = data.get("tasks", [])
        tasks.extend(batch)
        if data.get("last_page") is True or len(batch) < 100:
            break
        page += 1
        time.sleep(0.3)  # be polite to the API
    return tasks


def _assignees(task):
    names = [a.get("username") or a.get("email", "") for a in task.get("assignees", [])]
    names = [n for n in names if n]
    return ", ".join(names) if names else "unassigned"


def classify(tasks):
    """Bucket tasks for the report."""
    done_types = {"done", "closed"}
    buckets = {
        "total": len(tasks),
        "done": [],
        "in_progress": [],
        "todo": [],
        "completed_this_week": [],
        "created_this_week": [],
        "due_next_week": [],
        "overdue": [],
    }
    next_week = NOW + timedelta(days=7)
    for t in tasks:
        status = (t.get("status") or {})
        stype = status.get("type", "open")
        sname = status.get("status", "unknown")
        created = _ms_to_dt(t.get("date_created"))
        done_at = _ms_to_dt(t.get("date_done")) or _ms_to_dt(t.get("date_closed"))
        due = _ms_to_dt(t.get("due_date"))
        is_done = stype in done_types

        if is_done:
            buckets["done"].append(t)
            if done_at and done_at >= WINDOW_START:
                buckets["completed_this_week"].append(t)
        elif sname.lower() in {"in progress", "in review", "active", "doing"} or stype == "custom":
            buckets["in_progress"].append(t)
        else:
            buckets["todo"].append(t)

        if created and created >= WINDOW_START:
            buckets["created_this_week"].append(t)

        if not is_done and due:
            if due < NOW:
                buckets["overdue"].append(t)
            elif due <= next_week:
                buckets["due_next_week"].append(t)
    return buckets


# --- Markdown building ------------------------------------------------------

def _task_line(t):
    line = f"- **{t.get('name', 'Untitled')}** — {_assignees(t)}"
    url = t.get("url")
    if url:
        line += f" · [open]({url})"
    return line


def build_markdown(buckets):
    week_range = f"{WINDOW_START.strftime('%d %b')} – {NOW.strftime('%d %b %Y')}"
    lines = []
    lines.append(f"### Weekly Progress Report — {NOW.strftime('%d %b %Y')}")
    lines.append("")
    lines.append(f"_Reporting window: {week_range} · generated automatically from ClickUp_")
    lines.append("")

    # Snapshot table
    lines.append("| Metric | Count |")
    lines.append("|---|---|")
    lines.append(f"| Total tickets on board | {buckets['total']} |")
    lines.append(f"| ✅ Done (all time) | {len(buckets['done'])} |")
    lines.append(f"| 🔄 In progress | {len(buckets['in_progress'])} |")
    lines.append(f"| 📋 To do | {len(buckets['todo'])} |")
    lines.append(f"| 🎉 Completed this week | {len(buckets['completed_this_week'])} |")
    lines.append(f"| 🆕 Created this week | {len(buckets['created_this_week'])} |")
    lines.append("")

    if buckets["total"] == 0:
        lines.append("> No tickets on the ClickUp board yet. Once the team starts")
        lines.append("> logging tasks, this report will fill in automatically.")
        lines.append("")
        return "\n".join(lines)

    def section(title, items, empty_note):
        lines.append(f"**{title}**")
        lines.append("")
        if items:
            for t in items:
                lines.append(_task_line(t))
        else:
            lines.append(f"_{empty_note}_")
        lines.append("")

    section("🎉 Completed this week", buckets["completed_this_week"],
            "Nothing marked done in the last 7 days.")
    section("🔄 In progress", buckets["in_progress"],
            "No tickets currently in progress.")
    section("📅 Due in the next 7 days", buckets["due_next_week"],
            "Nothing due in the coming week.")
    if buckets["overdue"]:
        section("⚠️ Overdue", buckets["overdue"], "")

    return "\n".join(lines)


def update_readme(markdown):
    if not os.path.exists(README_PATH):
        print("::warning::README.md not found — creating one.")
        content = f"# PRJ381\n\n{START_MARKER}\n{END_MARKER}\n"
    else:
        with open(README_PATH, "r", encoding="utf-8") as fh:
            content = fh.read()

    block = f"{START_MARKER}\n{markdown}\n{END_MARKER}"
    if START_MARKER in content and END_MARKER in content:
        pre = content.split(START_MARKER)[0]
        post = content.split(END_MARKER, 1)[1]
        content = pre + block + post
    else:
        # Markers missing — append the block at the bottom.
        content = content.rstrip() + "\n\n## Progress Report\n\n" + block + "\n"

    with open(README_PATH, "w", encoding="utf-8") as fh:
        fh.write(content)


def write_snapshot(markdown):
    os.makedirs("reports", exist_ok=True)
    fname = f"reports/progress-{NOW.strftime('%Y-%m-%d')}.md"
    with open(fname, "w", encoding="utf-8") as fh:
        fh.write(markdown + "\n")
    return fname


# --- Teams (Power Automate Workflows webhook) -------------------------------

def post_to_teams(buckets, report_url):
    if not TEAMS_WEBHOOK:
        print("::warning::TEAMS_WEBHOOK_URL not set — skipping Teams post.")
        return
    facts = [
        {"title": "Completed this week", "value": str(len(buckets["completed_this_week"]))},
        {"title": "In progress", "value": str(len(buckets["in_progress"]))},
        {"title": "To do", "value": str(len(buckets["todo"]))},
        {"title": "Created this week", "value": str(len(buckets["created_this_week"]))},
        {"title": "Overdue", "value": str(len(buckets["overdue"]))},
    ]
    card = {
        "type": "message",
        "attachments": [{
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                    {"type": "TextBlock", "size": "Large", "weight": "Bolder",
                     "text": "PRJ381 — Weekly Progress Report"},
                    {"type": "TextBlock", "isSubtle": True, "spacing": "None",
                     "text": NOW.strftime("%d %b %Y")},
                    {"type": "FactSet", "facts": facts},
                ],
                "actions": [
                    {"type": "Action.OpenUrl", "title": "View full report", "url": report_url}
                ] if report_url else [],
            },
        }],
    }
    body = json.dumps(card).encode("utf-8")
    req = urllib.request.Request(
        TEAMS_WEBHOOK, data=body,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"Teams post status: {resp.status}")
    except urllib.error.HTTPError as exc:
        print(f"::error::Teams webhook {exc.code}: {exc.read().decode('utf-8','replace')}",
              file=sys.stderr)


# --- Main -------------------------------------------------------------------

def main():
    if not CLICKUP_TOKEN:
        print("::error::CLICKUP_API_TOKEN is not set.", file=sys.stderr)
        sys.exit(1)

    try:
        tasks = fetch_clickup_tasks(CLICKUP_TOKEN)
    except Exception:
        # If ClickUp is unreachable, don't crash the whole workflow — emit an
        # empty report so the schedule stays visible.
        tasks = []

    buckets = classify(tasks)
    markdown = build_markdown(buckets)
    update_readme(markdown)
    snapshot = write_snapshot(markdown)

    report_url = (
        f"https://github.com/{REPO_SLUG}/blob/{DEFAULT_BRANCH}/{snapshot}"
        if REPO_SLUG else ""
    )
    post_to_teams(buckets, report_url)
    print(f"Report generated: {snapshot}")


if __name__ == "__main__":
    main()