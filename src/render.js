/**
 * D3 rendering and treemap logic
 */

const Render = {
  /**
   * Calculate AI economic impact metrics
   */
  calcImpact: (sectors) => {
    const ageProfile = window.APP_STATE?.ageProfile || CONFIG.DATA.AGE_PROFILE_FALLBACK;
    const total = sectors.reduce((s, d) => s + d.emp, 0);
    const high = sectors.filter((s) => s.ai >= 7).reduce((s, d) => s + d.emp, 0);
    const mid = sectors
      .filter((s) => s.ai >= 4 && s.ai < 7)
      .reduce((s, d) => s + d.emp, 0);
    const low = sectors.filter((s) => s.ai < 4).reduce((s, d) => s + d.emp, 0);

    // Age-risk and AI balance summaries (heuristics)
    const ageRiskTotals = { '15-24': 0, '25-34': 0, '35-44': 0, '45-54': 0 };
    const balanceTotals = { Szansa: 0, Równowaga: 0, Zagrożenie: 0 };

    sectors.forEach((s) => {
      const ageRisk = Utils.getAgeRiskProfile(s, ageProfile);
      ageRiskTotals[ageRisk.dominantAge] += s.emp;

      const balance = Utils.getAIChanceThreatProfile(s);
      balanceTotals[balance.label] += s.emp;
    });

    const topAgeRisk = Object.entries(ageRiskTotals).sort((a, b) => b[1] - a[1])[0];
    const topBalance = Object.entries(balanceTotals).sort((a, b) => b[1] - a[1])[0];

    // GDP estimates: +1-3% yearly, 5-year horizon, base ~3100 PLN billion
    const gdpBln = 3100;

    // Update cards
    document.getElementById('imp-high').textContent = Utils.formatWorkersShort(high);
    document.getElementById('imp-high-pct').textContent =
      Utils.formatPercent(high, total) + ' siły roboczej';
    document.getElementById('imp-mid').textContent = Utils.formatWorkersShort(mid);
    document.getElementById('imp-mid-pct').textContent =
      Utils.formatPercent(mid, total) + ' siły roboczej';
    document.getElementById('imp-gdp').textContent =
      `+${Math.round(gdpBln * 0.01)}–${Math.round(gdpBln * 0.03)} mld PLN`;

    // FTE calculations (15-25% productivity gain)
    // Note: `emp` is stored in thousands of workers, so result is also in thousands.
    const fLow = Math.round(high * 0.15);
    const fHi = Math.round(high * 0.25);
    document.getElementById('imp-fte').textContent = `${fLow}–${fHi} tys. FTE`;
    document.getElementById('stat-atrisk').textContent =
      Utils.formatWorkersShort(high);

    document.getElementById('imp-age-risk').textContent = topAgeRisk[0];
    document.getElementById('imp-age-risk-sub').textContent =
      `${Utils.formatWorkersFromThousands(topAgeRisk[1])} w sektorach, gdzie ta grupa ma najwyzsze ryzyko (zrodlo wieku: BAEL ${ageProfile.year || '—'})`;

    document.getElementById('imp-balance').textContent = topBalance[0];
    document.getElementById('imp-balance-sub').textContent =
      `Szansa: ${Utils.formatWorkersShort(balanceTotals.Szansa)} · Zagrożenie: ${Utils.formatWorkersShort(balanceTotals.Zagrożenie)} · Równowaga: ${Utils.formatWorkersShort(balanceTotals.Równowaga)}`;

    // Distribution bar
    const bar = document.getElementById('dist-bar');
    bar.innerHTML = '';
    const segments = [
      { val: low, p: (low / total) * 100, c: '#4ade80', l: 'Niska' },
      { val: mid, p: (mid / total) * 100, c: '#f5a623', l: 'Umiarkowana' },
      { val: high, p: (high / total) * 100, c: '#f87171', l: 'Wysoka' },
    ];

    segments.forEach((seg) => {
      const div = document.createElement('div');
      div.className = 'dist-seg';
      div.style.cssText = `flex: ${seg.p}; background: ${seg.c}`;
      div.title = `${seg.l}: ${Utils.formatWorkersFromThousands(seg.val)} (${Utils.formatPercent(seg.val, total)})`;
      div.innerHTML = `<span>${seg.p > 8 ? Math.round(seg.p) + '%' : ''}</span>`;
      bar.appendChild(div);
    });

    // Insights
    const topAI = [...sectors]
      .filter((s) => s.ai >= 7)
      .sort((a, b) => b.emp - a.emp)[0];
    const topGrowthHighAI = [...sectors]
      .filter((s) => s.ai >= 6)
      .sort((a, b) => b.outlook - a.outlook)[0];

    document.getElementById('insight-1').innerHTML = `
      <strong>Największy sektor wysokiej ekspozycji:</strong>
      Sekcja <span class="hi">${topAI?.code}</span>
      (${topAI?.name.replace(/\n/g, ' ')}) — <span class="hi">${Utils.formatWorkersFromThousands(topAI?.emp || 0)}</span>
      przy ocenie AI <span class="hi">${topAI?.ai}/10</span>.
      Praca niemal w całości cyfrowa — największe pole do transformacji przez generatywne AI.
      <br><br>
      <strong>Metodologia:</strong> Ocena AI wg Karpathy — LLM szacuje, jak bardzo praca jest fundamentalnie cyfrowa.
      Score ≥ 7 oznacza wykonywanie pracy w całości lub w dominującej części na komputerze.
    `;

    document.getElementById('insight-2').innerHTML = `
      <strong>Paradoks: wzrost + wysoka ekspozycja AI:</strong>
      Sekcja <span class="hi">${topGrowthHighAI?.code}</span>
      (${topGrowthHighAI?.name.replace(/\n/g, ' ')}) —
      trend <span class="hi">+${topGrowthHighAI?.outlook}%</span> przy AI ${topGrowthHighAI?.ai}/10.
      Wysoka ekspozycja na AI nie musi oznaczać spadku zatrudnienia —
      wzrost produktywności może generować <em>więcej</em> popytu na daną pracę.
      <br><br>
      <strong>Wiek a ryzyko (heurystyka):</strong> Najczęściej zagrożona grupa to
      <span class="hi">${topAgeRisk[0]}</span> obejmująca około <span class="hi">${Utils.formatWorkersFromThousands(topAgeRisk[1])}</span>
      w sektorach o najwyższej presji transformacyjnej AI.
      Wagi wieku pochodza z oficjalnej tablicy GUS BAEL P3978 (rok: ${ageProfile.year || '—'}).
      <br><br>
      <strong>Gdzie AI jest szansą, a gdzie zagrożeniem:</strong>
      Szansa: <span class="hi">${Utils.formatWorkersShort(balanceTotals.Szansa)}</span>,
      Zagrożenie: <span class="hi">${Utils.formatWorkersShort(balanceTotals.Zagrożenie)}</span>,
      Równowaga: <span class="hi">${Utils.formatWorkersShort(balanceTotals.Równowaga)}</span>.
      <br><br>
      <strong>Szacunek PKB</strong> ma charakter scenariusza, nie prognozy punktowej.
      Kwota <span class="hi">+31–93 mld PLN</span> wynika z zalozenia +1–3% wobec bazy PKB ~3 100 mld PLN (GUS 2023).
      W literaturze globalnej (McKinsey) najczesciej raportowany jest wzrost produktywnosci
      rzedu +0,5 do +3,4 pp rocznie (w tym sam genAI: +0,1 do +0,6 pp), zaleznie od tempa adopcji.
    `;
  },

  /**
   * Render D3 treemap
   */
  render: (sectors, currentLayer = 'outlook') => {
        const shortTileLabel = (code, rawName) => {
          const map = {
            A: 'Rolnictwo',
            B: 'Gornictwo',
            C: 'Przemysl',
            D: 'Energetyka',
            E: 'Woda/odpady',
            F: 'Budownictwo',
            G: 'Handel',
            H: 'Transport',
            I: 'Gastro/hotel',
            J: 'IT',
            K: 'Finanse',
            L: 'Nieruchomosci',
            M: 'Profesjonalne',
            N: 'Administracyjne',
            O: 'Administracja',
            P: 'Edukacja',
            Q: 'Zdrowie',
            R: 'Kultura',
            S: 'Pozostale',
          };

          if (map[code]) return map[code];
          const firstWord = String(rawName || '').replace(/\n/g, ' ').trim().split(' ')[0] || '';
          return firstWord;
        };

    const width = document.getElementById('chart').offsetWidth;
    const height = 500;

    // Keep deterministic layout: sectors ordered alphabetically (A-S).
    const sortedSectors = [...sectors].sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''), 'pl')
    );

    // Prepare hierarchy data
    const root = d3
      .hierarchy({ children: sortedSectors })
      .sum((d) => d.emp);

    // Create treemap layout
    const treemap = d3.treemap().size([width, height]).paddingTop(0).paddingRight(0).paddingBottom(0).paddingLeft(0);
    treemap(root);

    // Bind SVG
    let svg = d3.select('#chart svg');
    if (svg.empty()) {
      svg = d3
        .select('#chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    }

    svg.attr('width', width).attr('height', height);

    // Bind data
    const tiles = svg
      .selectAll('.tile')
      .data(root.leaves(), (d) => d.data.code);

    // Remove old
    tiles.exit().remove();

    // Enter + Update
    const tileGroup = tiles
      .enter()
      .append('g')
      .attr('class', 'tile')
      .merge(tiles)
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    tileGroup
      .selectAll('rect')
      .data((d) => [d])
      .join('rect')
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0)
      .attr('fill', (d) => {
        const layer = CONFIG.LAYERS[currentLayer];
        return layer?.colorFn({ data: d.data }) || '#666';
      });

    // Always-visible labels: section code + category name
    tileGroup
      .selectAll('text.tile-label-code')
      .data((d) => [d])
      .join('text')
      .attr('class', 'tile-label-code')
      .attr('x', 8)
      .attr('y', 18)
      .text((d) => d.data.code || '')
      .attr('fill', 'rgba(255,255,255,0.96)')
      .style('font-family', 'var(--fm)')
      .style('font-size', (d) => ((d.x1 - d.x0) > 90 ? '12px' : '10px'))
      .style('font-weight', '700')
      .style('pointer-events', 'none');

    tileGroup
      .selectAll('text.tile-label-name')
      .data((d) => [d])
      .join('text')
      .attr('class', 'tile-label-name')
      .attr('x', 8)
      .attr('y', 34)
      .attr('fill', 'rgba(255,255,255,0.92)')
      .style('font-family', 'var(--fb)')
      .style('font-size', (d) => ((d.x1 - d.x0) > 110 ? '11px' : '9px'))
      .style('font-weight', '600')
      .style('pointer-events', 'none')
      .each(function (d) {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        const raw = (d.data.name || '').replace(/\n/g, ' ');
        const maxChars = Math.max(8, Math.floor((width - 16) / 6.2));
        const text = raw.length > maxChars ? raw.slice(0, maxChars - 1) + '…' : raw;
        const tiny = width < 70 || height < 45;
        const sel = d3.select(this);

        // On tiny tiles show compact category label so sectors like B and D stay readable.
        if (tiny) {
          const short = shortTileLabel(d.data.code, d.data.name);
          const canShowTiny = width >= 34 && height >= 24;
          sel
            .attr('y', Math.max(20, Math.min(height - 6, 30)))
            .style('font-size', '8px')
            .text(canShowTiny ? short : '');
          return;
        }

        sel
          .attr('y', 34)
          .style('font-size', width > 110 ? '11px' : '9px')
          .text(text);
      });

    // Interactivity
    tileGroup
      .on('mouseenter', (event, d) => {
        const tt = document.getElementById('tt');
        tt.innerHTML = Utils.createTooltip({ data: d.data }, currentLayer);
        tt.style.display = 'block';
      })
      .on('mousemove', (event) => {
        const tt = document.getElementById('tt');
        const margin = 10;
        const offset = 12;

        // Tooltip uses position: fixed, so use viewport-relative coordinates.
        let left = event.clientX + offset;
        let top = event.clientY + offset;

        const ttW = tt.offsetWidth || 260;
        const ttH = tt.offsetHeight || 140;

        if (left + ttW > window.innerWidth - margin) {
          left = Math.max(margin, event.clientX - ttW - offset);
        }
        if (top + ttH > window.innerHeight - margin) {
          top = Math.max(margin, event.clientY - ttH - offset);
        }

        tt.style.left = `${left}px`;
        tt.style.top = `${top}px`;
      })
      .on('mouseleave', () => {
        document.getElementById('tt').style.display = 'none';
      })
      .on('touchstart', (event, d) => {
        const touch = event.touches && event.touches[0];
        if (!touch) return;

        const tt = document.getElementById('tt');
        tt.innerHTML = Utils.createTooltip({ data: d.data }, currentLayer);
        tt.style.display = 'block';

        const margin = 10;
        const offset = 12;
        let left = touch.clientX + offset;
        let top = touch.clientY + offset;

        const ttW = tt.offsetWidth || 260;
        const ttH = tt.offsetHeight || 140;

        if (left + ttW > window.innerWidth - margin) {
          left = Math.max(margin, touch.clientX - ttW - offset);
        }
        if (top + ttH > window.innerHeight - margin) {
          top = Math.max(margin, touch.clientY - ttH - offset);
        }

        tt.style.left = `${left}px`;
        tt.style.top = `${top}px`;

        clearTimeout(window.__ttHideTimer);
        window.__ttHideTimer = setTimeout(() => {
          tt.style.display = 'none';
        }, 2200);
      });
  },

  /**
   * Render legend
   */
  renderLegend: (layer = 'outlook') => {
    const config = CONFIG.LAYERS[layer];
    const legend = document.getElementById('legend');
    const desc = document.getElementById('layer-desc');

    legend.innerHTML = '';
    desc.textContent = config.desc;

    if (config.type === 'items' && config.legendItems) {
      config.legendItems.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `<div class="lsw" style="background: ${item.c}"></div><span>${item.l}</span>`;
        legend.appendChild(div);
      });
    } else if (config.type === 'gradient') {
      const div = document.createElement('div');
      div.className = 'legend-item';
      div.style.gap = '16px';
      div.innerHTML = `
        <div style="min-width: 120px; height: 16px; background: linear-gradient(to right, ${config.min}, ${config.max}); border-radius: 2px;"></div>
        <span style="font-size: 10px;">${config.unitL}</span>
        <span style="font-size: 10px;">—</span>
        <span style="font-size: 10px;">${config.unitR}</span>
      `;
      legend.appendChild(div);
    }
  },
};
