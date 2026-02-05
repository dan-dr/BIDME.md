---

## 2026-02-05 — Fix bid `url` → `destination_url` field name in README

**Agent:** BIDME
**Project:** /Users/dan/Projects/bidme
**Loop:** 00001
**Doc ID:** README-001
**Gap ID:** GAP-010

### Change Type
INACCURATE → Corrected

### README Section
For Advertisers

### What Was Changed
Changed `url` to `destination_url` in both the YAML bid example and the fields table. The README previously showed `url` as the field name, but the code (`src/lib/validation.ts`) parses `destination_url`. Bids using `url` would silently fail validation.

### Content Added/Changed
```markdown
# In YAML example:
  destination_url: "https://yourcompany.com"
# In table:
| `destination_url` | Yes | Click-through destination URL |
```

### Verification
- [x] Change matches the proposed fix from LOOP_00001_PLAN.md
- [x] Formatting matches existing README style
- [x] No broken links or references introduced
- [x] Content is accurate based on code review (confirmed `destination_url` in validation.ts line 6, 36)
