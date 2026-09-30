/* Digital Replica Day — fiscal-cycle simulation of the visual company.
 *
 * Mirrors the time-use visualisation grammar (1000 dots, rim activity zones,
 * bar chart of concentration, ranking list, click-to-treemap of detail) but
 * rebinds every concept to the PCO operating model:
 *
 *   dot          → one transaction / unit of work flowing through the company
 *   rim zone     → one of the eight departments
 *   time clock   → the fiscal cycle (Day 1 → Day 30)
 *   bar chart    → concentration of money/activity by department
 *   ranking      → busiest departments in the current tick
 *   treemap      → audit trail of a single transaction (who / what / where / why / risk)
 *
 * The simulation runs on D3 v7, vendored at assets/d3/d3.v7.min.js.
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
  // These mirror a real company's cash + work flow, derived from the eight-dept atlas:
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

      // Distribute the start day across the 30-day fiscal cycle (skewed mid-month for invoices)
      let startDay;
      const skew = rng();
      if (tplKey === "recurring_bill" || tplKey === "payroll") {
        startDay = Math.floor(rng() * 30);          // bills + payroll spread evenly
      } else if (tplKey === "inventory_sale") {
        startDay = Math.floor(skew * skew * 30);    // back-loaded to month-end
      } else {
        startDay = Math.floor(rng() * 30);
      }

      // Each step takes 0.5–3 days
      const steps = flow.map((dept, idx) => {
        const duration = Math.max(1, Math.round((0.5 + rng() * 2.5) * 2)) / 2; // half-day units
        return {
          dept,
          duration,
          startOffset: idx === 0 ? 0 : null // filled below
        };
      });
      let running = startDay;
      for (let k = 0; k < steps.length; k++) {
        steps[k].startOffset = running;
        running += steps[k].duration;
      }
      const finishOffset = steps[steps.length - 1].startOffset + steps[steps.length - 1].duration;
      const totalDays = finishOffset - startDay;

      // Value in $ (illustrative; clearly labelled in UI as illustrative)
      const value = Math.round(50 + Math.pow(rng(), 2) * 9500); // long tail of small + few large

      // Risk class — amber if stuck, red if escalation, lime if cleared
      const stuckRoll = rng();
      const riskClass = stuckRoll < 0.06 ? "red"   // escalation
                      : stuckRoll < 0.20 ? "amber" // pending / stuck
                      : "lime";                   // cleared

      txs.push({
        index: i,
        template: tplKey,
        flow,
        steps,
        startDay,
        finishOffset,
        value,
        riskClass,
        // Treemap payload — built once for click-into-detail
        audit: buildAudit(tplKey, value, riskClass, steps, rng)
      });
    }
    return txs;
  }

  function buildAudit(tplKey, value, riskClass, steps, rng) {
    // The treemap shows how a single transaction's value/time is split across departments
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
  let currDay = 0;     // 0..29
  let pause = true;
  let USER_SPEED = "slow"; // slow = 800ms, fast = 60ms per tick
  const SPEEDS = { slow: 800, fast: 60 };

  let width = 760, height = 760;
  let cx0 = width / 2, cy0 = height / 2;
  let rimRadius = 300;

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
    const foci = {};
    DEPTS.forEach((d, i) => {
      const theta = (i / DEPTS.length) * 2 * Math.PI - Math.PI / 2;
      foci[d.code] = {
        x: cx0 + rimRadius * Math.cos(theta),
        y: cy0 + rimRadius * Math.sin(theta),
        theta
      };
    });

    // Centre label
    svg.append("text")
      .attr("class", "sim-centre-label")
      .attr("x", cx0)
      .attr("y", cy0 - 8)
      .attr("text-anchor", "middle")
      .text("VISUALP");
    svg.append("text")
      .attr("class", "sim-centre-sub")
      .attr("x", cx0)
      .attr("y", cy0 + 16)
      .attr("text-anchor", "middle")
      .text("Day 1 → Day 30");

    // Department labels on the rim (name + live %)
    const labelNodes = svg.selectAll("text.sim-dept-label")
      .data(DEPTS)
      .enter().append("text")
      .attr("class", "sim-dept-label")
      .attr("x", d => foci[d.code].x)
      .attr("y", d => foci[d.code].y - 14)
      .attr("text-anchor", "middle");

    labelNodes.append("tspan")
      .attr("class", "sim-dept-name")
      .attr("x", d => foci[d.code].x)
      .text(d => d.short);

    labelNodes.append("tspan")
      .attr("class", "sim-dept-pct")
      .attr("x", d => foci[d.code].x)
      .attr("dy", "1.3em")
      .text(d => "0%");

    // Transaction nodes
    const nodes = TRANSACTIONS.map(t => {
      const firstStep = t.steps[0];
      return {
        tx: t,
        x: foci[firstStep.dept].x + (Math.random() - 0.5) * 8,
        y: foci[firstStep.dept].y + (Math.random() - 0.5) * 8,
        currentDept: firstStep.dept,
        currentStep: 0,
        radius: t.riskClass === "red" ? 4.2 : t.riskClass === "amber" ? 3.6 : 3,
        color: t.riskClass === "red" ? "var(--state-bad)"
             : t.riskClass === "amber" ? "var(--state-warn)"
             : "var(--accent)"
      };
    });

    const sim = d3.forceSimulation(nodes)
      .alphaDecay(0.06)
      .force("collide", d3.forceCollide(d => d.radius + 1.2))
      .on("tick", () => {
        nodeSel
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);
      });

    const nodeSel = svg.append("g")
      .attr("class", "sim-nodes")
      .selectAll("circle")
      .data(nodes)
      .enter().append("circle")
      .attr("class", "sim-dot")
      .attr("r", d => d.radius)
      .attr("fill", d => d.color)
      .attr("stroke", "var(--surface)")
      .attr("stroke-width", 0.6)
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
    tick();
  }

  // ----- Per-day tick ---------------------------------------------------------

  function tick() {
    // For each transaction, advance its step if the current step has finished
    TRANSACTIONS.forEach((t, i) => {
      const node = d3.select(`#sim-chart circle`).nodes()[i]; // not used; we mutate the bound data directly
      const nd = d3.select(`#sim-chart`).selectAll("circle.sim-dot").data()[i];

      const step = t.steps[nd.currentStep];
      const stepEndsAt = step.startOffset + step.duration;
      if (currDay >= stepEndsAt && nd.currentStep < t.steps.length - 1) {
        nd.currentStep += 1;
        nd.currentDept = t.steps[nd.currentStep].dept;
        nd.x = foci[nd.currentDept].x + (Math.random() - 0.5) * 8;
        nd.y = foci[nd.currentDept].y + (Math.random() - 0.5) * 8;
      }
    });

    // Recompute concentration
    DEPTS.forEach(d => { valueByDept[d.code] = 0; countByDept[d.code] = 0; });
    d3.select("#sim-chart").selectAll("circle.sim-dot").data().forEach(nd => {
      const t = nd.tx;
      // Linear interpolation: as the step progresses, accumulate value
      const step = t.steps[nd.currentStep];
      const stepProgress = Math.max(0, Math.min(1, (currDay - step.startOffset) / step.duration));
      valueByDept[nd.currentDept] += t.value * stepProgress;
      countByDept[nd.currentDept] += 1;
    });

    // Update rim labels
    d3.selectAll("text.sim-dept-label").each(function (d) {
      const total = d3.sum(Object.values(valueByDept));
      const pct = total > 0 ? Math.round((valueByDept[d.code] / total) * 100) : 0;
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
      setTimeout(tick, SPEEDS[USER_SPEED]);
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

    // y-axis gridlines
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
      .attr("fill", "var(--accent-soft)")
      .attr("stroke", "var(--accent)")
      .attr("stroke-width", 0.6);

    // y-axis label
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

    d3.select("#sim-bars").selectAll("rect.sim-bar")
      .data(pcts)
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
    // Sort by share desc
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

    wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ----- Controls -------------------------------------------------------------

  function play() {
    pause = false;
    d3.select("#sim-play").style("display", "none");
    d3.select("#sim-pause").style("display", "initial");
    tick();
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
    d3.select("#sim-chart").selectAll("circle.sim-dot").each(function (d) {
      const firstStep = d.tx.steps[0];
      d.currentStep = 0;
      d.currentDept = firstStep.dept;
      d.x = foci[firstStep.dept].x + (Math.random() - 0.5) * 8;
      d.y = foci[firstStep.dept].y + (Math.random() - 0.5) * 8;
    });
    DEPTS.forEach(d => { valueByDept[d.code] = 0; countByDept[d.code] = 0; });
    tick();
  }

  // ----- Boot -----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", build);
})();