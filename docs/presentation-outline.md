# CodeArena 26 presentation outline

1. **Problem:** citizen flood and road-hazard reports are difficult to verify and coordinate across councils, crews and relief teams.
2. **Platform overview:** citizen, NGO, government and relief web portals, anonymous public map, AWS infrastructure and Flutter app. The responsive web portals provide the photo-to-clearance workflow; Android supports SOS, resources and screened routing.
3. **Two entry points:** photo/GPS reports and independent replayed weather/river observations create persistent cases.
4. **Five evidence checks:** two plain-code checks plus image/location/risk AI, server-extracted photo GPS and independent nearby observations. Show reasons, urgency, missing evidence and uncalibrated confidence.
5. **Human control:** automatic ward/council assignment, jurisdiction-scoped queues, review and reassignment, community requests and reversible reporting bans. Show the audit trail.
6. **Shared response:** nearby alerts with automatic route guidance, a public map, nearest eligible shelter allocation, crew dispatch and photographic closure. Demonstrate explicit unavailable routes and crew-assisted extraction when needed.
7. **Demo:** follow the [demo script](demo-script.md); include a missing/failed AI case to show how human verification works without invented certainty.
8. **Engineering evidence:** domain and browser tests, TypeScript/build, Android analysis/tests. Distinguish these from live cloud/device validation.
9. **Next deployment step:** provision verified shelters, roads and ward boundaries, connect model/cloud credentials, run the live adapter probes and rehearse with real council-scoped role accounts.
