#!/usr/bin/python3
"""Export a bounded, filtered view of deployment and integrity journal events."""
import json
import ipaddress
import os
import re
import subprocess
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

DOMAINS = ("osher.cc", "mazonhaosher.co.il")
DIRECTORY = Path("/var/lib/osher-console-events")
PAGE_VIEWS = Path("/var/log/nginx/osher-page-views.log")
RETENTION_DAYS = 14
MAX_PER_GROUP = 1250
UNIT_TYPES = {
    **{f"osher-site-{kind}@{site}.service": (site, label)
       for site in DOMAINS
       for kind, label in (("deploy", "Deploy"), ("build", "Build"), ("notify", "GitHub Actions"))},
    "osher-integrity-check.service": ("server", "AIDE"),
    "fail2ban.service": ("server", "Fail2ban"),
}
JOURNAL_FIELDS = {
    "PRIORITY": "priority",
    "_PID": "processId",
    "_COMM": "process",
    "_SYSTEMD_INVOCATION_ID": "invocationId",
    "SYSLOG_IDENTIFIER": "identifier",
    "MESSAGE_ID": "messageId",
    "RESULT": "result",
    "JOB_TYPE": "jobType",
    "JOB_RESULT": "jobResult",
    "_BOOT_ID": "bootId",
}

UNIT_EVENTS = (
    ("Starting ", "info", "started"),
    ("Finished ", "success", "finished"),
    ("Failed to start ", "error", "failed"),
)
AUDIT_CHANGES = {
    "osher_web_config": "Web server configuration changed",
    "osher_tunnel_config": "Cloudflare Tunnel configuration changed",
    "osher_ssh_config": "SSH configuration changed",
    "osher_ssh_protection": "Fail2ban configuration changed",
    "osher_privilege_config": "Privilege configuration changed",
    "osher_service_config": "systemd unit configuration changed",
    "osher_service_code": "Deployment service code changed",
}


def describe(message, component):
    for prefix, level, detail in UNIT_EVENTS:
        if message.startswith(prefix) and (level == "error" or component == "GitHub Actions"):
            return level, f"{component} {detail}", {"phase": detail, "trigger": "GitHub Actions" if component == "GitHub Actions" else "systemd"}
    if component == "Deploy":
        match = re.fullmatch(r"Deployed [\w.-]+ at ([0-9a-f]{40})", message)
        if match:
            return "success", f"Release {match[1][:7]} is serving traffic", {"commit": match[1], "healthCheck": "passed", "outcome": "published"}
        if message.startswith("Health check failed"):
            return "error", "Health check failed. Previous release restored.", {"healthCheck": "failed", "rollback": "restored"}
        if message.startswith("Rollback failed"):
            return "error", "Rollback failed. Inspect the production journal.", {"rollback": "failed", "operatorAction": "Review deployment journal"}
    if component == "Build":
        match = re.fullmatch(r"Waiting for successful CI for \S+ at ([0-9a-f]{40}) \(status: ([a-z_]+)\)", message)
        if match:
            return "warning", f"Release {match[1][:7]} is waiting for CI ({match[2]})", {"commit": match[1], "ciStatus": match[2], "outcome": "deferred"}
        match = re.fullmatch(r"✓ built in ([\d.]+)s", message)
        if match:
            return "success", "Vite build completed", {"tool": "Vite", "durationSeconds": float(match[1]), "outcome": "built"}
        match = re.fullmatch(r"added (\d+) packages? in (\d+)s", message)
        if match:
            return "info", "Install completed", {"tool": "npm", "packages": int(match[1]), "durationSeconds": int(match[2])}
        if re.fullmatch(r"vite v[\w.-]+ building for production\.\.\.", message):
            return "info", "Vite production build started", {"tool": "Vite", "phase": "build"}
        if message == "transforming...":
            return "info", "Transforming source modules", {"tool": "Vite", "phase": "transform"}
        match = re.fullmatch(r"✓ (\d+) modules? transformed\.", message)
        if match:
            return "success", "Source modules transformed", {"tool": "Vite", "modules": int(match[1]), "phase": "transform"}
        if message == "rendering chunks...":
            return "info", "Rendering output chunks", {"tool": "Vite", "phase": "render"}
        if message == "computing gzip size...":
            return "info", "Measuring compressed output", {"tool": "Vite", "phase": "measure"}
        match = re.match(r"npm (?:warn|WARN) deprecated ([\w@./-]{1,100}):", message)
        if match:
            return "warning", f"Deprecated npm dependency {match[1]}", {"tool": "npm", "package": match[1]}
        match = re.match(r"npm (?:error|ERR!) code ([A-Z][A-Z0-9_]{1,24})$", message)
        if match and match[1] != "ENOSPC":
            return "error", f"npm failed with {match[1]}", {"tool": "npm", "error": match[1]}
        if "Out of memory" in message or "killed by the OOM killer" in message:
            return "error", "Build hit the server memory limit", {"resource": "memory", "outcome": "terminated"}
        if "ENOSPC" in message:
            return "error", "Build ran out of disk space", {"resource": "disk", "error": "ENOSPC"}
    if component == "AIDE":
        if "AIDE found differences" in message:
            return "warning", "Integrity baseline differences detected", {"baseline": "changed", "operatorAction": "Review changed paths locally"}
        if "AIDE found no differences" in message:
            return "success", "Protected files match the integrity baseline", {"baseline": "matched", "outcome": "verified"}
        match = re.fullmatch(r"(Added|Removed|Changed) entries:\s+(\d+)", message)
        if match and int(match[2]):
            return "warning", "AIDE reported integrity differences", {"change": match[1].lower(), "entries": int(match[2])}
    if component == "Fail2ban":
        match = re.search(r"\[sshd\]\s+(Ban|Unban)\s+([0-9a-fA-F:.]+)(?:\s|$)", message)
        if match:
            try:
                address = str(ipaddress.ip_address(match[2]))
            except ValueError:
                return None
            blocked = match[1] == "Ban"
            details = {"jail": "sshd", "action": "blocked" if blocked else "unblocked", "sourceIp": address}
            if address == "192.0.2.123":
                details["context"] = "Firewall verification"
            return ("warning" if blocked else "info",
                    "Fail2ban blocked an SSH source." if blocked else "SSH block expired or was lifted.",
                    details)
    return None


def journal_details(record, unit):
    details = {"source": "systemd journal", "unit": unit,
               "timestampMicros": int(record["__REALTIME_TIMESTAMP"])}
    for field, name in JOURNAL_FIELDS.items():
        value = record.get(field)
        if isinstance(value, str) and re.fullmatch(r"[a-zA-Z0-9_.@-]{1,128}", value):
            details[name] = int(value) if field in {"PRIORITY", "_PID"} and value.isdecimal() else value
    return details


def host_events():
    command = [
        "journalctl", "--no-pager", "--quiet", f"--since={RETENTION_DAYS} days ago",
        "--output=json", "--output-fields=" + ",".join(("UNIT", "_SYSTEMD_UNIT", "MESSAGE", *JOURNAL_FIELDS)),
    ]
    events = []
    queries = (
        ("Systemd", ["--lines=2000", "_PID=1"]),
        ("Kernel", ["--lines=500", "--priority=warning", "_TRANSPORT=kernel"]),
        ("Host services", ["--lines=1000", "--priority=warning"]),
    )
    for component, filters in queries:
        try:
            output = subprocess.check_output([*command, *filters], text=True, timeout=2)
        except (OSError, subprocess.SubprocessError):
            continue
        for line in output.splitlines():
            record = json.loads(line)
            unit = record.get("UNIT") or record.get("_SYSTEMD_UNIT")
            if component == "Kernel":
                if not isinstance(record.get("MESSAGE"), str):
                    continue
                text = kernel_summary(record["MESSAGE"])
                unit = "kernel"
            elif not isinstance(unit, str) or unit in UNIT_TYPES or not re.fullmatch(r"[a-zA-Z0-9_.@:-]{1,200}\.service", unit):
                continue
            elif component == "Systemd":
                action = record.get("JOB_TYPE")
                result = record.get("JOB_RESULT")
                if action not in ("start", "stop", "restart", "reload") or not isinstance(result, str):
                    continue
                text = f"{unit} {action} completed" if result == "done" else f"{unit} {action} failed"
            else:
                if record.get("_PID") == "1" or record.get("PRIORITY") not in ("0", "1", "2", "3", "4"):
                    continue
                text = f"{unit} reported a journal alert"
            context = journal_details(record, unit)
            date = datetime.fromtimestamp(context["timestampMicros"] / 1_000_000, timezone.utc)
            if component == "Systemd":
                level = "success" if result == "done" else "error"
            else:
                level = "warning" if context.get("priority") == 4 else "error"
            events.append(dict(time=date.isoformat(), site="server", component=component,
                               level=level, message=text, details=context))
    return events


def kernel_summary(message):
    message = message.lower()
    for pattern, summary in (
        (r"out of memory|oom.kill|oom-killer", "Kernel reported an out-of-memory condition"),
        (r"i/o error|filesystem error|read-only file system", "Kernel reported a storage error"),
        (r"soft lockup|hard lockup|watchdog", "Kernel reported a watchdog or CPU stall event"),
        (r"thermal|overheating", "Kernel reported a thermal event"),
        (r"segfault|general protection fault", "Kernel reported a process fault"),
    ):
        if re.search(pattern, message):
            return summary
    return "Kernel reported a journal alert"


def collect():
    command = [
        "journalctl", "--no-pager", "--quiet", "--since=14 days ago", "--lines=1600",
        "--output=json", "--output-fields=" + ",".join(("UNIT", "_SYSTEMD_UNIT", "MESSAGE", *JOURNAL_FIELDS)),
    ]
    events = []
    # Bound each unit separately so a busy service cannot hide release events.
    for unit, (site, component) in UNIT_TYPES.items():
        output = subprocess.check_output([*command, "--unit", unit], text=True, timeout=2)
        for line in output.splitlines():
            record = json.loads(line)
            journal_unit = record.get("UNIT") or record.get("_SYSTEMD_UNIT")
            message = record.get("MESSAGE")
            if journal_unit != unit or not isinstance(message, str):
                continue
            details = describe(message, component)
            if details is None:
                continue
            level, text, context = details
            context.update(journal_details(record, unit))
            date = datetime.fromtimestamp(context["timestampMicros"] / 1_000_000, timezone.utc)
            events.append(dict(time=date.isoformat(), site=site, component=component,
                               level=level, message=text, details=context))
    events.extend(host_events())
    events.extend(audit_events())
    events.extend(visit_events())
    return events


def visit_events():
    sites = {*DOMAINS, "deploy.osher.cc"}
    pages = {"Home page", "Console demo", "Console", "Public page"}
    protocols = {"HTTP/1.0", "HTTP/1.1", "HTTP/2.0", "HTTP/3.0"}
    try:
        with PAGE_VIEWS.open("rb") as source:
            offset = max(0, source.seek(0, os.SEEK_END) - 32768)
            source.seek(offset)
            if offset:
                source.readline()
            lines = source.read(32768).splitlines()
    except OSError:
        return []
    events = []
    for line in lines:
        try:
            record = json.loads(line)
            site, page, protocol = record["site"], record["page"], record["originProtocol"]
            if site not in sites or page not in pages or protocol not in protocols:
                continue
            timestamp = float(record["time"])
            if timestamp < time.time() - RETENTION_DAYS * 86400:
                continue
            try:
                client_ip = str(ipaddress.ip_address(record["clientIp"]))
            except (ValueError, TypeError, KeyError):
                client_ip = None
            origin_seconds = float(record["originSeconds"])
            details = {"source": "Nginx access log", "timestampSeconds": timestamp,
                       "page": page, "httpStatus": int(record["httpStatus"]),
                       "originSeconds": origin_seconds,
                       "originResponseMs": round(origin_seconds * 1000),
                       "responseBytes": int(record["responseBytes"]), "originProtocol": protocol}
            if client_ip:
                details["clientIp"] = client_ip
            date = datetime.fromtimestamp(timestamp, timezone.utc).isoformat()
        except (ValueError, TypeError, KeyError, OverflowError, OSError):
            continue
        events.append(dict(time=date, site=site, component="Visits", level="info",
                           message="Page loaded", details=details))
    return events


def audit_events():
    try:
        with Path("/var/log/audit/audit.log").open("rb") as source:
            offset = max(0, source.seek(0, os.SEEK_END) - 262144)
            source.seek(offset)
            if offset:
                source.readline()
            records = source.read(262144).decode("utf-8", errors="replace").splitlines()
    except OSError:
        return []
    events = []
    for line in records:
        if not line.startswith("type=SYSCALL ") or " success=yes " not in line:
            continue
        match = re.search(r'msg=audit\((\d+\.\d+):(\d+)\).*\bkey="(osher_[a-z_]+)"', line)
        if not match or match[3] not in AUDIT_CHANGES:
            continue
        date = datetime.fromtimestamp(float(match[1]), timezone.utc)
        details = {"source": "Linux audit log", "timestampSeconds": float(match[1]),
                   "auditEventId": match[2], "rule": match[3], "result": "success"}
        for field, name in (("syscall", "syscallNumber"), ("pid", "processId"), ("ppid", "parentProcessId")):
            value = re.search(rf"\b{field}=(\d+)(?=\s|$)", line)
            if value:
                details[name] = int(value[1])
        architecture = re.search(r"\barch=([0-9a-f]{8})(?=\s|$)", line)
        if architecture:
            details["architecture"] = architecture[1]
        process = re.search(r'\bcomm="([\w.-]{1,32})"', line)
        if process:
            details["process"] = process[1]
        events.append(dict(time=date.isoformat(), site="server", component="Auditd",
                           level="info", message=AUDIT_CHANGES[match[3]], details=details))
    return events[-35:]


def security_metrics():
    data = dict(sampled=iso_now())
    try:
        audit = subprocess.check_output(["auditctl", "-s"], text=True, timeout=2)
        rules = subprocess.check_output(["auditctl", "-l"], text=True, timeout=2)
        lost = re.search(r"^lost\s+(\d+)", audit, re.MULTILINE)
        if lost:
            data["audit"] = dict(lost=int(lost[1]), watches=sum(line.startswith("-w ") for line in rules.splitlines()))
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        jail = subprocess.check_output(
            ["fail2ban-client", "status", "sshd"], text=True, timeout=2, stderr=subprocess.DEVNULL,
        )
        banned = re.search(r"Currently banned:\s*(\d+)", jail)
        failed = re.search(r"Total failed:\s*(\d+)", jail)
        if banned and failed:
            data["ssh"] = dict(banned=int(banned[1]), failed=int(failed[1]))
    except (OSError, subprocess.SubprocessError):
        pass
    return data


def iso_now():
    return datetime.now(timezone.utc).isoformat()


def write_json(name, data):
    with tempfile.NamedTemporaryFile(dir=DIRECTORY, delete=False, mode="w", encoding="utf-8") as target:
        filename = target.name
        try:
            json.dump(data, target)
            target.flush()
            os.chmod(filename, 0o644)
            os.replace(filename, DIRECTORY / name)
        finally:
            Path(filename).unlink(missing_ok=True)


def retain_events(recent):
    try:
        previous = json.loads((DIRECTORY / "events.json").read_text())
    except (OSError, ValueError):
        previous = []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)).isoformat()
    unique = {}
    for event in [*previous, *recent]:
        if event["time"] >= cutoff:
            key = (event["time"], event["site"], event["component"], event["level"], event["message"])
            unique[key] = event
    ordered = sorted(unique.values(), key=lambda event: event["time"], reverse=True)
    visits = [event for event in ordered if event["component"] == "Visits"][:MAX_PER_GROUP]
    host_components = {"Systemd", "Kernel", "Host services"}
    host = [event for event in ordered if event["component"] in host_components][:MAX_PER_GROUP]
    operational = [event for event in ordered if event["component"] not in host_components | {"Visits"}][:MAX_PER_GROUP]
    return sorted([*visits, *operational, *host], key=lambda event: event["time"], reverse=True)


def main():
    write_json("events.json", retain_events(collect()))
    write_json("security.json", security_metrics())


if __name__ == "__main__":
    main()
