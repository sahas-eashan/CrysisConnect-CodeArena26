# CodeArena 26 presentation outline

1. **Problem:** citizen flood and road-hazard reports are difficult to verify and coordinate across councils, crews and relief teams.
2. **Platform overview:** CrysisConnect citizen/NGO/government portals, AWS infrastructure and Flutter app. Explain how the components support the disaster-response workflow.
3. **Two entry points:** photo/GPS reports and independent replayed weather/river observations create persistent cases.
4. **Five evidence checks:** two plain-code checks plus image/location/risk AI. Show reasons, missing evidence and the aggregator's uncalibrated confidence.
5. **Human control:** request more evidence, confirm or reject, record the basis, then dispatch crews and relief. Show the audit trail.
6. **Shared response:** scoped in-app broadcasts, maps, screened road candidates, shelter reservations and photographic closure.
7. **Demo:** follow `demo-script.md`; include a missing/failed AI case to show how human verification works without invented certainty.
8. **Engineering evidence:** domain and browser tests, TypeScript/build, Android analysis/tests. Distinguish these from live cloud/device validation.
9. **Next deployment step:** provision verified shelter/road data, connect the team's model and cloud credentials, and rehearse with real role accounts.
