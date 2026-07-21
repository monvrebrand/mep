document.addEventListener('DOMContentLoaded', () => {
    const userStr = localStorage.getItem('santander_user');
    const token = localStorage.getItem('customerToken');
    
    if (!userStr || !token) return; // Not logged in
    
    const user = JSON.parse(userStr);
    const badge = document.getElementById('notificationBadge');
    const list = document.getElementById('notificationList');
    const dropdownToggle = document.getElementById('notificationDropdown');
    
    if (!badge || !list || !dropdownToggle) return; // Not on a dashboard page

    let unreadCount = 0;

    async function fetchNotifications() {
        try {
            const res = await fetch(`/api/user/${user.username}/notifications`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            
            if (data.success) {
                const notifications = data.notifications;
                unreadCount = notifications.filter(n => !n.is_read).length;
                
                // Update badge
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.classList.remove('d-none');
                } else {
                    badge.classList.add('d-none');
                }

                // Update list
                if (notifications.length === 0) {
                    list.innerHTML = '<li><div class="dropdown-item text-center text-muted">No notifications</div></li>';
                } else {
                    list.innerHTML = notifications.map(n => `
                        <li>
                            <div class="dropdown-item ${n.is_read ? 'text-muted' : 'fw-bold'} text-wrap" style="border-bottom: 1px solid #eee;">
                                <div class="d-flex justify-content-between">
                                    <small class="text-danger">${n.type.toUpperCase()}</small>
                                    <small class="text-muted" style="font-size: 0.75rem;">${new Date(n.created_at).toLocaleDateString()}</small>
                                </div>
                                <div style="font-size: 0.9rem;">${n.message}</div>
                            </div>
                        </li>
                    `).join('');
                }
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }

    async function markAsRead() {
        if (unreadCount === 0) return;
        
        try {
            const res = await fetch(`/api/user/${user.username}/notifications/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                unreadCount = 0;
                badge.classList.add('d-none');
                // Optional: trigger a fetch to grey them out, but they will update on next poll anyway
            }
        } catch (err) {
            console.error('Error marking notifications as read:', err);
        }
    }

    // Fetch initially
    fetchNotifications();

    // Poll every 30 seconds
    setInterval(fetchNotifications, 30000);

    // Mark as read when opening the dropdown
    dropdownToggle.addEventListener('click', () => {
        markAsRead();
    });
});
