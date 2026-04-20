WGLT Phase 3 Engine Refactor v1

What this package does
- loads scenario-index.json and the foundation scenario packs
- filters JSON scenarios by mode, job, step, and monthly focus
- chooses a weighted random scenario
- applies immediate effects
- queues delayed hooks into the existing consequence engine

Current mapping
- Life button -> real_life foundation pack
- Financial button -> financial foundation pack
- Job button -> opportunity foundation pack
- Elite mode can occasionally route financial clicks into elite_credit

Fallback behavior
- If a foundation pack is missing or no scenario matches, the legacy app behavior still runs.

Important note
- This is a bridge refactor, not a total engine replacement.
- Legacy systems stay in place so the app remains playable while the new JSON path is tested.
