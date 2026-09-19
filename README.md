# Rally Club — Friendly Doubles

A responsive badminton tournament dashboard for eight doubles pairs: two round-robin pools, then quarterfinals, semifinals, and a final.

## Included

- Live/upcoming/played fixture filters and pool standings.
- Automatic ranking by wins and points difference.
- Quarterfinal seeding that recalculates as pool results are entered.
- One-game-to-21 score recording with validation for both formats.
- Scorekeeper access requests and an organiser approval queue.
- An organiser-only tournament builder for custom player names, venue, and date.
- A Rotation League option: 16 players are shuffled into four groups of four, partners rotate for three matches per group, and individual points determine advancement and final places.
- Responsive layout with no build tooling required.

## Preview locally

Open `index.html` directly, or run:

```sh
python3 -m http.server 4173 --directory .
```

Then visit `http://127.0.0.1:4173`.

## Demo organiser access

The demonstration passcode is `rallyadmin`. Sample tournament data, approved scorers, and results are saved only in that browser's local storage. Use **Control room → Tournament setup → Reset demo data** to restore the supplied state.

To create an event, use **Control room → Tournament setup → Create new tournament**. Enter the event details and the two players in each of eight doubles pairs. Pairs 1–4 are placed in Pool A and pairs 5–8 in Pool B; all round-robin fixtures and the knockout bracket are created for you.

Choose **Rotation League** in the same builder to enter 16 individual players instead. The app randomly makes four equal groups of four. Each group plays the three possible doubles partner rotations. When all groups complete a round, players are re-grouped by their placement within their previous group: all first-place players together, then all second-place players, and so on. This happens again for Round 3. The final leaderboard uses every player's accumulated game points from all three rounds.

## Friendly rules

- Every player brings two birds/shuttles.
- The top three Rotation League players are determined by total points across every match.
- The top three winners split the remaining birds equally.

## Important for a public launch

This static version demonstrates the approval journey, but browser local storage and a client-side passcode are not secure access control. Before publishing a public link, move users, access approvals, fixtures, and scores to a backend (for example Supabase or Firebase), enforce organiser/editor roles with server-side authentication and authorization, and store the admin secret only in server-side environment variables.

## Deploy

Upload this folder to a static host such as Netlify, Vercel, or GitHub Pages. No build command is required.
