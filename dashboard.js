/************************************************************************
 * SUPABASE CREDENTIALS HARDCODING SECTION
 ************************************************************************/
const SUPABASE_URL = "https://hgtlatmntilgyijyyqnu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OqD5ksBvDVMePF1gv3s-PQ_PM5hQGnF";

// Application State Variables
let currentDate = new Date();
let trades = [];
let transfers = [];
let supabaseClient = null;
let chartInstance = null;
let currentUser = null;

window.onload = async function () {
    initSupabaseClient();
    initChart();
    await checkAuthAndLoad();

    const todayStr = new Date().toISOString().split('T')[0];
    const tradeDateEl = document.getElementById('tradeDate');
    const transferDateEl = document.getElementById('transferDate');
    if (tradeDateEl) tradeDateEl.value = todayStr;
    if (transferDateEl) transferDateEl.value = todayStr;
};

function initSupabaseClient() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("Supabase initialized successfully.");
        } catch (e) {
            console.error("Supabase initialization failed:", e);
            supabaseClient = null;
        }
    } else {
        console.log("Operating in local browser storage mode.");
    }
}

async function checkAuthAndLoad() {
    if (supabaseClient) {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error || !session) {
                window.location.href = 'auth.html';
                return;
            }
            currentUser = session.user;
            await loadStoredData();
        } catch (err) {
            console.error("Auth session check error:", err);
            window.location.href = 'auth.html';
        }
    } else {
        loadLocalData();
        renderDashboard();
    }
}

async function handleSignOut() {
    if (supabaseClient) {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error('Logout error:', error.message);
            alert('Error logging out: ' + error.message);
            return;
        }
    }
    localStorage.clear();
    window.location.href = 'index.html';
}

async function loadStoredData() {
    if (supabaseClient && currentUser) {
        try {
            const { data: tData, error: tErr } = await supabaseClient
                .from('trades')
                .select('*')
                .eq('user_id', currentUser.id);

            const { data: trData, error: trErr } = await supabaseClient
                .from('transfers')
                .select('*')
                .eq('user_id', currentUser.id);

            trades = (!tErr && tData) ? tData : [];
            transfers = (!trErr && trData) ? trData : [];

            saveLocalCache();
        } catch (err) {
            console.warn("Supabase fetch failed, falling back to LocalStorage:", err);
            loadLocalData();
        }
    } else {
        loadLocalData();
    }
    renderDashboard();
}

function loadLocalData() {
    const keyPrefix = currentUser ? currentUser.id : 'guest';
    const localT = localStorage.getItem(`tj_trades_${keyPrefix}`);
    const localTr = localStorage.getItem(`tj_transfers_${keyPrefix}`);

    trades = localT ? JSON.parse(localT) : [];
    transfers = localTr ? JSON.parse(localTr) : [];
}

function saveLocalCache() {
    const keyPrefix = currentUser ? currentUser.id : 'guest';
    localStorage.setItem(`tj_trades_${keyPrefix}`, JSON.stringify(trades));
    localStorage.setItem(`tj_transfers_${keyPrefix}`, JSON.stringify(transfers));
}

function saveData() {
    saveLocalCache();
    renderDashboard();
}

function renderDashboard() {
    renderCalendar();
    renderStats();
    renderChart();
    renderLogsTable();
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderDashboard();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const monthYrEl = document.getElementById('calendarMonthYear');
    if (monthYrEl) monthYrEl.innerText = `${monthNames[month]} ${year}`;

    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const tradeMap = {};
    trades.forEach(t => {
        if (!tradeMap[t.date]) tradeMap[t.date] = { count: 0, pl: 0 };
        tradeMap[t.date].count += 1;
        tradeMap[t.date].pl += parseFloat(t.actual_pl || 0);
    });

    let cellCount = 0;
    let currentWeekPL = 0;
    let currentWeekTrades = 0;
    let weekNumber = 1;

    for (let i = firstDay - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i;
        grid.appendChild(createCalendarCell(dayNum, null, null, true));
        cellCount++;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const data = tradeMap[dateStr];

        if (data) {
            currentWeekPL += data.pl;
            currentWeekTrades += data.count;
        }

        grid.appendChild(createCalendarCell(day, data ? data : null, dateStr, false));
        cellCount++;

        if (cellCount % 7 === 0) {
            grid.appendChild(createWeekSummaryCell(weekNumber, currentWeekPL, currentWeekTrades));
            currentWeekPL = 0;
            currentWeekTrades = 0;
            weekNumber++;
        }
    }

    let nextMonthDay = 1;
    while (cellCount % 7 !== 0) {
        grid.appendChild(createCalendarCell(nextMonthDay, null, null, true));
        cellCount++;
        nextMonthDay++;
    }
    if (currentWeekTrades > 0 || cellCount % 7 === 0) {
        grid.appendChild(createWeekSummaryCell(weekNumber, currentWeekPL, currentWeekTrades));
    }
}

function getHeatmapClass(data) {
    if (!data || data.count === 0) return 'cell-no-trades';
    const pl = data.pl;
    if (pl <= -50) return 'cell-heavy-loss';
    if (pl < -15) return 'cell-mod-loss';
    if (pl < 0) return 'cell-minor-loss';
    if (pl > 0 && pl <= 20) return 'cell-minor-gain';
    if (pl > 20 && pl <= 60) return 'cell-mod-gain';
    if (pl > 60) return 'cell-strong-gain';
    return 'cell-no-trades';
}

// READ-ONLY CALENDAR CELL CREATION
function createCalendarCell(day, data, dateStr, isOtherMonth) {
    const div = document.createElement('div');
    // Removed cursor-pointer and no click listener assigned
    div.className = `calendar-cell rounded-2xl p-2.5 flex flex-col justify-between border cursor-default select-none ${isOtherMonth ? 'opacity-25 border-transparent bg-darkBg/30' : getHeatmapClass(data)}`;

    const topRow = `<div class="font-bold text-slate-300 text-xs">${day}</div>`;

    let bottomContent = `<div class="text-[10px] text-slate-500 font-medium">No data</div>`;
    if (data && data.count > 0) {
        const isProfit = data.pl >= 0;
        // Integer whole number formatting
        const wholePL = Math.round(data.pl);
        const plFormatted = (isProfit ? '+' : '') + '$' + wholePL;
        const plColor = isProfit ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold';
        bottomContent = `
            <div class="mt-1 overflow-hidden leading-tight">
                <div class="${plColor} text-xs tracking-tight truncate" title="${plFormatted}">${plFormatted}</div>
                <div class="text-[10px] text-slate-400 font-medium whitespace-nowrap">${data.count} trade${data.count > 1 ? 's' : ''}</div>
            </div>
        `;
    }

    div.innerHTML = topRow + bottomContent;
    return div;
}

function createWeekSummaryCell(weekNum, weekPL, weekTrades) {
    const div = document.createElement('div');
    div.className = "calendar-cell rounded-2xl p-2.5 flex flex-col justify-between border border-cardBorder bg-darkBg/80 text-right";

    const isProfit = weekPL >= 0;
    const plFormatted = (isProfit ? '+' : '') + '$' + Math.round(weekPL);
    const plColor = isProfit ? 'text-emerald-400' : 'text-rose-400';

    div.innerHTML = `
        <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">WEEK ${weekNum}</div>
        <div class="mt-1 overflow-hidden leading-tight">
            <div class="${plColor} font-extrabold text-xs tracking-tight truncate" title="${plFormatted}">${plFormatted}</div>
            <div class="text-[10px] text-slate-500 font-medium whitespace-nowrap">${weekTrades} trades</div>
        </div>
    `;
    return div;
}

function renderStats() {
    let totalPL = 0;
    let totalTrades = trades.length;
    let wins = 0;
    let losses = 0;

    const dailyPLMap = {};

    trades.forEach(t => {
        const pl = parseFloat(t.actual_pl || 0);
        totalPL += pl;
        if (pl > 0) wins++;
        else if (pl < 0) losses++;

        if (!dailyPLMap[t.date]) dailyPLMap[t.date] = 0;
        dailyPLMap[t.date] += pl;
    });

    const tradingDaysCount = Object.keys(dailyPLMap).length;
    const avgDailyPL = tradingDaysCount > 0 ? (totalPL / tradingDaysCount) : 0;

    let bestDayVal = -Infinity;
    let bestDayDate = 'No trades';
    let worstDayVal = Infinity;
    let worstDayDate = 'No trades';

    Object.entries(dailyPLMap).forEach(([dateStr, pl]) => {
        if (pl > bestDayVal) {
            bestDayVal = pl;
            bestDayDate = formatDateLabel(dateStr);
        }
        if (pl < worstDayVal) {
            worstDayVal = pl;
            worstDayDate = formatDateLabel(dateStr);
        }
    });

    if (bestDayVal === -Infinity) bestDayVal = 0;
    if (worstDayVal === Infinity) worstDayVal = 0;

    let netDeposits = 0;
    transfers.forEach(tr => {
        const amt = parseFloat(tr.amount || 0);
        if (tr.type === 'DEPOSIT') netDeposits += amt;
        else if (tr.type === 'WITHDRAWAL') netDeposits -= amt;
    });

    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';

    const setElText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    setElText('statTradingDays', tradingDaysCount);
    setElText('statTotalTrades', totalTrades);
    setElText('statProfitable', wins);
    setElText('statLosing', losses);

    const totalPLFormatted = (totalPL >= 0 ? '$' : '-$') + Math.round(Math.abs(totalPL));
    const totalPLEl = document.getElementById('statTotalPL');
    if (totalPLEl) {
        totalPLEl.innerText = totalPLFormatted;
        totalPLEl.className = `text-3xl font-black mt-1.5 ${totalPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    setElText('statAvgDailyPL', (avgDailyPL >= 0 ? '$' : '-$') + Math.round(Math.abs(avgDailyPL)));
    setElText('statBestDayVal', (bestDayVal >= 0 ? '$' : '-$') + Math.round(Math.abs(bestDayVal)));
    setElText('statBestDayDate', bestDayDate);
    setElText('statWorstDayVal', (worstDayVal >= 0 ? '$' : '-$') + Math.round(Math.abs(worstDayVal)));
    setElText('statWorstDayDate', worstDayDate);

    setElText('equityTradingProfit', totalPLFormatted);
    setElText('equityNetDeposits', '$' + Math.round(netDeposits));
    setElText('equityTransfersCount', `${transfers.length} transfers`);
    setElText('equityWinRate', `${winRate}%`);
    setElText('equityTotalTradesCount', totalTrades);

    const winRateNum = parseFloat(winRate);
    const msgEl = document.getElementById('equityWinRateMsg');
    if (msgEl) {
        if (totalTrades === 0) {
            msgEl.innerText = 'No trades logged';
            msgEl.className = 'text-xs text-slate-400 mt-1 inline-block font-semibold';
        } else if (winRateNum >= 50) {
            msgEl.innerText = 'Good Standing';
            msgEl.className = 'text-xs text-emerald-400 mt-1 inline-block font-semibold';
        } else {
            msgEl.innerText = 'Needs work';
            msgEl.className = 'text-xs text-amber-400 mt-1 inline-block font-semibold';
        }
    }
}

function formatDateLabel(dateStr) {
    if (!dateStr || dateStr === 'No trades') return 'No trades';
    const parts = dateStr.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[d.getMonth()]} ${d.getDate()}`;
}

function initChart() {
    const canvas = document.getElementById('equityChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Equity',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderWidth: 2.5,
                tension: 0.15,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: '#10b981',
                pointHoverBackgroundColor: '#34d399',
                pointBorderColor: '#0f172a',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1e293b',
                    titleColor: '#94a3b8',
                    bodyColor: '#34d399',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: (context) => 'Date: ' + context[0].label,
                        label: (context) => {
                            const val = context.raw || 0;
                            const formatted = (val >= 0 ? '$' : '-$') + Math.round(Math.abs(val));
                            return ` Equity: ${formatted}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(30, 41, 59, 0.6)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(30, 41, 59, 0.6)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: (value) => (value >= 0 ? '$' : '-$') + Math.round(Math.abs(value))
                    }
                }
            }
        }
    });
}

function renderChart() {
    if (!chartInstance) return;

    const events = [];
    trades.forEach(t => events.push({ date: t.date, type: 'TRADE', amount: parseFloat(t.actual_pl || 0) }));
    transfers.forEach(tr => {
        const amt = parseFloat(tr.amount || 0);
        events.push({ date: tr.date, type: 'TRANSFER', amount: tr.type === 'DEPOSIT' ? amt : -amt });
    });

    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    let currentEquity = 0;
    const labels = [];
    const dataPoints = [];

    if (events.length === 0) {
        labels.push('Start');
        dataPoints.push(0);
    } else {
        events.forEach(ev => {
            currentEquity += ev.amount;
            labels.push(formatDateLabel(ev.date));
            dataPoints.push(currentEquity);
        });
    }

    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = dataPoints;
    chartInstance.update();
}

function renderLogsTable() {
    const tbody = document.getElementById('tradeLogsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const badge = document.getElementById('logCountBadge');
    if (badge) badge.innerText = `${trades.length} Records`;

    if (trades.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500 text-xs">No trade logs found. Click "New Trade" to start journaling!</td></tr>`;
        return;
    }

    const sortedTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedTrades.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkBg/50 transition";

        const pl = parseFloat(t.actual_pl || 0);
        const isWin = pl >= 0;
        const plClass = isWin ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';

        let badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
        if (t.outcome === 'WIN') badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        if (t.outcome === 'BREAKEVEN') badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";

        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-200">${t.date}</td>
            <td class="p-3 font-bold text-white uppercase">${t.pair}</td>
            <td class="p-3"><span class="px-2.5 py-0.5 border text-xs rounded-full font-semibold ${badgeColor}">${t.outcome}</span></td>
            <td class="p-3 text-slate-400">$${Math.round(parseFloat(t.risk || 0))}</td>
            <td class="p-3 text-slate-400">$${Math.round(parseFloat(t.target || 0))}</td>
            <td class="p-3 ${plClass}">${isWin ? '+' : ''}$${Math.round(pl)}</td>
            <td class="p-3 text-right space-x-2">
                <button onclick="editTrade('${t.id}')" class="text-slate-400 hover:text-emerald-400 p-1"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteTrade('${t.id}')" class="text-slate-400 hover:text-rose-400 p-1"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function autoFillPL() {
    const outcome = document.getElementById('tradeOutcome').value;
    const risk = parseFloat(document.getElementById('tradeRisk').value) || 0;
    const target = parseFloat(document.getElementById('tradeTarget').value) || 0;
    const plInput = document.getElementById('tradeActualPL');

    if (outcome === 'WIN' && target > 0) plInput.value = Math.round(target);
    else if (outcome === 'LOSS' && risk > 0) plInput.value = -Math.round(risk);
    else if (outcome === 'BREAKEVEN') plInput.value = 0;
}

async function handleSaveTrade(e) {
    e.preventDefault();
    const id = document.getElementById('tradeId').value || Date.now().toString();
    const tradeObj = {
        id: id,
        user_id: currentUser ? currentUser.id : null,
        date: document.getElementById('tradeDate').value,
        pair: document.getElementById('tradePair').value.toUpperCase(),
        risk: parseFloat(document.getElementById('tradeRisk').value) || 0,
        target: parseFloat(document.getElementById('tradeTarget').value) || 0,
        outcome: document.getElementById('tradeOutcome').value,
        actual_pl: parseFloat(document.getElementById('tradeActualPL').value) || 0
    };

    if (supabaseClient && currentUser) {
        try {
            await supabaseClient.from('trades').upsert([tradeObj]);
        } catch (err) {
            console.error("Supabase trade sync error:", err);
        }
    }

    const existingIdx = trades.findIndex(t => t.id === id);
    if (existingIdx >= 0) trades[existingIdx] = tradeObj;
    else trades.push(tradeObj);

    saveData();
    closeTradeModal();
}

async function deleteTrade(id) {
    if (supabaseClient && currentUser) {
        try {
            await supabaseClient.from('trades').delete().eq('id', id).eq('user_id', currentUser.id);
        } catch (err) {
            console.error("Delete trade error:", err);
        }
    }
    trades = trades.filter(t => t.id !== id);
    saveData();
}

function editTrade(id) {
    const t = trades.find(item => item.id === id);
    if (!t) return;
    document.getElementById('tradeId').value = t.id;
    document.getElementById('tradeDate').value = t.date;
    document.getElementById('tradePair').value = t.pair;
    document.getElementById('tradeRisk').value = t.risk;
    document.getElementById('tradeTarget').value = t.target;
    document.getElementById('tradeOutcome').value = t.outcome;
    document.getElementById('tradeActualPL').value = t.actual_pl;

    document.getElementById('tradeModalTitle').innerText = 'Edit Trade';
    document.getElementById('tradeModal').classList.remove('hidden');
}

async function handleSaveTransfer(e) {
    e.preventDefault();
    const transferObj = {
        id: Date.now().toString(),
        user_id: currentUser ? currentUser.id : null,
        type: document.getElementById('transferType').value,
        amount: parseFloat(document.getElementById('transferAmount').value) || 0,
        date: document.getElementById('transferDate').value
    };

    if (supabaseClient && currentUser) {
        try {
            await supabaseClient.from('transfers').insert([transferObj]);
        } catch (err) {
            console.error("Supabase transfer error:", err);
        }
    }

    transfers.push(transferObj);
    saveData();
    closeDepositModal();
}

function exportCSV() {
    if (trades.length === 0) return;
    let csv = 'Date,Pair,Outcome,Risk,Target,Actual_PL\n';
    trades.forEach(t => {
        csv += `${t.date},${t.pair},${t.outcome},${t.risk},${t.target},${t.actual_pl}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `trading_journal_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
}

function openTradeModal() {
    document.getElementById('tradeId').value = '';
    document.getElementById('tradeForm').reset();
    document.getElementById('tradeModalTitle').innerText = 'Record New Trade';
    document.getElementById('tradeDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('tradeModal').classList.remove('hidden');
}
function closeTradeModal() { document.getElementById('tradeModal').classList.add('hidden'); }

function openDepositModal() {
    document.getElementById('depositForm').reset();
    document.getElementById('transferDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('depositModal').classList.remove('hidden');
}
function closeDepositModal() { document.getElementById('depositModal').classList.add('hidden'); }