---
name: intake-live-component
description: Which intake/chat component is actually live vs dead code in the frontend
metadata:
  type: project
---

The live conversational intake is `IntakeStudio` (frontend/src/features/setup/IntakeStudio.tsx),
rendered at `app/projects/[id]/setup/identity/page.tsx`. It uses the `useInterview` hook
(intake/useInterview.ts) + `ChatPanel` (left chat) + `DesignBrief` (right artifact: summary +
follow-up questions). New projects land here via ProjectForm → setupIdentity.

DEAD/legacy code that redirects to setup/identity or is unimported — do NOT edit these expecting
the live flow to change: `ChatIntake.tsx`, `ScriptUpload.tsx`, `IdentityStep.tsx`/`BodyStep.tsx`/
`PitchStep.tsx`, and the `setup/pitch`, `setup/body`, `intake`, `questions`, `story-analysis`,
`outline`, `content`, `design`, `editor`, `review`, `export` route pages (all `redirect(...)`).

The live intake has NO router navigation on script upload — uploading runs one interview turn
and updates the right `DesignBrief` panel in place. A perceived "redirect to more questions" is
DesignBrief presentation, not navigation.

**Why:** there are two parallel intake implementations; the obvious-looking `ChatIntake`/
`ScriptUpload` are not wired in. **How to apply:** for intake/chat-agent behavior changes, edit
`useInterview.ts`, `ChatPanel.tsx`, `DesignBrief.tsx`, and backend `intake_interview.py`.
