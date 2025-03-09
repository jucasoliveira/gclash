import * as THREE from 'three';
import { io } from 'socket.io-client';

// Character class definitions
const CHARACTER_CLASSES = {
  CLERK: {
    name: 'Clerk',
    color: 0x4287f5, // Blue
    health: 80,
    speed: 0.15,
    description: 'High speed, lower health. Uses magic attacks.'
  },
  WARRIOR: {
    name: 'Warrior',
    color: 0xe74c3c, // Red
    health: 120,
    speed: 0.08,
    description: 'High health, lower speed. Uses melee attacks.'
  },
  RANGER: {
    name: 'Ranger',
    color: 0x2ecc71, // Green
    health: 100,
    speed: 0.12,
    description: 'Balanced health and speed. Uses ranged attacks.'
  }
};

// Global variables
let scene, camera, renderer;
let ground, cube, player;
let socket;
let isometricOffset = { x: 0, y: 0 };
let cameraTarget = new THREE.Vector3(0, 0, 0);
let moveSpeed = 0.1;
let selectedClass = null;
let gameStarted = false;
let playerStats = {};
let keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false,
  a: false,
  s: false,
  d: false
};
// Store other players
const otherPlayers = {};

// Connect to Socket.io server
function connectToServer() {
  // Connect to the server (default URL if running locally)
  socket = io('http://localhost:3000');
  
  // Connection event
  socket.on('connect', () => {
    console.log('Connected to server!', socket.id);
    
    // Send player join event with class information
    socket.emit('playerJoin', {
      id: socket.id,
      position: { x: player.position.x, y: player.position.y, z: player.position.z },
      type: 'player',
      class: selectedClass,
      stats: playerStats
    });
  });
  
  // Disconnection event
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });
  
  // Error handling
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });
  
  // Listen for existing players when joining
  socket.on('existingPlayers', (players) => {
    console.log('Existing players:', players);
    players.forEach(playerData => {
      createOtherPlayer(playerData);
    });
  });
  
  // Listen for new players joining
  socket.on('playerJoined', (playerData) => {
    console.log('New player joined:', playerData);
    createOtherPlayer(playerData);
  });
  
  // Listen for other players' movements
  socket.on('playerMoved', (data) => {
    if (otherPlayers[data.id]) {
      const otherPlayer = otherPlayers[data.id];
      otherPlayer.position.set(
        data.position.x,
        data.position.y,
        data.position.z
      );
    }
  });
  
  // Listen for players leaving
  socket.on('playerLeft', (data) => {
    console.log('Player left:', data);
    if (otherPlayers[data.id]) {
      scene.remove(otherPlayers[data.id]);
      delete otherPlayers[data.id];
    }
  });
}

// Create grid texture for the ground
function createGridTexture(size = 512, gridSize = 10, lineWidth = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = '#4a7e5c';
  ctx.fillRect(0, 0, size, size);
  
  // Draw grid
  const step = size / gridSize;
  ctx.strokeStyle = '#304e3a';
  ctx.lineWidth = lineWidth;
  
  // Draw vertical lines
  for (let i = 0; i <= gridSize; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
  }
  
  // Draw horizontal lines
  for (let i = 0; i <= gridSize; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  
  return new THREE.CanvasTexture(canvas);
}

// Set up isometric camera
function setupIsometricCamera() {
  // Use OrthographicCamera for true isometric look
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = 10;
  
  camera = new THREE.OrthographicCamera(
    -viewSize * aspect, // left
    viewSize * aspect,  // right
    viewSize,           // top
    -viewSize,          // bottom
    0.1,                // near
    1000                // far
  );
  
  // Set isometric angle (45 degrees rotated, 35.264 degrees from horizontal)
  updateCameraPosition();
}

// Update camera position based on isometric offset
function updateCameraPosition() {
  // Classic isometric angle
  const isometricAngle = Math.PI / 4; // 45 degrees
  const elevationAngle = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees
  
  const distance = 20;
  
  // Calculate position based on angles and offset
  camera.position.x = distance * Math.cos(isometricAngle) + isometricOffset.x;
  camera.position.z = distance * Math.sin(isometricAngle) + isometricOffset.y;
  camera.position.y = distance * Math.sin(elevationAngle);
  
  // Update target based on offset
  cameraTarget.set(isometricOffset.x, 0, isometricOffset.y);
  camera.lookAt(cameraTarget);
}

// Initialize the scene
function init() {
  // Create the scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue background

  // Create isometric camera
  setupIsometricCamera();

  // Create the renderer
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('game-canvas'),
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);

  // Create a ground plane with grid texture
  const groundSize = 20;
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
  const gridTexture = createGridTexture();
  gridTexture.wrapS = THREE.RepeatWrapping;
  gridTexture.wrapT = THREE.RepeatWrapping;
  gridTexture.repeat.set(groundSize / 2, groundSize / 2);
  
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    map: gridTexture,
    side: THREE.DoubleSide
  });
  
  ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2; // Rotate to be flat
  ground.receiveShadow = true;
  scene.add(ground);

  // Create a cube (for testing)
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.position.set(0, 0.5, 0);
  cube.castShadow = true;
  scene.add(cube);
  
  // Create player model based on selected class
  createPlayer();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);
  
  // Add keyboard controls
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Connect to server after scene initialization
  connectToServer();
  
  // Add click event for testing movement
  document.addEventListener('click', onDocumentClick);
}

// Handle key down
function handleKeyDown(event) {
  if (keys.hasOwnProperty(event.key)) {
    keys[event.key] = true;
  }
}

// Handle key up
function handleKeyUp(event) {
  if (keys.hasOwnProperty(event.key)) {
    keys[event.key] = false;
  }
}

// Process keyboard input
function processKeyboardInput() {
  let cameraMoved = false;
  let playerMoved = false;
  
  // Camera movement with arrow keys (aligned with the isometric view)
  if (keys.ArrowUp) {
    isometricOffset.x -= moveSpeed;
    isometricOffset.y -= moveSpeed;
    cameraMoved = true;
  }
  if (keys.ArrowDown) {
    isometricOffset.x += moveSpeed;
    isometricOffset.y += moveSpeed;
    cameraMoved = true;
  }
  if (keys.ArrowLeft) {
    isometricOffset.x -= moveSpeed;
    isometricOffset.y += moveSpeed;
    cameraMoved = true;
  }
  if (keys.ArrowRight) {
    isometricOffset.x += moveSpeed;
    isometricOffset.y -= moveSpeed;
    cameraMoved = true;
  }
  
  // Player movement with WASD (aligned with world coordinates)
  if (keys.w) {
    player.position.z -= moveSpeed;
    playerMoved = true;
  }
  if (keys.s) {
    player.position.z += moveSpeed;
    playerMoved = true;
  }
  if (keys.a) {
    player.position.x -= moveSpeed;
    playerMoved = true;
  }
  if (keys.d) {
    player.position.x += moveSpeed;
    playerMoved = true;
  }
  
  // Update camera if moved
  if (cameraMoved) {
    updateCameraPosition();
  }
  
  // Send player position to server if moved
  if (playerMoved && socket && socket.connected) {
    socket.emit('playerMove', {
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      }
    });
  }
}

// Handle window resize
function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = 10;
  
  camera.left = -viewSize * aspect;
  camera.right = viewSize * aspect;
  camera.top = viewSize;
  camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
  
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Handle click for testing Socket.io
function onDocumentClick(event) {
  // Calculate normalized device coordinates
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Create a raycaster
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  // Check for intersection with the ground
  const intersects = raycaster.intersectObject(ground);
  
  if (intersects.length > 0) {
    const position = intersects[0].point;
    
    // Move the cube to the clicked position
    cube.position.set(position.x, 0.5, position.z);
    
    // Send movement to server
    if (socket && socket.connected) {
      socket.emit('playerMove', {
        position: {
          x: position.x,
          y: 0.5,
          z: position.z
        }
      });
    }
  }
}

// Create a player model for other players
function createOtherPlayer(playerData) {
  // Determine color based on player class
  let playerColor = 0xff6600; // Default orange
  
  if (playerData.class && CHARACTER_CLASSES[playerData.class]) {
    playerColor = CHARACTER_CLASSES[playerData.class].color;
  } else if (playerData.stats && playerData.stats.color) {
    playerColor = playerData.stats.color;
  }
  
  // Create other player model
  const geometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
  const material = new THREE.MeshStandardMaterial({ color: playerColor });
  const otherPlayer = new THREE.Mesh(geometry, material);
  
  // Set position
  otherPlayer.position.set(
    playerData.position.x,
    playerData.position.y,
    playerData.position.z
  );
  
  otherPlayer.castShadow = true;
  
  // Store player data for later use
  otherPlayer.userData = {
    id: playerData.id,
    class: playerData.class,
    stats: playerData.stats
  };
  
  // Add to scene and store in our dictionary
  scene.add(otherPlayer);
  otherPlayers[playerData.id] = otherPlayer;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Process keyboard input
  processKeyboardInput();
  
  // Rotate the cube
  if (cube) {
    cube.rotation.y += 0.01;
  }
  
  // Render the scene
  renderer.render(scene, camera);
}

// Initialize character selection
function initCharacterSelection() {
  const clerkClass = document.getElementById('clerk-class');
  const warriorClass = document.getElementById('warrior-class');
  const rangerClass = document.getElementById('ranger-class');
  const startButton = document.getElementById('start-game');
  
  // Handle class selection
  clerkClass.addEventListener('click', () => {
    selectCharacterClass('CLERK');
    setActiveClass(clerkClass);
  });
  
  warriorClass.addEventListener('click', () => {
    selectCharacterClass('WARRIOR');
    setActiveClass(warriorClass);
  });
  
  rangerClass.addEventListener('click', () => {
    selectCharacterClass('RANGER');
    setActiveClass(rangerClass);
  });
  
  // Handle start game button
  startButton.addEventListener('click', startGame);
  
  function setActiveClass(element) {
    // Remove selected class from all
    clerkClass.classList.remove('selected');
    warriorClass.classList.remove('selected');
    rangerClass.classList.remove('selected');
    
    // Add selected class to clicked element
    element.classList.add('selected');
    
    // Show start button
    startButton.classList.add('visible');
  }
}

// Select character class
function selectCharacterClass(classKey) {
  selectedClass = classKey;
  playerStats = { ...CHARACTER_CLASSES[classKey] };
  moveSpeed = playerStats.speed;
  
  console.log(`Selected class: ${playerStats.name}`);
}

// Start the game
function startGame() {
  if (!selectedClass) {
    alert('Please select a character class before starting');
    return;
  }
  
  // Hide character selection UI
  document.getElementById('character-selection').style.display = 'none';
  
  // Show game UI
  const gameUI = document.getElementById('game-ui');
  gameUI.classList.add('visible');
  
  // Update UI with player stats
  document.getElementById('player-class').textContent = `Class: ${playerStats.name}`;
  document.getElementById('player-stats').textContent = `Health: ${playerStats.health}`;
  document.getElementById('player-color').style.backgroundColor = '#' + playerStats.color.toString(16);
  
  // Initialize the game
  gameStarted = true;
  init();
  animate();
}

// Create player based on selected class
function createPlayer() {
  // Create player model based on selected class
  const playerGeometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
  const playerMaterial = new THREE.MeshStandardMaterial({ color: playerStats.color });
  player = new THREE.Mesh(playerGeometry, playerMaterial);
  player.position.set(2, 0.8, 2); // Start position
  player.castShadow = true;
  scene.add(player);
}

// Initialize the scene and start animation
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Guild Clash...');
  initCharacterSelection();
});