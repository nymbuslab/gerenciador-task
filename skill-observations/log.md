# Skill Observation Log

Observations captured during task-oriented work.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = skill updated/created | DECLINED (YYYY-MM-DD) = user decided not to pursue - resolved statuses always carry their resolution date

---

## 2026-09-01

### Observation 1: Filter large generated directories at the source

**Status:** OPEN
**Date:** 2026-09-01
**Session context:** Continuing a planned implementation task in a TypeScript/Supabase project.
**Skill:** iniciar-sessao
**Type:** open-source
**Phase/Area:** Lightweight repository discovery

**Issue:** A recursive PowerShell file listing attempted to exclude dependency folders with a post-filter and still traversed a very large `node_modules` tree, producing excessive output before being interrupted.

**Suggested improvement:** In discovery steps, prefer `rg --files` with ignore rules or commands that exclude generated directories before traversal starts; avoid recursive `Get-ChildItem` over the project root unless the depth and exclusions are structurally enforced.

**Principle:** Fast context gathering should prune generated directories before traversal, not after output is already being produced.
