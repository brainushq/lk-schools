// lk-schools school picker. Turns <input data-lk-school> into a school search
// box backed by the lk-schools API. Built to public/widget.js and served next
// to the API, so it always talks to the API it was loaded from.
//
//   <input name="school" data-lk-school>
//   <script src="https://lk-schools.brainus.lk/widget.js" defer></script>
//
// Options (data attributes on the input):
//   data-district, data-province, data-type   restrict results
//   data-value="id" | "censusNo"               what the form submits (default "id")
// The form submits the chosen school's value under the input's original name;
// the visible box only shows the school name. On selection the input fires a
// "lk-school-select" event with the full school record in event.detail.

interface School {
  id: string;
  name: string;
  district: string;
  province: string;
  type: string | null;
  censusNo: string | null;
  zone: string | null;
  educationDivision: string | null;
}

interface Options {
  district?: string;
  province?: string;
  type?: string;
  value?: "id" | "censusNo";
  limit?: number;
}

const script = document.currentScript as HTMLScriptElement | null;
const API_BASE = script ? new URL(script.src).origin : "";
const PREFIX = "lks";
let uid = 0;

const STYLES = `
.${PREFIX}-wrap{position:relative;display:inline-block;width:100%}
.${PREFIX}-wrap>input{width:100%;box-sizing:border-box}
.${PREFIX}-list{--lks-bg:#fff;--lks-fg:#1a1a1a;--lks-muted:#6b6b6b;--lks-border:#d9d9d9;--lks-active:#eef3ff;
position:absolute;z-index:2147483000;left:0;right:0;top:calc(100% + 4px);margin:0;padding:4px 0;list-style:none;
background:var(--lks-bg);color:var(--lks-fg);border:1px solid var(--lks-border);border-radius:8px;
box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:320px;overflow-y:auto;font:14px/1.35 system-ui,sans-serif}
@media (prefers-color-scheme:dark){.${PREFIX}-list{--lks-bg:#1f1f1f;--lks-fg:#f2f2f2;--lks-muted:#a3a3a3;--lks-border:#3a3a3a;--lks-active:#2b3550}}
.${PREFIX}-list[hidden]{display:none}
.${PREFIX}-opt{padding:8px 12px;cursor:pointer}
.${PREFIX}-opt[aria-selected=true]{background:var(--lks-active)}
.${PREFIX}-name{display:block;font-weight:500}
.${PREFIX}-meta{display:block;font-size:12px;color:var(--lks-muted)}
.${PREFIX}-empty{padding:8px 12px;color:var(--lks-muted)}
.${PREFIX}-credit{padding:6px 12px 2px;font-size:11px;color:var(--lks-muted);border-top:1px solid var(--lks-border);margin-top:4px}
.${PREFIX}-credit a{color:inherit}
`;

function injectStyles() {
  if (document.getElementById(`${PREFIX}-styles`)) return;
  const style = document.createElement("style");
  style.id = `${PREFIX}-styles`;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function attach(input: HTMLInputElement, options: Options = {}) {
  if (input.dataset.lkSchoolReady) return;
  input.dataset.lkSchoolReady = "1";
  injectStyles();

  const opts: Options = {
    district: input.dataset.district,
    province: input.dataset.province,
    type: input.dataset.type,
    value: input.dataset.value === "censusNo" ? "censusNo" : "id",
    limit: 8,
    ...options,
  };

  // The form submits the hidden field; the visible box only holds the name.
  const hidden = el("input");
  hidden.type = "hidden";
  hidden.name = input.name;
  input.removeAttribute("name");
  input.autocomplete = "off";
  input.placeholder ||= "Search for your school";

  const wrap = el("div", `${PREFIX}-wrap`);
  input.parentNode!.insertBefore(wrap, input);
  wrap.append(input, hidden);

  const listId = `${PREFIX}-list-${++uid}`;
  const list = el("ul", `${PREFIX}-list`);
  list.id = listId;
  list.setAttribute("role", "listbox");
  list.hidden = true;
  wrap.appendChild(list);

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", listId);
  input.setAttribute("aria-expanded", "false");

  const cache = new Map<string, School[]>();
  let results: School[] = [];
  let active = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }

  function setActive(i: number) {
    const items = list.querySelectorAll<HTMLLIElement>(`.${PREFIX}-opt`);
    items.forEach((li, n) => li.setAttribute("aria-selected", String(n === i)));
    active = i;
    if (items[i]) {
      input.setAttribute("aria-activedescendant", items[i].id);
      items[i].scrollIntoView({ block: "nearest" });
    }
  }

  function render(message?: string) {
    list.replaceChildren();
    if (message) {
      list.appendChild(el("li", `${PREFIX}-empty`, message));
    } else {
      results.forEach((school, i) => {
        const li = el("li", `${PREFIX}-opt`);
        li.id = `${listId}-${i}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        const place = [school.educationDivision, school.district].filter(Boolean).join(", ");
        li.append(el("span", `${PREFIX}-name`, school.name), el("span", `${PREFIX}-meta`, place));
        // mousedown, not click, so it fires before the input's blur closes the list
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          select(school);
        });
        li.addEventListener("mousemove", () => active !== i && setActive(i));
        list.appendChild(li);
      });
    }
    const credit = el("li", `${PREFIX}-credit`);
    credit.setAttribute("role", "presentation");
    const link = el("a", undefined, "BrainUs");
    link.href = "https://brainus.lk";
    link.target = "_blank";
    link.rel = "noopener";
    credit.append("Schools data by ", link);
    list.appendChild(credit);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    active = -1;
  }

  function select(school: School) {
    input.value = school.name;
    hidden.value = (opts.value === "censusNo" ? school.censusNo : school.id) ?? school.id;
    close();
    input.dispatchEvent(new CustomEvent("lk-school-select", { detail: school, bubbles: true }));
  }

  async function search(q: string) {
    const params = new URLSearchParams({ q, limit: String(opts.limit) });
    if (opts.district) params.set("district", opts.district);
    if (opts.province) params.set("province", opts.province);
    if (opts.type) params.set("type", opts.type);
    const key = params.toString();

    if (cache.has(key)) {
      results = cache.get(key)!;
      return render(results.length ? undefined : "No schools found");
    }

    controller?.abort();
    controller = new AbortController();
    try {
      const res = await fetch(`${API_BASE}/v1/schools/search?${key}`, { signal: controller.signal });
      if (res.status === 429) return render("Too many searches, try again in a minute");
      if (!res.ok) throw new Error(String(res.status));
      results = (await res.json()).results as School[];
      cache.set(key, results);
      // The user may have kept typing while this was in flight.
      if (input.value.trim() === q) render(results.length ? undefined : "No schools found");
    } catch (err) {
      if ((err as Error).name !== "AbortError") render("Couldn't load schools");
    }
  }

  input.addEventListener("input", () => {
    hidden.value = ""; // typing again invalidates the previous choice
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) return close();
    timer = setTimeout(() => search(q), 200);
  });

  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    const count = results.length;
    if (e.key === "ArrowDown" && count) {
      e.preventDefault();
      setActive((active + 1) % count);
    } else if (e.key === "ArrowUp" && count) {
      e.preventDefault();
      setActive((active - 1 + count) % count);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      select(results[active]);
    } else if (e.key === "Escape") {
      close();
    }
  });

  input.addEventListener("blur", close);
}

function init() {
  document.querySelectorAll<HTMLInputElement>("input[data-lk-school]").forEach((i) => attach(i));
}

(window as unknown as { LkSchools: unknown }).LkSchools = { attach, init };

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
