import confetti from 'canvas-confetti';

const boardElement = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const resetButton = document.getElementById('reset-button');
const winnerMessageElement = document.getElementById('winner-message');

const BOARD_SIZE = 8;
const EMPTY = 0;
const P1_MAN = 1;
const P2_MAN = 2;
const P1_KING = 3;
const P2_KING = 4;

let boardState = [];
let currentPlayer = P1_MAN; // Player 1 starts
let selectedPiece = null; // { row, col, element }
let validMoves = []; // Array of { row, col, captures: [{row, col}] }
let mustCapture = false; // Flag if captures are available this turn
let pieceLockedForMultiJump = null; // Stores the piece that must continue jumping {row, col}

// --- Initialization ---

function createBoard() {
    boardElement.innerHTML = ''; // Clear existing board
    boardState = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        const row = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            row.push(EMPTY);
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = r;
            square.dataset.col = c;
            if ((r + c) % 2 !== 0) { // Only add listeners to dark squares
                square.addEventListener('click', handleSquareClick);
            }
            boardElement.appendChild(square);
        }
        boardState.push(row);
    }
}

function initializePieces() {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if ((r + c) % 2 !== 0) { // Dark squares only
                if (r < 3) {
                    boardState[r][c] = P1_MAN; // Player 1 at the top
                } else if (r > 4) {
                    boardState[r][c] = P2_MAN; // Player 2 at the bottom
                } else {
                    boardState[r][c] = EMPTY;
                }
            } else {
                 boardState[r][c] = EMPTY; // Light squares are always empty initially
            }
        }
    }
}

function renderBoard() {
    // Clear previous pieces and highlights
    document.querySelectorAll('.piece').forEach(p => p.remove());
    document.querySelectorAll('.valid-move').forEach(m => {
        m.classList.remove('valid-move', 'capture');
        // Remove potential target emoji if needed (simple clear for now)
    });

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const pieceType = boardState[r][c];
            if (pieceType !== EMPTY) {
                const pieceElement = document.createElement('div');
                pieceElement.classList.add('piece');
                pieceElement.dataset.row = r;
                pieceElement.dataset.col = c;

                if (pieceType === P1_MAN || pieceType === P1_KING) {
                    pieceElement.classList.add('player1');
                } else {
                    pieceElement.classList.add('player2');
                }

                if (pieceType === P1_KING || pieceType === P2_KING) {
                    pieceElement.classList.add('king');
                }

                const square = boardElement.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
                square.appendChild(pieceElement);
            }
        }
    }

    // Update turn indicator
    turnIndicator.textContent = `Turn: Player ${currentPlayer === P1_MAN ? '1 (White)' : '2 (Black)'}`;

    // Re-apply selected state if necessary
    if (selectedPiece) {
        const pieceElement = boardElement.querySelector(`.piece[data-row="${selectedPiece.row}"][data-col="${selectedPiece.col}"]`);
        if (pieceElement) {
            pieceElement.classList.add('selected');
        }
        highlightValidMoves();
    }

     // Hide winner message initially
    winnerMessageElement.classList.add('hidden');
    winnerMessageElement.textContent = '';
}

// --- Game Logic ---

function handleSquareClick(event) {
    const clickedSquare = event.currentTarget;
    const row = parseInt(clickedSquare.dataset.row);
    const col = parseInt(clickedSquare.dataset.col);
    const pieceType = boardState[row][col];

    // Check if clicking on a valid move destination
    const isValidMove = validMoves.find(move => move.row === row && move.col === col);
    if (selectedPiece && isValidMove) {
        executeMove(selectedPiece.row, selectedPiece.col, row, col, isValidMove.captures);
        return; // Move executed, stop further processing
    }

    // Clear previous selection
    clearSelection();

    // Check if clicking on a piece of the current player
    if (isCurrentPlayerPiece(pieceType)) {
         // If multi-jump is required, only allow selecting the locked piece
        if (pieceLockedForMultiJump && (pieceLockedForMultiJump.row !== row || pieceLockedForMultiJump.col !== col)) {
            console.log("Must continue jumping with the same piece.");
            return;
        }
        selectPiece(row, col, clickedSquare.querySelector('.piece'));
    }
}

function isCurrentPlayerPiece(pieceType) {
    if (currentPlayer === P1_MAN) {
        return pieceType === P1_MAN || pieceType === P1_KING;
    } else {
        return pieceType === P2_MAN || pieceType === P2_KING;
    }
}

function selectPiece(row, col, pieceElement) {
    if (!pieceElement) return;

    selectedPiece = { row, col, element: pieceElement };
    pieceElement.classList.add('selected');

    // Calculate and highlight valid moves
    validMoves = calculateValidMoves(row, col);
    highlightValidMoves();
}

function clearSelection() {
    if (selectedPiece && selectedPiece.element) {
        selectedPiece.element.classList.remove('selected');
    }
    selectedPiece = null;
    validMoves = [];
    document.querySelectorAll('.valid-move').forEach(m => {
        m.classList.remove('valid-move', 'capture');
    });
}

function highlightValidMoves() {
    validMoves.forEach(move => {
        const square = boardElement.querySelector(`.square[data-row="${move.row}"][data-col="${move.col}"]`);
        if (square) {
            square.classList.add('valid-move');
            if (move.captures.length > 0) {
                square.classList.add('capture');
            }
        }
    });
}

function executeMove(fromRow, fromCol, toRow, toCol, capturedPieces) {
    const pieceType = boardState[fromRow][fromCol];
    boardState[toRow][toCol] = pieceType;
    boardState[fromRow][fromCol] = EMPTY;

    // Remove captured pieces
    capturedPieces.forEach(cap => {
        boardState[cap.row][cap.col] = EMPTY;
    });

    // Check for promotion
    let promoted = false;
    if (pieceType === P1_MAN && toRow === BOARD_SIZE - 1) {
        boardState[toRow][toCol] = P1_KING;
        promoted = true;
    } else if (pieceType === P2_MAN && toRow === 0) {
        boardState[toRow][toCol] = P2_KING;
        promoted = true;
    }

    clearSelection(); // Clear selection highlights immediately

    // Check for further captures from the landing square (multi-jump)
    const potentialNextCaptures = calculateValidMoves(toRow, toCol, true); // Only check for captures
    const canContinueJumping = potentialNextCaptures.length > 0 && capturedPieces.length > 0 && !promoted;

    if (canContinueJumping) {
        // Lock the piece for the next jump and re-select it visually
        pieceLockedForMultiJump = { row: toRow, col: toCol };
        renderBoard(); // Re-render to show removed pieces
        const newPieceElement = boardElement.querySelector(`.piece[data-row="${toRow}"][data-col="${toCol}"]`);
        selectPiece(toRow, toCol, newPieceElement); // Re-select and show next moves
    } else {
        // Move finished, switch player
        pieceLockedForMultiJump = null;
        switchPlayer();
        renderBoard();
        checkWinCondition();
    }
}

function switchPlayer() {
    currentPlayer = (currentPlayer === P1_MAN) ? P2_MAN : P1_MAN;
    calculateIfCaptureIsMandatory(); // Check if the new player must capture
    if (mustCapture && !canPlayerMakeAnyCapture(currentPlayer)) {
        // If the player MUST capture but has no capture moves, they lose (stalemate variation)
        // Or, more commonly in checkers, if they have no moves at all, they lose.
         checkWinCondition(); // Re-check win as they might have no moves at all
    }
}

function calculateValidMoves(row, col, onlyCaptures = false) {
    const pieceType = boardState[row][col];
    if (pieceType === EMPTY) return [];

    let moves = [];
    let captures = []; // Separate list for captures to prioritize them easily
    const isKing = (pieceType === P1_KING || pieceType === P2_KING);
    const player = (pieceType === P1_MAN || pieceType === P1_KING) ? P1_MAN : P2_MAN;
    // Men only move forward, but capture in any direction
    const forwardDirection = (player === P1_MAN) ? 1 : -1;

    const directions = [
        { dr: -1, dc: -1 }, // Up-Left
        { dr: -1, dc: 1 },  // Up-Right
        { dr: 1, dc: -1 },  // Down-Left
        { dr: 1, dc: 1 }   // Down-Right
    ];

    for (const dir of directions) {
        if (isKing) {
            // --- King Logic ---
            let potentialCapture = null; // { jumpOverRow, jumpOverCol }
            // Scan along the diagonal
            for (let i = 1; ; i++) {
                const currentRow = row + i * dir.dr;
                const currentCol = col + i * dir.dc;

                if (!isValidSquare(currentRow, currentCol)) break; // Off board

                const currentSquareContent = boardState[currentRow][currentCol];

                if (potentialCapture) { // Already jumped one piece, looking for landing spots
                    if (currentSquareContent === EMPTY) {
                        // Valid landing spot after a jump
                        captures.push({
                            row: currentRow,
                            col: currentCol,
                            captures: [potentialCapture] // Capture the stored piece
                        });
                    } else {
                        // Path blocked after jump, stop scanning in this direction
                        break;
                    }
                } else { // Haven't jumped yet on this line
                    if (currentSquareContent === EMPTY) {
                        // Empty square - potential simple move (if not forced capture)
                        if (!onlyCaptures && !mustCapture) {
                           moves.push({ row: currentRow, col: currentCol, captures: [] });
                        }
                    } else if (!isAlly(pieceType, currentSquareContent)) {
                        // Found an opponent piece
                        // Check the square *immediately after* it
                        const landRow = currentRow + dir.dr;
                        const landCol = currentCol + dir.dc;
                        if (isValidSquare(landRow, landCol) && boardState[landRow][landCol] === EMPTY) {
                             // Found a jump opportunity. Store the jumped piece.
                             // Landing spots will be collected in the next iterations
                             potentialCapture = { row: currentRow, col: currentCol };
                             // Add the first landing spot immediately
                             captures.push({
                                 row: landRow,
                                 col: landCol,
                                 captures: [potentialCapture]
                             });
                         } else {
                             // Cannot jump over this opponent piece (blocked), stop scanning
                             break;
                         }
                    } else {
                        // Found an ally piece, path blocked, stop scanning
                        break;
                    }
                }
            }
        } else {
             // --- Man Logic ---

             // Check Captures (Men capture in any direction)
             const jumpOverRow = row + dir.dr;
             const jumpOverCol = col + dir.dc;
             const landRow = row + 2 * dir.dr;
             const landCol = col + 2 * dir.dc;

             if (isValidSquare(landRow, landCol) && boardState[landRow][landCol] === EMPTY) {
                 const jumpedPieceType = isValidSquare(jumpOverRow, jumpOverCol) ? boardState[jumpOverRow][jumpOverCol] : EMPTY;
                 if (jumpedPieceType !== EMPTY && !isAlly(pieceType, jumpedPieceType)) {
                      // Man capture found
                      captures.push({ row: landRow, col: landCol, captures: [{ row: jumpOverRow, col: jumpOverCol }] });
                 }
             }

             // Check Simple Moves (Men only move forward)
             if (!onlyCaptures && !mustCapture) {
                 const moveRow = row + dir.dr;
                 const moveCol = col + dir.dc;
                 // Check if it's a forward move for the man
                 const isForwardMove = dir.dr === forwardDirection;

                 if (isForwardMove && isValidSquare(moveRow, moveCol) && boardState[moveRow][moveCol] === EMPTY) {
                     moves.push({ row: moveRow, col: moveCol, captures: [] });
                 }
             }
        }
    }

     // Prioritize captures: If any captures exist, return only captures. Otherwise, return simple moves.
     if (captures.length > 0) {
         return captures;
     } else {
         return onlyCaptures ? [] : moves; // If onlyCaptures is true and no captures found, return empty
     }
}

function isValidSquare(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function isAlly(piece1, piece2) {
    if (piece1 === EMPTY || piece2 === EMPTY) return false;
    const player1Group = [P1_MAN, P1_KING];
    const player2Group = [P2_MAN, P2_KING];
    return (player1Group.includes(piece1) && player1Group.includes(piece2)) ||
           (player2Group.includes(piece1) && player2Group.includes(piece2));
}

// --- Game State ---

function calculateIfCaptureIsMandatory() {
    mustCapture = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const pieceType = boardState[r][c];
            if (isCurrentPlayerPiece(pieceType)) {
                const moves = calculateValidMoves(r, c, true); // Check only captures
                if (moves.length > 0) {
                    mustCapture = true;
                    return; // Found a mandatory capture, no need to check further
                }
            }
        }
    }
}

function canPlayerMakeAnyMove(player) {
     for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const pieceType = boardState[r][c];
             const checkPlayer = player === P1_MAN ? [P1_MAN, P1_KING] : [P2_MAN, P2_KING];
            if (checkPlayer.includes(pieceType)) {
                 // Temporarily set current player to check moves correctly based on mustCapture state
                 const originalPlayer = currentPlayer;
                 const originalMustCapture = mustCapture;
                 currentPlayer = player; // Temporarily switch
                 calculateIfCaptureIsMandatory(); // Recalculate mustCapture for the player being checked

                 const moves = calculateValidMoves(r, c);

                 currentPlayer = originalPlayer; // Restore original player and state
                 mustCapture = originalMustCapture;

                if (moves.length > 0) {
                    return true; // Found at least one valid move
                }
            }
        }
    }
    return false; // No moves found for any piece of this player
}

function canPlayerMakeAnyCapture(player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const pieceType = boardState[r][c];
            const checkPlayer = player === P1_MAN ? [P1_MAN, P1_KING] : [P2_MAN, P2_KING];
            if (checkPlayer.includes(pieceType)) {
                const moves = calculateValidMoves(r, c, true); // Check only captures
                if (moves.length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function countPieces() {
    let p1Count = 0;
    let p2Count = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = boardState[r][c];
            if (piece === P1_MAN || piece === P1_KING) p1Count++;
            else if (piece === P2_MAN || piece === P2_KING) p2Count++;
        }
    }
    return { p1: p1Count, p2: p2Count };
}

function checkWinCondition() {
    const pieceCounts = countPieces();
    const player1CanMove = canPlayerMakeAnyMove(P1_MAN);
    const player2CanMove = canPlayerMakeAnyMove(P2_MAN);

    let winner = null;

    if (pieceCounts.p2 === 0 || !player2CanMove) {
        winner = 'Player 1 (White)';
    } else if (pieceCounts.p1 === 0 || !player1CanMove) {
        winner = 'Player 2 (Black)';
    }

    if (winner) {
        showWinner(winner);
        // Optionally disable further clicks on the board
        boardElement.style.pointerEvents = 'none';
    } else {
         // Ensure board clicks are enabled if game is ongoing
         boardElement.style.pointerEvents = 'auto';
    }
}

function showWinner(winnerName) {
    winnerMessageElement.textContent = `${winnerName} Wins!`;
    winnerMessageElement.style.display = 'block'; // Ensure display is set before removing hidden for transition
    // Use a tiny timeout to allow the 'display: block' to apply before starting the transition
    setTimeout(() => {
        winnerMessageElement.classList.remove('hidden');
    }, 10); // Small delay (10ms)
    triggerConfetti();
}

function triggerConfetti() {
    const duration = 4 * 1000; // Slightly longer duration
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 35, spread: 360, ticks: 70, zIndex: 11 }; // Ensure confetti is above winner message

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
        return clearInterval(interval);
        }

        const particleCount = 60 * (timeLeft / duration); // More particles initially
        // Launch confetti from multiple points for better coverage
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.4), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.6, 0.9), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount: particleCount / 2, origin: { x: 0.5, y: 0 } }); // Center top burst

    }, 250);
}

// --- Reset ---

function resetGame() {
    currentPlayer = P1_MAN;
    selectedPiece = null;
    validMoves = [];
    mustCapture = false;
    pieceLockedForMultiJump = null;
    winnerMessageElement.classList.add('hidden');
    winnerMessageElement.style.display = 'none'; // Reset display property
    boardElement.style.pointerEvents = 'auto'; // Re-enable clicks

    createBoard(); // Recreate squares and add listeners
    initializePieces();
    renderBoard();
    calculateIfCaptureIsMandatory(); // Check initial mandatory captures (unlikely but good practice)
}

resetButton.addEventListener('click', resetGame);

// --- Initial Setup ---
resetGame(); // Initialize the game when the script loads