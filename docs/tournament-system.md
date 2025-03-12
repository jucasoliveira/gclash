# Tournament System Documentation

## Overview

The Guild Clash tournament system allows players to create and join tournaments with up to 16 participants. Tournaments follow a bracket-based elimination format where players compete in 1v1 matches until a winner is determined. This document outlines the architecture, components, and communication protocols used in the tournament system.

## Components

### Client-Side Components

#### Game.js

The main game controller handles tournament UI interactions and coordinates with the WebSocketManager for tournament operations.

Key methods:

- `_setupTournamentEvents()`: Sets up event listeners for tournament-related UI elements
- `_setupTournamentEventHandlers()`: Sets up event handlers for tournament-related events
- `_createTournament(tournamentName)`: Creates a new tournament with the given name
- `_joinTournament(tournamentId)`: Joins an existing tournament
- `_addTournamentToList(tournament)`: Adds a tournament to the UI list
- `_updateTournamentStatus(message)`: Updates the tournament status display
- `_handleStartGame()`: Handles starting the game after joining a tournament

#### WebSocketManager.js

Manages WebSocket communication with the server for tournament operations.

Key methods:

- `createTournament(tournamentData)`: Sends a request to create a tournament
- `joinTournament(tournamentId)`: Sends a request to join a tournament
- `registerMessageHandler(messageType, handler)`: Registers a handler for a specific message type
- `unregisterMessageHandler(messageType, handler)`: Unregisters a handler for a specific message type
- `getCurrentTournament()`: Gets the current tournament data
- `getAvailableTournaments()`: Gets the list of available tournaments

### Server-Side Components

#### server.js

The main server file handles tournament creation, joining, and management.

Key functions:

- Tournament creation handler: Processes `createTournament` messages
- Tournament join handler: Processes `joinTournament` messages
- Tournament state management: Tracks tournament status and player lists
- Tournament bracket generation: Creates tournament brackets when ready
- Tournament match management: Handles match scheduling and results

## Communication Protocol

### Client to Server Messages

#### createTournament

```javascript
{
  type: 'createTournament',
  name: 'Tournament Name',
  tier: 'ALL' // Optional, defaults to 'ALL'
}
```

#### joinTournament

```javascript
{
  type: 'joinTournament',
  tournamentId: 'tournament_id'
}
```

### Server to Client Messages

#### tournamentCreated

```javascript
{
  type: 'tournamentCreated',
  tournament: {
    id: 'tournament_id',
    name: 'Tournament Name',
    tier: 'ALL',
    maxPlayers: 16,
    playerCount: 1,
    status: 'WAITING'
  }
}
```

#### tournamentJoined

```javascript
{
  type: 'tournamentJoined',
  tournament: {
    id: 'tournament_id',
    name: 'Tournament Name',
    playerCount: 2,
    players: [
      { id: 'player_id_1', username: 'Player1', characterClass: 'clerk' },
      { id: 'player_id_2', username: 'Player2', characterClass: 'warrior' }
    ],
    status: 'WAITING'
  }
}
```

#### newTournament

```javascript
{
  type: 'newTournament',
  tournament: {
    id: 'tournament_id',
    name: 'Tournament Name',
    tier: 'ALL',
    maxPlayers: 16,
    playerCount: 1,
    status: 'WAITING'
  }
}
```

#### tournamentUpdated

```javascript
{
  type: 'tournamentUpdated',
  tournament: {
    id: 'tournament_id',
    name: 'Tournament Name',
    playerCount: 3,
    status: 'WAITING'
  }
}
```

#### activeTournaments

```javascript
{
  type: 'activeTournaments',
  tournaments: [
    {
      id: 'tournament_id_1',
      name: 'Tournament 1',
      playerCount: 3,
      status: 'WAITING'
    },
    {
      id: 'tournament_id_2',
      name: 'Tournament 2',
      playerCount: 5,
      status: 'WAITING'
    }
  ]
}
```

## Tournament States

Tournaments can be in one of the following states:

- `WAITING`: Tournament is waiting for players to join
- `STARTING`: Tournament is about to start
- `IN_PROGRESS`: Tournament is in progress
- `COMPLETED`: Tournament has completed

## Tournament Creation Flow

1. Player selects "Tournament" mode in the game UI
2. Player enters a tournament name and clicks "Create"
3. Client sends `createTournament` message to server
4. Server creates tournament and sends `tournamentCreated` message to client
5. Server broadcasts `newTournament` message to all clients
6. Client updates UI to show tournament created status

## Tournament Joining Flow

1. Player selects "Tournament" mode in the game UI
2. Player sees list of available tournaments
3. Player clicks "Join" on a tournament
4. Client sends `joinTournament` message to server
5. Server adds player to tournament and sends `tournamentJoined` message to client
6. Server broadcasts `tournamentUpdated` message to all clients
7. Client updates UI to show joined tournament status

## Game Start Flow

1. Player selects a character class
2. Player clicks "Start Game" button
3. Client sends `join` message to server with player data including tournament ID
4. Server processes join message and updates player data
5. Client loads tournament map and starts the game
6. Server tracks player's tournament participation

## Implementation Details

### Tournament ID Generation

Tournament IDs are generated using the following format:

```javascript
`tournament_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
```

### Player Validation

Before creating or joining a tournament, the client validates:

1. Player has selected a character class
2. WebSocket connection is established
3. Player is not already in a tournament

### Error Handling

The system implements comprehensive error handling:

1. Client-side validation before sending requests
2. Server-side validation of incoming messages
3. Proper error messages sent back to clients
4. UI feedback for error conditions

## Database Integration

Tournament data is stored in MongoDB using the following schema:

```javascript
const TournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  tier: {
    type: String,
    enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "ALL"],
    default: "ALL",
  },
  status: {
    type: String,
    enum: ["WAITING", "STARTING", "IN_PROGRESS", "COMPLETED"],
    default: "WAITING",
  },
  players: [
    {
      id: String,
      username: String,
      characterClass: String,
      dbId: mongoose.Schema.Types.ObjectId,
    },
  ],
  brackets: mongoose.Schema.Types.Mixed,
  matches: [
    {
      id: String,
      player1Id: String,
      player2Id: String,
      winnerId: String,
      status: String,
      startTime: Date,
      endTime: Date,
    },
  ],
  winner: {
    id: String,
    username: String,
    dbId: mongoose.Schema.Types.ObjectId,
  },
  createdAt: { type: Date, default: Date.now },
  createdBy: String,
});
```

## Best Practices

1. Always validate player data before tournament actions
2. Use consistent message formats between client and server
3. Implement proper error handling and user feedback
4. Maintain tournament state consistency across clients
5. Clean up tournament resources when no longer needed
6. Provide clear visual feedback for tournament actions
7. Implement proper logging for debugging
8. Handle edge cases like disconnections and reconnections

## Recent Improvements

### Tournament Player Visibility Enhancement

The tournament system has been enhanced to improve player visibility when joining tournaments. The following improvements have been implemented:

#### Enhanced `joinTournament` Method

The `joinTournament` method in WebSocketManager.js has been updated to include the following enhancements:

```javascript
joinTournament(tournamentId) {
  // Check if WebSocket is connected
  if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
    console.error('[NETWORK] Cannot join tournament: WebSocket not connected');
    return;
  }

  console.log(`[NETWORK] Joining tournament: ${tournamentId}`);

  // Set current tournament ID
  this._currentTournament = { id: tournamentId };

  // Set game mode to tournament
  window.game.gameMode = 'tournament';

  // Send join tournament message
  this.sendMessage({
    type: 'joinTournament',
    tournamentId: tournamentId
  });

  // Request tournament players after a short delay to ensure server has processed join
  setTimeout(() => {
    this.requestTournamentPlayers(tournamentId);

    // Also request existing players with tournament ID
    this.sendMessage({
      type: 'getExistingPlayers',
      tournamentId: tournamentId
    });

    // Force update player positions to ensure all players are visible
    this.forceUpdatePlayerPositions();
  }, 500);

  // Schedule a second update of player positions after a longer delay
  // to catch any late-joining players
  setTimeout(() => {
    this.forceUpdatePlayerPositions();
  }, 2000);
}
```

#### Key Improvements

1. **Game Mode Setting**: Automatically sets the game mode to 'tournament' when joining a tournament.
2. **Tournament Player Request**: Requests tournament players after a short delay to ensure the server has processed the join request.
3. **Existing Player Request**: Sends a message to request existing players with the tournament ID.
4. **Force Position Updates**: Calls `forceUpdatePlayerPositions()` to ensure all players are visible.
5. **Delayed Position Update**: Schedules a second update of player positions after a longer delay to catch any late-joining players.

#### Benefits

- More reliable player visibility in tournament mode
- Improved synchronization of player positions when joining tournaments
- Better player experience with automatic updates of player positions
- Reduced likelihood of invisible players in tournament mode

These improvements ensure that players can see all other participants in the tournament, enhancing the multiplayer experience and reducing confusion caused by invisible players.
