# Rally Club — Friendly Doubles

A responsive badminton tournament dashboard that generates doubles league groups, knockout seeding, and rotation-league fixtures from the player count you choose.

## Included

- Live/upcoming/played fixture filters and dynamic league standings.
- Automatic ranking by wins and points difference.
- Knockout draws that scale to the qualifying field: final, semifinals, or quarterfinals.
- One-game-to-21 score recording with validation for both formats.
- Scorekeeper access requests and an organiser approval queue.
- An organiser-only tournament builder for custom player names, venue, and date.
- A Rotation League option for every whole-number player count from 4 upward, experience-aware group balancing, fair doubles rotations, and individual points for advancement and final places.
- iPhone- and Android-friendly touch targets, safe-area support, numeric keyboards, and no iOS input zoom.

## Preview locally

Open `index.html` directly, or run:

```sh
python3 -m http.server 4173 --directory .
```

Then visit `http://127.0.0.1:4173`.

## Demo organiser access

The demonstration passcode is `rallyadmin`. Sample tournament data, approved scorers, and results are saved only in that browser's local storage. Use **Control room → Tournament setup → Reset demo data** to restore the supplied state.

To create an event, use **Control room → Tournament setup → Create new tournament**. Select an even player count of at least four, enter the two players in every fixed pair, and the app balances pairs across league groups, creates all round-robin fixtures, and seeds a suitable knockout bracket.

Choose **Rotation League** in the same builder to enter every whole-number player count from four upward. Assign each player a Beginner, Intermediate, Advanced, or Competitive level. A randomized snake draft shares experience levels across automatically balanced groups of at least four players—for example, 14 players become 4 / 5 / 5. Groups whose size is divisible by four give every player exactly three games per round. A five-player group needs four doubles matches, so one player receives a rotating fourth game while everyone else has three; this avoids leaving a player out. When all groups complete a round, players are re-seeded by their placement within the previous group for Round 2 and again for Round 3. The final leaderboard uses every player's accumulated game points from all three rounds.

## Friendly rules

- Every player brings two birds/shuttles.
- The top three Rotation League players are determined by total points across every match.
- The top three winners split the remaining birds equally.

## Important for a public launch

This static version demonstrates the approval journey, but browser local storage and a client-side passcode are not secure access control. Before publishing a public link, move users, access approvals, fixtures, and scores to a backend (for example Supabase or Firebase), enforce organiser/editor roles with server-side authentication and authorization, and store the admin secret only in server-side environment variables.

## Deploy

Upload this folder to a static host such as Netlify, Vercel, or GitHub Pages. No build command is required.
