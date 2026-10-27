const GITHUB_API = 'https://api.github.com/users/';
let chartInstance = null;
let isCompareMode = false;

const langColors = { JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c', Python: '#3572A5', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', PHP: '#4F5D95', Go: '#00ADD8', Rust: '#dea584' };

const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('gh_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('gh_theme', next);
    if (chartInstance) renderChart(chartInstance.data.labels, chartInstance.data.datasets[0].data, chartInstance.data.datasets[0].backgroundColor); // Re-render for theme
});

function toggleCompareMode() {
    isCompareMode = !isCompareMode;
    document.getElementById('compareSearchBox').classList.toggle('hidden', !isCompareMode);
    document.getElementById('compareInput').value = '';
    document.getElementById('searchBtn').textContent = isCompareMode ? 'Compare ⚔️' : 'Analyze →';
}

function handleKeyPress(e) { if (e.key === 'Enter') analyzeProfile(); }

function formatNumber(num) { return num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num; }

function calcScore(repos, stars, followers) {
    let score = (repos * 1) + (stars * 5) + (followers * 2);
    if (score > 1000) return { score: 'Legendary', color: '#ef4444' };
    if (score > 500) return { score: 'Pro Dev', color: '#f59e0b' };
    if (score > 200) return { score: 'Rising Star', color: '#10b981' };
    if (score > 50) return { score: 'Active', color: '#3b82f6' };
    return { score: 'Newbie', color: '#8b8b9e' };
}

function saveSearch(user) {
    let searches = JSON.parse(localStorage.getItem('gh_recent') || '[]');
    if (!searches.includes(user)) searches.unshift(user);
    searches = searches.slice(0, 4); // keep top 4
    localStorage.setItem('gh_recent', JSON.stringify(searches));
    renderRecentSearches();
}
function renderRecentSearches() {
    const container = document.getElementById('recentSearches');
    container.innerHTML = '';
    const searches = JSON.parse(localStorage.getItem('gh_recent') || '[]');
    searches.forEach(s => {
        container.innerHTML += `<span class="search-tag" onclick="document.getElementById('usernameInput').value='${s}'; analyzeProfile();">🕒 ${s}</span>`;
    });
}
renderRecentSearches();

async function analyzeProfile() {
    const input = document.getElementById('usernameInput');
    let username = input.value.trim();
    let compareUser = document.getElementById('compareInput').value.trim();
    
    if (!username) return;

    const parseUser = (str) => str.includes('github.com/') ? str.split('github.com/')[1].split('/')[0].split('?')[0] : str;
    username = parseUser(username);
    if (isCompareMode && compareUser) compareUser = parseUser(compareUser);

    const loader = document.getElementById('loader');
    const errorDiv = document.getElementById('error');
    const dashboard = document.getElementById('dashboard');
    const btn = document.getElementById('searchBtn');

    loader.style.display = 'flex'; errorDiv.style.display = 'none'; dashboard.style.display = 'none'; btn.disabled = true;

    try {
        const uRes = await fetch(`${GITHUB_API}${username}`);
        if (!uRes.ok) throw new Error('User not found.');
        const userData = await uRes.json();
        
        const [rRes, eRes] = await Promise.all([
            fetch(`${GITHUB_API}${username}/repos?per_page=100&sort=updated`),
            fetch(`${GITHUB_API}${username}/events/public?per_page=5`)
        ]);
        const repoData = await rRes.json();
        const eventData = await eRes.json();

        let totalStars = 0; const langCount = {};
        repoData.forEach(repo => {
            totalStars += repo.stargazers_count;
            if (repo.language) langCount[repo.language] = (langCount[repo.language] || 0) + 1;
        });

        document.getElementById('userAvatar').src = userData.avatar_url;
        document.getElementById('userName').textContent = userData.name || username;
        const userLink = document.getElementById('userUsername');
        userLink.textContent = '@' + userData.login; userLink.href = userData.html_url;
        document.getElementById('userBio').textContent = userData.bio || 'No bio available.';
        document.getElementById('userLocation').textContent = userData.location ? `📍 ${userData.location}` : '📍 Location not set';
        
        const scoreData = calcScore(userData.public_repos, totalStars, userData.followers);
        const scoreBadge = document.getElementById('userScoreBadge');
        scoreBadge.textContent = `🏆 ${scoreData.score}`;
        scoreBadge.style.background = scoreData.color;

        document.getElementById('statRepos').textContent = formatNumber(userData.public_repos);
        document.getElementById('statStars').textContent = formatNumber(totalStars);
        document.getElementById('statFollowers').textContent = formatNumber(userData.followers);

        const actList = document.getElementById('activityList');
        actList.innerHTML = '';
        if (eventData.length === 0) actList.innerHTML = '<p style="font-size:12px; color:var(--text-dim);">No recent activity.</p>';
        eventData.forEach(ev => {
            let text = '';
            if (ev.type === 'PushEvent') text = `Pushed ${ev.payload.commits?.length || 1} commit(s) to <strong>${ev.repo.name.split('/')[1]}</strong>`;
            else if (ev.type === 'WatchEvent') text = `Starred <strong>${ev.repo.name}</strong>`;
            else if (ev.type === 'CreateEvent') text = `Created ${ev.payload.ref_type} in <strong>${ev.repo.name.split('/')[1]}</strong>`;
            else return;

            const date = new Date(ev.created_at).toLocaleDateString();
            actList.innerHTML += `<div class="activity-item"><div class="act-text">${text}</div><div class="act-time">${date}</div></div>`;
        });

        const topRepos = [...repoData].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 3);
        const repoList = document.getElementById('repoList');
        repoList.innerHTML = '';
        topRepos.forEach(repo => {
            const color = langColors[repo.language] || '#8b8b9e';
            repoList.innerHTML += `
                <div class="repo-item">
                    <a href="${repo.html_url}" target="_blank" class="repo-name">📁 ${repo.name}</a>
                    <p class="repo-desc">${repo.description || 'No description.'}</p>
                    <div class="repo-meta">
                        ${repo.language ? `<span style="color:${color}">● ${repo.language}</span>` : ''}
                        <span>⭐ ${repo.stargazers_count}</span>
                    </div>
                </div>`;
        });

        renderChart(Object.keys(langCount).slice(0, 5), Object.values(langCount).slice(0, 5), Object.keys(langCount).slice(0, 5).map(l => langColors[l] || '#a371f7'));

        loader.style.display = 'none'; dashboard.style.display = 'block';
        document.getElementById('floatingActions').style.display = 'flex';
        
        saveSearch(username);

        if (isCompareMode && compareUser) {
            alert(`Compare feature loading... (User 1: ${username} vs User 2: ${compareUser}). Isko next step me UI me integrate karenge!`);
        }

    } catch (err) {
        loader.style.display = 'none'; errorDiv.textContent = '❌ ' + err.message; errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
    }
}

function renderChart(labels, data, bgColors) {
    const ctx = document.getElementById('langChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 6 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: isLight ? '#64748b' : '#8b8b9e', padding: 20, font: { family: 'Inter', size: 12 } } } }, cutout: '75%' }
    });
}

function downloadImage() {
    const area = document.getElementById('captureArea');
    const btn = document.querySelector('.float-btn');
    btn.textContent = '⏳ Generating...';
    
    html2canvas(area, { backgroundColor: getComputedStyle(document.body).backgroundColor, scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `github-stats-${document.getElementById('userName').textContent}.png`;
        link.href = canvas.toDataURL();
        link.click();
        btn.textContent = '📸 Download';
    });
}