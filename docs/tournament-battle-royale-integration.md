# Tournament Winners Integration with Battle Royale

## Overview

This document outlines the integration between the tournament system and battle royale events in Guild Clash. The integration allows tournament winners to be automatically invited to special battle royale events when enough winners have accumulated.

## Flow Diagram

```
Tournament Completion → Save Winner → Check Winner Count → Create Battle Royale → Notify Players → Join Battle Royale → Start Battle Royale
```

## Components

### Database Models

#### TournamentWinner Model

The `TournamentWinner` model tracks tournament winners and their status:

```javascript
{
  playerId: String,           // Player ID who won the tournament
  tournamentId: ObjectId,     // Tournament ID that was won
  tier: String,               // Tournament tier (bronze, silver, gold, etc.)
  timestamp: Date,            // When the tournament was won
  processed: Boolean,         // Whether this winner has been processed for a battle royale
  battleRoyaleId: ObjectId    // Battle royale ID this winner was invited to (if processed)
}
```

#### BattleRoyale Model

The `BattleRoyale` model stores battle royale event data:

```javascript
{
  name: String,               // Name of the battle royale event
  tier: String,               // Tier of the battle royale
  status: String,             // Status (pending, in-progress, completed)
  maxParticipants: Number,    // Maximum number of participants (default: 40)
  participants: [String],     // Array of participant IDs
  startTime: Date,            // Scheduled start time
  createdAt: Date,            // When the battle royale was created
  endedAt: Date,              // When the battle royale ended (if completed)
  winnerId: String,           // Winner of the battle royale (if completed)
  results: [{                 // Results of the battle royale (top placements)
    playerId: String,
    position: Number,
    kills: Number
  }]
}
```

### Server-Side Logic

#### Tournament Completion Handler

When a tournament completes, the `handleTournamentCompletion` function:

1. Identifies the tournament winner
2. Saves the winner to the `TournamentWinner` collection
3. Checks if there are 40 unprocessed winners
4. If 40 winners are available, creates a new battle royale event
5. Marks the winners as processed and associates them with the battle royale
6. Notifies all players about the battle royale event
7. Sends special invitations to the tournament winners

#### Battle Royale Notifications

Two notification functions handle battle royale announcements:

- `notifyBattleRoyaleEvent`: Broadcasts the event to all connected players
- `notifyBattleRoyaleInvitation`: Sends special invitations to tournament winners

#### WebSocket Message Handling

The server handles the following battle royale-related messages:

- `joinBattleRoyale`: Adds a player to a battle royale event
- `battleRoyaleJoined`: Confirms a player has joined a battle royale
- `battleRoyaleUpdated`: Updates all clients about participant count changes
- `battleRoyaleStarted`: Notifies all participants when a battle royale starts

### Client-Side Components

#### BattleRoyaleNotification Component

The `BattleRoyaleNotification` component:

1. Displays notifications about battle royale events
2. Shows special invitations for tournament winners
3. Provides buttons to join or dismiss the notification
4. Handles user interactions with the notification
5. Communicates with the game system via the event bus

#### WebSocketManager Integration

The `WebSocketManager` handles battle royale-related messages:

- Processes `battleRoyaleEvent` and `battleRoyaleInvitation` messages
- Sends `joinBattleRoyale` requests when players choose to join
- Handles `battleRoyaleJoined` confirmations
- Emits events to the event bus for client-side components

#### Game Class Integration

The `Game` class:

1. Initializes the `BattleRoyaleNotification` component
2. Sets up event handlers for battle royale events
3. Handles join requests from the notification component
4. Processes join confirmations from the server
5. Transitions to battle royale mode when a player joins

## Implementation Details

### Tournament Winner Processing

When a tournament completes:

```javascript
async function handleTournamentCompletion(tournament) {
  // Get the winner
  const winner = tournament.participants.find((p) => p.position === 1);

  // Save winner to TournamentWinner collection
  const tournamentWinner = new TournamentWinner({
    playerId: winner.playerId,
    tournamentId: tournament._id,
    tier: tournament.tier,
    timestamp: new Date(),
    processed: false,
  });

  await tournamentWinner.save();

  // Check if we have enough winners to trigger a battle royale
  const pendingWinners = await TournamentWinner.find({ processed: false });

  // If we have 40 winners, trigger a battle royale
  if (pendingWinners.length >= 40) {
    // Create a new battle royale
    const battleRoyale = new BattleRoyale({
      name: "Tournament Champions Battle Royale",
      tier: "champions",
      status: "pending",
      maxParticipants: 40,
      participants: [],
      startTime: new Date(Date.now() + 15 * 60 * 1000), // Start in 15 minutes
      createdAt: new Date(),
    });

    await battleRoyale.save();

    // Mark winners as processed
    const winnerIds = pendingWinners.map((w) => w.playerId);
    await TournamentWinner.updateMany(
      { _id: { $in: pendingWinners.map((w) => w._id) } },
      { $set: { processed: true, battleRoyaleId: battleRoyale._id } }
    );

    // Notify all players about the battle royale event
    notifyBattleRoyaleEvent(battleRoyale);

    // Send special invitations to the tournament winners
    notifyBattleRoyaleInvitation(battleRoyale, winnerIds);
  }
}
```

### Battle Royale Notifications

Notification functions:

```javascript
function notifyBattleRoyaleEvent(battleRoyale) {
  broadcastToAll({
    type: "battleRoyaleEvent",
    data: {
      battleRoyaleId: battleRoyale._id,
      name: battleRoyale.name,
      tier: battleRoyale.tier,
      playerCount: battleRoyale.participants.length,
      maxPlayers: battleRoyale.maxParticipants,
      startTime: battleRoyale.startTime,
    },
  });
}

function notifyBattleRoyaleInvitation(battleRoyale, winners) {
  winners.forEach((winnerId) => {
    const socket = wss.clients.find((c) => c.id === winnerId);

    if (socket) {
      socket.send(
        JSON.stringify({
          type: "battleRoyaleInvitation",
          data: {
            battleRoyaleId: battleRoyale._id,
            message:
              "You have been invited to join the Battle Royale as a tournament winner!",
            name: battleRoyale.name,
            tier: battleRoyale.tier,
            startTime: battleRoyale.startTime,
          },
        })
      );
    }
  });
}
```

### Client-Side Notification Handling

The `BattleRoyaleNotification` component displays notifications and handles user interactions:

```javascript
class BattleRoyaleNotification {
  constructor() {
    // Initialize UI elements
    this._init();

    // Set up event listeners
    eventBus.on(
      "network.battleRoyaleEvent",
      this.showBattleRoyaleNotification.bind(this)
    );
    eventBus.on(
      "network.battleRoyaleInvitation",
      this.showBattleRoyaleInvitation.bind(this)
    );
  }

  showBattleRoyaleNotification(data) {
    this.currentBattleRoyaleId = data.battleRoyaleId;
    this.notificationElement.textContent = `A Battle Royale event is starting! ${
      data.playerCount || 40
    } players will compete for glory. Will you join the battle?`;
    this.container.style.display = "block";
  }

  showBattleRoyaleInvitation(data) {
    this.currentBattleRoyaleId = data.battleRoyaleId;
    this.notificationElement.textContent = `You've been invited to join the Battle Royale as a tournament winner! Join now to claim your spot.`;
    this.container.style.display = "block";
  }

  _handleJoinClick() {
    if (this.currentBattleRoyaleId) {
      eventBus.emit("game.joinBattleRoyale", {
        battleRoyaleId: this.currentBattleRoyaleId,
      });
      this.hide();
    }
  }
}
```

## Testing

To test the integration:

1. Complete multiple tournaments to generate winners
2. Verify winners are saved to the database
3. Check that a battle royale is created when 40 winners are collected
4. Verify notifications are sent to all players
5. Confirm special invitations are sent to tournament winners
6. Test joining the battle royale through the notification
7. Verify the battle royale starts when enough players join

## Future Enhancements

- Implement battle royale spectator mode for eliminated players
- Add battle royale-specific rewards and achievements
- Create more sophisticated matchmaking based on player tier
- Implement battle royale statistics tracking
- Add special battle royale events with unique rules
- Create a battle royale leaderboard for top performers
