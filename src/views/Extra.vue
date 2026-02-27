<script setup>
import { Box, ClipboardList, HardDrive, Home, Layers, Check, ChevronRight, Heart, Github, Send, Bug, Cloud } from "lucide-vue-next";

const rawBuildTimestamp = import.meta.env.VITE_BUILD_TIMESTAMP;
const buildDate = rawBuildTimestamp ? new Date(rawBuildTimestamp) : null;
const buildTimestamp = buildDate && !Number.isNaN(buildDate.getTime())
  ? buildDate.toISOString().replace("T", " ").replace("Z", " UTC")
  : "Unknown";

const buildRelative = (() => {
  if (!buildDate || Number.isNaN(buildDate.getTime())) return "Unknown";

  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - buildDate.getTime()) / 1000));

  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
})();

const navItems = [
  {
    title: "Images",
    to: "/images",
    description: "Inspect local Docker images",
    icon: Layers,
    features: ["List images", "Cleanup helpers"],
  },
  {
    title: "Volumes",
    to: "/volumes",
    description: "View and manage named volumes",
    icon: HardDrive,
    features: ["Safe storage", "Portable data"],
  },
  {
    title: "Logs",
    to: "/logs",
    description: "Read container logs and recent output",
    icon: ClipboardList,
    features: ["Tail logs", "Debug quickly"],
  },
];

const externalItems = [
  {
    title: "Sponsor",
    href: "https://sponsor.besoeasy.com/",
    description: "Support Yantr development",
    icon: Heart,
    features: ["Keep the project alive", "Fund new features"],
  },
  {
    title: "GitHub",
    href: "https://github.com/besoeasy/Yantr",
    description: "Source code, issues, and releases",
    icon: Github,
    features: ["Track updates", "Report bugs"],
  },
  {
    title: "Report Issue",
    href: "https://github.com/besoeasy/yantr/issues",
    description: "Open a bug report or request a feature",
    icon: Bug,
    features: ["Bug reports", "Feature requests"],
  },
];
</script>

<template>
  <main class="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white px-4 py-8">
    <div class="max-w-7xl mx-auto space-y-12">
      <!-- Header -->
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold tracking-tight">Extra Tools & Links</h1>
        <p class="text-sm text-gray-500 dark:text-zinc-500 font-medium">Additional utilities and external resources for Yantr.</p>
      </div>

      <!-- Navigation Grid -->
      <section aria-label="Navigation" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="group relative overflow-hidden bg-white dark:bg-[#0A0A0A] rounded-xl p-6 border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 focus:outline-none"
          :aria-label="`${item.title}: ${item.description}`"
        >
          <!-- Hover Glow Line -->
          <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <!-- Hover Dot Pattern -->
          <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

          <div class="relative z-10 flex flex-col h-full">
            <!-- Icon & Title -->
            <div class="flex items-center gap-3 mb-4">
              <div class="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 group-hover:border-blue-500/30 group-hover:text-blue-500 transition-colors">
                <component :is="item.icon" :size="18" />
              </div>
              <h2 class="text-lg font-semibold tracking-tight group-hover:text-blue-500 transition-colors">
                {{ item.title }}
              </h2>
            </div>
            
            <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed mb-6 flex-grow">
              {{ item.description }}
            </p>

            <!-- Features -->
            <ul class="space-y-2 text-xs text-gray-500 dark:text-zinc-500 font-medium">
              <li v-for="feature in item.features" :key="feature" class="flex items-center gap-2">
                <Check :size="12" class="text-gray-400 dark:text-zinc-600 group-hover:text-blue-400 transition-colors" />
                {{ feature }}
              </li>
            </ul>
            
            <!-- Slide Action -->
            <div class="mt-6 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-blue-500 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
              Open Tool <ChevronRight :size="14" />
            </div>
          </div>
        </router-link>
      </section>

      <!-- External Links Grid -->
      <section aria-label="External Links">
        <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500 mb-4">External Resources</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            v-for="item in externalItems"
            :key="item.href"
            :href="item.href"
            target="_blank"
            rel="noopener noreferrer"
            class="group relative overflow-hidden bg-white dark:bg-[#0A0A0A] rounded-xl p-6 border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 focus:outline-none"
            :aria-label="`${item.title}: ${item.description}`"
          >
            <!-- Hover Glow Line -->
            <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-gray-400 dark:via-zinc-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div class="relative z-10 flex flex-col h-full">
              <!-- Icon & Title -->
              <div class="flex items-center gap-3 mb-4">
                <div class="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 group-hover:border-gray-300 dark:group-hover:border-zinc-600 transition-colors">
                  <component :is="item.icon" :size="18" class="text-gray-700 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
                </div>
                <h2 class="text-lg font-semibold tracking-tight">
                  {{ item.title }}
                </h2>
              </div>
              
              <p class="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed mb-6 flex-grow">
                {{ item.description }}
              </p>

              <!-- Features -->
              <ul class="space-y-2 text-xs text-gray-500 dark:text-zinc-500 font-medium">
                <li v-for="feature in item.features" :key="feature" class="flex items-center gap-2">
                  <Check :size="12" class="text-gray-400 dark:text-zinc-600" />
                  {{ feature }}
                </li>
              </ul>
              
              <!-- Slide Action -->
              <div class="mt-6 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                Visit Link <ChevronRight :size="14" />
              </div>
            </div>
          </a>
        </div>
      </section>

      <!-- Build Version -->
      <section aria-label="Build Information" class="w-full">
        <div class="bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500">Build Info</div>
            <div class="text-xl font-bold tracking-tighter tabular-nums text-gray-900 dark:text-white">{{ buildTimestamp }}</div>
            <div class="text-xs text-gray-500 dark:text-zinc-500 font-medium">Generated at image build time (UTC)</div>
          </div>
          <div class="px-3 py-1.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-md text-xs font-bold text-gray-700 dark:text-zinc-300 whitespace-nowrap">
            {{ buildRelative }}
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
