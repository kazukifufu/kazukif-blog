<script setup lang="ts">
import { ref, computed } from 'vue'

// Astro側（BaseLayout.astro）からビルド時に渡される記事一覧
// date は Date 型がそのまま props に載せられないため、ISO文字列で受け取る
interface Article {
  category: string
  slug: string
  title: string
  date: string // ISO文字列（例: "2026-07-28T00:00:00.000Z"）
  dateRevised?: string // 更新日（ISO文字列）。更新していない記事には存在しない
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
  // 日付の昇順（古い順）に並び替えてからグループ化する。
  // ファイル名の文字列比較順のままだと、"install_ubuntu2604-10" が
  // "install_ubuntu2604-2" より前に来てしまう（"-1" < "-10" < "-2" という
  // 辞書順比較のため）ので、日付という数値的に意味のある値でソートする。
  const sortedArticles = [...props.articles].sort(
    (a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf()
  )
  for (const article of sortedArticles) {
    if (!structure[article.category]) {
      structure[article.category] = []
    }
    structure[article.category].push(article)
  }
  return structure
})

// カテゴリの表示順はアルファベット順にする（menuDataのキー挿入順＝各カテゴリの
// 最初の記事の日付順になってしまうため、カテゴリ名だけを別途ソートして使う）
const sortedCategoryNames = computed(() => Object.keys(menuData.value).sort())

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

// 更新日の一覧（dateRevised を持つ記事のみ。作成日とは別に管理する）
const revisedDates = computed(() =>
  Array.from(
    new Set(
      props.articles
        .filter((article) => article.dateRevised)
        .map((article) => article.dateRevised!.slice(0, 10))
    )
  )
)

// 選択中の日付が、記事の作成日または更新日と一致するか（記事リストの絞り込み用）
const matchesSelectedDate = (article: Article) => {
  if (!selectedDate.value) return true
  return (
    article.date.slice(0, 10) === selectedDate.value ||
    article.dateRevised?.slice(0, 10) === selectedDate.value
  )
}

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
  hasArticle: boolean // その日に作成された記事がある
  hasRevision: boolean // その日に更新された記事がある
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
    days.push({ date: null, isToday: false, hasArticle: false, hasRevision: false, fullDate: '' })
  }

  for (let d = 1; d <= totalDays; d++) {
    const fullDate = formatDate(year, month, d)
    const isToday =
      year === today.getFullYear() && month === today.getMonth() && d === today.getDate()

    const hasArticle = articleDates.value.includes(fullDate)
    const hasRevision = revisedDates.value.includes(fullDate)

    days.push({ date: d, isToday, hasArticle, hasRevision, fullDate })
  }

  return days
})

// 作成日・更新日のどちらかがある日だけクリックして絞り込める
const handleDateClick = (day: CalendarDay) => {
  if (!day.hasArticle && !day.hasRevision) return
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
      <span class="filter-text">{{ selectedDate }} に作成・更新した記事で絞込み</span>
      <button class="clear-btn" @click="clearFilter">解除</button>
    </div>

    <!-- カテゴリー＆記事リスト（カテゴリはアルファベット順に表示） -->
    <ul class="category-list">
      <li v-for="category in sortedCategoryNames" :key="category" class="category-item">
        <div class="category-title" @click="toggleCategory(category)">
          <span class="arrow">{{ expandedCategories[category] ? '▼' : '▶' }}</span>
          {{ category }}
        </div>
        <transition name="slide">
          <ul v-if="expandedCategories[category]" class="article-list">
            <li
              v-for="article in menuData[category]"
              :key="`${article.category}/${article.slug}`"
              v-show="matchesSelectedDate(article)"
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
            'has-revision': day.hasRevision,
            'is-selected': selectedDate === day.fullDate,
          }"
          @click="handleDateClick(day)"
        >
          {{ day.date }}
        </div>
      </div>

      <!-- 凡例：作成日と更新日を色のドットで区別する -->
      <div class="calendar-legend">
        <span class="legend-item"><span class="legend-dot legend-created"></span>作成日</span>
        <span class="legend-item"><span class="legend-dot legend-revised"></span>更新日</span>
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

/* 更新日のみの日：青系。作成日の規則より前に書き、両方ある日は作成日（緑）の背景を優先する */
.day-cell.has-revision {
  cursor: pointer;
  font-weight: 700;
  color: #1d4f86;
  background-color: rgba(47, 111, 176, 0.2);
}

.day-cell.has-revision:hover {
  background-color: rgba(47, 111, 176, 0.32);
}

/* 作成日の日：緑系 */
.day-cell.has-article {
  cursor: pointer;
  font-weight: 700;
  color: #24392f;
  background-color: rgba(111, 168, 143, 0.22);
}

.day-cell.has-article:hover {
  background-color: rgba(111, 168, 143, 0.36);
}

/* 作成日・更新日を色だけに頼らず、形でも判別できるようにする
   ::after = 作成日（緑の丸）、::before = 更新日（青のひし形） */
.day-cell.has-article::after,
.day-cell.has-revision::before {
  content: '';
  position: absolute;
  bottom: 3px;
  left: 50%;
}

/* 作成日：丸（6px） */
.day-cell.has-article::after {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #3f7d62;
  transform: translateX(-50%);
}

/* 更新日：ひし形（5pxの正方形を45度回転。対角線は約7pxで、丸と見た目の大きさが揃う） */
.day-cell.has-revision::before {
  width: 5px;
  height: 5px;
  border-radius: 1px;
  background-color: #2f6fb0;
  transform: translateX(-50%) rotate(45deg);
}

/* 作成日と更新日が同じ日にある場合は、丸とひし形を左右に並べる */
.day-cell.has-article.has-revision::after {
  transform: translateX(calc(-50% - 6px));
}

.day-cell.has-article.has-revision::before {
  transform: translateX(calc(-50% + 6px)) rotate(45deg);
}

.day-cell.is-today {
  border: 2px solid #9c7a3f;
  font-weight: 700;
}

.day-cell.is-selected {
  background-color: var(--color-lamp-green, #6fa88f) !important;
  color: #1b241f !important;
}

/* 選択中は背景が緑になるため、点の色を背景から浮く色に変える */
.day-cell.is-selected::after {
  background-color: #1b241f;
}

.day-cell.is-selected::before {
  background-color: #f5f0e3;
}

/* 凡例（作成日・更新日） */
.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 10px;
  font-size: 11px;
  color: #6b4f28;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-dot {
  display: inline-block;
}

/* 作成日：丸 */
.legend-created {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #3f7d62;
}

/* 更新日：ひし形（回転で左右にはみ出すぶん、余白を足す） */
.legend-revised {
  width: 5px;
  height: 5px;
  margin: 0 1px;
  border-radius: 1px;
  background-color: #2f6fb0;
  transform: rotate(45deg);
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