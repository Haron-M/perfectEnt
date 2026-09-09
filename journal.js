
const SUPABASE_URL = "https://hgtlatmntilgyijyyqnu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OqD5ksBvDVMePF1gv3s-PQ_PM5hQGnF";
let supabaseClient = null;
if (
    !SUPABASE_URL.startsWith("YOUR_") &&
    !SUPABASE_ANON_KEY.startsWith("YOUR_")
) {

    supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

}
/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let trades = [];

let deposits = [];

let currentMonth = new Date();


/* =====================================================
   SHORTCUT
===================================================== */

const $ = id =>
    document.getElementById(id);


/* =====================================================
   MONEY FORMAT
===================================================== */

function money(value) {

    value = Number(value) || 0;

    if (value < 0) {

        return "-$" +
            Math.abs(value).toFixed(2);

    }

    return "$" +
        value.toFixed(2);
}


/* =====================================================
   DATE FORMAT
===================================================== */

function isoDate(date) {

    const d = new Date(date);

    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
}


function displayDate(date) {

    return new Date(
        `${date}T00:00:00`
    ).toLocaleDateString(
        undefined,
        {
            month: "short",
            day: "numeric"
        }
    );
}


/* =====================================================
   MESSAGE
===================================================== */

function showMessage(
    element,
    text,
    success = false
) {

    element.textContent = text;

    element.style.color =
        success
            ? "#54d88d"
            : "#ff9292";
}


/* =====================================================
   CALCULATE P/L
===================================================== */

function calculatePL() {

    const risk =
        Number(
            $("risk").value
        ) || 0;

    const target =
        Number(
            $("target").value
        ) || 0;

    const result =
        document.querySelector(
            'input[name="result"]:checked'
        )?.value;


    let pl = 0;


    if (result === "win") {

        pl = target;

    } else {

        pl = -risk;

    }


    $("calculatedPL").textContent =
        money(pl);


    if (pl >= 0) {

        $("calculatedPL").style.color =
            "#53d88d";

    } else {

        $("calculatedPL").style.color =
            "#ff858b";

    }

}


/* =====================================================
   EVENT LISTENERS FOR P/L
===================================================== */

$("risk").addEventListener(
    "input",
    calculatePL
);

$("target").addEventListener(
    "input",
    calculatePL
);


document
    .querySelectorAll(
        'input[name="result"]'
    )
    .forEach(input => {

        input.addEventListener(
            "change",
            calculatePL
        );

    });


$("tradeDate").value =
    isoDate(new Date());


/* =====================================================
   SIGN UP
===================================================== */

$("signupBtn").onclick =
    async function () {

        if (!supabaseClient) {

            showMessage(
                $("authMessage"),
                "Please add your Supabase URL and key in the code first."
            );

            return;
        }


        const email =
            $("email").value.trim();

        const password =
            $("password").value;


        if (!email) {

            showMessage(
                $("authMessage"),
                "Please enter your email."
            );

            return;
        }


        if (password.length < 6) {

            showMessage(
                $("authMessage"),
                "Password must be at least 6 characters."
            );

            return;
        }


        const {
            data,
            error
        } =
            await supabaseClient.auth.signUp({
                email,
                password
            });


        if (error) {

            showMessage(
                $("authMessage"),
                error.message
            );

            return;
        }


        showMessage(
            $("authMessage"),
            "Account created successfully. Check your email if confirmation is enabled.",
            true
        );

    };


/* =====================================================
   LOGIN
===================================================== */

$("loginBtn").onclick =
    async function () {

        if (!supabaseClient) {

            showMessage(
                $("authMessage"),
                "Please configure Supabase first."
            );

            return;
        }


        const email =
            $("email").value.trim();

        const password =
            $("password").value;


        if (!email || !password) {

            showMessage(
                $("authMessage"),
                "Please enter email and password."
            );

            return;
        }


        const {
            data,
            error
        } =
            await supabaseClient.auth
                .signInWithPassword({
                    email,
                    password
                });


        if (error) {

            showMessage(
                $("authMessage"),
                error.message
            );

            return;
        }


        await startApp(
            data.session
        );

    };


/* =====================================================
   LOGOUT
===================================================== */

$("logoutBtn").onclick =
    async function () {

        if (supabaseClient) {

            await supabaseClient.auth.signOut();

        }


        $("app")
            .classList
            .add("hidden");


        $("authScreen")
            .classList
            .remove("hidden");

    };


/* =====================================================
   START APPLICATION
===================================================== */

async function startApp(session) {

    if (!session) {

        return;

    }


    $("authScreen")
        .classList
        .add("hidden");


    $("app")
        .classList
        .remove("hidden");


    await loadData();

    renderAll();

}


/* =====================================================
   LOAD DATA FROM SUPABASE
===================================================== */

async function loadData() {

    if (!supabaseClient) {

        return;

    }


    const tradesResponse =
        await supabaseClient
            .from("trades")
            .select("*")
            .order(
                "trade_date",
                {
                    ascending: true
                }
            );


    const depositsResponse =
        await supabaseClient
            .from("deposits")
            .select("*")
            .order(
                "deposit_date",
                {
                    ascending: true
                }
            );


    if (tradesResponse.error) {

        console.error(
            tradesResponse.error
        );

    }


    if (depositsResponse.error) {

        console.error(
            depositsResponse.error
        );

    }


    trades =
        tradesResponse.data || [];


    deposits =
        depositsResponse.data || [];

}


/* =====================================================
   SAVE TRADE
===================================================== */

$("tradeForm").onsubmit =
    async function (event) {

        event.preventDefault();


        if (!supabaseClient) {

            showMessage(
                $("formMessage"),
                "Please configure Supabase first."
            );

            return;
        }


        const userResponse =
            await supabaseClient.auth
                .getUser();


        const user =
            userResponse.data.user;


        if (!user) {

            showMessage(
                $("formMessage"),
                "You are not logged in."
            );

            return;
        }


        const result =
            document.querySelector(
                'input[name="result"]:checked'
            ).value;


        const risk =
            Number(
                $("risk").value
            );


        const target =
            Number(
                $("target").value
            );


        const pnl =
            result === "win"
                ? target
                : -risk;


        const deposit =
            Number(
                $("deposit").value
            ) || 0;


        /* Insert trade */

        const {
            error: tradeError
        } =
            await supabaseClient
                .from("trades")
                .insert({

                    user_id: user.id,

                    trade_date:
                        $("tradeDate").value,

                    pair:
                        $("pair")
                            .value
                            .trim()
                            .toUpperCase(),

                    direction:
                        $("direction").value,

                    risk_amount:
                        risk,

                    target_profit:
                        target,

                    result:
                        result,

                    pnl:
                        pnl,

                    notes:
                        $("notes")
                            .value
                            .trim()

                });


        if (tradeError) {

            showMessage(
                $("formMessage"),
                tradeError.message
            );

            return;
        }


        /* Insert deposit if entered */

        if (deposit > 0) {

            const {
                error: depositError
            } =
                await supabaseClient
                    .from("deposits")
                    .insert({

                        user_id:
                            user.id,

                        amount:
                            deposit,

                        deposit_date:
                            $("tradeDate").value

                    });


            if (depositError) {

                showMessage(
                    $("formMessage"),
                    depositError.message
                );

                return;
            }

        }


        showMessage(
            $("formMessage"),
            "Trade saved successfully.",
            true
        );


        /* Reset form */

        this.reset();


        $("tradeDate").value =
            isoDate(new Date());


        calculatePL();


        await loadData();

        renderAll();

    };


/* =====================================================
   RENDER EVERYTHING
===================================================== */

function renderAll() {

    renderStats();

    renderCalendar();

    renderTable();

    renderChart();

}


/* =====================================================
   STATISTICS
===================================================== */

function renderStats() {

    const totalPL =
        trades.reduce(
            (sum, trade) =>
                sum + Number(trade.pnl),
            0
        );


    const totalDeposits =
        deposits.reduce(
            (sum, deposit) =>
                sum + Number(deposit.amount),
            0
        );


    const wins =
        trades.filter(
            trade =>
                trade.result === "win"
        ).length;


    const losses =
        trades.filter(
            trade =>
                trade.result === "loss"
        ).length;


    const winRate =
        trades.length
            ? (wins / trades.length) * 100
            : 0;


    const tradingDays =
        [
            ...new Set(
                trades.map(
                    trade =>
                        trade.trade_date
                )
            )
        ];


    /* Daily P/L */

    const dailyMap = {};


    trades.forEach(trade => {

        if (!dailyMap[trade.trade_date]) {

            dailyMap[trade.trade_date] = 0;

        }


        dailyMap[trade.trade_date] +=
            Number(trade.pnl);

    });


    const daily =
        Object.entries(dailyMap)
            .map(
                ([date, pnl]) => ({
                    date,
                    pnl
                })
            );


    /* Top cards */

    $("tradingProfit")
        .textContent =
        money(totalPL);


    $("netDeposits")
        .textContent =
        money(totalDeposits);


    $("profitPercent")
        .textContent =
        `↗ ${totalDeposits
            ? (
                totalPL /
                totalDeposits *
                100
            ).toFixed(2)
            : "0.00"
        }%`;


    $("transferText")
        .textContent =
        deposits.length
            ? `${deposits.length} deposit${deposits.length > 1
                ? "s"
                : ""
            }`
            : "No transfers";


    $("winRate")
        .textContent =
        `${winRate.toFixed(1)}%`;


    $("winText")
        .textContent =
        winRate >= 50
            ? "Good progress"
            : "Needs work";


    $("totalTrades")
        .textContent =
        trades.length;


    $("sideTrades")
        .textContent =
        trades.length;


    $("tradingDays")
        .textContent =
        tradingDays.length;


    $("profitable")
        .textContent =
        wins;


    $("losing")
        .textContent =
        losses;


    $("totalPL")
        .textContent =
        money(totalPL);


    $("avgDaily")
        .textContent =
        money(
            tradingDays.length
                ? totalPL /
                tradingDays.length
                : 0
        );


    /* Best day */

    if (daily.length) {

        const best =
            daily.reduce(
                (a, b) =>
                    b.pnl > a.pnl
                        ? b
                        : a
            );


        const worst =
            daily.reduce(
                (a, b) =>
                    b.pnl < a.pnl
                        ? b
                        : a
            );


        $("bestDay")
            .textContent =
            money(best.pnl);


        $("bestDate")
            .textContent =
            displayDate(best.date);


        $("worstDay")
            .textContent =
            money(worst.pnl);


        $("worstDate")
            .textContent =
            displayDate(worst.date);

    } else {

        $("bestDay")
            .textContent =
            "$0.00";

        $("worstDay")
            .textContent =
            "$0.00";

        $("bestDate")
            .textContent =
            "—";

        $("worstDate")
            .textContent =
            "—";

    }

}


/* =====================================================
   CALENDAR
===================================================== */

function renderCalendar() {

    const year =
        currentMonth.getFullYear();

    const month =
        currentMonth.getMonth();


    $("monthTitle")
        .textContent =
        currentMonth.toLocaleDateString(
            undefined,
            {
                month: "long",
                year: "numeric"
            }
        );


    const calendar =
        $("calendar");


    calendar.innerHTML = "";


    /* Week headers */

    const weekdays = [
        "SUN",
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
        "SAT"
    ];


    weekdays.forEach(day => {

        calendar.insertAdjacentHTML(
            "beforeend",
            `<div class="weekday">
                ${day}
             </div>`
        );

    });


    calendar.insertAdjacentHTML(
        "beforeend",
        `<div class="weekday">
            WEEK
         </div>`
    );


    const firstDay =
        new Date(
            year,
            month,
            1
        );


    const lastDay =
        new Date(
            year,
            month + 1,
            0
        );


    const startingDay =
        firstDay.getDay();


    const totalDays =
        lastDay.getDate();


    /* Group trades by date */

    const dayData = {};


    trades.forEach(trade => {

        if (!dayData[trade.trade_date]) {

            dayData[trade.trade_date] = {

                pnl: 0,

                count: 0

            };

        }


        dayData[trade.trade_date].pnl +=
            Number(trade.pnl);


        dayData[trade.trade_date].count++;

    });


    /* Empty days before month */

    for (
        let i = 0;
        i < startingDay;
        i++
    ) {

        calendar.insertAdjacentHTML(
            "beforeend",
            `<div class="day empty">
                <span class="num"></span>
             </div>`
        );

    }


    /* Month days */

    for (
        let day = 1;
        day <= totalDays;
        day++
    ) {

        const date =
            `${year}-${String(month + 1)
                .padStart(2, "0")
            }-${String(day)
                .padStart(2, "0")
            }`;


        const data =
            dayData[date];


        let className =
            "day";


        let information =
            "No trades";


        if (data) {

            if (data.pnl >= 0) {

                className +=
                    " gain";

            } else {

                className +=
                    " loss";

            }


            information =
                `${money(data.pnl)}
                 •
                 ${data.count}
                 trade${data.count > 1
                    ? "s"
                    : ""
                }`;

        }


        calendar.insertAdjacentHTML(
            "beforeend",
            `
            <div class="${className}">

                <span class="num">
                    ${day}
                </span>

                <small>
                    ${information}
                </small>

            </div>
            `
        );


        const dateObject =
            new Date(
                year,
                month,
                day
            );


        if (
            dateObject.getDay() === 6 ||
            day === totalDays
        ) {

            const weekNumber =
                Math.ceil(
                    (
                        day +
                        startingDay
                    ) / 7
                );


            const weekTrades =
                trades.filter(
                    trade => {

                        const d =
                            new Date(
                                trade.trade_date +
                                "T00:00:00"
                            );

                        return (
                            d.getFullYear() === year &&
                            d.getMonth() === month &&
                            Math.ceil(
                                (
                                    d.getDate() +
                                    startingDay
                                ) / 7
                            ) === weekNumber
                        );

                    }
                );


            const weekPL =
                weekTrades.reduce(
                    (sum, trade) =>
                        sum +
                        Number(trade.pnl),
                    0
                );


            calendar.insertAdjacentHTML(
                "beforeend",
                `
                <div class="day week">

                    <strong>
                        WEEK ${weekNumber}
                    </strong>

                    <small>
                        ${money(weekPL)}
                    </small>

                    <small>
                        ${weekTrades.length}
                        trades
                    </small>

                </div>
                `
            );

        }

    }

}


/* =====================================================
   TRADE HISTORY TABLE
===================================================== */

function renderTable() {

    const body =
        $("tradeTableBody");


    body.innerHTML = "";


    const reversed =
        [...trades].reverse();


    if (!reversed.length) {

        body.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    style="
                        text-align:center;
                        color:#777;
                        padding:30px;
                    "
                >
                    No trades recorded yet.
                </td>
            </tr>
        `;

        return;
    }


    reversed.forEach(trade => {

        const resultClass =
            trade.result === "win"
                ? "win"
                : "loss-text";


        const resultText =
            trade.result === "win"
                ? "WIN"
                : "LOSS";


        const pnlClass =
            Number(trade.pnl) >= 0
                ? "win"
                : "loss-text";


        body.insertAdjacentHTML(
            "beforeend",
            `
            <tr>

                <td>
                    ${trade.trade_date}
                </td>

                <td>
                    ${escapeHTML(
                trade.pair
            )}
                </td>

                <td>
                    ${trade.direction}
                </td>

                <td>
                    ${money(
                trade.risk_amount
            )}
                </td>

                <td>
                    ${money(
                trade.target_profit
            )}
                </td>

                <td class="${resultClass}">
                    ${resultText}
                </td>

                <td class="${pnlClass}">
                    ${money(
                trade.pnl
            )}
                </td>

                <td>

                    <button
                        class="delete-btn"
                        onclick="
                            deleteTrade(
                                '${trade.id}'
                            )
                        "
                    >
                        Delete
                    </button>

                </td>

            </tr>
            `
        );

    });

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    return String(value)
        .replace(
            /[&<>"']/g,
            character => {

                const entities = {

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"

                };

                return entities[
                    character
                ];

            }
        );

}


/* =====================================================
   DELETE TRADE
===================================================== */

async function deleteTrade(id) {

    if (
        !confirm(
            "Are you sure you want to delete this trade?"
        )
    ) {

        return;

    }


    if (!supabaseClient) {

        return;

    }


    const {
        error
    } =
        await supabaseClient
            .from("trades")
            .delete()
            .eq("id", id);


    if (error) {

        alert(
            error.message
        );

        return;

    }


    await loadData();

    renderAll();

}


/* =====================================================
   EQUITY CURVE
===================================================== */

function renderChart() {

    const svg =
        $("equityChart");


    let equity = 0;


    const events = [

        ...trades.map(
            trade => ({

                date:
                    trade.trade_date,

                type:
                    "trade",

                value:
                    Number(trade.pnl)

            })
        ),

        ...deposits.map(
            deposit => ({

                date:
                    deposit.deposit_date,

                type:
                    "deposit",

                value:
                    Number(deposit.amount)

            })
        )

    ];


    events.sort(
        (a, b) =>
            a.date.localeCompare(
                b.date
            )
    );


    const points = [];


    events.forEach(event => {

        equity +=
            event.value;


        points.push({

            date:
                event.date,

            equity:
                equity

        });

    });


    if (!points.length) {

        points.push({

            date:
                isoDate(new Date()),

            equity:
                0

        });

    }


    const values =
        points.map(
            point =>
                point.equity
        );


    const min =
        Math.min(
            0,
            ...values
        );


    const max =
        Math.max(
            1,
            ...values
        );


    const width = 1000;

    const height = 320;

    const left = 65;

    const right = 20;

    const top = 15;

    const bottom = 35;


    function x(index) {

        return (
            left +
            (
                index /
                Math.max(
                    1,
                    points.length - 1
                )
            ) *
            (
                width -
                left -
                right
            )
        );

    }


    function y(value) {

        return (
            top +
            (
                (max - value) /
                (max - min || 1)
            ) *
            (
                height -
                top -
                bottom
            )
        );

    }


    let chartHTML = "";


    /* Horizontal grid lines */

    for (
        let i = 0;
        i < 5;
        i++
    ) {

        const value =
            max -
            (
                (max - min) *
                i /
                4
            );


        const yPosition =
            y(value);


        chartHTML += `

            <line
                class="chart-grid"
                x1="${left}"
                x2="${width - right}"
                y1="${yPosition}"
                y2="${yPosition}"
            />

            <text
                class="chart-label"
                x="5"
                y="${yPosition + 4}"
            >
                ${money(value)}
            </text>

        `;

    }


    /* Equity line */

    const path =
        points
            .map(
                (point, index) => {

                    return `
                        ${index === 0
                            ? "M"
                            : "L"
                        }
                        ${x(index)}
                        ${y(point.equity)}
                    `;

                }
            )
            .join(" ");


    chartHTML += `

        <path
            class="equity-line"
            d="${path}"
        />

    `;


    /* Zero line */

    chartHTML += `

        <line
            class="zero-line"
            x1="${left}"
            x2="${width - right}"
            y1="${y(0)}"
            y2="${y(0)}"
        />

    `;


    /* Dates */

    chartHTML += `

        <text
            class="chart-label"
            x="${left}"
            y="${height - 8}"
        >
            ${points[0].date}
        </text>

        <text
            class="chart-label"
            text-anchor="end"
            x="${width - right}"
            y="${height - 8}"
        >
            ${points[points.length - 1].date}
        </text>

    `;


    svg.innerHTML =
        chartHTML;

}


/* =====================================================
   CHANGE MONTH
===================================================== */

$("prevMonth").onclick =
    function () {

        currentMonth.setMonth(
            currentMonth.getMonth() - 1
        );

        renderCalendar();

    };


$("nextMonth").onclick =
    function () {

        currentMonth.setMonth(
            currentMonth.getMonth() + 1
        );

        renderCalendar();

    };


/* =====================================================
   EXPORT CSV
===================================================== */

$("exportBtn").onclick =
    function () {

        if (!trades.length) {

            alert(
                "There are no trades to export."
            );

            return;

        }


        const rows = [

            [
                "Date",
                "Pair",
                "Direction",
                "Risk",
                "Target",
                "Result",
                "P/L",
                "Notes"
            ]

        ];


        trades.forEach(trade => {

            rows.push([

                trade.trade_date,

                trade.pair,

                trade.direction,

                trade.risk_amount,

                trade.target_profit,

                trade.result,

                trade.pnl,

                trade.notes || ""

            ]);

        });


        const csv =
            rows
                .map(
                    row =>
                        row
                            .map(
                                value =>
                                    `"${String(value ?? "")
                                        .replaceAll(
                                            '"',
                                            '""'
                                        )}"`
                            )
                            .join(",")
                )
                .join("\n");


        const blob =
            new Blob(
                [csv],
                {
                    type:
                        "text/csv;charset=utf-8;"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            "trade-journal.csv";


        link.click();


        URL.revokeObjectURL(
            url
        );

    };


/* =====================================================
   INITIALIZE
===================================================== */

async function initialize() {

    calculatePL();


    if (!supabaseClient) {

        $("authScreen")
            .classList
            .remove("hidden");


        showMessage(
            $("authMessage"),
            "Configure your Supabase URL and key in this HTML file."
        );


        return;

    }


    const {
        data
    } =
        await supabaseClient.auth
            .getSession();


    if (data.session) {

        await startApp(
            data.session
        );

    }

}


/* START */

initialize();
