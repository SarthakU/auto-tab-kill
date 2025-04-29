// Save options to browser.storage
function saveOptions(e) {
  e.preventDefault();
  console.log('Saving options...');
  const timeLimit = document.getElementById('timeLimit').value;
  const whitelist = document.getElementById('whitelist').value.split('\n').filter(pattern => pattern.trim() !== '');
  console.log('New settings:', { timeLimit, whitelist });
  browser.storage.sync.set({
    timeLimit: document.getElementById('timeLimit').value,
    whitelist: document.getElementById('whitelist').value.split('\n').filter(pattern => pattern.trim() !== '')
  }).then(() => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved successfully!';
    status.className = 'status success';
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  });
}

// Load saved options
function restoreOptions() {
  console.log('Loading saved options...');
  browser.storage.sync.get({
    timeLimit: 1,
    whitelist: []
  }).then((result) => {
    console.log('Loaded settings:', result);
    document.getElementById('timeLimit').value = result.timeLimit;
    document.getElementById('whitelist').value = result.whitelist.join('\n');
  }).catch(error => {
    console.error('Error loading settings:', error);
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
