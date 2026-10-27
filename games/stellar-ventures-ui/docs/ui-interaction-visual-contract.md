# Stellar Ventures interaction visuals

## Visual intents

- **Board build targeting.** While a player chooses where to place an Outpost (Expand Network, Create Wormhole, Jerry-Rig, Private Contractor), legal hexes are highlighted and every other hex is dimmed under a mask and stops taking clicks. Map art, Borders and Outposts already on the board are otherwise unchanged.
- **Wormhole pick.** The first click on a legal Create Wormhole hex only picks it: the general legal-hex highlight gives way to that hex, its nearest Outpost and the straight path between them, all unmasked, and the action panel previews cost and Mining Capacity gain. A second click on the same hex submits.
- **Multi-hex selection.** Develop Planet(s), Forced Ship Purchase and tax loans toggle hexes in and out of a pending set, shown as selected on the board, until the panel submits or cancels.
- **Sign The Agreement offer.** While a Corporation is offered Sign The Agreement, the Alien Planet hexes it holds Outposts on pulse on the board for everyone, matching the panel's planet count. The President's walkthrough (Sign, Issue Share, Flip the Alien Planet Tile) stays on the action panel until they press Continue, even after the submitted action moves the game on.
- **Secret Agents reveal.** After Increase Alien is chosen, the action panel keeps showing the flipped tile for a few seconds before the game moves on.
- **Reveal overlays.** Full-screen reveals (First Ship Ordered, Border Closed, Pay Taxes, Hostile Takeover, The Agreement Is Signed) show once per viewer per event and are dismissed with Continue. Border Closed also pulses the closed Border's segments on the map behind the dialog in that Border's color.
- **Power card zoom.** Hovering any Corporate Power card image anywhere opens a larger copy beside it, kept on screen. It never takes clicks. Mouse only; touch has no hover.
- **Takeover preview.** The alien head in a player's Liquidation Value box toggles that card to the value with Hostile Takeover assessed, and shows that player's at-risk Shares as Alien Shares. It affects only that card for that viewer.
- **Signed glow.** A Share of a Corporation that has signed The Agreement carries a green glow wherever it is drawn. It is game state, not a selection, and never changes clicks.

## Coexistence and precedence

- Board targeting has one owner: the board's active action mode. An in-progress Private Contractor build wins outright. Otherwise the session's explicit mode wins, falling back in order to Expand Network, Create Wormhole, Jerry-Rig, Private Contractor, Amethyst home planet, then tax loan. Develop Planet(s) and Dismantling Outposts are active only when explicitly chosen, never as a fallback.
- Masking applies only to the four Outpost-placing modes. A picked Wormhole target, its nearest Outpost and the path between them stay unmasked even though they are not otherwise legal targets.
- The Sign The Agreement planet pulse and the Border Closed pulse are separate effects and can show together on the map.
- Reveal overlays can be pending at once. Each is its own full-screen layer and they stack rather than queue: Power card zoom is on top, then The Agreement Is Signed, then the others in mount order, with Pay Taxes above Border Closed. The Agreement Is Signed waits while the President's own walkthrough is still on screen.
- Signed glow and takeover preview coexist: a signed, at-risk Share shows as an Alien Share while its glow stays.

## Shared visual state

| Value | Meaning | Producer → consumers | Cleared | History / replay |
| --- | --- | --- | --- | --- |
| Board action mode | Which hex action clicks submit when several are legal | Expand Network, Order Ships, Investor and Alien Tech panels → board | Before every new displayed state | Not set while viewing history (no legal actions) |
| Wormhole pick | Tentative Create Wormhole target | Board → board, Expand Network panel | Before every new displayed state; Undo cancels it first | Same as above |
| Investor build Corporation | Corporation a Jerry-Rig or Private Contractor build is for | Investor panel → board | Explicitly after a Jerry-Rig and when a build finishes, never by a new state, since one build spans several states | Server's expanding Corporation takes over once confirmed |
| Pending hex sets (Develop Planets, Forced Ship Purchase, tax loans) | Hexes picked but not submitted | Board ↔ owning panel | On submit or cancel; Undo removes the last pick; tax loans also before every new state | Local only |
| Open picker (Investor, Alien Tech) | A choice opened but not submitted | Owning panel | By the panel; Undo cancels it | Local only |
| Sign The Agreement staged step | Walkthrough position before the tile flip | Sign The Agreement panel | Before every new state; Undo steps back one stage | Local only |
| Sign The Agreement reveal | Keeps the walkthrough on screen after the submitted action moves the game on | Sign The Agreement panel → action panel, Agreement and First Ship overlays | When the President presses Continue; survives the state update it causes | — |
| Secret Agents reveal | Keeps the flipped tile on screen after submit | Secret Agents panel → action panel | Automatically after a few seconds | — |
| Border Closed level | Border the open dialog is about | Border Closed overlay → board pulse | When the dialog is dismissed or unmounts | Overlay not shown while viewing history |
| Seen reveals | Which reveals this viewer has dismissed, per game | Each reveal overlay | Never cleared by navigation; saved to the account with a browser fallback, and overlays wait for the account copy before showing | Border Closed, Pay Taxes and Agreement overlays are hidden while viewing history |

Undo works through local steps first (newest pick, then staged walkthrough steps, then open pickers) and reverts a submitted action only when nothing local is pending.

## Render ownership

- The board owns all hex highlights, masks, selection marks, the Wormhole path, the Sign The Agreement planet pulse and the Border Closed pulse. Panels and overlays only set the shared values above.
- Each reveal overlay owns its own full-screen layer, mounted once on the game table. The Agreement cinematic keeps its starfield fixed and scrolls its content when taller than the screen.
- Power card zoom is mounted once on the game table and finds cards by image source. It has no hit target.
- The takeover preview is owned by the player card and changes nothing outside it.

## Verification scenarios

| Scenario | Expected | Status |
| --- | --- | --- |
| Border closes and taxes are collected together; Continue on both | Both dismiss; neither returns after reload; the Border pulse stops when its dialog closes | Exercised, headless Chrome at phone size, Tax Town replay |
| The Agreement Is Signed on a 375×667 screen | Content scrolls under a fixed backdrop; Continue reachable | Exercised, headless Chrome, Alpha Test replay |
| Share auction for a Corporation with ordered Ships | Ordered Ships appear hatched and faded after delivered ones | Exercised, headless Chrome |
| Amount shown in red text | Credits sign turns red with it | Exercised, headless Chrome, Pay Taxes reveal |
| Expand Network with Create Wormhole also legal | Toggle switches targets; mask follows the chosen mode | Manual |
| Pick a Wormhole hex, then Undo | Path highlight clears, general legal highlight and mask return, nothing submitted | Manual |
| Sign The Agreement walkthrough, Back/Undo before the flip | Walks back one stage at a time; after the flip the panel stays until Continue | Manual |
| Step into History with a reveal pending, then return to Live | No reveal shows in History; it shows once on return if not yet seen | Manual |
| Hover a Power card near the screen edge | Zoom stays fully on screen and does not block the click | Manual |
| Toggle the alien head on one player card | Only that card changes value and at-risk Shares; other viewers unaffected | Manual |
