document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('jwt');
    if (!token) {
      window.location.href = '/login.html';
      return;
    }
  
    // Fetch the user's profile
    try {
      const res = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to fetch profile');
      }
      document.getElementById('username').innerText = data.data.username;
    } catch (err) {
      console.error(err);
    }
  
    // Handle password update
    const form = document.getElementById('update-password-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById('new-password').value;
      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ newPassword })
        });
        const result = await res.json();
        // Show success or error message
        document.getElementById('update-message').innerText = result.message || result.status;
      } catch (err) {
        document.getElementById('update-message').innerText = err.message;
      }
    });
  
    // Back to Chat button
    document.getElementById('back-chat').addEventListener('click', () => {
      window.location.href = '/index.html';
    });
  });
  