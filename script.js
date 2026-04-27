document.addEventListener('DOMContentLoaded', async () => {
    // ── Element refs ──
    const loginScreen  = document.getElementById('login-screen');
    const launcherScreen = document.getElementById('launcher-screen');

    const tabMs        = document.getElementById('tab-microsoft');
    const tabOff       = document.getElementById('tab-offline');
    const bodyMs       = document.getElementById('body-microsoft');
    const bodyOff      = document.getElementById('body-offline');

    const btnMsLogin   = document.getElementById('btn-ms-login');
    const msStatus     = document.getElementById('ms-status');
    const offlineInput = document.getElementById('offline-username');
    const btnOffLogin  = document.getElementById('btn-offline-login');

    const welcomeName  = document.getElementById('welcome-name');
    const userName     = document.getElementById('user-name');
    const userStatus   = document.getElementById('user-status');
    const avatarImg    = document.getElementById('avatar-img');
    const logoutBtn    = document.getElementById('logout-btn');

    const launchBtn    = document.getElementById('launch-btn');
    const closeBtn     = document.getElementById('close-btn');
    const settingsBtn  = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const ramSlider    = document.getElementById('ram-slider');
    const ramDisplay   = document.getElementById('ram-display');
    const colorPicker  = document.getElementById('color-picker');

    const modsBtn      = document.getElementById('mods-btn');
    const modsTab      = document.getElementById('mods-tab');
    const closeMods    = document.getElementById('close-mods');
    const addModBtn    = document.getElementById('add-mod-btn');
    const modsList     = document.getElementById('mods-list');

    // ── Login tab switching ──
    tabMs.addEventListener('click', () => {
        tabMs.classList.add('active');
        tabOff.classList.remove('active');
        bodyMs.classList.remove('hidden');
        bodyOff.classList.add('hidden');
    });
    tabOff.addEventListener('click', () => {
        tabOff.classList.add('active');
        tabMs.classList.remove('active');
        bodyOff.classList.remove('hidden');
        bodyMs.classList.add('hidden');
    });

    // ── Helper: transition to launcher ──
    function showLauncher(name, isPremium) {
        welcomeName.innerText = name;
        userName.innerText = name;
        userStatus.innerText = isPremium ? 'Premium' : 'Offline';
        userStatus.style.color = isPremium ? '#34d399' : '#94a3b8';
        avatarImg.src = `https://minotar.net/helm/${name}/32.png`;

        loginScreen.style.opacity = '0';
        loginScreen.style.transform = 'scale(0.95)';
        loginScreen.style.transition = 'all .3s ease';

        setTimeout(() => {
            loginScreen.classList.add('hidden');
            launcherScreen.classList.remove('hidden');
        }, 300);
    }

    // ── Microsoft login ──
    btnMsLogin.addEventListener('click', async () => {
        if (!window.electronAPI) return;
        btnMsLogin.disabled = true;
        btnMsLogin.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Waiting for browser...';
        msStatus.innerText = 'A browser window will open. Sign in there.';

        try {
            const result = await window.electronAPI.microsoftLogin();
            if (result && result.name) {
                showLauncher(result.name, true);
            } else {
                msStatus.innerText = 'Login failed or was cancelled.';
            }
        } catch (e) {
            msStatus.innerText = 'Login error. Try again.';
        }
        btnMsLogin.disabled = false;
        btnMsLogin.innerHTML = '<i class="fa-brands fa-microsoft"></i> Sign in with Microsoft';
    });

    // ── Offline login ──
    btnOffLogin.addEventListener('click', () => {
        const name = offlineInput.value.trim();
        if (!name) { offlineInput.style.borderColor = '#ef4444'; return; }
        if (window.electronAPI) window.electronAPI.offlineLogin(name);
        showLauncher(name, false);
    });
    offlineInput.addEventListener('input', () => { offlineInput.style.borderColor = ''; });
    offlineInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnOffLogin.click(); });

    // ── Logout ──
    logoutBtn.addEventListener('click', () => {
        launcherScreen.style.opacity = '0';
        launcherScreen.style.transform = 'scale(0.95)';
        launcherScreen.style.transition = 'all .3s ease';
        setTimeout(() => {
            launcherScreen.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            loginScreen.style.opacity = '1';
            loginScreen.style.transform = 'scale(1)';
            launcherScreen.style.opacity = '';
            launcherScreen.style.transform = '';
        }, 300);
    });

    // ── Launch progress listener ──
    if (window.electronAPI && window.electronAPI.onLaunchProgress) {
        window.electronAPI.onLaunchProgress((message) => {
            if (message === 'Launched!' || message === 'Closed' || message === 'Error launching') {
                launchBtn.innerHTML = '<i class="fa-solid fa-play"></i> Launch GreenCloud';
                launchBtn.style.opacity = '1';
                launchBtn.style.pointerEvents = 'auto';
                if (message === 'Error launching') alert('Failed to launch Minecraft.');
            } else {
                launchBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${message}`;
            }
        });
    }

    // ── Update listener ──
    if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
        window.electronAPI.onUpdateAvailable(() => {
            const banner = document.getElementById('update-banner');
            if (banner) {
                banner.classList.remove('hidden');
                banner.querySelector('span').innerText = 'A new version of GreenCloud is available! Downloading...';
            }
        });
    }

    if (window.electronAPI && window.electronAPI.onUpdateReady) {
        window.electronAPI.onUpdateReady(() => {
            const banner = document.getElementById('update-banner');
            if (banner) {
                banner.querySelector('span').innerText = 'Update downloaded! Please restart to apply.';
            }
        });
    }

    const restartBtn = document.getElementById('restart-update-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (window.electronAPI) window.electronAPI.restartAndUpdate();
        });
    }

    // ── Launch button ──
    launchBtn.addEventListener('click', () => {
        launchBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Preparing...';
        launchBtn.style.opacity = '0.8';
        launchBtn.style.pointerEvents = 'none';
        if (window.electronAPI) {
            const currentRam = localStorage.getItem('greencloud-ram') || "4";
            window.electronAPI.launchMinecraft(currentRam);
        }
    });

    // ── Close ──
    closeBtn.addEventListener('click', () => {
        const container = document.querySelector('.launcher-container') || document.querySelector('.login-container');
        if (container) {
            container.style.transform = 'scale(0.95)';
            container.style.opacity = '0';
            container.style.transition = 'all .25s ease';
        }
        setTimeout(() => { if (window.electronAPI) window.electronAPI.closeWindow(); }, 250);
    });

    // ── Settings modal ──
    const savedColor = localStorage.getItem('greencloud-gui-color');
    if (savedColor) {
        applyGuiColor(savedColor);
        colorPicker.value = savedColor;
    }
    const savedRam = localStorage.getItem('greencloud-ram');
    if (savedRam) { ramSlider.value = savedRam; ramDisplay.innerText = `${savedRam}GB`; }

    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

    ramSlider.addEventListener('input', (e) => {
        ramDisplay.innerText = `${e.target.value}GB`;
        localStorage.setItem('greencloud-ram', e.target.value);
    });

    colorPicker.addEventListener('input', (e) => {
        applyGuiColor(e.target.value);
        localStorage.setItem('greencloud-gui-color', e.target.value);
    });

    function applyGuiColor(hex) {
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        document.documentElement.style.setProperty('--gui-tint', `rgba(${r}, ${g}, ${b}, 0.35)`);
        document.body.style.background = `linear-gradient(135deg, rgba(${Math.floor(r*0.3)}, ${Math.floor(g*0.3)}, ${Math.floor(b*0.3)}, 1) 0%, rgba(${Math.floor(r*0.5)}, ${Math.floor(g*0.5)}, ${Math.floor(b*0.5)}, 0.6) 100%)`;
    }

    // ── Mods modal ──
    async function refreshModsList() {
        if (!window.electronAPI) return;
        const mods = await window.electronAPI.getMods();
        modsList.innerHTML = '';
        mods.forEach(modName => {
            const li = document.createElement('li');
            li.className = 'mod-item';
            li.innerHTML = `<span><i class="fa-solid fa-cube" style="margin-right:8px;color:var(--accent-green);"></i>${modName}</span><i class="fa-solid fa-trash remove-mod" data-name="${modName}"></i>`;
            modsList.appendChild(li);
            
            li.querySelector('.remove-mod').addEventListener('click', async (e) => {
                const name = e.currentTarget.getAttribute('data-name');
                if (await window.electronAPI.deleteMod(name)) {
                    li.remove();
                }
            });
        });
    }

    modsBtn.addEventListener('click', () => {
        modsTab.classList.remove('hidden');
        refreshModsList();
    });
    closeMods.addEventListener('click', () => modsTab.classList.add('hidden'));

    addModBtn.addEventListener('click', async () => {
        if (!window.electronAPI) return;
        const result = await window.electronAPI.selectMod();
        if (result && result.length > 0) {
            refreshModsList();
        }
    });

    // ── External Links ──
    const socialLinks = document.querySelectorAll('.social-links a');
    socialLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = link.getAttribute('href');
            if (window.electronAPI) window.electronAPI.openExternal(url);
        });
    });
});
