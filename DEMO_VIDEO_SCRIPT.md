# FloodLine demo video voiceover

The Remotion composition at `demo-video/` is the deterministic visual version
of this script. It uses the seeded inland Ikeja–Yaba scenario rather than live
provider data, so the hackathon recording is repeatable.

Render it with:

```powershell
Set-Location C:\Users\USER\Desktop\Projects\Floodline\demo-video
npm install
npm run typecheck
npm run render
```

Suggested length: 75–90 seconds. Keep the seeded `Demo` labels visible in
the recording. This script describes reported risk, not guaranteed safety.

## 0:00–0:10 — The problem

**Screen:** Open the Lagos map with the seeded demo markers visible.

**Voiceover:**

> When heavy rain changes the roads we know, the hardest question is often
> not “Can I still move?” It is “What do we know right now, and what is the
> better-informed choice?”

## 0:10–0:22 — A shared picture

**Screen:** Slowly move across the incident markers and the official warning.

**Voiceover:**

> FloodLine brings community reports and official warnings into one clear
> picture. These markers are deliberately seeded demo records, but the
> experience shows how people can see nearby evidence before they leave.

## 0:22–0:38 — Choosing a route

**Screen:** Open Route, choose `Use controlled Lagos demo trip`, trigger the
hazard, then show the route comparison.

**Voiceover:**

> I’m travelling from Ikeja toward Yaba. The fastest route
> is not always the best-informed route. In this seeded scenario, Route B has
> a reported hazard while Route A has lower reported flood risk.

## 0:38–0:55 — The journey changes

**Screen:** Start navigation on the faster route. Trigger the seeded hazard.
Show the moving demo marker and wait for the route update.

**Voiceover:**

> And the decision does not stop when the journey starts. As conditions change,
> FloodLine monitors the active route. When new evidence affects the trip, it
> can recommend a lower reported-risk alternative within the time policy.

## 0:55–1:08 — A useful alert

**Screen:** Show `Route updated`, then open the notification simulator.

**Voiceover:**

> The message is designed to be useful under pressure: what changed, why it
> matters, and what option is available next. The notification preview is
> simulation-only for this demo; no real message is sent.

## 1:08–1:20 — Close

**Screen:** Return to the updated route or map overview.

**Voiceover:**

> FloodLine does not promise a perfectly safe road. It helps people make a
> clearer decision from the flood information available now—before the next
> turn, and before uncertainty becomes an emergency.

## Recording notes

- Run `npm run demo:seed` before Take A.
- Run it again before Take B so the dormant route hazard is reset.
- Use `npm run demo:trigger-hazard` only at the marked moment.
- Keep `Demo` labels and the notification simulator disclaimer visible.
- Use a calm, human voice; pause briefly after “the journey changes” and before
  the final sentence.
- Do not call seeded records live authority data or describe a route as
  guaranteed safe.
