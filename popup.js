const passBtn = document.getElementById('passBtn');
const statusDiv = document.getElementById('status');

function updateUI() {
  browser.storage.local.get(['passExpiry', 'lockoutExpiry', 'tamperLocked']).then((data) => {
    const now = Date.now();

    if (data.tamperLocked) {
      passBtn.disabled = true;
      passBtn.textContent = "Pass Unavailable";
      statusDiv.textContent = "Clock manipulation detected. System locked.";
      statusDiv.className = "status-msg lockdown";
      return;
    }

    // Scenario 1: User is currently on a 20-minute pass
    if (data.passExpiry && now < data.passExpiry) {
      passBtn.disabled = true;
      passBtn.textContent = "Pass Active";
      
      const timeLeft = data.passExpiry - now;
      const mins = Math.floor(timeLeft / 60000);
      const secs = Math.floor((timeLeft % 60000) / 1000);
      
      // Use \n instead of <br> for linter safety
      statusDiv.textContent = `YouTube unblocked for:\n${mins}m ${secs}s`;
      statusDiv.className = "status-msg active";
      
      setTimeout(updateUI, 1000); 
      return;
    }

    // Scenario 2: User is in the 7-day lockout period
    if (data.lockoutExpiry && now < data.lockoutExpiry) {
      passBtn.disabled = true;
      passBtn.textContent = "Locked Out";
      
      const timeLeft = data.lockoutExpiry - now;
      const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((timeLeft % (1000 * 60 * 60)) / 60000);
      
      statusDiv.textContent = `Next pass available in:\n${days}d ${hours}h ${mins}m`;
      statusDiv.className = "status-msg lockdown";
      return;
    }

    // Scenario 3: Ready to use
    passBtn.disabled = false;
    passBtn.textContent = "Activate 20-Min Pass";
    statusDiv.textContent = "YouTube homepage is currently blocked.";
    statusDiv.className = "status-msg";
  });
}

passBtn.addEventListener('click', () => {
  browser.runtime.sendMessage({ action: "startPass" }).then(() => {
    updateUI();
  });
});

updateUI();