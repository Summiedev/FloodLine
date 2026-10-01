# FloodLine Remotion demo video

This composition is a deterministic hackathon presentation of the same controlled
Lagos scenario seeded by `backend/prisma/demo-seed.ts`.

It uses the seeded inland journey:

- Ikeja → Yaba
- Oshodi Interchange, Ikeja GRA access road, and Ojota interchange reports
- the controlled official-warning polygon for inland Lagos routes
- the dormant severe hazard activated during navigation
- Route A / Route B comparison, reroute, and in-app alert history

The video is presentation-only. It does not claim that the records are live
authority data, and it does not claim that any route is guaranteed safe.

## Render

```powershell
Set-Location C:\Users\USER\Desktop\Projects\Floodline\demo-video
npm install
npm run typecheck
npm run render
```

Output:

```text
demo-video/out/floodline-demo.mp4
```

Preview interactively with:

```powershell
npm run start
```
