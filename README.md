# Dopamine Dev

Gamify your coding experience! Every time you save a file, you spin for rewards. Earn coins, hit jackpots, and redeem custom rewards while tracking your flow state and clean code streaks.

## Features

### 🎰 The Reward System
Every time you save a document (`Cmd+S` / `Ctrl+S`), the status bar spins!
### 💰 Coin Earning Rules

| Mechanic | Condition | Effect / Multiplier |
| :--- | :--- | :--- |
| **Base Reward** | Save with >= 20 chars added | **1 Coin** (Base) |
| **Deletions** | Deleting code only | **No Reward** (No spin) |
| **Magnitude** | **Medium** (>5 lines or >100 chars) | **x2** Multiplier |
| | **Large** (>20 lines or >500 chars) | **x5** Multiplier |
| | **Epic** (>50 lines or >2000 chars) | **x10** Multiplier |
| **Flow State** | Continuous coding > 15 mins | **+1 Coin** per 15 mins |
| **Speed Bonus** | WPM > 40 / > 80 | **+2 Coins** / **+5 Coins** |
| **Clean Code** | Errors Fixed | **x2.0** Multiplier ("Bug Fixer") |
| | Clean (No errors) | **x1.5** Multiplier |
| | **Introduced Errors** | **x0.5** Multiplier ("Buggy") |
| **Jackpot** | Random Roll (Default 10%) | **+10 Coins** * Multiplier |
| | **Introduced Errors** | **Jackpot Disabled** |

### 💰 Coin Wallet
Track your earnings!
- View your current balance in the Status Bar.
- Use the command `Check Dopamine Balance` to see your total in a notification.
- Coins persist across sessions **(reset daily)**.

### 🎁 Custom Rewards
Configure your own rewards for winning!
- **URL Rewards:** Open a funny video, a music playlist, or a break timer.
- **Message Rewards:** Get a motivational quote or a reminder to drink water.
- **Image Rewards:** Open a dedicated tab with a celebration image!
    - **URL:** Provide a direct link to an image (e.g. `https://example.com/cat.jpg`).
    - **Keyword:** Provide a single word (e.g. `kitten`, `nature`, `tech`) to get a random image.
- **Quote Rewards:** Get an inspiring quote in a notification.
    - **Content:** Specify a category (e.g., `programming`, `motivation`, `productivity`, or `any`).

## Extension Settings

This extension allows you to customize your experience via VS Code settings:

* `dopamineDev.winOdds`: The probability of winning a jackpot (0.0 to 1.0). Default is `0.1` (10%).
* `dopamineDev.enableSound`: Enable or disable sound effects (Win/Coin sounds). Default is `false`.
* `dopamineDev.sounds.win`: Path to a custom sound file for jackpots.
* `dopamineDev.sounds.coin`: Path to a custom sound file for coin rewards.
* `dopamineDev.ignoreExtensions`: List of file extensions (e.g., `['.md', '.txt']`) to prevent the slot machine from triggering on save. Default includes `['.json']`.
* `dopamineDev.bulkThreshold`: Character limit for a single change to be considered 'typed'. Changes above this are considered 'pasted' or 'generated' and are discounted in WPM calculation and contribute less to Diff Magnitude. Default is `50`.
* `dopamineDev.rewards`: A list of rewards to pick from when you win.

### Example Configuration

```json
"dopamineDev.rewards": [
    {
        "type": "quote",
        "content": "programming",
        "label": "Wisdom of Code"
    },
    {
        "type": "image",
        "content": "nature",
        "label": "Relaxing Scenery"
    },
    {
        "type": "url",
        "content": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "label": "Mystery Break"
    },
    {
        "type": "message",
        "content": "You've earned a short break! Stretch and look away from the screen.",
        "label": "Take a Break"
    }
]
```

## Commands

- `Dopamine Dev: Check Dopamine Balance`: Shows your current coin balance.

## Requirements

- VS Code ^1.80.0

## Release Notes

### 0.1.0
- Introduced Coin Wallet system.
- Added configurable Rewards.
- Added Sound effects toggle.
- Improved visuals.