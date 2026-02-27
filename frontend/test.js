

let socket;
let currentConversationId = null;
let currentUserId = null;
let currentUsername = null;

async function init() {
  const isAuth = await checkAuth();
  if (!isAuth) {
    window.location.href = 'landing.html';
    return;
  }

  const user = JSON.parse(localStorage.getItem('user'));
  currentUserId = user.id;
  currentUsername = user.username;

  initializeSocket();
  await loadConversations();
}

function initializeSocket() {
  socket = io(SOCKET_URL);

  socket.on('connect', () => {
    socket.emit('authenticate', {
      userId: currentUserId,
      username: currentUsername
    });
  });

  socket.on('new-message', (data) => {
    if (data.conversationId == currentConversationId) {
      appendMessage(data);
      scrollToBottom();
    }
    loadConversations();
  });
}

async function loadConversations() {
  try {
    const data = await apiCall(API_ENDPOINTS.inbox);
    const list = document.getElementById('conversationsList');

    if (!data.conversations || data.conversations.length === 0) {
      list.innerHTML = `<div style="padding:20px;color:#808080">No conversations yet</div>`;
      return;
    }

    list.innerHTML = data.conversations.map(conv => `
      <div class="conversation-item"
           onclick="openConversation('${conv.conversation_id}')">
        <div class="conversation-username">${conv.other_username}</div>
        <div class="conversation-preview">${conv.last_message || 'No messages yet'}</div>
      </div>
    `).join('');

  } catch (err) {
    console.error(err);
  }
}

async function openConversation(conversationId) {
  currentConversationId = conversationId;

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chatContainer').style.display = 'flex';

  socket.emit('join-conversation', conversationId);

  await loadMessages(conversationId);
}

async function loadMessages(conversationId) {
  const data = await apiCall(API_ENDPOINTS.conversationMessages(conversationId));
  const container = document.getElementById('messagesContainer');

  container.innerHTML = data.messages.map(msg => `
    <div class="message ${msg.sender_id == currentUserId ? 'sent' : 'received'}">
      <div>${msg.content}</div>
    </div>
  `).join('');

  scrollToBottom();
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !currentConversationId) return;

  socket.emit('send-message', {
    conversationId: currentConversationId,
    content
  });

  input.value = '';
}

function appendMessage(msg) {
  const container = document.getElementById('messagesContainer');
  const div = document.createElement('div');
  div.className = `message ${msg.senderId == currentUserId ? 'sent' : 'received'}`;
  div.innerHTML = `<div>${msg.content}</div>`;
  container.appendChild(div);
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

window.addEventListener('load', init);


