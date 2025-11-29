## Script To Use
Hey {name}, I’m Blake Daniels. I build websites and do media and marketing to help people grow their business. I saw your profile on your brokerage’s site. Do you have your own personal website or do you just use the brokerage site?

## Implementation Details
1. **Template Support**
- Use `{name}` placeholder; optionally `{brokerage}` later.
- Store the script in `localStorage` (`smsScript`) so it persists.

2. **UI Additions**
- Add a small “Script” settings button in the header that opens a modal with a textarea prefilled with your script.
- Save/Close updates `smsScript` immediately.

3. **Dynamic SMS Links**
- On number tap, compute the body from the template:
  - Resolve `{name}` from the agent card.
  - Build the URL: prefer iOS format `sms:/open?addresses=${phone}&body=${encodeURIComponent(body)}`; fallback `sms:${phone}&body=${encodeURIComponent(body)}`.
- Continue to auto-check, move to Completed, and update counts after click.

4. **Apply To All Agents**
- Wire both hard-coded and newly added agents to use the same link click handler.
- If no script is set, fall back to plain `sms:` links.

5. **Testing**
- Set the provided script.
- Tap several numbers on iPhone Safari; Messages opens with body prefilled and name injected.
- Verify movement to Completed and counts.

## Notes
- Target iPhone; Android support can be added later (`smsto:` fallback) if you want.
- Leaves your existing features untouched.

If this plan looks good, I’ll implement and push it using your script by default.