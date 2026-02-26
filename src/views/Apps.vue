<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useApiUrl } from "../composables/useApiUrl";
import AppCard from "../components/AppCard.vue";
import { Tag, Search, LayoutGrid, X, Command } from "lucide-vue-next";

const searchInput = ref(null);

function focusSearch(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.value?.focus();
  }
}

const router = useRouter();
const { apiUrl } = useApiUrl();

// State
const apps = ref([]);
const containers = ref([]);
const loading = ref(false);
const appSearch = ref("");
const selectedTag = ref(null);

const hourSeed = ref(getDateHourSeed());
let refreshInterval = null;
let seedInterval = null;

// Computed
const installedAppIds = computed(() => {
  const ids = new Set(containers.value.map((c) => c?.app?.id).filter(Boolean));
  return ids;
});

const appInstanceCounts = computed(() => {
  const projectsByApp = {};
  containers.value.forEach((c) => {
    const appId = c?.app?.id;
    const projectId = c?.app?.projectId;
    if (appId && projectId) {
      if (!projectsByApp[appId]) projectsByApp[appId] = new Set();
      projectsByApp[appId].add(projectId);
    }
  });
  const counts = {};
  for (const [appId, projects] of Object.entries(projectsByApp)) {
    counts[appId] = projects.size;
  }
  return counts;
});

const shuffledApps = computed(() => {
  // Deterministic shuffle, updated at most once per hour
  void hourSeed.value;
  return shuffleWithSeed(apps.value);
});

const allAppsCount = computed(() => apps.value.length);

const tags = computed(() => {
  const tagSet = new Set();
  apps.value.forEach((app) => {
    if (Array.isArray(app.tags)) {
      app.tags.forEach((tag) => tagSet.add(tag));
    }
  });

  const tagsArray = Array.from(tagSet).sort();

  return tagsArray
    .map((tag) => {
      const count = apps.value.filter((app) =>
        Array.isArray(app.tags) && app.tags.includes(tag)
      ).length;
      return { name: tag, count };
    })
    .filter((tag) => tag.count > 2);
});

const combinedApps = computed(() => {
  let combined = shuffledApps.value.map((app) => ({
    ...app,
    isInstalled: installedAppIds.value.has(app.id),
  }));

  if (selectedTag.value) {
    combined = combined.filter((app) =>
      Array.isArray(app.tags) && app.tags.includes(selectedTag.value)
    );
  }

  if (appSearch.value) {
    const search = appSearch.value.toLowerCase();
    combined = combined.filter((app) => {
      return (
        app.name.toLowerCase().includes(search) ||
        (Array.isArray(app.tags) && app.tags.join(' ').toLowerCase().includes(search)) ||
        (app.description && app.description.toLowerCase().includes(search))
      );
    });
  }

  return combined;
});

// Helper Functions
function getDateHourSeed() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}`;
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function shuffleWithSeed(array) {
  const dateHourSeed = getDateHourSeed();
  let numericSeed = 0;
  for (let i = 0; i < dateHourSeed.length; i++) {
    numericSeed += dateHourSeed.charCodeAt(i) * (i + 1);
  }

  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(numericSeed + i) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// API Functions
async function fetchApps() {
  try {
    const response = await fetch(`${apiUrl.value}/api/apps`);
    const data = await response.json();
    if (data.success) {
      apps.value = data.apps;
    }
  } catch (error) {
    console.error("Failed to fetch apps:", error);
  }
}

async function fetchContainers() {
  try {
    const response = await fetch(`${apiUrl.value}/api/containers`);
    const data = await response.json();
    if (data.success) {
      containers.value = data.containers.filter((c) => c.state === "running");
    }
  } catch (error) {
    console.error("Failed to fetch containers:", error);
  }
}

function viewAppDetail(appId) {
  router.push(`/apps/${appId}`);
}

// Lifecycle
onMounted(async () => {
  window.addEventListener('keydown', focusSearch);
  loading.value = true;
  await Promise.all([fetchApps(), fetchContainers()]);
  loading.value = false;

  refreshInterval = setInterval(fetchContainers, 10000);

  seedInterval = setInterval(() => {
    const nextSeed = getDateHourSeed();
    if (nextSeed !== hourSeed.value) {
      hourSeed.value = nextSeed;
    }
  }, 60_000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
  if (seedInterval) clearInterval(seedInterval);
  window.removeEventListener('keydown', focusSearch);
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-slate-200 font-sans flex flex-col lg:flex-row">
    
    <!-- Main Content -->
    <main class="flex-1 min-w-0 order-1 lg:order-1">
        <!-- Top Bar -->
        <div class="sticky top-0 z-30 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 px-4 sm:px-6 pt-4 pb-3">

          <!-- Search input -->
          <div class="relative group">
            <Search :size="17" class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors group-focus-within:text-gray-700 dark:group-focus-within:text-slate-300" />
            <input
              ref="searchInput"
              v-model="appSearch"
              type="text"
              placeholder="Search apps…"
              class="w-full bg-gray-50 dark:bg-[#0c0c0e] border border-gray-200 dark:border-slate-800 rounded-2xl pl-11 pr-24 py-3 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-gray-900 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-[#111] focus:shadow-lg transition-all duration-200"
            />
            <!-- Kbd hint -->
            <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none" :class="appSearch ? 'hidden' : ''">
              <kbd class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700">
                <Command :size="9" />
                K
              </kbd>
            </div>
            <!-- Clear button -->
            <button
              v-if="appSearch"
              @click="appSearch = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X :size="15" />
            </button>
          </div>

          <!-- Active filters + result count -->
          <div class="mt-2.5 flex items-center gap-2 flex-wrap min-h-6">
            <span class="text-xs text-gray-400 dark:text-slate-500">
              {{ combinedApps.length }} app{{ combinedApps.length === 1 ? '' : 's' }}
            </span>
            <span
              v-if="selectedTag"
              class="inline-flex items-center gap-1 text-xs font-medium bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900 px-2.5 py-1 rounded-full"
            >
              {{ selectedTag }}
              <button @click="selectedTag = null" class="ml-0.5 hover:opacity-70 transition-opacity">
                <X :size="11" />
              </button>
            </span>
          </div>
        </div>

        <!-- content area -->
        <div class="p-6">
            <div v-if="loading" class="flex flex-col items-center justify-center py-20">
               <div class="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
               <div class="text-sm text-slate-500">Loading catalog...</div>
            </div>

            <div v-else-if="combinedApps.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
                <div class="bg-slate-100 dark:bg-slate-800 rounded-full p-4 mb-4">
                   <Search :size="32" class="text-slate-400" />
                </div>
                <h3 class="text-lg font-bold text-slate-900 dark:text-white">No apps found</h3>
                <p class="text-slate-500 mt-1 max-w-xs mx-auto">We couldn't find any apps matching your search filters.</p>
                <button @click="appSearch = ''; selectedTag = null" class="mt-4 text-sm font-medium text-blue-600 hover:underline">Clear all filters</button>
            </div>

            <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                <AppCard
                  v-for="app in combinedApps"
                  :key="app.id"
                  :app="app"
                  :instance-count="appInstanceCounts[app.id] || 0"
                  @click="viewAppDetail(app.id)"
                />
            </div>
        </div>

    </main>

    <!-- Sidebar / Filters -->
    <aside class="w-full lg:w-60 xl:w-64 shrink-0 bg-white dark:bg-[#0c0c0e] border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-slate-800 lg:h-screen lg:sticky lg:top-0 overflow-y-auto order-2 lg:order-2 scrollbar-none">
      <div class="p-5">

        <!-- Header -->
        <div class="mb-6">
          <h2 class="text-base font-bold text-gray-900 dark:text-white">Tags</h2>
          <p class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{{ allAppsCount }} apps available</p>
        </div>

        <!-- All button -->
        <button
          @click="selectedTag = null"
          :class="[
            'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mb-1',
            selectedTag === null
              ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-gray-900'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-slate-200'
          ]"
        >
          <div class="flex items-center gap-2.5">
            <LayoutGrid :size="15" />
            All apps
          </div>
          <span :class="[
            'text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-md',
            selectedTag === null
              ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
          ]">{{ allAppsCount }}</span>
        </button>

        <!-- Divider -->
        <div class="my-3 border-t border-gray-100 dark:border-slate-800"></div>

        <!-- Category list -->
        <div class="space-y-0.5">
          <button
            v-for="cat in tags"
            :key="cat.name"
            @click="selectedTag = cat.name"
            :class="[
              'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
              selectedTag === cat.name
                ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-gray-900'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-slate-200'
            ]"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Tag :size="14" class="shrink-0" />
              <span class="truncate">{{ cat.name }}</span>
            </div>
            <span :class="[
              'text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-md shrink-0 ml-2',
              selectedTag === cat.name
                ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500'
            ]">{{ cat.count }}</span>
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
