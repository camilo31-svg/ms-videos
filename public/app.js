const STORAGE_KEYS = {
  favorites: "media-seva-favorites-v1",
  history: "media-seva-history-v1",
  audioMode: "media-seva-audio-mode-v1",
  theme: "ms-videos-theme-v1"
};

const state = {
  catalog: null,
  activeTab: "browse",
  path: [],
  query: "",
  current: null,
  queue: [],
  audioMode: localStorage.getItem(STORAGE_KEYS.audioMode) === "true",
  favorites: readStorage(STORAGE_KEYS.favorites, []).filter((item) => mediaKind(item) === "video"),
  history: readStorage(STORAGE_KEYS.history, []).filter((item) => mediaKind(item) === "video"),
  installPrompt: null,
  historyTimer: null
};

const els = {
  body: document.body,
  list: document.querySelector("#library-list"),
  template: document.querySelector("#library-item-template"),
  contentState: document.querySelector("#content-state"),
  viewTitle: document.querySelector("#view-title"),
  breadcrumb: document.querySelector("#breadcrumb"),
  itemCount: document.querySelector("#item-count"),
  backButton: document.querySelector("#back-button"),
  searchToggle: document.querySelector("#search-toggle"),
  searchPanel: document.querySelector("#search-panel"),
  searchInput: document.querySelector("#search-input"),
  searchClear: document.querySelector("#search-clear"),
  themeToggle: document.querySelector("#theme-toggle"),
  themeColor: document.querySelector("#theme-color"),
  installButton: document.querySelector("#install-button"),
  favoriteCount: document.querySelector("#desktop-favorite-count"),
  playerPane: document.querySelector("#player-pane"),
  playerArtwork: document.querySelector("#player-artwork"),
  playerPlaceholder: document.querySelector("#player-placeholder"),
  video: document.querySelector("#video-player"),
  audio: document.querySelector("#audio-player"),
  nowLabel: document.querySelector("#now-playing-label"),
  nowTitle: document.querySelector("#now-playing-title"),
  nowPath: document.querySelector("#now-playing-path"),
  playerFavorite: document.querySelector("#player-favorite"),
  playButton: document.querySelector("#play-button"),
  previousButton: document.querySelector("#previous-button"),
  nextButton: document.querySelector("#next-button"),
  seekBack: document.querySelector("#seek-back-button"),
  seekForward: document.querySelector("#seek-forward-button"),
  audioMode: document.querySelector("#audio-mode-toggle"),
  downloadCurrent: document.querySelector("#download-current"),
  miniPlayer: document.querySelector("#mini-player"),
  miniTitle: document.querySelector("#mini-title"),
  miniStatus: document.querySelector("#mini-status"),
  miniPlay: document.querySelector("#mini-play"),
  miniOpen: document.querySelector("#mini-open"),
  mobilePlayerTab: document.querySelector("#mobile-player-tab")
};

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function storedTheme() {
  try {
    const theme = localStorage.getItem(STORAGE_KEYS.theme);
    return theme === "light" || theme === "dark" ? theme : "";
  } catch {
    return "";
  }
}

function preferredTheme() {
  return storedTheme() || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function applyTheme(theme, persist = false) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  els.themeToggle.querySelector("span").textContent = dark ? "\u2600" : "\u263E";
  els.themeToggle.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
  els.themeToggle.title = dark ? "Modo claro" : "Modo oscuro";
  els.themeColor.content = dark ? "#0b1110" : "#17211f";
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEYS.theme, dark ? "dark" : "light");
    } catch {}
  }
}

function mediaKind(item) {
  if (item.type === "video" || item.type === "audio") return item.type;
  const extension = item.name?.split(".").pop()?.toLowerCase();
  if (["mp4", "m4v", "webm", "mov"].includes(extension)) return "video";
  if (["mp3", "m4a", "aac", "wav", "ogg", "flac"].includes(extension)) return "audio";
  return item.type || "document";
}

function isPlayable(item) {
  return mediaKind(item) === "video";
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatCount(count) {
  return `${count} ${count === 1 ? "opcion" : "opciones"}`;
}

function videoOnly(items) {
  return (items || []).flatMap((item) => {
    if (item.type === "video") return [item];
    if (item.type !== "folder") return [];
    return [{ ...item, children: videoOnly(item.children) }];
  });
}

function prepareVideoCatalog(catalog) {
  const rootItems = Array.isArray(catalog?.items) ? catalog.items : [];
  const videosRoot = rootItems.find((item) => item.id === "I0SXE91" || normalize(item.name) === "videos");
  return {
    ...catalog,
    title: "Videos",
    items: videoOnly(videosRoot ? videosRoot.children : rootItems)
  };
}

function itemYear(item) {
  return item.type === "folder" ? item.name.match(/\b(?:19|20)\d{2}\b/)?.[0] || "" : "";
}

function currentFolder() {
  if (!state.path.length) return state.catalog;
  return state.path[state.path.length - 1];
}

function pathLabel(item) {
  if (item.path) return item.path;
  const parts = [...state.path.map((node) => node.name), item.name].filter(Boolean);
  return parts.join(" / ");
}

function fileSnapshot(item) {
  const variants = (item.variants || []).map(({ url, size, quality, format, playable }) => ({
    url,
    size: size || "",
    quality: quality || format || "Video",
    format: format || "",
    playable: playable !== false
  }));
  return {
    id: item.id,
    type: mediaKind(item),
    name: item.name,
    url: item.url,
    size: item.size || "",
    quality: item.quality || variants.find((variant) => variant.url === item.url)?.quality || "",
    variants,
    source: item.source || "",
    path: item.path || pathLabel(item)
  };
}

function withVariant(item, variant) {
  return {
    ...item,
    url: variant.url,
    size: variant.size || "",
    quality: variant.quality || variant.format || "Video"
  };
}

function variantDetails(variant) {
  const format = variant.format || "";
  const showFormat = format && !normalize(variant.quality).includes(normalize(format));
  return [showFormat ? format : "", variant.size, variant.playable === false ? "Compatibilidad limitada" : ""]
    .filter(Boolean)
    .join(" · ");
}

function flattenCatalog(items, parents = [], output = []) {
  for (const item of items || []) {
    item._parents = parents;
    output.push(item);
    if (item.type === "folder") {
      flattenCatalog(item.children, [...parents, item], output);
    }
  }
  return output;
}

function setView(tab) {
  state.activeTab = tab;
  state.query = "";
  els.searchInput.value = "";
  els.searchClear.classList.add("hidden");
  els.playerPane.classList.remove("mobile-open");
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  els.mobilePlayerTab.classList.remove("active");
  render();
}

function getVisibleItems() {
  if (!state.catalog) return [];
  if (state.query) {
    const query = normalize(state.query);
    return flattenCatalog(state.catalog.items).filter((item) =>
      normalize(`${item.name} ${item.path || ""}`).includes(query)
    );
  }
  if (state.activeTab === "favorites") return state.favorites;
  if (state.activeTab === "history") return state.history;
  return currentFolder().items || currentFolder().children || [];
}

function visibleHeading(items) {
  if (state.query) {
    return {
      title: "Resultados",
      crumb: `Busqueda: ${state.query}`,
      canGoBack: true
    };
  }
  if (state.activeTab === "favorites") {
    return { title: "Favoritos", crumb: "Tu biblioteca", canGoBack: true };
  }
  if (state.activeTab === "history") {
    return { title: "Historial", crumb: "Escuchado recientemente", canGoBack: true };
  }
  return {
    title: state.path.at(-1)?.name || state.catalog?.title || "Videos",
    crumb: state.path.length ? ["Videos", ...state.path.slice(0, -1).map((node) => node.name)].join(" / ") : "MS Videos",
    canGoBack: state.path.length > 0
  };
}

function render() {
  if (!state.catalog) return;
  const items = getVisibleItems();
  const heading = visibleHeading(items);

  els.viewTitle.textContent = heading.title;
  els.breadcrumb.textContent = heading.crumb;
  els.itemCount.textContent = formatCount(items.length);
  els.backButton.classList.toggle("hidden", !heading.canGoBack);
  els.favoriteCount.textContent = String(state.favorites.length);
  els.list.replaceChildren();
  els.contentState.classList.add("hidden");

  if (!items.length) {
    renderEmptyState();
    return;
  }

  const yearFolders = state.activeTab === "browse" && !state.query
    ? items.filter((item) => itemYear(item)).sort((left, right) => Number(itemYear(right)) - Number(itemYear(left)))
    : [];
  const regularItems = yearFolders.length ? items.filter((item) => !itemYear(item)) : items;
  const queue = items.filter(isPlayable);
  if (yearFolders.length) els.list.append(createYearSection(yearFolders));
  for (const item of regularItems) {
    els.list.append(createLibraryItem(item, queue));
  }
}

function createYearSection(items) {
  const section = document.createElement("section");
  const heading = document.createElement("div");
  const title = document.createElement("h2");
  const hint = document.createElement("p");
  const grid = document.createElement("div");
  section.className = "year-section";
  heading.className = "year-heading";
  grid.className = "year-grid";
  title.textContent = "Elige un año";
  hint.textContent = "Archivo de videos por fecha";
  heading.append(title, hint);

  for (const item of items) {
    const button = document.createElement("button");
    const year = document.createElement("strong");
    const label = document.createElement("span");
    const name = document.createElement("span");
    const arrow = document.createElement("span");
    button.type = "button";
    button.className = "year-card";
    button.setAttribute("aria-label", `Abrir videos de ${itemYear(item)}`);
    year.className = "year-number";
    year.textContent = itemYear(item);
    label.className = "year-label";
    const remainder = item.name.replace(itemYear(item), "").replace(/[_-]+/g, " ").trim();
    name.textContent = /^h$/i.test(remainder) ? "Colección H · castellano" : remainder || "Videos del año";
    arrow.className = "year-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "›";
    label.append(name, arrow);
    button.append(year, label);
    button.addEventListener("click", () => openFolder(item));
    grid.append(button);
  }

  section.append(heading, grid);
  return section;
}

function renderEmptyState() {
  let title = "No hay videos aqui";
  let message = "Vuelve a la videoteca para seguir explorando.";
  if (state.query) {
    title = "Sin resultados";
    message = "Prueba con otro nombre, año o tema.";
  } else if (state.activeTab === "favorites") {
    title = "Todavia no tienes favoritos";
    message = "Tus videos guardados apareceran aqui.";
  } else if (state.activeTab === "history") {
    title = "Tu historial esta vacio";
    message = "Los videos que reproduzcas apareceran aqui.";
  }

  els.contentState.innerHTML = "";
  const wrapper = document.createElement("div");
  const strong = document.createElement("strong");
  const text = document.createElement("span");
  strong.textContent = title;
  text.textContent = message;
  wrapper.append(strong, text);
  els.contentState.append(wrapper);
  els.contentState.classList.remove("hidden");
}

function createLibraryItem(item, queue) {
  const fragment = els.template.content.cloneNode(true);
  const article = fragment.querySelector(".library-item");
  const main = fragment.querySelector(".item-main");
  const icon = fragment.querySelector(".item-icon");
  const title = fragment.querySelector(".item-title");
  const meta = fragment.querySelector(".item-meta");
  const trailing = fragment.querySelector(".item-trailing");
  const actions = fragment.querySelector(".item-actions");
  const kind = item.type === "folder" ? "folder" : mediaKind(item);

  article.dataset.kind = kind;
  title.textContent = item.name;
  icon.textContent = kind === "folder" ? "▰" : kind === "video" ? "▶" : kind === "audio" ? "♪" : "▤";

  if (kind === "folder") {
    const childCount = item.children?.length || 0;
    meta.textContent = item.loaded === true ? formatCount(childCount) : childCount ? `${formatCount(childCount)} · videos en linea` : "Videos en linea";
    main.setAttribute("aria-label", `Abrir ${item.name}`);
    main.addEventListener("click", () => openFolder(item));
  } else if (kind === "video") {
    const variants = item.variants?.length ? item.variants : [{
      url: item.url,
      size: item.size || "",
      quality: item.quality || "Video",
      format: item.name.split(".").pop()?.toUpperCase() || "",
      playable: true
    }];
    meta.textContent = variants.length > 1
      ? `${variants.length} calidades disponibles`
      : [variants[0].quality, variantDetails(variants[0])].filter(Boolean).join(" · ");
    trailing.textContent = variants.length > 1 ? "⌄" : "▶";
    main.setAttribute("aria-label", variants.length > 1 ? `Elegir calidad para ${item.name}` : `Reproducir ${item.name}`);
    main.setAttribute("aria-expanded", "false");
    main.addEventListener("click", () => {
      if (variants.length > 1) {
        toggleQualityPanel(article, main, item, variants, queue);
        return;
      }
      const selected = withVariant(item, variants[0]);
      playItem(selected, queue.map((queued) => queued.id === item.id ? selected : queued));
    });
    actions.append(createFavoriteButton(item));
    if (variants.length === 1) actions.append(createDownloadButton(withVariant(item, variants[0])));
  }

  return fragment;
}

function toggleQualityPanel(article, main, item, variants, queue) {
  const existing = article.querySelector(".quality-panel");
  document.querySelectorAll(".quality-panel").forEach((panel) => {
    panel.closest(".library-item")?.querySelector(".item-main")?.setAttribute("aria-expanded", "false");
    panel.remove();
  });
  if (existing) return;

  const panel = document.createElement("div");
  const label = document.createElement("p");
  panel.className = "quality-panel";
  label.className = "quality-heading";
  label.textContent = "Calidad de reproducción";
  panel.append(label);

  for (const variant of variants) {
    const row = document.createElement("div");
    const play = document.createElement("button");
    const marker = document.createElement("span");
    const copy = document.createElement("span");
    const quality = document.createElement("strong");
    const detail = document.createElement("small");
    const selected = withVariant(item, variant);
    row.className = "quality-row";
    play.type = "button";
    play.className = "quality-option";
    play.setAttribute("aria-label", `Reproducir ${item.name} en calidad ${variant.quality}`);
    marker.className = "quality-play";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "▶";
    copy.className = "quality-copy";
    quality.textContent = variant.quality || variant.format || "Video";
    detail.textContent = variantDetails(variant);
    copy.append(quality, detail);
    play.append(marker, copy);
    play.addEventListener("click", () => {
      const selectedQueue = queue.map((queued) => queued.id === item.id ? selected : queued);
      playItem(selected, selectedQueue);
    });
    row.append(play, createDownloadButton(selected));
    panel.append(row);
  }

  article.append(panel);
  main.setAttribute("aria-expanded", "true");
}

function createFavoriteButton(item) {
  const button = document.createElement("button");
  const favorite = isFavorite(item);
  button.type = "button";
  button.className = `icon-button item-action${favorite ? " is-favorite" : ""}`;
  button.innerHTML = `<span aria-hidden="true">${favorite ? "♥" : "♡"}</span>`;
  button.setAttribute("aria-label", favorite ? "Quitar de favoritos" : "Anadir a favoritos");
  button.title = favorite ? "Quitar de favoritos" : "Favorito";
  button.addEventListener("click", () => toggleFavorite(item));
  return button;
}

function createDownloadButton(item) {
  const link = document.createElement("a");
  link.className = "icon-button item-action";
  link.href = item.url;
  link.download = item.name;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.innerHTML = '<span aria-hidden="true">⇩</span>';
  link.setAttribute("aria-label", `Descargar ${item.name}`);
  link.title = "Descargar";
  link.addEventListener("click", (event) => event.stopPropagation());
  return link;
}

async function openFolder(item) {
  state.path = [...(item._parents || []), item];
  state.activeTab = "browse";
  state.query = "";
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === "browse");
  });
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (item.loaded === true || item.loading) return;
  item.loading = true;
  showFolderLoading(item);
  try {
    const parents = [...(item._parents || []).map((folder) => folder.name), item.name];
    const endpoint = new URL("api/folder", document.baseURI);
    endpoint.searchParams.set("source", item.source || "castellano");
    endpoint.searchParams.set("id", item.remoteId || item.id);
    endpoint.searchParams.set("name", item.name);
    endpoint.searchParams.set("parents", JSON.stringify(parents));
    const response = await fetch(endpoint, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Folder request failed: ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.children)) throw new Error("Invalid folder response");
    item.children = videoOnly(payload.children);
    item.loaded = true;
    item.loadError = false;
    flattenCatalog(item.children, [...(item._parents || []), item]);
  } catch {
    item.loadError = true;
  } finally {
    item.loading = false;
    if (state.path.at(-1) === item) {
      render();
      if (item.loadError && !(item.children?.length)) showFolderError(item);
    }
  }
}

function showFolderLoading(item) {
  els.list.replaceChildren();
  els.contentState.innerHTML = "";
  const wrapper = document.createElement("div");
  const strong = document.createElement("strong");
  const text = document.createElement("span");
  strong.textContent = item.name;
  text.textContent = "Actualizando esta carpeta...";
  wrapper.append(strong, text);
  els.contentState.append(wrapper);
  els.contentState.classList.remove("hidden");
}

function showFolderError(item) {
  els.list.replaceChildren();
  els.contentState.innerHTML = "";
  const wrapper = document.createElement("div");
  const strong = document.createElement("strong");
  const text = document.createElement("span");
  const retry = document.createElement("button");
  strong.textContent = "No se pudo actualizar la carpeta";
  text.textContent = "La videoteca remota no respondio.";
  retry.type = "button";
  retry.className = "text-action retry-action";
  retry.textContent = "Reintentar";
  retry.addEventListener("click", () => {
    item.loadError = false;
    openFolder(item);
  });
  wrapper.append(strong, text, retry);
  els.contentState.append(wrapper);
  els.contentState.classList.remove("hidden");
}

function goBack() {
  if (state.query) {
    state.query = "";
    els.searchInput.value = "";
    els.searchClear.classList.add("hidden");
  } else if (state.activeTab !== "browse") {
    state.activeTab = "browse";
  } else if (state.path.length) {
    state.path.pop();
  }
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.activeTab);
  });
  render();
}

function isFavorite(item) {
  return state.favorites.some((favorite) => favorite.id === item.id || favorite.url === item.url);
}

function toggleFavorite(item) {
  const index = state.favorites.findIndex((favorite) => favorite.id === item.id || favorite.url === item.url);
  if (index >= 0) {
    state.favorites.splice(index, 1);
  } else {
    state.favorites.unshift(fileSnapshot(item));
  }
  saveStorage(STORAGE_KEYS.favorites, state.favorites);
  updatePlayerFavorite();
  render();
}

function activeMedia() {
  if (!state.current) return null;
  if (mediaKind(state.current) === "video" && !state.audioMode) return els.video;
  return els.audio;
}

function inactiveMedia() {
  const active = activeMedia();
  return active === els.video ? els.audio : els.video;
}

function playItem(item, queue = []) {
  const snapshot = fileSnapshot(item);
  const changed = state.current?.url !== snapshot.url;
  state.current = snapshot;
  state.queue = queue.length ? queue.map(fileSnapshot) : [snapshot];
  const kind = mediaKind(snapshot);

  if (changed) {
    els.video.pause();
    els.audio.pause();
    els.video.removeAttribute("src");
    els.audio.removeAttribute("src");
    const media = activeMedia();
    media.src = snapshot.url;
    media.load();
    restorePosition(media, snapshot);
  }

  els.body.classList.add("has-media");
  els.playerPane.classList.remove("player-empty");
  els.playerPlaceholder.classList.add("hidden");
  els.miniPlayer.classList.remove("hidden");
  els.nowLabel.textContent = ["Video", snapshot.quality, state.audioMode ? "modo audio" : ""].filter(Boolean).join(" · ");
  els.nowTitle.textContent = snapshot.name;
  els.nowPath.textContent = snapshot.path || "Sant Mat Castellano";
  els.miniTitle.textContent = snapshot.name;
  els.audioMode.checked = kind === "audio" ? true : state.audioMode;
  els.audioMode.disabled = kind !== "video";
  els.downloadCurrent.href = snapshot.url;
  els.downloadCurrent.download = snapshot.name;
  els.downloadCurrent.classList.remove("disabled");
  els.downloadCurrent.setAttribute("aria-disabled", "false");
  [els.playerFavorite, els.playButton, els.previousButton, els.nextButton, els.seekBack, els.seekForward].forEach((control) => {
    control.disabled = false;
  });

  updateMediaVisibility();
  updatePlayerFavorite();
  updateMediaSession();
  addToHistory(snapshot, 0);
  render();

  activeMedia().play().catch(() => updatePlaybackControls());
}

function restorePosition(media, item) {
  const previous = state.history.find((entry) => entry.url === item.url);
  if (!previous?.position) return;
  media.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(media.duration) && previous.position < media.duration - 15) {
      media.currentTime = previous.position;
    }
  }, { once: true });
}

function updateMediaVisibility() {
  if (!state.current) return;
  const kind = mediaKind(state.current);
  const showVideo = kind === "video" && !state.audioMode;
  els.video.classList.toggle("hidden", !showVideo);
  els.audio.classList.toggle("hidden", showVideo);
  els.playerArtwork.classList.toggle("hidden", showVideo);
}

function switchAudioMode(enabled) {
  if (!state.current || mediaKind(state.current) !== "video") return;
  const oldMedia = activeMedia();
  const time = Number.isFinite(oldMedia.currentTime) ? oldMedia.currentTime : 0;
  const shouldResume = !oldMedia.paused;
  oldMedia.pause();
  state.audioMode = enabled;
  localStorage.setItem(STORAGE_KEYS.audioMode, String(enabled));
  const nextMedia = activeMedia();

  if (nextMedia.src !== state.current.url) {
    nextMedia.src = state.current.url;
    nextMedia.load();
  }
  nextMedia.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(nextMedia.duration)) nextMedia.currentTime = Math.min(time, nextMedia.duration || time);
    if (shouldResume) nextMedia.play().catch(() => updatePlaybackControls());
  }, { once: true });

  els.nowLabel.textContent = ["Video", state.current.quality, enabled ? "modo audio" : ""].filter(Boolean).join(" · ");
  updateMediaVisibility();
  updateMediaSession();
  updatePlaybackControls();
}

function togglePlayback() {
  const media = activeMedia();
  if (!media) return;
  if (media.paused) media.play().catch(() => updatePlaybackControls());
  else media.pause();
}

function seekBy(seconds) {
  const media = activeMedia();
  if (!media) return;
  const duration = Number.isFinite(media.duration) ? media.duration : Infinity;
  media.currentTime = Math.max(0, Math.min(duration, media.currentTime + seconds));
  updatePositionState();
}

function skip(direction) {
  if (!state.current || !state.queue.length) return;
  const index = state.queue.findIndex((item) => item.url === state.current.url);
  const nextIndex = (index + direction + state.queue.length) % state.queue.length;
  playItem(state.queue[nextIndex], state.queue);
}

function updatePlaybackControls() {
  const media = activeMedia();
  const playing = media && !media.paused;
  const icon = playing ? "❚❚" : "▶";
  els.playButton.querySelector("span").textContent = icon;
  els.playButton.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
  els.miniPlay.querySelector("span").textContent = icon;
  els.miniPlay.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
  els.miniStatus.textContent = playing ? (state.audioMode ? "Reproduciendo en modo audio" : "Reproduciendo") : "Pausado";
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
}

function updatePlayerFavorite() {
  if (!state.current) return;
  const favorite = isFavorite(state.current);
  els.playerFavorite.classList.toggle("is-favorite", favorite);
  els.playerFavorite.querySelector("span").textContent = favorite ? "♥" : "♡";
  els.playerFavorite.setAttribute("aria-label", favorite ? "Quitar de favoritos" : "Anadir a favoritos");
}

function addToHistory(item, position) {
  const existing = state.history.find((entry) => entry.url === item.url);
  const entry = {
    ...fileSnapshot(item),
    position: Math.max(0, Math.floor(position || existing?.position || 0)),
    playedAt: Date.now()
  };
  state.history = [entry, ...state.history.filter((historyItem) => historyItem.url !== entry.url)].slice(0, 60);
  saveStorage(STORAGE_KEYS.history, state.history);
}

function saveCurrentProgress() {
  const media = activeMedia();
  if (!state.current || !media || !Number.isFinite(media.currentTime)) return;
  addToHistory(state.current, media.currentTime);
}

function scheduleProgressSave() {
  clearTimeout(state.historyTimer);
  state.historyTimer = setTimeout(saveCurrentProgress, 900);
}

function updateMediaSession() {
  if (!("mediaSession" in navigator) || !state.current) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: state.current.name,
    artist: "Sant Mat Castellano",
    album: state.current.path || "MS Videos",
    artwork: [
      { src: new URL("/icon-192.png", location.href).href, sizes: "192x192", type: "image/png" },
      { src: new URL("/icon-512.png", location.href).href, sizes: "512x512", type: "image/png" }
    ]
  });
  updatePositionState();
}

function updatePositionState() {
  if (!("mediaSession" in navigator) || !("setPositionState" in navigator.mediaSession)) return;
  const media = activeMedia();
  if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: media.duration,
      playbackRate: media.playbackRate,
      position: Math.min(media.currentTime, media.duration)
    });
  } catch {
    // Some mobile browsers expose Media Session before position updates are ready.
  }
}

function configureMediaSessionHandlers() {
  if (!("mediaSession" in navigator)) return;
  const handlers = {
    play: () => activeMedia()?.play(),
    pause: () => activeMedia()?.pause(),
    seekbackward: (details) => seekBy(-(details.seekOffset || 10)),
    seekforward: (details) => seekBy(details.seekOffset || 10),
    seekto: (details) => {
      const media = activeMedia();
      if (!media || typeof details.seekTime !== "number") return;
      media.currentTime = details.seekTime;
      updatePositionState();
    },
    previoustrack: () => skip(-1),
    nexttrack: () => skip(1)
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Unsupported actions are ignored while the remaining controls still work.
    }
  }
}

function attachMediaEvents(media) {
  media.addEventListener("play", updatePlaybackControls);
  media.addEventListener("pause", () => {
    updatePlaybackControls();
    saveCurrentProgress();
  });
  media.addEventListener("ended", () => {
    saveCurrentProgress();
    skip(1);
  });
  media.addEventListener("timeupdate", () => {
    updatePositionState();
    scheduleProgressSave();
  });
  media.addEventListener("loadedmetadata", updatePositionState);
}

function handleSearch() {
  state.query = els.searchInput.value.trim();
  els.searchClear.classList.toggle("hidden", !state.query);
  render();
}

function clearSearch() {
  els.searchInput.value = "";
  state.query = "";
  els.searchClear.classList.add("hidden");
  els.searchInput.focus();
  render();
}

function openPlayerMobile() {
  els.playerPane.classList.add("mobile-open");
  document.querySelectorAll(".mobile-nav-item").forEach((button) => button.classList.remove("active"));
  els.mobilePlayerTab.classList.add("active");
}

function bindEvents() {
  applyTheme(preferredTheme());
  els.themeToggle.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (!storedTheme()) applyTheme(event.matches ? "dark" : "light");
  });
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.tab));
  });
  els.backButton.addEventListener("click", goBack);
  els.searchToggle.addEventListener("click", () => {
    els.searchPanel.classList.toggle("hidden");
    if (!els.searchPanel.classList.contains("hidden")) els.searchInput.focus();
  });
  els.searchInput.addEventListener("input", handleSearch);
  els.searchClear.addEventListener("click", clearSearch);
  els.playerFavorite.addEventListener("click", () => state.current && toggleFavorite(state.current));
  els.playButton.addEventListener("click", togglePlayback);
  els.miniPlay.addEventListener("click", togglePlayback);
  els.previousButton.addEventListener("click", () => skip(-1));
  els.nextButton.addEventListener("click", () => skip(1));
  els.seekBack.addEventListener("click", () => seekBy(-10));
  els.seekForward.addEventListener("click", () => seekBy(10));
  els.audioMode.addEventListener("change", () => switchAudioMode(els.audioMode.checked));
  els.miniOpen.addEventListener("click", openPlayerMobile);
  els.mobilePlayerTab.addEventListener("click", openPlayerMobile);
  window.addEventListener("beforeunload", saveCurrentProgress);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveCurrentProgress();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    els.installButton.classList.remove("hidden");
  });
  els.installButton.addEventListener("click", async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    els.installButton.classList.add("hidden");
  });

  attachMediaEvents(els.video);
  attachMediaEvents(els.audio);
  configureMediaSessionHandlers();
}

async function loadCatalog() {
  els.contentState.innerHTML = "<div><strong>Cargando videos</strong><span>Preparando la videoteca...</span></div>";
  els.contentState.classList.remove("hidden");
  try {
    const response = await fetch(new URL("catalog.json", document.baseURI), { cache: "no-cache" });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    state.catalog = prepareVideoCatalog(await response.json());
    flattenCatalog(state.catalog.items);
    render();
  } catch {
    els.contentState.innerHTML = "<div><strong>No se pudo abrir la videoteca</strong><span>Comprueba tu conexion y vuelve a intentarlo.</span></div>";
    els.contentState.classList.remove("hidden");
  }
}

bindEvents();
loadCatalog();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {}));
}
