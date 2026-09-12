# CodeArena 26 demonstration

Start `npm run dev`. Open `/citizen/hazards`, `/admin/hazards` and `/ngo/hazards` in separate tabs. Use two different photos: the original report and a new clearance image. Demo shelter names and weather readings are labeled as samples.

1. **Citizen report:** capture GPS, select flood/blocked road/fallen tree, add a title, ward/locality, description and photograph. Optionally request drinking water and shelter. Submit and inspect the saved case and its five check records.
2. **Explain evidence:** show the plain-code weather and distinct-reporter cluster checks. With server Gemini configured, show image/location/risk outputs and the aggregate verdict. Without it, show the explicit unavailable state and human review; do not describe this as a live AI diagnosis.
3. **Independent detection:** run `npm run weather:replay` or choose the flood scenario in government monitoring. A simulated gauge threshold opens a case and sends a nearby in-app warning without a citizen complaint. Explain the difference between an early warning and a confirmed hazard.
4. **Information loop:** on the citizen case, the officer records a reviewer note and requests more information. The citizen adds another photograph and notes; show the preserved history and reevaluation.
5. **Confirmation and broadcast:** the officer records a reason and confirms the citizen hazard. Its risk area appears on the map. Share the citizen's GPS to see geographically applicable warnings. Route screening returns a candidate that avoids recorded hazards or explicitly reports that no screened route is available.
6. **Relief and dispatch:** reserve shelter places outside risk areas, note the relief organization/supplies, and assign the case to `demo-ngo`. Show the shelter capacity reduction and NGO queue.
7. **Crew closure:** in the NGO tab, submit a different clearance photo and field notes. The case resolves, the active hazard disappears from the map, and the citizen's open tab updates automatically.
8. **Feedback:** show the review history and bounded confirmation threshold. Shelter reservations remain until an explicit release records that occupants have left.

If cloud services are configured, optionally show the existing resource inventory/SOS dashboards and government alert composer. Sending real SMS/email is a separate deliberate operation; the weather replay only changes the in-app demo state.

For an automated rehearsal, run `npm run test:e2e`. This drives the actual report, information request, review, relief, assignment and clearance UI with a local isolated store and explicit fixture photos.
