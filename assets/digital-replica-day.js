/* Digital Replica Day — fiscal-cycle simulation of the visual company.
 *
 * Algorithm ported from ustimeuse/ustimeuse.github.io (MIT, 2016, Wanqi Hu / ATUS).
 * Original: https://github.com/ustimeuse/ustimeuse.github.io — js/oneday.js
 *
 * The reference animates 1000 dots (each = one person's day) around 11 rim
 * activity zones over 1440 minutes, with a bar-chart of concentration, a ranked
 * list, and a click-to-treemap of one person's daily schedule.
 *
 * This file rebinds every concept to the visualp / PCO model:
 *
 *   dot          → one transaction / unit of work flowing through the company
 *   rim zone     → one of the eight departments
 *   time clock   → the fiscal cycle (Day 1 → Day 30)
 *   bar chart    → concentration of money/activity by department
 *   ranking      → busiest departments in the current tick
 *   treemap      → audit trail of a single transaction (who / what / where / why / risk)
 *
 * Core orbit algorithm follows the reference verbatim (tick callback pulls
 * each node toward its current activity focus, then quadtree-resolves
 * collisions). D3 v3 → v7: d3.layout.queue → d3.forceSimulation, d3.scale.ordinal
 * → d3.scaleBand, d3.layout.treemap → d3.treemap, d3.geom.quadtree → d3.quadtree.
 *
 * D3 v7 is vendored at assets/d3/d3.v7.min.js.
 */

(() => {
  "use strict";

  // ----- Department rim ------------------------------------------------------

  const DEPTS = [
    { code: "finance",    short: "Finance",         long: "Finance — where money is static / pending / flowing" },
    { code: "sales",      short: "Sales receipts",  long: "Sales receipts — money in, by channel" },
    { code: "operations", short: "Operations",      long: "Operations — work in progress, cycle time" },
    { code: "supply",     short: "Supply",          long: "Supply — inbound lanes, suppliers, lead time" },
    { code: "people",     short: "People",          long: "People — headcount, cohorts, attrition" },
    { code: "customers",  short: "Customers",       long: "Customers — accounts, retention, concentration" },
    { code: "product",    short: "Product / R&D",   long: "Product / R&D — backlog, shipped, time-to-value" },
    { code: "risk",       short: "Risk / legal",    long: "Risk / legal — exposures, hedges, mitigations" }
  ];

  // Each transaction has a "lifecycle" — a sequence of departments it passes through.
  // Mirrors a real company's cash + work flow, derived from the eight-dept atlas:
  //   finance is touched by every flow (settlement)
  //   most transactions begin in supply/sales and end in finance/operations
  //   risk touches a fraction (hedged flows)
  const FLOW_TEMPLATES = {
    inventory_sale:   ["supply", "operations", "customers", "sales", "finance"],
    service_invoice:  ["operations", "customers", "sales", "finance"],
    recurring_bill:   ["operations", "sales", "finance"],
    capex_purchase:   ["supply", "operations", "finance"],
    refund:           ["finance", "sales", "customers", "operations"],
    payroll:          ["people", "finance"],
    hedge_settle:     ["risk", "finance"],
    new_product:      ["product", "operations", "customers", "finance"]
  };

  const TEMPLATE_KEYS = Object.keys(FLOW_TEMPLATES);

  // 1000 transactions, deterministic so the visual is reproducible.
  function seededRand(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
  }

  function generateTransactions() {
    const rng = seededRand(20260930);
    const txs = [];
    for (let i = 0; i < 1000; i++) {
      const tplKey = TEMPLATE_KEYS[Math.floor(rng() * TEMPLATE_KEYS.length)];
      const flow = FLOW_TEMPLATES[tplKey];

      // Distribute the start day across the 30-day fiscal cycle
      let startDay;
      if (tplKey === "inventory_sale") {
        startDay = Math.floor(rng() * rng() * 30);   // back-loaded to month-end
      } else {
        startDay = Math.floor(rng() * 30);
      }

      // Each step takes 0.5–3 days (half-day units)
      const steps = flow.map((dept, idx) => {
        const duration = Math.max(1, Math.round((0.5 + rng() * 2.5) * 2)) / 2;
        return { dept, duration, startOffset: idx === 0 ? 0 : null };
      });
      let running = startDay;
      for (let k = 0; k < steps.length; k++) {
        steps[k].startOffset = running;
        running += steps[k].duration;
      }
      const finishOffset = steps[steps.length - 1].startOffset + steps[steps.length - 1].duration;

      // Value in $ (illustrative; clearly labelled in UI as illustrative)
      const value = Math.round(50 + Math.pow(rng(), 2) * 9500);

      // Risk class — amber if stuck, red if escalation, lime if cleared
      const stuckRoll = rng();
      const riskClass = stuckRoll < 0.06 ? "red"
                      : stuckRoll < 0.20 ? "amber"
                      : "lime";

      txs.push({
        index: i,
        template: tplKey,
        flow,
        steps,
        startDay,
        finishOffset,
        value,
        riskClass,
        audit: buildAudit(tplKey, value, riskClass, steps, rng)
      });
    }
    return txs;
  }

  function buildAudit(tplKey, value, riskClass, steps, rng) {
    // The treemap shows how a single transaction's value is split across departments
    const split = {};
    let remaining = value;
    steps.forEach((s, idx) => {
      const isLast = idx === steps.length - 1;
      const portion = isLast ? remaining : Math.round(remaining * (0.15 + rng() * 0.25));
      split[s.dept] = (split[s.dept] || 0) + portion;
      remaining -= portion;
    });
    if (remaining > 0) split[steps[steps.length - 1].dept] += remaining;
    return {
      kind: tplKey,
      value,
      riskClass,
      durationDays: steps.reduce((a, s) => a + s.duration, 0),
      deptShares: split
    };
  }

  // ----- State ---------------------------------------------------------------

  let TRANSACTIONS = [];
  let NODES = [];          // d3-bound node objects (with x/y/act)
  let FOCI = [];            // [{code, x, y}] for each department
  let sim = null;          // d3.forceSimulation instance (hoisted from inside build())
  let currDay = 0;        // 0..29
  let pause = true;
  let USER_SPEED = "slow";
  const SPEEDS = { slow: 800, fast: 60 };

  let width = 760, height = 760;
  let cx0 = width / 2, cy0 = height / 2;
  let rimRadius = 300;
  let maxRadius = 3;
  let padding = 1;

  // Concentration of value by department at the current day
  const valueByDept = Object.fromEntries(DEPTS.map(d => [d.code, 0]));
  // Count of active transactions touching each department at the current day
  const countByDept = Object.fromEntries(DEPTS.map(d => [d.code, 0]));

  // ----- Build the simulation -------------------------------------------------

  function build() {
    TRANSACTIONS = generateTransactions();

    const container = d3.select("#sim-chart").node().getBoundingClientRect();
    width = Math.max(640, container.width);
    height = Math.min(width, 760);
    cx0 = width / 2;
    cy0 = height / 2;
    rimRadius = Math.min(width, height) * 0.40;

    const svg = d3.select("#sim-chart").append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "auto")
      .style("display", "block");

    // Department foci on the rim (8 zones, evenly spaced)
    FOCI = DEPTS.map((d, i) => {
      const theta = (i / DEPTS.length) * 2 * Math.PI - Math.PI / 2;
      return {
        code: d.code,
        x: cx0 + rimRadius * Math.cos(theta),
        y: cy0 + rimRadius * Math.sin(theta),
        theta
      };
    });

    // Centre label
    svg.append("text")
      .attr("class", "sim-centre-label")
      .attr("x", cx0).attr("y", cy0 - 8)
      .attr("text-anchor", "middle")
      .text("VISUALP");
    svg.append("text")
      .attr("class", "sim-centre-sub")
      .attr("x", cx0).attr("y", cy0 + 16)
      .attr("text-anchor", "middle")
      .text("Day 1 → Day 30");

    // Department labels on the rim (name + live %)
    const labelNodes = svg.selectAll("text.sim-dept-label")
      .data(DEPTS)
      .enter().append("text")
      .attr("class", "sim-dept-label")
      .attr("x", d => FOCI.find(f => f.code === d.code).x)
      .attr("y", d => FOCI.find(f => f.code === d.code).y - 14)
      .attr("text-anchor", "middle");

    labelNodes.append("tspan")
      .attr("class", "sim-dept-name")
      .attr("x", d => FOCI.find(f => f.code === d.code).x)
      .text(d => d.short);

    labelNodes.append("tspan")
      .attr("class", "sim-dept-pct")
      .attr("x", d => FOCI.find(f => f.code === d.code).x)
      .attr("dy", "1.3em")
      .text(() => "0%");

    // Transaction nodes — placed at the rim focus of their first step (matches reference).
    // Each node gets a stable random offset (offsetX/offsetY) so dots form a small cloud
    // around each dept focus instead of all collapsing to the same pixel.
    NODES = TRANSACTIONS.map(t => {
      const firstStep = t.steps[0];
      const focus = FOCI.find(f => f.code === firstStep.dept);
      // Distribute offset on a ring of radius 8–18 px around the focus,
      // so the cloud spreads but stays clearly inside the dept zone.
      const ringR = 8 + Math.random() * 10;
      const ringA = Math.random() * Math.PI * 2;
      return {
        tx: t,
        act: firstStep.dept,
        currentStep: 0,
        nextMoveDay: firstStep.startOffset + firstStep.duration,
        radius: t.riskClass === "red" ? 5 : t.riskClass === "amber" ? 4.5 : 4,
        offsetX: ringR * Math.cos(ringA),
        offsetY: ringR * Math.sin(ringA),
        x: focus.x + ringR * Math.cos(ringA),
        y: focus.y + ringR * Math.sin(ringA),
        color: t.riskClass === "red" ? "var(--state-bad-fill)"
             : t.riskClass === "amber" ? "var(--state-warn-fill)"
             : "var(--accent-deep)"
      };
    });

    // d3 force simulation — runs the same custom tick as the reference:
    // pull each node toward its current focus, then quadtree-resolve collisions.
    // No built-in forces (gravity/charge/collide) so the rim pull in simTick is
    // the only positional force. This matches oneday.js lines 228–236 exactly.
    sim = d3.forceSimulation(NODES)
      .alphaDecay(0.05)
      .alphaMin(0.001)
      .velocityDecay(0)
      .on("tick", simTick);

    // Circles
    const circle = svg.append("g")
      .attr("class", "sim-nodes")
      .selectAll("circle")
      .data(NODES)
      .enter().append("circle")
      .attr("class", "sim-dot")
      .attr("r", d => d.radius)
      .attr("fill", d => d.color)
      .attr("stroke", "var(--surface)")
      .attr("stroke-width", 0.6)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .on("click", (event, d) => {
        event.stopPropagation();
        showTreemap(d.tx);
      })
      .on("mouseenter", function (event, d) {
        showTooltip(event, `${d.tx.template.replace(/_/g, " ")} · $${d.tx.value.toLocaleString()} · ${d.tx.riskClass}`);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

    // Bar chart panel
    buildBars();

    // Wire controls
    d3.select("#sim-play").on("click", play);
    d3.select("#sim-pause").on("click", pauseSim);
    d3.select("#sim-reset").on("click", reset);
    d3.selectAll(".sim-toggle").on("click", function () {
      const v = this.getAttribute("data-val");
      USER_SPEED = v;
      d3.selectAll(".sim-toggle").classed("current", function () {
        return this.getAttribute("data-val") === v;
      });
    });

    // Run one tick at day 0 so the page isn't empty on load
    dayTick();

    // Autostart when #autoplay is in the URL hash, or ?autoplay=1 in the query
    // (used for headless visual checks and quick page-load demos).
    const usp = new URLSearchParams(window.location.search);
    if (window.location.hash === "#autoplay" || usp.get("autoplay") === "1") {
      setTimeout(play, 200);
    }
  }

  // ----- Simulation tick (rim orbit + collide) --------------------------------

  function simTick(e) {
    // Port of oneday.js tick() (lines 478–506): pull each node toward its
    // current activity focus + per-node offset, then resolve collisions.
    // The reference uses k = 0.04 * e.alpha, which gives fast early motion
    // then slow settle — leaves room for collide() to spread nodes around
    // the focus. We adopt the same pattern.
    const k = 0.04 * (e && e.alpha != null ? e.alpha : 1);
    for (let i = 0; i < NODES.length; i++) {
      const o = NODES[i];
      const focus = FOCI.find(f => f.code === o.act);
      if (!focus) continue;
      const targetX = focus.x + o.offsetX;
      const targetY = focus.y + o.offsetY;
      // Damper — heavier nodes (red) move slower so risk clusters stay anchored
      const damper = o.tx.riskClass === "red" ? 0.7 : 1;
      o.x += (targetX - o.x) * k * damper;
      o.y += (targetY - o.y) * k * damper;
    }
    collide(NODES, 0.5);
    d3.select("#sim-chart").selectAll("circle.sim-dot")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);
  }

  // Port of oneday.js collide() — quadtree-based collision resolution.
  // d3.geom.quadtree → d3.quadtree (v3 → v7 API change).
  function collide(nodes, alpha) {
    const maxR = maxRadius;
    const quadtree = d3.quadtree()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(nodes);
    for (const d of nodes) {
      const r = d.radius + maxR + padding;
      const nx1 = d.x - r, nx2 = d.x + r;
      const ny1 = d.y - r, ny2 = d.y + r;
      quadtree.visit((quad, x1, y1, x2, y2) => {
        if (quad.point && quad.point !== d) {
          const qp = quad.point;
          const dx = d.x - qp.x, dy = d.y - qp.y;
          let l = Math.sqrt(dx * dx + dy * dy);
          const minDist = d.radius + qp.radius + (d.act !== qp.act ? padding : 0);
          if (l < minDist && l > 0) {
            const factor = (l - minDist) / l * alpha;
            d.x -= dx * factor;
            d.y -= dy * factor;
            qp.x += dx * factor;
            qp.y += dy * factor;
          }
        }
        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
      });
    }
  }

  // ----- Day tick (advance transactions through their lifecycles) -------------

  function dayTick() {
    // For each transaction, advance its step if the current step has finished.
    // Mirrors oneday.js timer() lines 413–441.
    let stepped = false;
    for (let i = 0; i < NODES.length; i++) {
      const nd = NODES[i];
      if (currDay >= nd.nextMoveDay && nd.currentStep < nd.tx.steps.length - 1) {
        nd.currentStep += 1;
        const step = nd.tx.steps[nd.currentStep];
        nd.act = step.dept;
        nd.nextMoveDay = step.startOffset + step.duration;
        // Snap node to the new dept's rim cloud — matches oneday.js lines 436–437.
        const focus = FOCI.find(f => f.code === nd.act);
        if (focus) {
          nd.x = focus.x + nd.offsetX;
          nd.y = focus.y + nd.offsetY;
        }
        stepped = true;
      }
    }

    // Reheat the simulation so nodes that changed dept actually orbit toward their new focus
    // (matches oneday.js timer() line 443 force.resume()).
    if (stepped && sim) {
      sim.alpha(0.3).restart();
    }

    // Recompute concentration
    for (const d of DEPTS) { valueByDept[d.code] = 0; countByDept[d.code] = 0; }
    for (const nd of NODES) {
      const t = nd.tx;
      const step = t.steps[nd.currentStep];
      const stepProgress = Math.max(0, Math.min(1, (currDay - step.startOffset) / step.duration));
      valueByDept[nd.act] += t.value * stepProgress;
      countByDept[nd.act] += 1;
    }

    // Update rim labels (live %)
    const total = d3.sum(Object.values(valueByDept)) || 1;
    d3.selectAll("text.sim-dept-label").each(function (d) {
      const pct = Math.round((valueByDept[d.code] / total) * 100);
      const sel = d3.select(this);
      sel.select("tspan.sim-dept-name").text(d.short);
      sel.select("tspan.sim-dept-pct").text(`${pct}%`);
    });

    // Update bars + ranking
    updateBarsAndRanking();

    // Update clock
    const dayLabel = currDay >= 29
      ? `Day 30 of 30 · cycle complete`
      : `Day ${Math.min(30, currDay + 1)} of 30`;
    d3.select("#sim-clock").text(dayLabel);

    if (!pause) {
      currDay = (currDay + 1) % 30;
      setTimeout(dayTick, SPEEDS[USER_SPEED]);
    }
  }

  // ----- Bars + ranking -------------------------------------------------------

  function buildBars() {
    const svg2 = d3.select("#sim-bars").append("svg")
      .attr("viewBox", "0 0 320 360")
      .style("width", "100%")
      .style("height", "auto");

    const margin = { top: 10, right: 10, bottom: 70, left: 36 };
    const w = 320 - margin.left - margin.right;
    const h = 360 - margin.top - margin.bottom;

    const g = svg2.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(DEPTS.map(d => d.code))
      .range([0, w])
      .padding(0.18);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([h, 0]);

    g.append("g")
      .attr("class", "sim-bars-axis")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x)
        .tickFormat(code => DEPTS.find(d => d.code === code).short)
        .tickSize(0))
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .attr("text-anchor", "end")
      .attr("dx", "-.4em")
      .attr("dy", ".2em")
      .style("font-family", "var(--font-mono)")
      .style("font-size", "10px")
      .style("fill", "var(--muted)");

    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => d + "%"))
      .selectAll("text")
      .style("font-family", "var(--font-mono)")
      .style("font-size", "10px")
      .style("fill", "var(--muted)");

    g.append("g")
      .attr("class", "sim-bars-grid")
      .selectAll("line")
      .data([25, 50, 75])
      .enter().append("line")
      .attr("x1", 0).attr("x2", w)
      .attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "var(--border)")
      .attr("stroke-dasharray", "2,3");

    g.selectAll("rect.sim-bar")
      .data(DEPTS)
      .enter().append("rect")
      .attr("class", "sim-bar")
      .attr("x", d => x(d.code))
      .attr("width", x.bandwidth())
      .attr("y", h)
      .attr("height", 0)
      .attr("fill", "var(--accent-deep-soft)")
      .attr("stroke", "var(--accent-deep)")
      .attr("stroke-width", 0.6);

    svg2.append("text")
      .attr("transform", `translate(12,${h / 2 + margin.top}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .style("font-family", "var(--font-mono)")
      .style("font-size", "10px")
      .style("fill", "var(--muted)")
      .text("Concentration");
  }

  function updateBarsAndRanking() {
    const total = d3.sum(Object.values(valueByDept)) || 1;
    const pcts = DEPTS.map(d => ({ ...d, pct: (valueByDept[d.code] / total) * 100 }));

    // Set attributes immediately AND start a transition. The transition is the
    // smooth visual; the immediate set ensures headless captures the right
    // value. (requestAnimationFrame doesn't advance under virtual time.)
    d3.select("#sim-bars").selectAll("rect.sim-bar")
      .data(pcts)
      .attr("y", d => 290 * (1 - Math.min(1, d.pct / 30)))
      .attr("height", d => 290 * Math.min(1, d.pct / 30))
      .transition().duration(SPEEDS[USER_SPEED] * 0.7)
      .attr("y", d => 290 * (1 - Math.min(1, d.pct / 30)))
      .attr("height", d => 290 * Math.min(1, d.pct / 30));

    // Ranking
    const ranked = [...pcts].sort((a, b) => b.pct - a.pct);
    const list = document.getElementById("sim-ranking");
    list.innerHTML = "";
    ranked.forEach((d, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="rk-num">${String(i + 1).padStart(2, "0")}</span>
                      <span class="rk-name">${d.short}</span>
                      <span class="rk-pct">${Math.round(d.pct)}%</span>`;
      list.appendChild(li);
    });
  }

  // ----- Tooltip --------------------------------------------------------------

  function showTooltip(event, html) {
    const tt = d3.select("#sim-tooltip");
    tt.style("opacity", 1).html(html);
    moveTooltip(event);
  }
  function moveTooltip(event) {
    const tt = d3.select("#sim-tooltip");
    const pad = 14;
    tt.style("left", (event.clientX + pad) + "px")
      .style("top",  (event.clientY + pad) + "px");
  }
  function hideTooltip() {
    d3.select("#sim-tooltip").style("opacity", 0);
  }

  // ----- Treemap (single-transaction audit) -----------------------------------

  function showTreemap(tx) {
    const wrap = document.getElementById("sim-treemap");
    wrap.innerHTML = "";
    const audit = tx.audit;

    const header = document.createElement("div");
    header.className = "tm-header";
    header.innerHTML = `
      <div class="tm-kind">${audit.kind.replace(/_/g, " ")}</div>
      <div class="tm-meta">$${audit.value.toLocaleString()} · ${audit.durationDays} days · <span class="tm-risk tm-risk-${audit.riskClass}">${audit.riskClass}</span></div>
    `;
    wrap.appendChild(header);

    const total = Object.values(audit.deptShares).reduce((a, b) => a + b, 0) || 1;
    const grid = document.createElement("div");
    grid.className = "tm-grid";
    const entries = Object.entries(audit.deptShares).sort((a, b) => b[1] - a[1]);
    entries.forEach(([code, val]) => {
      const pct = (val / total) * 100;
      const d = DEPTS.find(x => x.code === code);
      const cell = document.createElement("div");
      cell.className = `tm-cell tm-cell-${audit.riskClass}`;
      cell.innerHTML = `
        <div class="tm-cell-name">${d ? d.short : code}</div>
        <div class="tm-cell-val">$${val.toLocaleString()}</div>
        <div class="tm-cell-pct">${Math.round(pct)}%</div>
      `;
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);

    const note = document.createElement("div");
    note.className = "tm-note";
    note.textContent = "Single transaction's audit trail: value split across the departments it touched, in order. Risk class drives cell colour.";
    wrap.appendChild(note);
  }

  // ----- Controls -------------------------------------------------------------

  function play() {
    pause = false;
    d3.select("#sim-play").style("display", "none");
    d3.select("#sim-pause").style("display", "initial");
    dayTick();
  }
  function pauseSim() {
    pause = true;
    d3.select("#sim-play").style("display", "initial");
    d3.select("#sim-pause").style("display", "none");
  }
  function reset() {
    pause = true;
    currDay = 0;
    d3.select("#sim-play").style("display", "initial");
    d3.select("#sim-pause").style("display", "none");
    d3.select("#sim-clock").text("Day 1 of 30");
    // Reset all nodes to first step
    for (const nd of NODES) {
      const firstStep = nd.tx.steps[0];
      nd.currentStep = 0;
      nd.act = firstStep.dept;
      nd.nextMoveDay = firstStep.startOffset + firstStep.duration;
      const focus = FOCI.find(f => f.code === firstStep.dept);
      nd.x = focus.x + (Math.random() - 0.5) * 4;
      nd.y = focus.y + (Math.random() - 0.5) * 4;
    }
    for (const d of DEPTS) { valueByDept[d.code] = 0; countByDept[d.code] = 0; }
    dayTick();
  }

  // ----- Boot -----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", build);
})();