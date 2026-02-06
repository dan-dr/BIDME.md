# Errors

## ERR-20260205-001 ps-awk-filter

**Logged**: 2026-02-05T18:51:26Z
**Priority**: high
**Status**: pending
**Area**: infra

### Summary
Failed awk filter while listing bun test processes

### Error
```
zsh:1: parse error near `}'
```

### Context
- Command attempted: ps -axo pid,ppid,pcpu,etime,comm,cwd,args | awk '$5=="bun" && $7=="test" {print}'
- Environment: zsh

### Suggested Fix
Quote awk program differently or avoid `cwd` column; use ps + grep then lsof for cwd.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md

---
