/**
 * TournamentBracket.js
 * Displays the tournament bracket as an HTML overlay
 */

import eventBus from '../core/EventBus.js';

class TournamentBracket {
  constructor() {
    this.container = null;
    this.currentTournament = null;
    this.isVisible = false;
    
    // Bind methods
    this._onTournamentStarted = this._onTournamentStarted.bind(this);
    this._onTournamentBracketUpdate = this._onTournamentBracketUpdate.bind(this);
    this._onTournamentComplete = this._onTournamentComplete.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    
    // Initialize
    this._init();
  }
  
  /**
   * Initialize the tournament bracket UI
   * @private
   */
  _init() {
    // Create container element
    this.container = document.createElement('div');
    this.container.id = 'tournament-bracket';
    this.container.className = 'tournament-bracket';
    this.container.style.display = 'none';
    
    // Add to document
    document.body.appendChild(this.container);
    
    // Add event listeners
    eventBus.on('tournamentStarted', this._onTournamentStarted);
    eventBus.on('tournamentBracketUpdate', this._onTournamentBracketUpdate);
    eventBus.on('tournamentComplete', this._onTournamentComplete);
    
    // Add keyboard listener for toggling bracket visibility
    document.addEventListener('keydown', this._onKeyDown);
    
    // Add styles
    this._addStyles();
  }
  
  /**
   * Add CSS styles for the tournament bracket
   * @private
   */
  _addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .tournament-bracket {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.85);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: 'Arial', sans-serif;
        overflow: auto;
        padding: 20px;
        box-sizing: border-box;
      }
      
      .tournament-bracket h1 {
        font-size: 24px;
        margin-bottom: 20px;
        color: #ffcc00;
        text-align: center;
      }
      
      .tournament-bracket .bracket-container {
        display: flex;
        justify-content: space-around;
        width: 100%;
        max-width: 1200px;
      }
      
      .tournament-bracket .round {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        width: 200px;
        margin: 0 10px;
      }
      
      .tournament-bracket .round-title {
        text-align: center;
        font-size: 16px;
        margin-bottom: 15px;
        color: #ffcc00;
      }
      
      .tournament-bracket .match {
        background-color: rgba(50, 50, 50, 0.7);
        border: 1px solid #444;
        border-radius: 5px;
        padding: 10px;
        margin-bottom: 15px;
        position: relative;
      }
      
      .tournament-bracket .match.completed {
        border-color: #ffcc00;
      }
      
      .tournament-bracket .match.ready {
        border-color: #00cc00;
        animation: pulse 2s infinite;
      }
      
      .tournament-bracket .player {
        padding: 5px;
        margin: 5px 0;
        border-radius: 3px;
      }
      
      .tournament-bracket .player.winner {
        background-color: rgba(0, 200, 0, 0.3);
        font-weight: bold;
      }
      
      .tournament-bracket .player.loser {
        color: #999;
      }
      
      .tournament-bracket .player.tbd {
        color: #777;
        font-style: italic;
      }
      
      .tournament-bracket .match-id {
        position: absolute;
        top: -8px;
        right: 5px;
        font-size: 10px;
        color: #777;
      }
      
      .tournament-bracket .close-button {
        position: absolute;
        top: 20px;
        right: 20px;
        background-color: #ff3333;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .tournament-bracket .winner-announcement {
        text-align: center;
        margin-top: 20px;
        padding: 15px;
        background-color: rgba(255, 204, 0, 0.2);
        border-radius: 5px;
        animation: fadeIn 1s;
      }
      
      .tournament-bracket .winner-name {
        font-size: 24px;
        font-weight: bold;
        color: #ffcc00;
      }
      
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0, 204, 0, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(0, 204, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 204, 0, 0); }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .tournament-bracket .instructions {
        position: absolute;
        bottom: 20px;
        left: 0;
        right: 0;
        text-align: center;
        color: #999;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Handle tournament started event
   * @param {Object} data - Tournament data
   * @private
   */
  _onTournamentStarted(data) {
    console.log('Tournament started:', data);
    this.currentTournament = {
      id: data.tournamentId,
      name: data.name,
      brackets: data.brackets,
      status: 'IN_PROGRESS',
      winner: null
    };
    
    this._renderBracket();
    this.show();
  }
  
  /**
   * Handle tournament bracket update event
   * @param {Object} data - Updated bracket data
   * @private
   */
  _onTournamentBracketUpdate(data) {
    console.log('Tournament bracket updated:', data);
    if (this.currentTournament && this.currentTournament.id === data.tournamentId) {
      this.currentTournament.brackets = data.brackets;
      this._renderBracket();
    }
  }
  
  /**
   * Handle tournament complete event
   * @param {Object} data - Tournament completion data
   * @private
   */
  _onTournamentComplete(data) {
    console.log('Tournament completed:', data);
    if (this.currentTournament && this.currentTournament.id === data.tournamentId) {
      this.currentTournament.status = 'COMPLETED';
      this.currentTournament.winner = data.winner;
      this._renderBracket();
      this.show();
    }
  }
  
  /**
   * Handle keydown event for toggling bracket visibility
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  _onKeyDown(event) {
    // Toggle bracket visibility with 'B' key
    if (event.key === 'b' || event.key === 'B') {
      this.toggle();
    }
    
    // Close bracket with Escape key
    if (event.key === 'Escape' && this.isVisible) {
      this.hide();
    }
  }
  
  /**
   * Render the tournament bracket
   * @private
   */
  _renderBracket() {
    if (!this.currentTournament || !this.currentTournament.brackets) {
      this.container.innerHTML = '<h1>No tournament data available</h1>';
      return;
    }
    
    // Create HTML content
    let html = `
      <h1>${this.currentTournament.name}</h1>
      <div class="bracket-container">
    `;
    
    // Render each round
    this.currentTournament.brackets.forEach((round, roundIndex) => {
      const roundName = this._getRoundName(roundIndex, this.currentTournament.brackets.length);
      
      html += `
        <div class="round">
          <div class="round-title">${roundName}</div>
      `;
      
      // Render matches in this round
      round.matches.forEach(match => {
        const matchStatus = match.status.toLowerCase();
        const player1IsTBD = !match.player1Id;
        const player2IsTBD = !match.player2Id;
        
        // Determine winner and loser
        let player1Class = '';
        let player2Class = '';
        
        if (match.winnerId) {
          if (match.winnerId === match.player1Id) {
            player1Class = 'winner';
            player2Class = 'loser';
          } else if (match.winnerId === match.player2Id) {
            player1Class = 'loser';
            player2Class = 'winner';
          }
        }
        
        if (player1IsTBD) player1Class = 'tbd';
        if (player2IsTBD) player2Class = 'tbd';
        
        html += `
          <div class="match ${matchStatus}">
            <div class="match-id">${match.matchId}</div>
            <div class="player ${player1Class}">
              ${player1IsTBD ? 'TBD' : match.player1Name}
            </div>
            <div class="player ${player2Class}">
              ${player2IsTBD ? 'TBD' : match.player2Name}
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
    });
    
    html += `</div>`;
    
    // Add winner announcement if tournament is completed
    if (this.currentTournament.status === 'COMPLETED' && this.currentTournament.winner) {
      html += `
        <div class="winner-announcement">
          <div>Tournament Champion</div>
          <div class="winner-name">${this.currentTournament.winner.name}</div>
        </div>
      `;
    }
    
    // Add close button and instructions
    html += `
      <button class="close-button" onclick="document.getElementById('tournament-bracket').style.display='none';">×</button>
      <div class="instructions">Press 'B' to toggle bracket view</div>
    `;
    
    this.container.innerHTML = html;
  }
  
  /**
   * Get the name of a tournament round based on its index
   * @param {number} roundIndex - Zero-based index of the round
   * @param {number} totalRounds - Total number of rounds
   * @returns {string} Round name
   * @private
   */
  _getRoundName(roundIndex, totalRounds) {
    const roundNumber = roundIndex + 1;
    
    if (roundNumber === totalRounds) {
      return 'Finals';
    } else if (roundNumber === totalRounds - 1) {
      return 'Semi-Finals';
    } else if (roundNumber === totalRounds - 2) {
      return 'Quarter-Finals';
    } else {
      return `Round ${roundNumber}`;
    }
  }
  
  /**
   * Show the tournament bracket
   */
  show() {
    this.container.style.display = 'flex';
    this.isVisible = true;
  }
  
  /**
   * Hide the tournament bracket
   */
  hide() {
    this.container.style.display = 'none';
    this.isVisible = false;
  }
  
  /**
   * Toggle the visibility of the tournament bracket
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    // Remove event listeners
    eventBus.off('tournamentStarted', this._onTournamentStarted);
    eventBus.off('tournamentBracketUpdate', this._onTournamentBracketUpdate);
    eventBus.off('tournamentComplete', this._onTournamentComplete);
    document.removeEventListener('keydown', this._onKeyDown);
    
    // Remove DOM elements
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Create singleton instance
const tournamentBracket = new TournamentBracket();

export default tournamentBracket; 