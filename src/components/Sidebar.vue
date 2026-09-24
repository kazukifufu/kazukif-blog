<script setup lang="ts">
import { ref, computed } from 'vue'

// Astro側（BaseLayout.astro）からビルド時に渡される記事一覧
// date は Date 型がそのまま props に載せられないため、ISO文字列で受け取る
interface Article {
  category: string
  slug: string
  title: string
  date: string // ISO文字列（例: "2026-07-28T00:00:00.000Z"）
}

const props = defineProps<{
  articles: Article[]
  /** 現在表示中のページパス（アクティブハイライト判定用）。Astro.url.pathname を渡す想定 */
  currentPath?: string
}>()

/* -------------------------------------------------------------------------- */
/* 現在表示中の記事の category / slug を currentPath から判定                  */
/* 旧 App.vue では useRoute().params から取得していたが、Astroにはvue-routerが */
/* 存在しないため、渡された現在パス文字列をパースする方式に置き換える           */
/* -------------------------------------------------------------------------- */
const currentCategory = computed(() => {
  const parts = (props.currentPath ?? '').split('/').filter(Boolean)
  // 例: /posts/tech/vue3入門 -> ['posts', 'tech', 'vue3入門']
  return parts[0] === 'posts' ? parts[1] : undefined
})
const currentSlug = computed(() => {
  const parts = (props.currentPath ?? '').split('/').filter(Boolean)
  return parts[0] === 'posts' ? parts[2] : undefined
})

/* -------------------------------------------------------------------------- */
/* カテゴリー ＆ 記事リストのグループ化                                        */
/* 旧 App.vue では onMounted 内で getAllPosts() を呼び出して組み立てていたが、  */
/* Astro側で既にビルド時に取得済みのデータが props で渡されるため、            */
/* computed だけで完結する                                                    */
/* -------------------------------------------------------------------------- */
const menuData = computed(() => {
  const structure: Record<string, Article[]> = {}
  for (const article of props.articles) {
    if (!structure[article.category]) {
      structure[article.category] = []
    }
    structure[article.category].push(article)
  }
  return structure
})

// 初期状態では全カテゴリーを展開（旧 App.vue の onMounted 内処理を移植）
const expandedCategories = ref<Record<string, boolean>>(
  Object.fromEntries(Object.keys(menuData.value).map((cat) => [cat, true]))
)

const toggleCategory = (category: string) => {
  expandedCategories.value[category] = !expandedCategories.value[category]
}

/* -------------------------------------------------------------------------- */
/* 日付フィルタ（旧 useDateFilter コンポーザブルを移植）                       */
/* -------------------------------------------------------------------------- */
const selectedDate = ref<string | null>(null)
const setDate = (date: string) => {
  selectedDate.value = date
}
const clearFilter = () => {
  selectedDate.value = null
}

// 記事の日付を "YYYY-MM-DD" 形式の文字列に正規化（ISO文字列の先頭10文字を利用）
const articleDates = computed(() =>
  Array.from(new Set(props.articles.map((article) => article.date.slice(0, 10))))
)

/* -------------------------------------------------------------------------- */
/* カレンダー描画ロジック（旧 App.vue の実装をそのまま移植）                    */
/* -------------------------------------------------------------------------- */
const today = new Date()
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())
const weekdays = ['日', '月', '火', '水', '木', '金', '土']

const calendarTitle = computed(() => `${currentYear.value}年 ${currentMonth.value + 1}月`)

const formatDate = (year: number, month: number, date: number) => {
  const m = String(month + 1).padStart(2, '0')
  const d = String(date).padStart(2, '0')
  return `${year}-${m}-${d}`
}

interface CalendarDay {
  date: number | null
  isToday: boolean
  hasArticle: boolean
  fullDate: string
}

const calendarDays = computed<CalendarDay[]>(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startDay = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const days: CalendarDay[] = []

  for (let i = 0; i < startDay; i++) {
    days.push({ date: null, isToday: false, hasArticle: false, fullDate: '' })
  }

  for (let d = 1; d <= totalDays; d++) {
    const fullDate = formatDate(year, month, d)
    const isToday =
      year === today.getFullYear() && month === today.getMonth() && d === today.getDate()

    const hasArticle = articleDates.value.includes(fullDate)

    days.push({ date: d, isToday, hasArticle, fullDate })
  }

  return days
})

const handleDateClick = (day: CalendarDay) => {
  if (!day.hasArticle) return
  setDate(day.fullDate)
}

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}
const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}
</script>

<template>
  <aside class="sidebar">
    <h2>カテゴリー</h2>

    <!-- 📅 日付選択中の解除バッジ -->
    <div v-if="selectedDate" class="filter-info">
      <span class="filter-icon">📅</span>
      <span class="filter-text">{{ selectedDate }} の記事で絞込み</span>
      <button class="clear-btn" @click="clearFilter">解除</button>
    </div>

    <!-- カテゴリー＆記事リスト -->
    <ul class="category-list">
      <li v-for="(articles, category) in menuData" :key="category" class="category-item">
        <div class="category-title" @click="toggleCategory(category)">
          <span class="arrow">{{ expandedCategories[category] ? '▼' : '▶' }}</span>
          {{ category }}
        </div>
        <transition name="slide">
          <ul v-if="expandedCategories[category]" class="article-list">
            <li
              v-for="article in articles"
              :key="`${article.category}/${article.slug}`"
              v-show="!selectedDate || article.date.slice(0, 10) === selectedDate"
              :class="{ active: currentCategory === article.category && currentSlug === article.slug }"
            >
              <a :href="`/posts/${article.category}/${article.slug}`">
                {{ article.title }}
              </a>
            </li>
          </ul>
        </transition>
      </li>
    </ul>

    <!-- カレンダー部分 -->
    <div class="sidebar-calendar">
      <div class="calendar-header">
        <button @click="prevMonth" class="cal-btn">&lt;</button>
        <span class="calendar-title">{{ calendarTitle }}</span>
        <button @click="nextMonth" class="cal-btn">&gt;</button>
      </div>

      <div class="calendar-weekdays">
        <span v-for="day in weekdays" :key="day" class="weekday-cell">{{ day }}</span>
      </div>

      <div class="calendar-grid">
        <div
          v-for="(day, index) in calendarDays"
          :key="index"
          class="day-cell"
          :class="{
            'is-today': day.isToday,
            'empty-cell': !day.date,
            'has-article': day.hasArticle,
            'is-selected': selectedDate === day.fullDate,
          }"
          @click="handleDateClick(day)"
        >
          {{ day.date }}
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* サイドバー（固定幅 280px、ウォールナット材の書架をイメージ） */
.sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-brass-line, rgba(176, 141, 87, 0.35));
  background-color: var(--color-wood-mid, #4a3826);
  padding: 20px 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: var(--color-paper, #ede6d6);
}

.sidebar h2 {
  font-family: var(--font-display, 'Shippori Mincho', serif);
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--color-brass, #cba86b);
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-brass-line, rgba(176, 141, 87, 0.3));
  padding-bottom: 10px;
}

/* カテゴリーリスト（箇条書きのリセット） */
.category-list,
.article-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.category-item {
  margin-bottom: 10px;
}

.category-title {
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  padding: 6px 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  color: var(--color-paper, #ede6d6);
  border-radius: 2px;
  transition: background-color 0.15s ease;
}

.category-title:hover {
  background-color: rgba(237, 230, 214, 0.06);
}

.category-title .arrow {
  font-size: 10px;
  color: var(--color-brass, #cba86b);
}

.article-list {
  padding-left: 14px;
  border-left: 1px solid var(--color-brass-line, rgba(176, 141, 87, 0.25));
  margin-left: 8px;
}

.article-list li {
  font-size: 13px;
  margin-top: 2px;
}

.article-list li a {
  display: block;
  padding: 6px 10px;
  color: rgba(237, 230, 214, 0.72);
  text-decoration: none;
  border-left: 3px solid transparent;
  word-break: keep-all;
  overflow-wrap: anywhere;
  line-height: 1.5;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.article-list li a:hover {
  color: var(--color-paper, #ede6d6);
  background-color: rgba(237, 230, 214, 0.06);
}

/* 現在地表示：しおり（ブックマーク）風の緑のリボン */
.article-list li.active a {
  background-color: rgba(122, 168, 148, 0.14);
  border-left: 3px solid var(--color-lamp-green, #6fa88f);
  color: var(--color-paper, #ede6d6);
  font-weight: 600;
}

/* カレンダー部分：書架に置かれた「紙の卓上カレンダー」として、背景を反転させたカードにする */
.sidebar-calendar {
  margin-top: auto;
  padding: 14px;
  background-color: var(--color-paper, #f5f0e3);
  border: 1px solid var(--color-brass-line, rgba(176, 141, 87, 0.35));
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  color: var(--color-ink, #2a2118);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.calendar-title {
  font-family: var(--font-display, 'Shippori Mincho', serif);
  font-weight: 600;
  font-size: 13px;
  color: var(--color-ink, #2a2118);
}

.cal-btn {
  background: none;
  border: 1px solid rgba(43, 32, 22, 0.25);
  border-radius: 2px;
  cursor: pointer;
  padding: 2px 8px;
  font-size: 12px;
  color: var(--color-ink, #2a2118);
}

.cal-btn:hover {
  background-color: rgba(43, 32, 22, 0.06);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-ink-muted, #6f6150);
  margin-bottom: 6px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border-radius: 4px;
  color: var(--color-ink, #2a2118);
}

.day-cell.empty-cell {
  visibility: hidden;
}

.day-cell.has-article {
  cursor: pointer;
  font-weight: 700;
  color: #24392f;
  background-color: rgba(111, 168, 143, 0.22);
}

/* 「記事のある日」を色以外でも判別できるよう、下に小さな点を追加 */
.day-cell.has-article::after {
  content: '';
  position: absolute;
  bottom: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--color-lamp-green, #6fa88f);
}

.day-cell.has-article:hover {
  background-color: rgba(111, 168, 143, 0.36);
}

.day-cell.is-today {
  border: 2px solid #9c7a3f;
  font-weight: 700;
}

.day-cell.is-selected {
  background-color: var(--color-lamp-green, #6fa88f) !important;
  color: #1b241f !important;
}

.day-cell.is-selected::after {
  background-color: #1b241f;
}

/* 絞り込み状態を表示するエリア全体 */
.filter-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.filter-icon {
  font-size: 14px;
}

.filter-text {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-paper, #ede6d6);
}

.clear-btn {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 2px;
  background-color: rgba(237, 230, 214, 0.1);
  color: var(--color-paper, #ede6d6);
  border: 1px solid var(--color-brass-line, rgba(176, 141, 87, 0.3));
  cursor: pointer;
  white-space: nowrap;
}

.clear-btn:hover {
  background-color: rgba(237, 230, 214, 0.18);
}
</style>