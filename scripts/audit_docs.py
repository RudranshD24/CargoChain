from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
REQUIRED = [
    "START_HERE.md", "PROJECT_MASTER.md", "AGENT_RULES.md", "REQUIREMENTS.md",
    "ARCHITECTURE.md", "DATABASE.md", "API_SPEC.md", "UI_UX_SPEC.md",
    "SECURITY_THREAT_MODEL.md", "DATASET_PLAN.md", "EVALUATION_PLAN.md",
    "DEVELOPMENT_PLAN.md", "WORKFLOW.md", "DECISIONS.md",
    "TRACEABILITY_REPORT.md", "CONSISTENCY_AUDIT.md", "CHANGELOG.md",
    "DEMO_SCRIPT.md", "VIVA_SLIDES.md", "MASTER_PROMPT.md",
]
errors, warnings = [], []
for name in REQUIRED:
    if not (DOCS / name).is_file():
        errors.append(f"Missing required document: docs/{name}")

for path in sorted(DOCS.glob("*.md")):
    body = path.read_text(encoding="utf-8")
    for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", body):
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        local = (path.parent / target.split("#", 1)[0]).resolve()
        if not local.exists():
            errors.append(f"{path.name}: broken local link: {target}")
    if re.search(r"\b(TODO|TBD|FILL THIS|INSERT HERE)\b", body, re.I):
        warnings.append(f"{path.name}: contains a placeholder marker")

req = (DOCS / "REQUIREMENTS.md")
if req.exists():
    ids = re.findall(r"\b(?:FR-[A-Z]+-\d{2}|NFR-\d{2})\b", req.read_text(encoding="utf-8"))
    dupes = sorted({x for x in ids if ids.count(x) > 1})
    # Table references in prose can repeat IDs, so only check duplicate first-column IDs.
    first_cols = re.findall(r"^\|\s*((?:FR-[A-Z]+-\d{2})|(?:NFR-\d{2}))\s*\|", req.read_text(encoding="utf-8"), re.M)
    dupes = sorted({x for x in first_cols if first_cols.count(x) > 1})
    if dupes:
        errors.append("Duplicate requirement IDs: " + ", ".join(dupes))

print(f"CargoChain docs audit: {len(REQUIRED)} required documents checked.")
if warnings:
    print("Warnings:")
    for item in warnings: print(" - " + item)
if errors:
    print("Errors:")
    for item in errors: print(" - " + item)
    sys.exit(1)
print("PASS: required documentation structure and basic checks are valid.")
