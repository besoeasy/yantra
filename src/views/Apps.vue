<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { Tag, Grid3x3 } from "lucide-vue-next";

const router = useRouter();

// State
const apps = ref([]);
const containers = ref([]);
const loading = ref(false);
const appSearch = ref("");
const apiUrl = ref("");
const selectedCategory = ref(null);

const hourSeed = ref(getDateHourSeed());
let refreshInterval = null;
let seedInterval = null;

// Computed
const installedAppIds = computed(() => {
  const ids = new Set(containers.value.map((c) => c?.app?.id).filter(Boolean));
  return ids;
});

const appInstanceCounts = computed(() => {
  const counts = {};
  containers.value.forEach((c) => {
    const appId = c?.app?.id;
    if (appId) {
      counts[appId] = (counts[appId] || 0) + 1;
    }
  });
  return counts;
});

const shuffledApps = computed(() => {
  // Deterministic shuffle, updated at most once per hour
  // (hourSeed is kept reactive via a small timer).
  void hourSeed.value;
  return shuffleWithSeed(apps.value);
});

const allAppsCount = computed(() => apps.value.length);

const categories = computed(() => {
  const categorySet = new Set();
  apps.value.forEach((app) => {
    if (app.category) {
      app.category.split(",").forEach((cat) => {
        categorySet.add(cat.trim());
      });
    }
  });

  const categoriesArray = Array.from(categorySet).sort();

  // Calculate count for each category and filter out categories with less than 2 apps
  return categoriesArray
    .map((cat) => {
      const count = apps.value.filter((app) =>
        app.category
          .split(",")
          .map((c) => c.trim())
          .includes(cat)
      ).length;
      return { name: cat, count };
    })
    .filter((cat) => cat.count > 2);
});

const combinedApps = computed(() => {
  let combined = shuffledApps.value.map((app) => ({
    ...app,
    isInstalled: installedAppIds.value.has(app.id),
  }));

  if (selectedCategory.value) {
    combined = combined.filter((app) =>
      app.category
        .split(",")
        .map((c) => c.trim())
        .includes(selectedCategory.value)
    );
  }

  if (appSearch.value) {
    const search = appSearch.value.toLowerCase();
    combined = combined.filter((app) => {
      return (
        app.name.toLowerCase().includes(search) ||
        app.category.toLowerCase().includes(search) ||
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
  loading.value = true;
  await Promise.all([fetchApps(), fetchContainers()]);
  loading.value = false;

  // Auto-refresh every 10 seconds
  refreshInterval = setInterval(fetchContainers, 10000);

  // Keep hourSeed reactive so we reshuffle at most hourly
  seedInterval = setInterval(() => {
    const nextSeed = getDateHourSeed();
    if (nextSeed !== hourSeed.value) {
      hourSeed.value = nextSeed;
    }
  }, 60_000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  if (seedInterval) {
    clearInterval(seedInterval);
    seedInterval = null;
  }
});
</script>

<template>
  <div class="relative">
    <!-- Main Content Area -->
    <div class="lg:mr-64 xl:mr-72 p-4 sm:p-6 md:p-10 lg:p-12">
      <!-- Search Bar -->
      <div class="mb-6 md:mb-8">
        <div class="relative">
          <input
            v-model="appSearch"
            type="text"
            placeholder="Search apps..."
            class="w-full px-4 sm:px-5 py-3 sm:py-4 pl-11 sm:pl-12 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all text-base"
          />
          <span class="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-lg sm:text-xl">🔍</span>
          <button
            v-if="appSearch"
            @click="appSearch = ''"
            class="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 touch-manipulation"
            title="Clear search"
          >
            ✕
          </button>
        </div>
        <div class="mt-2 text-sm text-gray-500 flex items-center justify-between">
          <span v-if="combinedApps.length < allAppsCount || selectedCategory">
            Showing {{ combinedApps.length }} of {{ allAppsCount }} apps
            <span v-if="selectedCategory" class="inline-flex items-center gap-1">
              in <span class="font-semibold text-blue-600">{{ selectedCategory }}</span>
              <button @click="selectedCategory = null" class="ml-1 text-gray-400 hover:text-gray-600 transition-colors" title="Clear filter">✕</button>
            </span>
          </span>
        </div>
      </div>

      <div v-if="loading" class="text-center py-16">
        <div class="text-gray-500 font-medium">Loading apps...</div>
      </div>
      <div v-else-if="combinedApps.length === 0" class="text-center py-16">
        <div class="text-5xl mb-4">🔍</div>
        <div class="text-gray-500 font-medium">No apps found</div>
        <div class="text-sm text-gray-400 mt-2">Try a different search term</div>
      </div>
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <div
          v-for="(app, index) in combinedApps"
          :key="app.id"
          :style="{ animationDelay: `${index * 30}ms` }"
          @click="viewAppDetail(app.id)"
          class="app-card group bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 transition-all duration-500 ease-out hover:border-gray-300 hover:shadow-2xl hover:shadow-gray-900/10 hover:-translate-y-1 active:scale-[0.98] cursor-pointer flex flex-col animate-fadeIn overflow-hidden relative"
        >
          <!-- Gradient background on hover -->
          <div class="absolute inset-0 bg-gradient-to-br from-gray-50/0 to-gray-50/0 group-hover:from-gray-50/50 group-hover:to-gray-50/30 transition-all duration-500 pointer-events-none"></div>

          <!-- Content wrapper -->
          <div class="relative z-10 flex flex-col h-full">
            <!-- Header with icon and title -->
            <div class="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
              <div class="relative flex-shrink-0">
                <img
                  :src="app.logo"
                  :alt="app.name"
                  class="w-14 h-14 sm:w-16 sm:h-16 object-contain transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                />
              </div>

              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-base sm:text-lg text-gray-900 truncate group-hover:text-gray-900 transition-colors line-clamp-2">
                  {{ app.name }}
                </h3>
                <p v-if="app.status" class="text-xs text-gray-500 mt-0.5">{{ app.status }}</p>
              </div>

              <!-- Instance count badge -->
              <div v-if="appInstanceCounts[app.id] > 1" class="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200">
                <span class="text-xs font-bold text-blue-700">{{ appInstanceCounts[app.id] }}</span>
              </div>
            </div>

            <!-- Description -->
            <p class="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-4 flex-grow group-hover:text-gray-700 transition-colors">
              {{ app.description || "No description available" }}
            </p>

            <!-- Categories -->
            <div class="flex flex-wrap gap-1.5 mb-4">
              <span
                v-for="(cat, idx) in app.category.split(',').slice(0, 3)"
                :key="cat"
                class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100/60 text-gray-700 border border-gray-200/50 group-hover:bg-gray-100/80 group-hover:border-gray-300 transition-all duration-300"
              >
                {{ cat.trim() }}
              </span>
              <span
                v-if="app.category.split(',').length > 3"
                class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 bg-gray-50/80 border border-gray-100/50 group-hover:bg-gray-100/80 group-hover:border-gray-200 transition-all duration-300"
              >
                +{{ app.category.split(',').length - 3 }}
              </span>
            </div>

            <!-- Footer action indicator -->
            <div class="flex items-center gap-2 text-xs text-gray-400 group-hover:text-gray-700 transition-colors mt-auto pt-3 border-t border-gray-100 group-hover:border-gray-200">
              <span>View Details</span>
              <svg class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Categories Sidebar - Fixed to right side on larger screens -->
    <aside class="hidden lg:block fixed top-0 right-0 w-64 xl:w-72 h-screen bg-white border-l border-gray-200 z-40 overflow-y-auto custom-scrollbar">
      <div class="p-6">
        <div class="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
          <Tag :size="20" class="text-gray-900" />
          <h3 class="text-lg font-bold text-gray-900">Categories</h3>
        </div>

        <div class="space-y-1.5">
          <!-- All Apps Option -->
          <button
            @click="selectedCategory = null"
            :class="selectedCategory === null ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'"
            class="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group"
          >
            <component
              :is="Grid3x3"
              :size="20"
              :class="selectedCategory === null ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'"
              class="flex-shrink-0 transition-colors"
            />
            <span class="text-sm font-medium flex-1 text-left">All apps</span>
            <span
              class="text-xs font-bold px-2 py-1 rounded-full min-w-[28px] text-center"
              :class="selectedCategory === null ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'"
            >
              {{ allAppsCount }}
            </span>
          </button>

          <!-- Category Buttons -->
          <button
            v-for="category in categories"
            :key="category.name"
            @click="selectedCategory = category.name"
            :class="selectedCategory === category.name ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'"
            class="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group"
          >
            <component
              :is="Tag"
              :size="18"
              :class="selectedCategory === category.name ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'"
              class="flex-shrink-0 transition-colors"
            />
            <span class="text-sm font-medium capitalize flex-1 text-left">{{ category.name }}</span>
            <span
              class="text-xs font-bold px-2 py-1 rounded-full min-w-[28px] text-center"
              :class="selectedCategory === category.name ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'"
            >
              {{ category.count }}
            </span>
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.4s ease-out forwards;
}

/* App card enhancements */
.app-card {
  border-radius: 1rem;
  transition: all 500ms cubic-bezier(0.16, 1, 0.3, 1);
}

.app-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(107, 114, 128, 0) 0%, rgba(75, 85, 99, 0) 100%);
  opacity: 0;
  transition: opacity 500ms ease-out;
  pointer-events: none;
  z-index: 0;
}

.app-card:hover::before {
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.05) 0%, rgba(75, 85, 99, 0.03) 100%);
  opacity: 1;
}

/* Smooth hover lift effect */
.app-card:hover {
  filter: drop-shadow(0 20px 25px -5px rgba(0, 0, 0, 0.08));
}

/* Category badge hover animation */
.app-card span {
  transition: all 300ms ease-out;
}

/* Icon container rotation on hover */
.app-card:hover img {
  filter: brightness(1.1);
}

/* Action indicator arrow */
.app-card:hover svg {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}
</style>
