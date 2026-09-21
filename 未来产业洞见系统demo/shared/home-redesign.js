(() => {
  "use strict";

  const NAV_COPY = {
    technology: {
      title: "技术演进洞察",
      copy: "追踪全球技术竞争格局与知识流动脉络，解析引文网络、关键技术路径及国家年度演进趋势，洞悉技术迭代方向与创新范式变迁。"
    },
    industry: {
      title: "全球版图洞察",
      copy: "构建产业三维动态对比体系，透视全球与中国区域产业版图，开展技术与产业竞争对标，识别区域产业优势与创新高地。"
    },
    enterprise: {
      title: "企业竞争画像",
      copy: "聚焦企业产业链定位与战略分群，构建多维技术画像，关联核心技术、创新能力与代表性专利族，精准刻画企业竞争位势。"
    },
    frontier: {
      title: "前沿技术雷达",
      copy: "识别前沿技术路线与关键演进方向，捕捉技术趋势与早期动量信号，前瞻发现潜在颠覆性创新机会。"
    }
  };

  const nav = document.getElementById("futureNav");
  const bubble = document.getElementById("futureNavBubble");
  const bubbleTitle = document.getElementById("futureNavBubbleTitle");
  const bubbleCopy = document.getElementById("futureNavBubbleCopy");
  let bubbleTimer = 0;

  const showBubble = view => {
    const content = NAV_COPY[view];
    if (!content || !bubble) return;
    clearTimeout(bubbleTimer);
    bubbleTitle.textContent = content.title;
    bubbleCopy.textContent = content.copy;
    bubble.classList.add("is-visible");
    bubble.setAttribute("aria-hidden", "false");
  };

  const hideBubble = () => {
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => {
      bubble?.classList.remove("is-visible");
      bubble?.setAttribute("aria-hidden", "true");
    }, 90);
  };

  nav?.querySelectorAll("[data-home-view]").forEach(link => {
    const view = link.dataset.homeView;
    link.addEventListener("mouseenter", () => showBubble(view));
    link.addEventListener("focus", () => showBubble(view));
    link.addEventListener("mouseleave", hideBubble);
    link.addEventListener("blur", hideBubble);
    link.addEventListener("click", event => {
      if (window.parent === window) return;
      event.preventDefault();
      window.parent.postMessage({ type: "fusion:navigate", view }, "*");
    });
  });

  const stage = document.getElementById("futureSectorStage");
  const cards = [...document.querySelectorAll(".future-sector-card")];
  const current = document.getElementById("futureSectorCurrent");
  let selected = Math.max(0, cards.findIndex(card => card.dataset.sector === "可控核聚变"));
  let pointerStart = null;
  let wheelLock = 0;

  const wrappedDelta = index => {
    let delta = index - selected;
    const half = cards.length / 2;
    if (delta > half) delta -= cards.length;
    if (delta < -half) delta += cards.length;
    return delta;
  };

  const selectSector = index => {
    selected = (index + cards.length) % cards.length;
    const step = Math.min(248, Math.max(172, (stage?.clientWidth || 1100) * .185));
    cards.forEach((card, cardIndex) => {
      const delta = wrappedDelta(cardIndex);
      const depth = Math.abs(delta);
      const x = delta * step;
      const y = depth === 0 ? -8 : 7 + Math.min(depth, 4) * 5;
      const z = depth === 0 ? 36 : -Math.min(depth, 4) * 132;
      const scale = depth === 0 ? 1.04 : depth === 1 ? .88 : depth === 2 ? .73 : depth === 3 ? .6 : .48;
      const edgeScale = depth >= 4 ? .62 : depth === 3 ? .82 : 1;
      const opacity = depth === 0 ? 1 : depth === 1 ? .82 : depth === 2 ? .5 : depth === 3 ? .22 : .06;
      const blur = depth === 0 ? 0 : depth === 1 ? .15 : depth === 2 ? .9 : depth === 3 ? 2.3 : 4;
      card.style.zIndex = String(20 - depth);
      card.style.opacity = String(opacity);
      card.style.filter = `blur(${blur}px)`;
      card.style.pointerEvents = depth > 3 ? "none" : "auto";
      card.style.transform = `translate3d(calc(-50% + ${x}px), ${y}px, ${z}px) rotateY(${delta * -7}deg) scale(${scale}) scaleX(${edgeScale})`;
      const active = cardIndex === selected;
      card.setAttribute("aria-pressed", String(active));
      card.tabIndex = active || depth <= 2 ? 0 : -1;
    });
    const activeCard = cards[selected];
    current.textContent = activeCard?.dataset.sector || "";
  };

  cards.forEach((card, index) => card.addEventListener("click", () => selectSector(index)));

  stage?.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") { event.preventDefault(); selectSector(selected - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); selectSector(selected + 1); }
    if (event.key === "Home") { event.preventDefault(); selectSector(0); }
    if (event.key === "End") { event.preventDefault(); selectSector(cards.length - 1); }
  });

  stage?.addEventListener("wheel", event => {
    const now = performance.now();
    if (now < wheelLock) return;
    if (Math.abs(event.deltaX) < 4 && Math.abs(event.deltaY) < 4) return;
    event.preventDefault();
    selectSector(selected + (event.deltaX + event.deltaY > 0 ? 1 : -1));
    wheelLock = now + 340;
  }, { passive: false });

  stage?.addEventListener("pointerdown", event => {
    pointerStart = { x: event.clientX, id: event.pointerId };
    stage.setPointerCapture?.(event.pointerId);
  });

  stage?.addEventListener("pointerup", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const distance = event.clientX - pointerStart.x;
    if (Math.abs(distance) > 52) selectSector(selected + (distance < 0 ? 1 : -1));
    pointerStart = null;
  });

  stage?.addEventListener("pointercancel", () => { pointerStart = null; });
  window.addEventListener("resize", () => selectSector(selected), { passive: true });
  selectSector(selected);
})();
