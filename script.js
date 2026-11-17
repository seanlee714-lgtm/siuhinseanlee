(() => {
  document.documentElement.classList.add("js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover)").matches;

  /* ---------- front <-> work ---------- */
  const front = document.getElementById("front"), work = document.getElementById("work");
  function go(view, push = true) {
    const toWork = view === "work";
    document.body.classList.toggle("on-work", toWork);
    work.inert = !toWork; work.setAttribute("aria-hidden", String(!toWork));
    front.inert = toWork; front.setAttribute("aria-hidden", String(toWork));
    if (push) history.replaceState(null, "", toWork ? "#work" : location.pathname);
    if (toWork) stack.focus({ preventScroll: true });
  }
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  // scrolling or swiping down on the front also opens the work
  let wheelSum = 0;
  const atEnd = () => front.scrollTop + front.clientHeight >= front.scrollHeight - 2;
  front.addEventListener("wheel", (e) => { if (!atEnd() || e.deltaY <= 0) { wheelSum = 0; return; } wheelSum += e.deltaY; if (wheelSum > 120) { wheelSum = 0; go("work"); } }, { passive: true });
  let ty0 = null;
  front.addEventListener("touchstart", (e) => { ty0 = e.touches[0].clientY; }, { passive: true });
  front.addEventListener("touchend", (e) => { if (ty0 !== null && atEnd() && ty0 - e.changedTouches[0].clientY > 60) go("work"); ty0 = null; }, { passive: true });

  /* ---------- work: cards that stack up over each other as you scroll ---------- */
  const stack = document.querySelector(".stack");
  const cards = [...stack.querySelectorAll(".card")];
  const headH = () => cards[0].querySelector(".head").offsetHeight;
  const cardTop = (i) => { let y = 0; for (let k = 0; k < i; k++) y += cards[k].offsetHeight; return y - i * headH(); };
  cards.forEach((c, i) => c.querySelector(".head").addEventListener("click", () => {
    stack.scrollTo({ top: Math.max(0, cardTop(i)), behavior: reduce ? "auto" : "smooth" });
  }));
  document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openProject(b.dataset.open)));
  let peek = null;

  /* ---------- projects: full-screen slides ---------- */
  const pauseIn = (root) => root.querySelectorAll("video").forEach((v) => { v.pause(); v.muted = true; });
  document.querySelectorAll(".s").forEach((s) => s.querySelectorAll(".b").forEach((b, i) => b.style.setProperty("--i", i)));

  function openProject(id) {
    const d = document.getElementById(id);
    if (!d) return;
    document.querySelectorAll("dialog[open]").forEach((o) => o.close());
    d.showModal();
    const deck = d.querySelector(".deck"); deck.scrollTop = 0; deck.focus({ preventScroll: true });
    peek?.classList.remove("on");
    history.replaceState(null, "", "#" + id.slice(2));
  }
  document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => openProject(b.dataset.next)));
  document.querySelectorAll("dialog.proj").forEach((d) => {
    d.querySelector(".close").addEventListener("click", () => d.close());
    d.addEventListener("close", () => {
      pauseIn(d); d.querySelectorAll(".reel").forEach(setLabel);
      d.querySelectorAll(".s.in").forEach((s) => s.classList.remove("in"));
      if (!document.querySelector("dialog[open]")) history.replaceState(null, "", document.body.classList.contains("on-work") ? "#work" : location.pathname);
    });
    // any scroll moves exactly one slide (a small flick no longer bounces back)
    const dk = d.querySelector(".deck");
    let acc = 0, lockUntil = 0;
    dk.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      if (now < lockUntil) { acc = 0; return; }
      acc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      if (Math.abs(acc) >= 24) {
        const h = dk.clientHeight, cur = Math.round(dk.scrollTop / h);
        dk.scrollTo({ top: (cur + Math.sign(acc)) * h, behavior: reduce ? "auto" : "smooth" });
        acc = 0; lockUntil = now + 650;
      }
    }, { passive: false });
    // arrow keys step through slides
    d.addEventListener("keydown", (e) => {
      const deck = d.querySelector(".deck");
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); deck.scrollBy({ top: deck.clientHeight, behavior: reduce ? "auto" : "smooth" }); }
      if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); deck.scrollBy({ top: -deck.clientHeight, behavior: reduce ? "auto" : "smooth" }); }
    });
  });

  // a slide builds when it is on screen; videos play only there; counter follows
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const s = e.target, on = e.intersectionRatio > 0.55;
      s.classList.toggle("in", on);
      s.querySelectorAll("video").forEach((v) => { if (on && !reduce) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause(); });
      if (on) {
        const d = s.closest("dialog"), n = [...s.parentNode.children].indexOf(s) + 1;
        d.querySelector(".count .n").textContent = String(n).padStart(2, "0");
      }
    });
  }, { threshold: [0, 0.55, 1] });
  document.querySelectorAll(".s").forEach((s) => io.observe(s));

  // reels: tap for sound, one at a time
  const reels = [...document.querySelectorAll(".reel")];
  function setLabel(r) {
    const muted = r.querySelector("video").muted;
    r.querySelector(".snd").textContent = muted ? "Sound off" : "Sound on";
    r.classList.toggle("on", !muted);
  }
  reels.forEach((r) => {
    const v = r.querySelector("video");
    r.addEventListener("click", () => {
      const willUnmute = v.muted;
      reels.forEach((o) => { if (o !== r) { o.querySelector("video").muted = true; setLabel(o); } });
      v.muted = !willUnmute;
      if (v.paused) v.play().catch(() => {});
      setLabel(r);
    });
  });

  // open straight to a project from a link like #nike
  const hid = "p-" + location.hash.slice(1);
  if (location.hash === "#work") go("work", false);
  else if (location.hash && document.getElementById(hid)) { go("work", false); openProject(hid); }

  // cursor label
  if (fine && !reduce) {
    const cur = document.createElement("div");
    cur.className = "cursor"; cur.setAttribute("aria-hidden", "true");
    document.body.append(cur);
    let x = 0, y = 0, cx = 0, cy = 0;
    addEventListener("pointermove", (e) => {
      x = e.clientX; y = e.clientY;
      const host = document.querySelector("dialog[open]") || document.body;
      if (cur.parentNode !== host) host.append(cur);
      const t = e.target.closest && e.target.closest(".opt, .reel, .close, .next");
      let label = "";
      if (t) {
        if (t.matches(".opt")) label = "Open";
        else if (t.matches(".reel")) label = t.querySelector("video").muted ? "Sound on" : "Sound off";
        else if (t.matches(".close")) label = "Close";
        else label = "Next";
      }
      if (label) cur.textContent = label;
      cur.classList.toggle("on", !!label);
    }, { passive: true });
    (function loop() { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; cur.style.left = cx + "px"; cur.style.top = cy + "px"; requestAnimationFrame(loop); })();
  }
})();
