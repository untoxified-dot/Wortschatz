import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  query, orderBy, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const wordsRef = collection(db, "words");
const wordsQuery = query(wordsRef, orderBy("word"));

// ---- state ----
let allWords = [];
let activeCategory = "Alle";
let searchTerm = "";

// ---- elements ----
const grid = document.getElementById("card-grid");
const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const template = document.getElementById("card-template");
const searchInput = document.getElementById("search");
const drawers = document.getElementById("drawers");
const addBtn = document.getElementById("add-word-btn");
const closePanelBtn = document.getElementById("close-panel");
const panel = document.getElementById("add-panel");
const scrim = document.getElementById("scrim");
const form = document.getElementById("word-form");
const articleField = document.getElementById("article-field");
const toast = document.getElementById("toast");

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

// ---- live subscription ----
onSnapshot(
  wordsQuery,
  (snapshot) => {
    allWords = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    loadingState.hidden = true;
    render();
  },
  (err) => {
    loadingState.hidden = true;
    showToast("Couldn't reach the catalog — check your Firebase setup.");
    console.error(err);
  }
);

function render() {
  const term = searchTerm.trim().toLowerCase();
  const filtered = allWords.filter((w) => {
    const matchesCategory = activeCategory === "Alle" || w.category === activeCategory;
    const matchesSearch =
      !term ||
      w.word?.toLowerCase().includes(term) ||
      w.translation?.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  grid.innerHTML = "";
  emptyState.hidden = filtered.length !== 0;

  filtered.forEach((w) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".card-tag").textContent =
      w.category === "Substantiv" ? w.article || "" : w.category;
    node.querySelector(".card-word").textContent = w.word || "";
    node.querySelector(".card-translation").textContent = w.translation || "";
    node.querySelector(".card-example").textContent = w.example || "";
    node.querySelector(".card-delete").addEventListener("click", () => removeWord(w.id, w.word));
    grid.appendChild(node);
  });
}

async function removeWord(id, word) {
  if (!confirm(`Remove "${word}" from the catalog?`)) return;
  try {
    await deleteDoc(doc(db, "words", id));
  } catch (err) {
    showToast("Couldn't remove that word.");
    console.error(err);
  }
}

// ---- drawer tabs ----
drawers.addEventListener("click", (e) => {
  const btn = e.target.closest(".drawer-tab");
  if (!btn) return;
  drawers.querySelectorAll(".drawer-tab").forEach((t) => t.classList.remove("is-active"));
  btn.classList.add("is-active");
  activeCategory = btn.dataset.category;
  render();
});

// ---- search ----
searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  render();
});

// ---- category choice toggles the article field ----
form.addEventListener("change", (e) => {
  if (e.target.name === "category") {
    articleField.classList.toggle("is-hidden", e.target.value !== "Substantiv");
  }
});

// ---- panel open/close ----
function openPanel() {
  panel.hidden = false;
  scrim.hidden = false;
  addBtn.setAttribute("aria-expanded", "true");
  document.getElementById("word-input").focus();
}
function closePanel() {
  panel.hidden = true;
  scrim.hidden = true;
  addBtn.setAttribute("aria-expanded", "false");
  form.reset();
  articleField.classList.remove("is-hidden");
}
addBtn.addEventListener("click", openPanel);
closePanelBtn.addEventListener("click", closePanel);
scrim.addEventListener("click", closePanel);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) closePanel();
});

// ---- submit new word ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const category = data.get("category");
  const word = (data.get("word") || "").trim();
  if (!word) return;

  const entry = {
    category,
    word,
    translation: (data.get("translation") || "").trim(),
    example: (data.get("example") || "").trim(),
    article: category === "Substantiv" ? data.get("article") : null,
    createdAt: serverTimestamp()
  };

  const submitBtn = form.querySelector(".btn-primary");
  submitBtn.disabled = true;
  try {
    await addDoc(wordsRef, entry);
    showToast(`"${word}" wurde hinzugefügt.`);
    closePanel();
  } catch (err) {
    showToast("Couldn't save that word — try again.");
    console.error(err);
  } finally {
    submitBtn.disabled = false;
  }
});
