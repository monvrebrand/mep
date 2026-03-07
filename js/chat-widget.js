(function() {
    // Inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
        .chat-widget-btn {
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 60px;
            height: 60px;
            background-color: red;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            transition: all 0.3s ease;
            border: none;
            color: white;
            font-size: 24px;
            text-decoration: none;
        }
        .chat-widget-btn:hover {
            transform: scale(1.1);
            background-color: #cc0000;
            color: white;
        }
        .chat-widget-box {
            display: none;
            position: fixed;
            bottom: 90px;
            left: 20px;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 5px 25px rgba(0,0,0,0.2);
            z-index: 9999;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid #ddd;
        }
        .chat-header {
            background-color: white;
            color: red;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #eee;
        }
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            background-color: #f9f9f9;
            display: flex;
            flex-direction: column;
        }
        .chat-input-area {
            padding: 15px;
            border-top: 1px solid #ddd;
            display: flex;
            gap: 10px;
            background: white;
        }
        .chat-message {
            margin-bottom: 10px;
            max-width: 80%;
            padding: 8px 12px;
            border-radius: 12px;
            font-size: 14px;
            word-wrap: break-word;
        }
        .chat-message.customer {
            align-self: flex-end;
            background-color: red;
            color: white;
            border-bottom-right-radius: 2px;
        }
        .chat-message.admin {
            align-self: flex-start;
            background-color: #e9ecef;
            color: #333;
            border-bottom-left-radius: 2px;
        }
        .chat-timestamp {
            font-size: 10px;
            margin-top: 4px;
            opacity: 0.7;
            text-align: right;
        }
        .chat-widget-box .btn-danger {
            background-color: red;
            border-color: red;
        }
        .chat-widget-box .btn-danger:hover {
            background-color: #cc0000;
            border-color: #bf0000;
        }
        .chat-confirmation {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin: 10px auto;
            text-align: center;
            width: 90%;
        }
        .chat-confirmation p {
            margin-bottom: 10px;
            font-size: 14px;
        }
        .chat-confirmation button {
            margin: 0 5px;
        }
    `;
    document.head.appendChild(style);

    // Inject HTML
    const widgetHTML = `
        <button id="chatWidgetBtn" class="chat-widget-btn">
            <i class="bi bi-chat-dots"></i>
        </button>

        <div id="chatWidgetBox" class="chat-widget-box">
            <div class="chat-header">
                <h5 class="m-0 fs-6 fw-bold"><i class="bi bi-headset me-2"></i>Support</h5>
                <button id="closeChatBtn" class="btn-close" aria-label="Close"></button>
            </div>
            
            <div id="chatMessages" class="chat-messages">
                <div class="text-center text-muted mt-4">
                    <p>Welcome to Santander Support.</p>
                    <p class="small">Please enter your details to start.</p>
                </div>
            </div>

            <div id="chatRegistration" class="p-4" style="display: none;">
                <div class="mb-3">
                    <input type="text" id="chatName" class="form-control form-control-sm" placeholder="Your Name">
                </div>
                <div class="mb-3">
                    <input type="email" id="chatEmail" class="form-control form-control-sm" placeholder="Your Email">
                </div>
                <div class="mb-3">
                    <textarea id="chatStartMsg" class="form-control form-control-sm" rows="2" placeholder="How can we help?"></textarea>
                </div>
                <button id="startChatBtn" class="btn btn-danger btn-sm w-100">Start Chat</button>
            </div>

            <div id="chatInputArea" class="chat-input-area" style="display: none;">
                <textarea id="chatInput" class="form-control form-control-sm" rows="1" placeholder="Type a message..."></textarea>
                <button id="sendMessageBtn" class="btn btn-danger btn-sm"><i class="bi bi-send"></i></button>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = widgetHTML;
    document.body.appendChild(div);

    // Logic
    const btn = document.getElementById('chatWidgetBtn');
    const box = document.getElementById('chatWidgetBox');
    const closeBtn = document.getElementById('closeChatBtn');
    const messagesDiv = document.getElementById('chatMessages');
    const regDiv = document.getElementById('chatRegistration');
    const inputArea = document.getElementById('chatInputArea');
    const startBtn = document.getElementById('startChatBtn');
    const sendBtn = document.getElementById('sendMessageBtn');
    const input = document.getElementById('chatInput');

    let sessionId = localStorage.getItem('chatSessionId');
    let customerName = localStorage.getItem('chatCustomerName');
    let customerEmail = localStorage.getItem('chatCustomerEmail');
    let pollingInterval;

    function toggleChat() {
        if (box.style.display === 'none' || box.style.display === '') {
            box.style.display = 'flex';
            if (sessionId) {
                showChatInterface();
                loadMessages();
                startPolling();
            } else {
                showRegistration();
            }
        } else {
            box.style.display = 'none';
            stopPolling();
        }
    }

    function showRegistration() {
        messagesDiv.style.display = 'none';
        inputArea.style.display = 'none';
        regDiv.style.display = 'block';
    }

    function showChatInterface() {
        regDiv.style.display = 'none';
        messagesDiv.style.display = 'flex';
        inputArea.style.display = 'flex';
    }

    function startChat() {
        const name = document.getElementById('chatName').value.trim();
        const email = document.getElementById('chatEmail').value.trim();
        const msg = document.getElementById('chatStartMsg').value.trim();

        if (!name || !email || !msg) return alert('Please fill all fields');

        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        customerName = name;
        customerEmail = email;

        localStorage.setItem('chatSessionId', sessionId);
        localStorage.setItem('chatCustomerName', name);
        localStorage.setItem('chatCustomerEmail', email);

        sendMessageToApi(msg, true);
        showChatInterface();
        startPolling();
    }

    async function sendMessageToApi(message, isFirst = false) {
        try {
            const payload = {
                session_id: sessionId,
                sender_type: 'customer',
                sender_name: customerName,
                message: message,
                customer_email: customerEmail
            };

            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            if (data.success) {
                if (!isFirst) {
                    input.value = '';
                    loadMessages();
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function loadMessages() {
        if (!sessionId) return;
        try {
            const res = await fetch(`/api/chat/messages/${sessionId}`);
            const data = await res.json();
            
            if (data.success) {
                if (data.active === false) {
                    endChat();
                    return;
                }
                renderMessages(data.messages);
            }
        } catch (e) {
            console.error(e);
        }
    }

    function renderMessages(msgs) {
        messagesDiv.innerHTML = '';
        msgs.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-message ${msg.sender_type}`;
            div.innerHTML = `
                <div>${escapeHtml(msg.message).replace(/\n/g, '<br>')}</div>
                <div class="chat-timestamp">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            messagesDiv.appendChild(div);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function startPolling() {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(loadMessages, 3000);
    }

    function stopPolling() {
        if (pollingInterval) clearInterval(pollingInterval);
    }

    // Ask for confirmation before closing the chat
    function requestCloseChat() {
        if (sessionId) {
            showCloseConfirmation();
        } else {
            // If there's no active session, just hide the widget
            box.style.display = 'none';
            stopPolling();
        }
    }

    function showCloseConfirmation() {
        // Prevent multiple confirmation boxes
        if (document.querySelector('.chat-confirmation')) return;

        // Disable input while confirming
        input.disabled = true;
        sendBtn.disabled = true;

        const confirmationDiv = document.createElement('div');
        confirmationDiv.className = 'chat-confirmation';
        confirmationDiv.innerHTML = `
            <p>Are you sure you want to end this chat session?</p>
            <div>
                <button id="confirmEndChat" class="btn btn-danger btn-sm">Yes, End</button>
                <button id="cancelEndChat" class="btn btn-secondary btn-sm">Cancel</button>
            </div>
        `;
        messagesDiv.appendChild(confirmationDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        document.getElementById('confirmEndChat').addEventListener('click', closeSessionOnServer);

        document.getElementById('cancelEndChat').addEventListener('click', () => {
            confirmationDiv.remove();
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        });
    }

    // Call server to delete the session
    async function closeSessionOnServer() {
        if (!sessionId) return;
        try {
            const res = await fetch(`/api/chat/sessions/${sessionId}/close`, {
                method: 'PUT'
            });
            const data = await res.json();
            if (data.success) {
                // Reset client-side state
                localStorage.removeItem('chatSessionId');
                localStorage.removeItem('chatCustomerName');
                localStorage.removeItem('chatCustomerEmail');
                sessionId = null;
                customerName = null;
                customerEmail = null;
                stopPolling();
                box.style.display = 'none';
                showRegistration(); // Reset to the initial view
            } else {
                alert('Failed to close chat session. Please try again.');
            }
        } catch (e) {
            console.error('Error closing chat session:', e);
        }
    }

    function endChat() {
        localStorage.removeItem('chatSessionId');
        localStorage.removeItem('chatCustomerName');
        localStorage.removeItem('chatCustomerEmail');
        sessionId = null;
        stopPolling();
        messagesDiv.innerHTML = '<div class="text-center text-muted mt-5">Chat ended.</div>';
        inputArea.style.display = 'none';
        setTimeout(() => {
            showRegistration();
        }, 2000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    btn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', requestCloseChat);
    startBtn.addEventListener('click', startChat);
    sendBtn.addEventListener('click', () => {
        const msg = input.value.trim();
        if (msg) sendMessageToApi(msg);
    });
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const msg = input.value.trim();
            if (msg) sendMessageToApi(msg);
        }
    });
})();