const API = "/api";
const session = JSON.parse(localStorage.getItem("session") || "null");
if (!session || !session.token) {
  window.location.href = "/";
}

const userInfo = document.getElementById("userInfo");
userInfo.textContent = `Вы вошли как: ${session.email}`;

const logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", async () => {
  await fetch(API + "/logout", { method: "POST", headers: { Authorization: "Bearer " + session.token }});
  localStorage.removeItem("session");
  window.location.href = "/";
});

const nameEl = document.getElementById("name");
const descEl = document.getElementById("description");
const priceEl = document.getElementById("price");
const catEl = document.getElementById("category");
const fileEl = document.getElementById("imageFile");
const preview = document.getElementById("preview");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const productsContainer = document.getElementById("products");
const searchEl = document.getElementById("search");
const filterEl = document.getElementById("filterCategory");
const refreshBtn = document.getElementById("refreshBtn");
const formMsg = document.getElementById("formMsg");
const formTitle = document.getElementById("formTitle");

let products = [];
let editingId = null;
let currentFile = null;

// preview selected file
fileEl.addEventListener("change", () => {
  const f = fileEl.files[0];
  if (!f) { preview.style.display = "none"; preview.src = ""; currentFile = null; return; }
  const reader = new FileReader();
  reader.onload = ev => {
    preview.src = ev.target.result;
    preview.style.display = "block";
    currentFile = f;
  };
  reader.readAsDataURL(f);
});

async function loadProducts() {
  try {
    const res = await fetch(API + "/products");
    products = await res.json();
  } catch (e) { console.error(e); products = []; }
}

function categoryStyle(cat) {
  switch (cat) {
    case "Колбаса и сосиски":
      return { class: "category-red", icon: "🥩" };
    case "Вода и напитки":
      return { class: "category-blue", icon: "🥤" };
    case "Сладкое":
      return { class: "category-purple", icon: "🍬" };
    case "Хлеб и выпечка":
      return { class: "category-yellow", icon: "🍞" };
    case "Овощи и фрукты":
      return { class: "category-green", icon: "🥕" };
    default:
      return { class: "category-purple", icon: "🛒" };
  }
}

function renderProducts() {
  const q = (searchEl.value || "").toLowerCase();
  const filterCategory = filterEl.value;
  productsContainer.innerHTML = "";
  const filtered = products.filter(p => {
    if (filterCategory !== "all" && filterCategory !== p.category) return false;
    if (q && !(`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q))) return false;
    return true;
  });

  if (!filtered.length) {
    productsContainer.innerHTML = `<div class="col-span-2 text-gray-500">Товары не найдены</div>`;
    return;
  }

  filtered.forEach(p => {
    const { bg, icon } = categoryStyle(p.category);
    const card = document.createElement("div");
    const catClass = categoryStyle(p.category);
    card.className = "product-card";
card.innerHTML = `
  <img src="${p.image || ''}" alt="${p.name}">
  <div class="product-name">${p.icon || ''} ${p.name}</div>
  <div class="product-category">${p.category}</div>
  <div class="product-desc">${p.description || ''}</div>
  <div class="product-price">${p.price} ₽</div>
  <div class="product-actions">
    ${
      p.ownerId === session.id
        ? `
        <div>
          <button data-edit="${p.id}">Ред.</button>
          <button data-del="${p.id}">Удал.</button>
        </div>`
        : `<div class="text-xs text-gray-300">Создал: ${p.ownerId.slice(0, 6)}...</div>`
    }
  </div>
`;
    productsContainer.appendChild(card);
  });

  // attach edit/delete handlers
  productsContainer.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => startEdit(btn.getAttribute("data-edit")));
  });
  productsContainer.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => deleteProduct(btn.getAttribute("data-del")));
  });
}

async function refresh() {
  await loadProducts();
  renderProducts();
}

async function createOrUpdate() {
  formMsg.textContent = "";
  const name = nameEl.value.trim();
  if (!name) { formMsg.textContent = "Введите название"; return; }
  const price = Number(priceEl.value) || 0;
  const category = catEl.value;
  const description = descEl.value.trim();

  const headers = { Authorization: "Bearer " + session.token };

  if (!editingId) {
    // create
    const fd = new FormData();
    fd.append("name", name);
    fd.append("price", String(price));
    fd.append("category", category);
    fd.append("description", description);
    if (currentFile) fd.append("image", currentFile);

    const res = await fetch(API + "/products", { method: "POST", headers, body: fd });
    if (!res.ok) {
      const data = await res.json();
      formMsg.textContent = data.error || "Ошибка при создании";
      return;
    }
    await refresh();
    resetForm();
  } else {
    // update — use PUT with FormData
    const fd = new FormData();
    fd.append("name", name);
    fd.append("price", String(price));
    fd.append("category", category);
    fd.append("description", description);
    if (currentFile) fd.append("image", currentFile);

    const res = await fetch(API + "/products/" + editingId, { method: "PUT", headers, body: fd });
    if (!res.ok) {
      const data = await res.json();
      formMsg.textContent = data.error || "Ошибка при обновлении";
      return;
    }
    await refresh();
    resetForm();
  }
}

async function startEdit(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (p.ownerId !== session.id) { alert("Вы не можете редактировать этот товар"); return; }
  editingId = id;
  formTitle.textContent = "Редактировать товар";
  nameEl.value = p.name;
  descEl.value = p.description || "";
  priceEl.value = p.price;
  catEl.value = p.category || "Другое";
  if (p.image) { preview.src = p.image; preview.style.display = "block"; } else { preview.style.display = "none"; }
  currentFile = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteProduct(id) {
  if (!confirm("Удалить товар?")) return;
  const res = await fetch(API + "/products/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + session.token }});
  if (!res.ok) {
    const d = await res.json();
    alert(d.error || "Ошибка");
    return;
  }
  await refresh();
}

function resetForm() {
  editingId = null;
  formTitle.textContent = "Добавить товар";
  nameEl.value = "";
  descEl.value = "";
  priceEl.value = "";
  catEl.value = "Колбаса и сосиски";
  fileEl.value = "";
  currentFile = null;
  preview.style.display = "none";
  preview.src = "";
  formMsg.textContent = "";
}

saveBtn.addEventListener("click", createOrUpdate);
resetBtn.addEventListener("click", resetForm);
searchEl.addEventListener("input", renderProducts);
filterEl.addEventListener("change", renderProducts);
refreshBtn.addEventListener("click", refresh);

refresh();
