import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STORAGE_KEY = "mishabitos:v2";
const OLD_STORAGE_KEY = "mishabitos:v1";

const WEEK_DAYS = [
  { id: 1, short: "L", label: "Lunes" },
  { id: 2, short: "M", label: "Martes" },
  { id: 3, short: "X", label: "Miercoles" },
  { id: 4, short: "J", label: "Jueves" },
  { id: 5, short: "V", label: "Viernes" },
  { id: 6, short: "S", label: "Sabado" },
  { id: 0, short: "D", label: "Domingo" },
];

const WEEKDAY_IDS = [1, 2, 3, 4, 5];
const EVERY_DAY_IDS = [1, 2, 3, 4, 5, 6, 0];

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayKey = () => toDateKey(new Date());

const addDays = (dateKey, amount) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
};

const getDayId = (dateKey) => new Date(`${dateKey}T00:00:00`).getDay();

const weekStart = (dateKey) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
};

const weekDates = (dateKey) => {
  const start = weekStart(dateKey);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

const rangeDates = (endDateKey, amount) =>
  Array.from({ length: amount }, (_, index) => addDays(endDateKey, index - amount + 1));

const monthDates = (dateKey) => {
  const baseDate = new Date(`${dateKey}T00:00:00`);
  const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const last = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date: toDateKey(date),
      inMonth: date >= first && date <= last,
    };
  });
};

const formatShortDate = (dateKey) =>
  new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric" }).format(
    new Date(`${dateKey}T00:00:00`)
  );

const formatLongDate = (dateKey) =>
  new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "short" }).format(
    new Date(`${dateKey}T00:00:00`)
  );

const formatHeaderDate = (dateKey) => {
  const date = new Date(`${dateKey}T00:00:00`);
  return {
    weekday: new Intl.DateTimeFormat("es", { weekday: "short" }).format(date),
    date: new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(date),
  };
};

const formatPlanDays = (activeDays) => {
  if (activeDays.length === 7) return "Todos los dias";
  if (activeDays.join(",") === WEEKDAY_IDS.join(",")) return "Lunes a viernes";
  return WEEK_DAYS.filter((day) => activeDays.includes(day.id))
    .map((day) => day.short)
    .join(", ");
};

const isCompleted = (habit, dateKey) => Number(habit.records?.[dateKey] || 0) > 0;
const isPlannedForDate = (habit, dateKey) => habit.activeDays.includes(getDayId(dateKey));

const getWeekProgress = (habit, dateKey) => {
  const dates = weekDates(dateKey);
  const planned = dates.filter((date) => isPlannedForDate(habit, date));
  const completed = dates.filter((date) => isCompleted(habit, date)).length;
  const target = Math.max(1, Number(habit.weeklyTarget) || planned.length || 1);
  return {
    completed,
    planned: planned.length,
    target,
    percent: Math.min(100, Math.round((completed / target) * 100)),
  };
};

const getRangeProgress = (habit, dateKey, amount) => {
  const dates = rangeDates(dateKey, amount).filter((date) => isPlannedForDate(habit, date));
  const completed = dates.filter((date) => isCompleted(habit, date)).length;
  return {
    completed,
    planned: dates.length,
    percent: dates.length ? Math.round((completed / dates.length) * 100) : 0,
  };
};

const getCurrentStreak = (habit, dateKey) => {
  let streak = 0;
  let cursor = dateKey;

  for (let index = 0; index < 120; index += 1) {
    if (!isPlannedForDate(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }

    if (!isCompleted(habit, cursor)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
};

const getBestStreak = (habit, dateKey, amount = 90) => {
  let best = 0;
  let current = 0;

  rangeDates(dateKey, amount).forEach((date) => {
    if (!isPlannedForDate(habit, date)) return;
    if (isCompleted(habit, date)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return best;
};

const getHabitScore = (habit, dateKey) => getRangeProgress(habit, dateKey, 30).percent;

const getDailyProgress = (habits, dateKey) => {
  const planned = habits.filter((habit) => isPlannedForDate(habit, dateKey));
  const completed = planned.filter((habit) => isCompleted(habit, dateKey)).length;

  return {
    completed,
    planned: planned.length,
    percent: planned.length ? Math.round((completed / planned.length) * 100) : 0,
  };
};

const defaultData = {
  habits: [
    {
      id: crypto.randomUUID(),
      name: "Entrenar",
      category: "Salud",
      weeklyTarget: 3,
      activeDays: [1, 3, 5],
      color: "#16a34a",
      records: {
        [addDays(todayKey(), -6)]: 1,
        [addDays(todayKey(), -4)]: 1,
        [addDays(todayKey(), -2)]: 1,
      },
    },
    {
      id: crypto.randomUUID(),
      name: "Meditar",
      category: "Mente",
      weeklyTarget: 5,
      activeDays: WEEKDAY_IDS,
      color: "#f97316",
      records: {
        [addDays(todayKey(), -4)]: 1,
        [addDays(todayKey(), -3)]: 1,
        [addDays(todayKey(), -2)]: 1,
        [todayKey()]: 1,
      },
    },
    {
      id: crypto.randomUUID(),
      name: "Leer",
      category: "Crecimiento",
      weeklyTarget: 4,
      activeDays: EVERY_DAY_IDS,
      color: "#2f80ed",
      records: {
        [addDays(todayKey(), -6)]: 1,
        [addDays(todayKey(), -4)]: 1,
        [addDays(todayKey(), -2)]: 1,
      },
    },
  ],
  goals: [
    {
      id: crypto.randomUUID(),
      name: "Mantener 80% de cumplimiento semanal",
      target: 80,
      current: 55,
      unit: "%",
    },
  ],
};

const emptyData = {
  habits: [],
  goals: [],
};

function normalizeHabit(habit) {
  const activeDays = Array.isArray(habit.activeDays) && habit.activeDays.length
    ? habit.activeDays
    : habit.frequency === "daily"
      ? EVERY_DAY_IDS
      : EVERY_DAY_IDS;

  const fallbackWeeklyTarget =
    habit.frequency === "weekly" ? Number(habit.target || activeDays.length || 1) : activeDays.length;
  const weeklyTarget = Number(habit.weeklyTarget || fallbackWeeklyTarget || 1);
  const records = Object.fromEntries(
    Object.entries(habit.records || {}).map(([date, value]) => [date, Number(value) > 0 ? 1 : 0])
  );

  return {
    id: habit.id || crypto.randomUUID(),
    name: habit.name || "Habito",
    category: habit.category || "Personal",
    weeklyTarget: Math.max(1, weeklyTarget),
    activeDays,
    color: habit.color || "#2f80ed",
    records,
  };
}

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
  if (!stored) return defaultData;

  try {
    const parsed = JSON.parse(stored);
    return {
      habits: Array.isArray(parsed.habits)
        ? parsed.habits.map(normalizeHabit)
        : defaultData.habits,
      goals: Array.isArray(parsed.goals) ? parsed.goals : defaultData.goals,
    };
  } catch {
    return defaultData;
  }
}

function saveData(nextData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
}

function App() {
  const [data, setData] = useState(loadData);
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const headerDate = formatHeaderDate(selectedDate);
  const [activeHabitId, setActiveHabitId] = useState(() => data.habits[0]?.id || "");
  const [reportRange, setReportRange] = useState("week");
  const [habitForm, setHabitForm] = useState({
    name: "",
    category: "",
    weeklyTarget: 3,
    activeDays: WEEKDAY_IDS,
    color: "#2f80ed",
  });
  const [goalForm, setGoalForm] = useState({
    name: "",
    target: 100,
    current: 0,
    unit: "%",
  });

  const setAndPersist = (nextData) => {
    setData(nextData);
    saveData(nextData);
  };

  const plannedToday = useMemo(
    () => data.habits.filter((habit) => isPlannedForDate(habit, selectedDate)),
    [data.habits, selectedDate]
  );

  const activeHabit = useMemo(
    () => data.habits.find((habit) => habit.id === activeHabitId) || data.habits[0],
    [activeHabitId, data.habits]
  );

  const todayStats = useMemo(() => {
    const completed = plannedToday.filter((habit) => isCompleted(habit, selectedDate)).length;
    return {
      total: plannedToday.length,
      completed,
      percent: plannedToday.length ? Math.round((completed / plannedToday.length) * 100) : 0,
    };
  }, [plannedToday, selectedDate]);

  const weeklyStats = useMemo(() => {
    const rows = data.habits.map((habit) => getWeekProgress(habit, selectedDate));
    const completed = rows.reduce((sum, row) => sum + row.completed, 0);
    const target = rows.reduce((sum, row) => sum + row.target, 0);
    return {
      completed,
      target,
      percent: target ? Math.min(100, Math.round((completed / target) * 100)) : 0,
    };
  }, [data.habits, selectedDate]);

  const monthlyStats = useMemo(() => {
    const rows = data.habits.map((habit) => getRangeProgress(habit, selectedDate, 30));
    const completed = rows.reduce((sum, row) => sum + row.completed, 0);
    const planned = rows.reduce((sum, row) => sum + row.planned, 0);

    return {
      completed,
      planned,
      percent: planned ? Math.round((completed / planned) * 100) : 0,
    };
  }, [data.habits, selectedDate]);

  const dashboardTrend = useMemo(() => {
    return rangeDates(selectedDate, 7).map((date) => {
      const progress = getDailyProgress(data.habits, date);
      return {
        date,
        label: formatShortDate(date).split(" ")[0],
        porcentaje: progress.percent,
      };
    });
  }, [data.habits, selectedDate]);

  const chartData = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => {
      const date = addDays(todayKey(), index - 13);
      const dayNumber = new Date(`${date}T00:00:00`).getDate();
      const planned = data.habits.filter((habit) => isPlannedForDate(habit, date));
      const completed = planned.filter((habit) => isCompleted(habit, date)).length;

      return {
        date,
        label: formatShortDate(date),
        chartLabel: String(dayNumber),
        porcentaje: planned.length ? Math.round((completed / planned.length) * 100) : 0,
      };
    });
  }, [data.habits]);

  const weeklyByHabit = useMemo(() => {
    return data.habits.map((habit) => {
      const progress = getWeekProgress(habit, selectedDate);
      return {
        name: habit.name,
        cumplimiento: progress.percent,
        completados: progress.completed,
        meta: progress.target,
      };
    });
  }, [data.habits, selectedDate]);

  const habitTrend = useMemo(() => {
    return data.habits.map((habit) => {
      const trend = Array.from({ length: 4 }, (_, index) => {
        const baseDate = addDays(weekStart(selectedDate), (index - 3) * 7);
        const progress = getWeekProgress(habit, baseDate);
        return {
          label: index === 3 ? "Esta" : `S-${3 - index}`,
          cumplimiento: progress.percent,
        };
      });

      return { habit, trend, progress: getWeekProgress(habit, selectedDate) };
    });
  }, [data.habits, selectedDate]);

  const habitMatrix = useMemo(() => {
    const dates = weekDates(selectedDate);
    return data.habits.map((habit) => ({
      habit,
      dates: dates.map((date) => ({
        date,
        planned: isPlannedForDate(habit, date),
        done: isCompleted(habit, date),
      })),
      progress: getWeekProgress(habit, selectedDate),
      currentStreak: getCurrentStreak(habit, selectedDate),
    }));
  }, [data.habits, selectedDate]);

  const reportSummary = useMemo(() => {
    const amount = reportRange === "week" ? 7 : reportRange === "month" ? 30 : 90;
    const rows = data.habits.map((habit) => ({
      habit,
      ...getRangeProgress(habit, selectedDate, amount),
      currentStreak: getCurrentStreak(habit, selectedDate),
      bestStreak: getBestStreak(habit, selectedDate, amount),
      score: getHabitScore(habit, selectedDate),
    }));
    const planned = rows.reduce((sum, row) => sum + row.planned, 0);
    const completed = rows.reduce((sum, row) => sum + row.completed, 0);

    return {
      amount,
      completed,
      planned,
      percent: planned ? Math.round((completed / planned) * 100) : 0,
      rows,
    };
  }, [data.habits, reportRange, selectedDate]);

  const calendarCells = useMemo(() => monthDates(selectedDate), [selectedDate]);

  const addHabit = (event) => {
    event.preventDefault();
    const name = habitForm.name.trim();
    if (!name) return;

    const activeDays = habitForm.activeDays.length ? habitForm.activeDays : WEEKDAY_IDS;
    const nextHabit = {
      ...habitForm,
      id: crypto.randomUUID(),
      name,
      category: habitForm.category.trim() || "Personal",
      weeklyTarget: Number(habitForm.weeklyTarget) || 1,
      activeDays,
      records: {},
    };

    setAndPersist({ ...data, habits: [nextHabit, ...data.habits] });
    setHabitForm({
      name: "",
      category: "",
      weeklyTarget: 3,
      activeDays: WEEKDAY_IDS,
      color: "#2f80ed",
    });
  };

  const addGoal = (event) => {
    event.preventDefault();
    const name = goalForm.name.trim();
    if (!name) return;

    setAndPersist({
      ...data,
      goals: [
        {
          ...goalForm,
          id: crypto.randomUUID(),
          name,
          target: Number(goalForm.target) || 1,
          current: Number(goalForm.current) || 0,
        },
        ...data.goals,
      ],
    });
    setGoalForm({ name: "", target: 100, current: 0, unit: "%" });
  };

  const toggleDone = (habit, dateKey = selectedDate) => {
    const nextHabits = data.habits.map((item) => {
      if (item.id !== habit.id) return item;
      const current = isCompleted(item, dateKey);
      return {
        ...item,
        records: {
          ...item.records,
          [dateKey]: current ? 0 : 1,
        },
      };
    });

    setAndPersist({ ...data, habits: nextHabits });
  };

  const removeHabit = (habitId) => {
    setAndPersist({
      ...data,
      habits: data.habits.filter((habit) => habit.id !== habitId),
    });
  };

  const updateHabit = (habitId, updates) => {
    const nextHabits = data.habits.map((habit) => {
      if (habit.id !== habitId) return habit;

      return normalizeHabit({
        ...habit,
        ...updates,
        weeklyTarget: Math.max(1, Number(updates.weeklyTarget) || Number(habit.weeklyTarget) || 1),
      });
    });

    setAndPersist({ ...data, habits: nextHabits });
  };

  const updateGoalCurrent = (goalId, value) => {
    const nextGoals = data.goals.map((goal) =>
      goal.id === goalId ? { ...goal, current: Math.max(0, Number(value) || 0) } : goal
    );
    setAndPersist({ ...data, goals: nextGoals });
  };

  const removeGoal = (goalId) => {
    setAndPersist({
      ...data,
      goals: data.goals.filter((goal) => goal.id !== goalId),
    });
  };

  const goToToday = () => {
    setSelectedDate(todayKey());
  };

  const resetAllData = () => {
    const confirmed = window.confirm(
      "Esto borrara todos tus habitos, planes y avances guardados en este dispositivo. Esta accion no se puede deshacer. Quieres continuar?"
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OLD_STORAGE_KEY);
    setData(emptyData);
    saveData(emptyData);
    setActiveHabitId("");
    setSelectedDate(todayKey());
  };

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <p className="eyebrow">Habit Tracker</p>
            <h2>
              <span>{headerDate.weekday}</span>
              {headerDate.date}
            </h2>
          </div>
          <div className="topbar-actions">
            <input
              aria-label="Fecha activa"
              className="date-input"
              max={todayKey()}
              onChange={(event) => setSelectedDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
            <button className="secondary-button today-button" onClick={goToToday} type="button">
              Hoy
            </button>
          </div>
        </header>

        {activeView === "dashboard" && (
          <Dashboard
            goals={data.goals}
            plannedToday={plannedToday}
            selectedDate={selectedDate}
            stats={todayStats}
            toggleDone={toggleDone}
            weeklyByHabit={weeklyByHabit}
            weeklyStats={weeklyStats}
            habitMatrix={habitMatrix}
            monthlyStats={monthlyStats}
            dashboardTrend={dashboardTrend}
          />
        )}

        {activeView === "habits" && (
          <HabitsView
            form={habitForm}
            habits={data.habits}
            onAdd={addHabit}
            onRemove={removeHabit}
            onResetAll={resetAllData}
            onUpdate={updateHabit}
            setForm={setHabitForm}
          />
        )}

        {activeView === "charts" && (
          <ChartsView
            activeHabit={activeHabit}
            calendarCells={calendarCells}
            chartData={chartData}
            habitTrend={habitTrend}
            reportRange={reportRange}
            reportSummary={reportSummary}
            selectedDate={selectedDate}
            setActiveHabitId={setActiveHabitId}
            setReportRange={setReportRange}
            toggleDone={toggleDone}
            weeklyByHabit={weeklyByHabit}
          />
        )}

        <nav className="nav-list" aria-label="Secciones">
          {[
            ["dashboard", "Hoy"],
            ["habits", "Plan"],
            ["charts", "Reporte"],
          ].map(([id, label]) => (
            <button
              className={activeView === id ? "active" : ""}
              key={id}
              onClick={() => setActiveView(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}

function Dashboard({
  dashboardTrend,
  habitMatrix,
  monthlyStats,
  plannedToday,
  selectedDate,
  stats,
  toggleDone,
  weeklyStats,
}) {
  return (
    <div className="view-stack">
      <section className="today-hero">
        <div>
          <p className="eyebrow">Resumen</p>
          <h1>{weeklyStats.percent}%</h1>
          <span>{weeklyStats.completed} de {weeklyStats.target} esta semana</span>
        </div>
        <div className="today-ring" style={{ "--value": `${stats.percent * 3.6}deg` }}>
          <strong>{stats.percent}%</strong>
          <small>hoy</small>
        </div>
      </section>

      <section className="summary-cards">
        <article>
          <span>Dia</span>
          <strong>{stats.percent}%</strong>
          <small>{stats.completed}/{stats.total}</small>
        </article>
        <article>
          <span>Semana</span>
          <strong>{weeklyStats.percent}%</strong>
          <small>{weeklyStats.completed}/{weeklyStats.target}</small>
        </article>
        <article>
          <span>Mes</span>
          <strong>{monthlyStats.percent}%</strong>
          <small>{monthlyStats.completed}/{monthlyStats.planned}</small>
        </article>
      </section>

      <section className="content-band dashboard-chart">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ultimos 7 dias</p>
            <h2>Resumen diario</h2>
          </div>
        </div>
        <div className="mini-chart-frame">
          <ResponsiveContainer height={150} width="100%">
            <BarChart data={dashboardTrend}>
              <XAxis dataKey="label" tickLine={false} />
              <YAxis
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                tickLine={false}
                width={42}
              />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="porcentaje" fill="#1f8acb" radius={[8, 8, 8, 8]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{formatShortDate(weekDates(selectedDate)[0])} - {formatShortDate(weekDates(selectedDate)[6])}</p>
            <h2>Marca tu semana</h2>
          </div>
        </div>
        <WeeklyClickMatrix
          habitMatrix={habitMatrix}
          selectedDate={selectedDate}
          toggleDone={toggleDone}
        />
      </section>

      <section className="content-band daily-list-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Hoy</p>
            <h2>Habitos de hoy</h2>
          </div>
        </div>
        <div className="today-list">
          {plannedToday.length ? (
            plannedToday.map((habit) => {
              const done = isCompleted(habit, selectedDate);
              const progress = getWeekProgress(habit, selectedDate);
              return (
                <button
                  className={done ? "today-item done" : "today-item"}
                  key={habit.id}
                  onClick={() => toggleDone(habit)}
                  type="button"
                >
                  <span className="habit-dot" style={{ backgroundColor: habit.color }} />
                  <span>
                    <strong>{habit.name}</strong>
                    <small>{progress.completed}/{progress.target} semana</small>
                  </span>
                  <b>{done ? "✓" : ""}</b>
                </button>
              );
            })
          ) : (
            <div className="empty-state">No hay habitos programados para esta fecha.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function WeeklyClickMatrix({ habitMatrix, selectedDate, toggleDone }) {
  const dates = weekDates(selectedDate);
  const dailyScores = dates.map((date) => {
    const activeRows = habitMatrix.filter(({ habit }) => isPlannedForDate(habit, date) || isCompleted(habit, date));
    const done = activeRows.filter(({ habit }) => isCompleted(habit, date)).length;
    return activeRows.length ? Math.round((done / activeRows.length) * 100) : null;
  });
  const weeklyCompleted = habitMatrix.reduce((sum, { progress }) => sum + progress.completed, 0);
  const weeklyTarget = habitMatrix.reduce((sum, { progress }) => sum + progress.target, 0);
  const weeklyPercent = weeklyTarget ? Math.round((weeklyCompleted / weeklyTarget) * 100) : 0;

  return (
    <div className="weekly-click-matrix">
      <div className="week-date-row">
        <span />
        {dates.map((date) => (
          <span className={date === selectedDate ? "today" : ""} key={date}>
            <b>{formatShortDate(date).split(" ")[0]}</b>
            <small>{new Date(`${date}T00:00:00`).getDate()}</small>
          </span>
        ))}
        <span />
      </div>
      {habitMatrix.map(({ habit, dates: rowDates, progress }) => (
        <div className="click-row" key={habit.id}>
          <div className="click-habit-name">
            <span className="habit-dot" style={{ backgroundColor: habit.color }} />
            <strong>{habit.name}</strong>
          </div>
          {rowDates.map(({ date, done, planned }) => (
            <button
              aria-label={`${habit.name} ${formatShortDate(date)}`}
              className={[
                "click-cell",
                planned ? "planned" : "off",
                !planned && done ? "extra" : "",
                done ? "done" : "",
                date === selectedDate ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={date}
              onClick={() => toggleDone(habit, date)}
              type="button"
            >
              {done ? "✓" : ""}
            </button>
          ))}
          <span className="habit-week-score">{progress.percent}%</span>
        </div>
      ))}
      <div className="matrix-footer">
        <span>% dia</span>
        {dailyScores.map((score, index) => (
          <strong key={dates[index]}>{score === null ? "-" : `${score}%`}</strong>
        ))}
        <b>{weeklyPercent}%</b>
      </div>
    </div>
  );
}

function HabitsView({ form, habits, onAdd, onRemove, onResetAll, onUpdate, setForm }) {
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const setPreset = (preset) => {
    setForm({
      ...form,
      activeDays: preset,
      weeklyTarget: preset.length,
    });
  };

  const toggleDay = (dayId) => {
    const exists = form.activeDays.includes(dayId);
    const activeDays = exists
      ? form.activeDays.filter((id) => id !== dayId)
      : [...form.activeDays, dayId].sort((a, b) => {
          const order = [1, 2, 3, 4, 5, 6, 0];
          return order.indexOf(a) - order.indexOf(b);
        });

    setForm({ ...form, activeDays, weeklyTarget: Math.max(1, Math.min(form.weeklyTarget, activeDays.length || 1)) });
  };

  const startEdit = (habit) => {
    setEditingId(habit.id);
    setEditForm({
      name: habit.name,
      category: habit.category,
      weeklyTarget: habit.weeklyTarget,
      activeDays: habit.activeDays,
      color: habit.color,
    });
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditForm(null);
  };

  const setEditPreset = (preset) => {
    setEditForm({
      ...editForm,
      activeDays: preset,
      weeklyTarget: preset.length,
    });
  };

  const toggleEditDay = (dayId) => {
    const exists = editForm.activeDays.includes(dayId);
    const activeDays = exists
      ? editForm.activeDays.filter((id) => id !== dayId)
      : [...editForm.activeDays, dayId].sort((a, b) => {
          const order = [1, 2, 3, 4, 5, 6, 0];
          return order.indexOf(a) - order.indexOf(b);
        });

    setEditForm({
      ...editForm,
      activeDays,
      weeklyTarget: Math.max(1, Math.min(Number(editForm.weeklyTarget) || 1, activeDays.length || 1)),
    });
  };

  const saveEdit = () => {
    if (!editForm || !editingId) return;

    const name = editForm.name.trim();
    if (!name) return;

    onUpdate(editingId, {
      ...editForm,
      name,
      category: editForm.category.trim() || "Personal",
      weeklyTarget: Number(editForm.weeklyTarget) || 1,
      activeDays: editForm.activeDays.length ? editForm.activeDays : WEEKDAY_IDS,
    });
    cancelEdit();
  };

  return (
    <div className="view-stack split-layout">
      <section className="content-band">
        <p className="eyebrow">Nuevo plan</p>
        <h2>Crear habito semanal</h2>
        <form className="form-grid" onSubmit={onAdd}>
          <label>
            Habito
            <input
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ej. Entrenar"
              value={form.name}
            />
          </label>
          <label>
            Categoria
            <input
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="Salud, mente, trabajo"
              value={form.category}
            />
          </label>
          <label>
            Meta semanal
            <input
              min="1"
              onChange={(event) => setForm({ ...form, weeklyTarget: event.target.value })}
              type="number"
              value={form.weeklyTarget}
            />
          </label>
          <div className="field-group">
            <span>Dias del plan</span>
            <div className="preset-row">
              <button onClick={() => setPreset([1, 3, 5])} type="button">
                3 veces
              </button>
              <button onClick={() => setPreset(WEEKDAY_IDS)} type="button">
                Lun-Vie
              </button>
              <button onClick={() => setPreset(EVERY_DAY_IDS)} type="button">
                Diario
              </button>
            </div>
            <div className="day-toggle-grid">
              {WEEK_DAYS.map((day) => (
                <button
                  className={form.activeDays.includes(day.id) ? "selected" : ""}
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  type="button"
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>
          <label>
            Color
            <input
              onChange={(event) => setForm({ ...form, color: event.target.value })}
              type="color"
              value={form.color}
            />
          </label>
          <button className="primary-button" type="submit">
            Crear plan
          </button>
        </form>
      </section>

      <section className="content-band">
        <p className="eyebrow">Actuales</p>
        <h2>Mis planes semanales</h2>
        <div className="compact-list">
          {habits.map((habit) =>
            editingId === habit.id && editForm ? (
              <article className="compact-row edit-row" key={habit.id}>
                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveEdit();
                  }}
                >
                  <label>
                    Habito
                    <input
                      onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                      value={editForm.name}
                    />
                  </label>
                  <label>
                    Categoria
                    <input
                      onChange={(event) => setEditForm({ ...editForm, category: event.target.value })}
                      value={editForm.category}
                    />
                  </label>
                  <label>
                    Meta semanal
                    <input
                      min="1"
                      onChange={(event) => setEditForm({ ...editForm, weeklyTarget: event.target.value })}
                      type="number"
                      value={editForm.weeklyTarget}
                    />
                  </label>
                  <div className="field-group">
                    <span>Dias del plan</span>
                    <div className="preset-row">
                      <button onClick={() => setEditPreset([1, 3, 5])} type="button">
                        3 veces
                      </button>
                      <button onClick={() => setEditPreset(WEEKDAY_IDS)} type="button">
                        Lun-Vie
                      </button>
                      <button onClick={() => setEditPreset(EVERY_DAY_IDS)} type="button">
                        Diario
                      </button>
                    </div>
                    <div className="day-toggle-grid">
                      {WEEK_DAYS.map((day) => (
                        <button
                          className={editForm.activeDays.includes(day.id) ? "selected" : ""}
                          key={day.id}
                          onClick={() => toggleEditDay(day.id)}
                          type="button"
                        >
                          {day.short}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label>
                    Color
                    <input
                      onChange={(event) => setEditForm({ ...editForm, color: event.target.value })}
                      type="color"
                      value={editForm.color}
                    />
                  </label>
                  <div className="edit-actions">
                    <button className="primary-button" onClick={saveEdit} type="button">
                      Guardar
                    </button>
                    <button onClick={cancelEdit} type="button">
                      Cancelar
                    </button>
                  </div>
                </form>
              </article>
            ) : (
              <article className="compact-row" key={habit.id}>
                <div>
                  <strong>{habit.name}</strong>
                  <p>
                    {habit.category} - {habit.weeklyTarget} por semana -{" "}
                    {formatPlanDays(habit.activeDays)}
                  </p>
                  <WeekStrip habit={habit} selectedDate={todayKey()} />
                </div>
                <div className="row-actions">
                  <button onClick={() => startEdit(habit)} type="button">
                    Editar
                  </button>
                  <button onClick={() => onRemove(habit.id)} type="button">
                    Eliminar
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      </section>

      <section className="danger-zone">
        <div>
          <p className="eyebrow">Reinicio</p>
          <h2>Borrar todo</h2>
          <span>Elimina habitos, planes y avances guardados en este dispositivo.</span>
        </div>
        <button onClick={onResetAll} type="button">
          Reiniciar todo
        </button>
      </section>
    </div>
  );
}

function GoalsView({ form, goals, onAdd, onRemove, setForm, updateGoalCurrent }) {
  return (
    <div className="view-stack split-layout">
      <section className="content-band">
        <p className="eyebrow">Nueva meta</p>
        <h2>Meta personal</h2>
        <form className="form-grid" onSubmit={onAdd}>
          <label>
            Nombre
            <input
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ej. Leer libros"
              value={form.name}
            />
          </label>
          <label>
            Objetivo final
            <input
              min="1"
              onChange={(event) => setForm({ ...form, target: event.target.value })}
              type="number"
              value={form.target}
            />
          </label>
          <label>
            Avance actual
            <input
              min="0"
              onChange={(event) => setForm({ ...form, current: event.target.value })}
              type="number"
              value={form.current}
            />
          </label>
          <label>
            Unidad
            <input
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
              placeholder="libros, kg, $, horas"
              value={form.unit}
            />
          </label>
          <button className="primary-button" type="submit">
            Crear meta
          </button>
        </form>
      </section>

      <section className="content-band">
        <p className="eyebrow">Seguimiento</p>
        <h2>Metas activas</h2>
        <div className="goal-grid">
          {goals.map((goal) => (
            <article className="goal-card" key={goal.id}>
              <GoalCard goal={goal} />
              <label>
                Avance
                <input
                  min="0"
                  onChange={(event) => updateGoalCurrent(goal.id, event.target.value)}
                  type="number"
                  value={goal.current}
                />
              </label>
              <button onClick={() => onRemove(goal.id)} type="button">
                Eliminar meta
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChartsView({
  activeHabit,
  calendarCells,
  chartData,
  habitTrend,
  reportRange,
  reportSummary,
  selectedDate,
  setActiveHabitId,
  setReportRange,
  toggleDone,
  weeklyByHabit,
}) {
  const activeHabitReport = activeHabit
    ? {
        score: getHabitScore(activeHabit, selectedDate),
        currentStreak: getCurrentStreak(activeHabit, selectedDate),
        bestStreak: getBestStreak(activeHabit, selectedDate),
        week: getWeekProgress(activeHabit, selectedDate),
      }
    : null;

  return (
    <div className="view-stack">
      <section className="content-band report-hero">
        <div>
          <p className="eyebrow">Resumen</p>
          <h2>{activeHabit?.name || "Habito"}</h2>
          <span>{activeHabit ? formatPlanDays(activeHabit.activeDays) : ""}</span>
        </div>
        <div className="report-tabs" aria-label="Rango de reportes">
          {[
            ["week", "Semanal"],
            ["month", "Mensual"],
            ["quarter", "90 dias"],
          ].map(([id, label]) => (
            <button
              className={reportRange === id ? "selected" : ""}
              key={id}
              onClick={() => setReportRange(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Habitos</p>
            <h2>Selecciona uno</h2>
          </div>
        </div>
        <div className="habit-report-list">
          {reportSummary.rows.map((row) => (
            <button
              className={activeHabit?.id === row.habit.id ? "selected" : ""}
              key={row.habit.id}
              onClick={() => setActiveHabitId(row.habit.id)}
              type="button"
            >
              <span className="habit-dot" style={{ backgroundColor: row.habit.color }} />
              <strong>{row.habit.name}</strong>
              <small>{row.completed}/{row.planned} hechos</small>
              <b>{row.percent}%</b>
            </button>
          ))}
        </div>
      </section>

      {activeHabit && activeHabitReport && (
        <section className="content-band detail-panel">
          <div className="overview-row">
            <div className="small-ring" style={{ "--value": `${activeHabitReport.score * 3.6}deg` }}>
              <span>{activeHabitReport.score}%</span>
            </div>
            <article>
              <strong>{activeHabitReport.score}%</strong>
              <span>Score</span>
            </article>
            <article>
              <strong>{activeHabitReport.currentStreak}d</strong>
              <span>Racha</span>
            </article>
            <article>
              <strong>{activeHabitReport.bestStreak}d</strong>
              <span>Mejor</span>
            </article>
            <article>
              <strong>{reportSummary.completed}</strong>
              <span>Total</span>
            </article>
          </div>
          <div className="habit-question">
            <span>¿Lo hiciste hoy?</span>
            <button
              disabled={!isPlannedForDate(activeHabit, selectedDate)}
              onClick={() => toggleDone(activeHabit)}
              type="button"
            >
              {!isPlannedForDate(activeHabit, selectedDate)
                ? "No programado"
                : isCompleted(activeHabit, selectedDate)
                  ? "Hecho ✓"
                  : "Marcar"}
            </button>
          </div>
          <WeekStrip habit={activeHabit} selectedDate={selectedDate} />
        </section>
      )}

      <section className="chart-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ultimos 14 dias</p>
            <h2>Cumplimiento del plan diario</h2>
          </div>
        </div>
        <div className="chart-frame">
          <ResponsiveContainer height={300} width="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#d9e2ea" strokeDasharray="4 4" />
              <XAxis dataKey="chartLabel" interval={1} minTickGap={10} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => `${value}%`} labelFormatter={(_, items) => items?.[0]?.payload?.label || ""} />
              <Line
                dataKey="porcentaje"
                dot={{ r: 4 }}
                stroke="#2f80ed"
                strokeWidth={3}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="content-band calendar-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Calendario</p>
            <h2>Mapa mensual</h2>
          </div>
        </div>
        <div className="calendar-grid">
          {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
            <strong key={day}>{day}</strong>
          ))}
          {calendarCells.map(({ date, inMonth }) => {
            const planned = activeHabit ? isPlannedForDate(activeHabit, date) : false;
            const done = activeHabit ? isCompleted(activeHabit, date) : false;
            return (
              <span
                className={[
                  "calendar-cell",
                  inMonth ? "" : "muted",
                  planned ? "planned" : "",
                  done ? "done" : "",
                  date === selectedDate ? "today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={date}
              >
                {new Date(`${date}T00:00:00`).getDate()}
              </span>
            );
          })}
        </div>
      </section>

      <section className="chart-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Semana actual</p>
            <h2>Cumplimiento por habito</h2>
          </div>
        </div>
        <div className="chart-frame">
          <ResponsiveContainer height={300} width="100%">
            <BarChart data={weeklyByHabit}>
              <CartesianGrid stroke="#d9e2ea" strokeDasharray="4 4" />
              <XAxis dataKey="name" tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="cumplimiento" fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Por habito</p>
            <h2>Tendencia de 4 semanas</h2>
          </div>
        </div>
        <div className="habit-chart-grid">
          {habitTrend.map(({ habit, progress, trend }) => (
            <article className="habit-chart-card" key={habit.id}>
              <div className="habit-chart-head">
                <div>
                  <strong>{habit.name}</strong>
                  <p>
                    {progress.completed} de {progress.target} esta semana
                  </p>
                </div>
                <span>{progress.percent}%</span>
              </div>
              <ResponsiveContainer height={150} width="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="#d9e2ea" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Line
                    dataKey="cumplimiento"
                    dot={{ r: 3 }}
                    stroke={habit.color}
                    strokeWidth={3}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function WeekStrip({ habit, selectedDate }) {
  return (
    <div className="week-strip" aria-label={`Semana de ${habit.name}`}>
      {weekDates(selectedDate).map((date) => {
        const planned = isPlannedForDate(habit, date);
        const done = isCompleted(habit, date);
        const day = WEEK_DAYS.find((item) => item.id === getDayId(date));

        return (
          <span
            className={[
              "week-dot",
              planned ? "planned" : "",
              done ? "done" : "",
              date === selectedDate ? "today" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={date}
            title={day?.label}
          >
            {day?.short}
          </span>
        );
      })}
    </div>
  );
}

function GoalCard({ goal }) {
  const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
  return (
    <article className="goal-card">
      <div className="goal-card-head">
        <strong>{goal.name}</strong>
        <span>{percent}%</span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p>
        {goal.current} de {goal.target} {goal.unit}
      </p>
    </article>
  );
}

export default App;
