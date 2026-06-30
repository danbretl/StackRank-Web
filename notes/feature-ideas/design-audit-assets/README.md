# StackRank redesign references

This directory contains the approved Phase 0 evidence and visual references for the redesign governed by [`../design-audit.md`](../design-audit.md).

## Baseline

`baseline/` is the deterministic before-state screenshot set. Regenerate it from the repository root with:

```bash
npm run screenshots -- --label=phase-0-before --output-dir=notes/feature-ideas/design-audit-assets/baseline
```

The manifest records viewport sizes and the expected open state for each screenshot.

## Concepts

`concepts/` contains the approved Image Gen reference set:

- `desktop-primary-workspace.png`
- `mobile-rank-view.png`
- `shared-movie-item-anatomy.png`
- `responsive-comparison.png`
- `mobile-all-packs-workspace.png`
- `mobile-movie-detail-sheet.png`
- `mobile-share-studio-controls.png`

The exact written specification in the audit takes precedence where generated labels or device framing conflict with existing StackRank behavior.
