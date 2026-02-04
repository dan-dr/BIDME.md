(function () {
  "use strict";

  // --- Config: detect owner/repo from URL or query params ---
  var params = new URLSearchParams(window.location.search);
  var owner = params.get("owner") || "";
  var repo = params.get("repo") || "";

  if (!owner || !repo) {
    // Infer from GitHub Pages URL: {owner}.github.io/{repo}/
    var host = window.location.hostname;
    var pathParts = window.location.pathname.split("/").filter(Boolean);
    if (host.endsWith(".github.io")) {
      owner = host.replace(".github.io", "");
      repo = pathParts[0] || "";
    }
  }

  // --- Utility ---
  function formatNumber(n) {
    if (n >= 1000000) {
      var val = n / 1000000;
      return (val % 1 === 0 ? val : parseFloat(val.toFixed(1))) + "M";
    }
    if (n >= 1000) {
      var val = n / 1000;
      return (val % 1 === 0 ? val : parseFloat(val.toFixed(1))) + "k";
    }
    return String(n);
  }

  function $(id) { return document.getElementById(id); }

  function show(id) { $(id).style.display = ""; }
  function hide(id) { $(id).style.display = "none"; }

  // --- Data fetching ---
  function fetchRepoData(owner, repo, path) {
    var url = "https://raw.githubusercontent.com/" +
      encodeURIComponent(owner) + "/" +
      encodeURIComponent(repo) + "/main/" + path;
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  // --- Rendering ---
  function renderAnalytics(data) {
    $("total-views").textContent = formatNumber(data.totalViews || 0);
    $("unique-visitors").textContent = formatNumber(data.uniqueVisitors || 0);

    var clicks = (data.clicks || []).length;
    $("total-clicks").textContent = formatNumber(clicks);

    var ctr = data.totalViews > 0 ? ((clicks / data.totalViews) * 100) : 0;
    $("ctr-value").textContent = ctr.toFixed(1) + "%";

    renderViewsChart(data.dailyViews || []);
    renderCountries(data.countries || {});
    renderPeriodHistory(data.periods || []);
  }

  function renderViewsChart(dailyViews) {
    var container = $("views-chart");
    if (!dailyViews.length) return;

    var recent = dailyViews.slice(-30);
    var max = Math.max.apply(null, recent.map(function (d) { return d.count; }));
    if (max === 0) max = 1;

    var html = "";
    for (var i = 0; i < recent.length; i++) {
      var d = recent[i];
      var pct = (d.count / max) * 100;
      var dateLabel = d.date.slice(5); // MM-DD
      html += '<div class="chart-bar-wrap">' +
        '<div class="chart-bar" style="height:' + pct + '%" data-tooltip="' + d.date + ': ' + d.count + ' views"></div>' +
        '<span class="chart-label">' + dateLabel + '</span>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  function renderCountries(countries) {
    var container = $("countries-list");
    var entries = Object.keys(countries).map(function (k) {
      return { name: k, count: countries[k] };
    }).sort(function (a, b) { return b.count - a.count; });

    if (!entries.length) return;

    var max = entries[0].count || 1;
    var top = entries.slice(0, 10);

    var html = "";
    for (var i = 0; i < top.length; i++) {
      var e = top[i];
      var pct = (e.count / max) * 100;
      html += '<div class="country-row">' +
        '<span>' + escapeHtml(e.name) + '</span>' +
        '<div class="country-bar-bg"><div class="country-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="country-count">' + formatNumber(e.count) + '</span>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  function renderBiddingStatus(period) {
    var container = $("bidding-status");
    if (!period) return;

    var status = "closed";
    var timeRemaining = "";
    if (period.end_date) {
      var end = new Date(period.end_date);
      var now = new Date();
      if (end > now) {
        status = "open";
        var diff = end - now;
        var hours = Math.floor(diff / 3600000);
        var days = Math.floor(hours / 24);
        if (days > 0) {
          timeRemaining = days + "d " + (hours % 24) + "h remaining";
        } else {
          timeRemaining = hours + "h remaining";
        }
      }
    }

    var statusBadge = status === "open"
      ? '<span class="badge badge-success">Open</span>'
      : '<span class="badge badge-danger">Closed</span>';

    var rows = [
      { label: "Status", value: statusBadge },
      { label: "Period", value: period.period_id || "—" },
      { label: "Views", value: formatNumber(period.views || 0) },
      { label: "Clicks", value: formatNumber(period.clicks || 0) },
      { label: "CTR", value: (period.ctr || 0).toFixed(1) + "%" }
    ];

    if (timeRemaining) {
      rows.push({ label: "Time Left", value: '<span class="text-accent">' + timeRemaining + '</span>' });
    }

    var html = "";
    for (var i = 0; i < rows.length; i++) {
      html += '<div class="status-row">' +
        '<span class="status-label">' + rows[i].label + '</span>' +
        '<span class="status-value">' + rows[i].value + '</span>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  function renderPeriodHistory(periods) {
    var container = $("period-history");
    if (!periods.length) return;

    var sorted = periods.slice().sort(function (a, b) {
      return (b.start_date || "").localeCompare(a.start_date || "");
    });

    var html = '<div class="table-wrap"><table>' +
      '<thead><tr><th>Period</th><th>Start</th><th>End</th><th>Views</th><th>Clicks</th><th>CTR</th></tr></thead>' +
      '<tbody>';

    for (var i = 0; i < sorted.length; i++) {
      var p = sorted[i];
      html += '<tr>' +
        '<td class="text-mono">' + escapeHtml(p.period_id) + '</td>' +
        '<td>' + (p.start_date || "—").slice(0, 10) + '</td>' +
        '<td>' + (p.end_date || "—").slice(0, 10) + '</td>' +
        '<td class="text-mono">' + formatNumber(p.views || 0) + '</td>' +
        '<td class="text-mono">' + formatNumber(p.clicks || 0) + '</td>' +
        '<td class="text-mono">' + (p.ctr || 0).toFixed(1) + '%</td>' +
        '</tr>';
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  function renderBanner(period) {
    var container = $("banner-preview");
    if (!period || !period.banner_url) return;

    var dest = period.destination_url || "#";
    var html = '<a href="' + escapeAttr(dest) + '" target="_blank" rel="noopener">' +
      '<img src="' + escapeAttr(period.banner_url) + '" alt="Current Banner">' +
      '</a>' +
      '<div class="mt-1"><a href="' + escapeAttr(dest) + '" target="_blank" rel="noopener" class="text-mono" style="font-size:0.8rem;">Visit advertiser &rarr;</a></div>';
    container.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // --- Init ---
  function init() {
    if (!owner || !repo) {
      hide("loading");
      $("error").textContent = "Could not determine repository. Use ?owner=OWNER&repo=REPO in the URL.";
      show("error");
      $("subtitle").textContent = "Repository not detected";
      return;
    }

    $("subtitle").textContent = owner + "/" + repo;

    var analyticsLoaded = false;
    var periodLoaded = false;
    var analyticsData = null;
    var periodData = null;

    function tryRender() {
      if (!analyticsLoaded || !periodLoaded) return;

      hide("loading");

      if (!analyticsData && !periodData) {
        $("error").textContent = "No analytics data found for this repository.";
        show("error");
        return;
      }

      show("dashboard");

      if (analyticsData) {
        renderAnalytics(analyticsData);
      }

      if (periodData) {
        renderBiddingStatus(periodData);
        renderBanner(periodData);
      } else if (analyticsData && analyticsData.periods && analyticsData.periods.length) {
        renderBiddingStatus(analyticsData.periods[analyticsData.periods.length - 1]);
      }
    }

    fetchRepoData(owner, repo, "data/analytics.json")
      .then(function (data) {
        analyticsData = data;
      })
      .catch(function () {
        analyticsData = null;
      })
      .finally(function () {
        analyticsLoaded = true;
        tryRender();
      });

    fetchRepoData(owner, repo, "data/current-period.json")
      .then(function (data) {
        periodData = data;
      })
      .catch(function () {
        periodData = null;
      })
      .finally(function () {
        periodLoaded = true;
        tryRender();
      });
  }

  init();
})();
