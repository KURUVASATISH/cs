let socket;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('jwt');

  if (!token) {
    redirectToLogin();
    return;
  }

  try {
    const response = await fetch('/api/auth/validate-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.status !== 'success') {
      console.warn('❌ Invalid token. Redirecting to login...');
      localStorage.removeItem('jwt');
      redirectToLogin();
      return;
    }

    // ✅ Token is valid, connect to socket with auth token
    socket = io({
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected with ID:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('⚠️ Socket connection failed:', err.message);
      localStorage.removeItem('jwt');
      redirectToLogin();
    });

    // Users handling
    socket.on('users-list', ({ online, all }) => {
      const onlineSet = new Set(online);
      document.getElementById('online-users').innerHTML = '';
      document.getElementById('offline-users').innerHTML = '';

      all.forEach(username => {
        if (onlineSet.has(username)) {
          createUserElement(username, 'online-users');
        } else {
          createUserElement(username, 'offline-users');
        }
      });
    });

    socket.on('user-online', (username) => moveUserToOnline(username));
    socket.on('user-offline', (username) => moveUserToOffline(username));
    socket.on('private-message', (msg) => displayMessage(msg, false));
    socket.on('offline-messages', (messages) => {
      messages.forEach(msg => displayMessage(msg, false));
    });

    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        window.location.href = '/profile.html';
      });
    }

  } catch (err) {
    console.error('❌ Token validation error:', err);
    localStorage.removeItem('jwt');
    redirectToLogin();
  }
});

function sendMessage() {
  const messageInput = document.getElementById('message-input');
  const receiverUsername = document.getElementById('receiver-username').value;

  if (messageInput.value.trim() && receiverUsername.trim()) {
    const messageData = {
      content: messageInput.value.trim(),
      receiverUsername: receiverUsername.trim()
    };

    socket.emit('private-message', messageData);

    displayMessage({
      sender: 'You',
      content: messageInput.value.trim(),
      timestamp: Date.now()
    }, true);

    messageInput.value = '';
  }
}

function displayMessage(msg, isSender) {
  const messagesContainer = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.className = isSender ? 'message sender' : 'message receiver';

  messageElement.innerHTML = `
    <span class="sender">${isSender ? 'You' : msg.sender}</span>
    <span class="content">${msg.content}</span>
    <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
  `;

  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createUserElement(username, listId) {
  const list = document.getElementById(listId);
  const li = document.createElement('li');
  li.textContent = `User ${username}`;
  li.id = `user-${username}`;
  li.addEventListener('click', () => {
    document.getElementById('receiver-username').value = username;
  });
  list.appendChild(li);
}

function moveUserToOnline(username) {
  const offlineEl = document.getElementById(`user-${username}`);
  if (offlineEl) offlineEl.remove();
  createUserElement(username, 'online-users');
}

function moveUserToOffline(username) {
  const onlineEl = document.getElementById(`user-${username}`);
  if (onlineEl) onlineEl.remove();
  createUserElement(username, 'offline-users');
}

function redirectToLogin() {
  window.location.href = '/login.html';
}
