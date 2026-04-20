WGLT Phase 2 Native Question System

This package is built to match your app's Phase 3 schema-based scenario engine.

Plug-and-play quickest method:
1. Back up your current files in /data/scenarios/
2. Replace these three files with the versions in this package:
   - real-life-expansion-v1.json
   - financial-expansion-v1.json
   - opportunity-job-expansion-v1.json
3. Keep all file names exactly the same.
4. Reload the app.

What changed:
- Preserved your existing scenarios already in those three files
- Appended new job-specific scenarios for ALL current jobs in jobs.json
- Used your native schema fields:
  id, category, mode, jobs, grade_band, title, prompt, step_tags, choices,
  triggers, consequence_paths, weight, repeat_rule, tags
- Used native choice fields:
  id, label, immediate_effects, delayed_hooks, reflection_tag, ledger_note,
  job_preview, job_previews
- Reused hook names already recognized by app.js where possible

Included extra files:
- *-v2-new-only.json = only the new scenarios, in case you want to inspect just the additions first.

Counts added:
- Real Life: 16 new scenarios
- Financial: 16 new scenarios
- Opportunity/Job: 16 new scenarios
- Total new native scenarios: 48
