(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var owner = params.get("owner") || "";
  var repo = params.get("repo") || "";

  if (!owner || !repo) {
    var host = window.location.hostname;
    var pathParts = window.location.pathname.split("/").filter(Boolean);
    if (host.endsWith(".github.io")) {
      owner = host.replace(".github.io", "");
      repo = pathParts[0] || "";
    }
  }

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

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function fetchRepoData(owner, repo, path) {
    var url = "https://raw.githubusercontent.com/" +
      encodeURIComponent(owner) + "/" +
      encodeURIComponent(repo) + "/main/" + path;
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function fetchRepoYaml(owner, repo, path) {
    var url = "https://raw.githubusercontent.com/" +
      encodeURIComponent(owner) + "/" +
      encodeURIComponent(repo) + "/main/" + path;
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    });
  }

  function parseSimpleYaml(text) {
    var result = {};
    var currentSection = null;
    var currentList = null;
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === "#") continue;

      if (trimmed.charAt(0) === "-" && currentList !== null) {
        var val = trimmed.slice(1).trim().replace(/^["']|["']$/g, "");
        result[currentList].push(val);
        continue;
      }

      currentList = null;
      var colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;

      var key = trimmed.slice(0, colonIdx).trim();
      var value = trimmed.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");

      if (line.charAt(0) !== " " && line.charAt(0) !== "\t") {
        currentSection = key;
        if (!value) continue;
      }

      var fullKey = currentSection && key !== currentSection ? currentSection + "." + key : key;

      if (!value) {
        result[fullKey] = [];
        currentList = fullKey;
      } else {
        result[fullKey] = value;
      }
    }
    return result;
  }

  function buildReactionUrl(issueNumber, reaction) {
    return "https://github.com/" + encodeURIComponent(owner) + "/" +
      encodeURIComponent(repo) + "/issues/" + issueNumber;
  }

  function buildWorkflowUrl(workflowFile) {
    return "https://github.com/" + encodeURIComponent(owner) + "/" +
      encodeURIComponent(repo) + "/actions/workflows/" + encodeURIComponent(workflowFile);
  }

  function buildIssueUrl(issueNumber) {
    return "https://github.com/" + encodeURIComponent(owner) + "/" +
      encodeURIComponent(repo) + "/issues/" + issueNumber;
  }

  function renderConfig(yamlText) {
    var container = $("config-summary");
    var cfg = parseSimpleYaml(yamlText);

    var rows = [
      { label: "Schedule", value: cfg["bidding.schedule"] || "—" },
      { label: "Bid Duration", value: (cfg["bidding.duration"] || "—") + " days" },
      { label: "Minimum Bid", value: "$" + (cfg["bidding.minimum_bid"] || "0") },
      { label: "Bid Increment", value: "$" + (cfg["bidding.increment"] || "0") },
      { label: "Banner Size", value: (cfg["banner.width"] || "?") + "×" + (cfg["banner.height"] || "?") + "px" },
      { label: "Formats", value: cfg["banner.format"] || "—" },
      { label: "Max File Size", value: (cfg["banner.max_size"] || "?") + " KB" },
      { label: "Position", value: cfg["banner.position"] || "—" },
      { label: "Analytics", value: cfg["analytics.display"] === "true" ? "Enabled" : "Disabled" }
    ];

    var html = "";
    for (var i = 0; i < rows.length; i++) {
      html += '<div class="config-row">' +
        '<span class="config-label">' + escapeHtml(rows[i].label) + '</span>' +
        '<span class="config-value">' + escapeHtml(String(rows[i].value)) + '</span>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  function renderBids(period) {
    var container = $("bids-list");
    if (!period || !period.bids || !period.bids.length) return;

    var sorted = period.bids.slice().sort(function (a, b) {
      return (b.amount || 0) - (a.amount || 0);
    });

    var issueNumber = period.issue_number || null;

    var html = "";
    for (var i = 0; i < sorted.length; i++) {
      var bid = sorted[i];
      var approveUrl = issueNumber
        ? escapeAttr(buildReactionUrl(issueNumber, "+1")) + "#issuecomment-" + (bid.comment_id || "")
        : "#";
      var rejectUrl = issueNumber
        ? escapeAttr(buildReactionUrl(issueNumber, "-1")) + "#issuecomment-" + (bid.comment_id || "")
        : "#";

      html += '<div class="bid-row">' +
        '<div class="bid-info">' +
          '<span class="bid-user">' + escapeHtml(bid.user || "Unknown") + '</span>' +
          ' &mdash; ' +
          '<span class="bid-amount">$' + formatNumber(bid.amount || 0) + '</span>' +
          '<div class="bid-meta">' +
            (bid.banner_url ? 'Banner: <a href="' + escapeAttr(bid.banner_url) + '" target="_blank" rel="noopener">' + escapeHtml(bid.banner_url.split("/").pop() || "view") + '</a>' : 'No banner') +
            (bid.timestamp ? ' &middot; ' + escapeHtml(bid.timestamp.slice(0, 10)) : '') +
          '</div>' +
        '</div>' +
        '<div class="bid-actions">' +
          '<a href="' + approveUrl + '" target="_blank" rel="noopener" class="btn btn-sm btn-approve">Approve</a>' +
          '<a href="' + rejectUrl + '" target="_blank" rel="noopener" class="btn btn-sm btn-reject">Reject</a>' +
        '</div>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  function renderBiddingIssue(period) {
    var container = $("bidding-issue");
    if (!period || !period.issue_number) {
      container.innerHTML = '<span class="text-muted" style="font-size:0.85rem;">No active bidding issue.</span>';
      return;
    }

    var issueUrl = buildIssueUrl(period.issue_number);
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
      { label: "Issue", value: '<a href="' + escapeAttr(issueUrl) + '" target="_blank" rel="noopener">#' + period.issue_number + '</a>' },
      { label: "Status", value: statusBadge },
      { label: "Period", value: escapeHtml(period.period_id || "—") },
      { label: "Start", value: escapeHtml((period.start_date || "—").slice(0, 10)) },
      { label: "End", value: escapeHtml((period.end_date || "—").slice(0, 10)) }
    ];

    if (timeRemaining) {
      rows.push({ label: "Time Left", value: '<span class="text-accent">' + escapeHtml(timeRemaining) + '</span>' });
    }

    var html = "";
    for (var i = 0; i < rows.length; i++) {
      html += '<div class="config-row">' +
        '<span class="config-label">' + rows[i].label + '</span>' +
        '<span class="config-value">' + rows[i].value + '</span>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  function renderPaymentHistory(periods) {
    var container = $("payment-history");
    if (!periods || !periods.length) return;

    var completed = periods.filter(function (p) {
      if (!p.end_date) return false;
      return new Date(p.end_date) < new Date();
    });

    if (!completed.length) return;

    var sorted = completed.slice().sort(function (a, b) {
      return (b.start_date || "").localeCompare(a.start_date || "");
    });

    var html = '<div class="table-wrap"><table>' +
      '<thead><tr><th>Period</th><th>Winner</th><th>Amount</th><th>Status</th></tr></thead>' +
      '<tbody>';

    for (var i = 0; i < sorted.length; i++) {
      var p = sorted[i];
      var paymentStatus = p.payment_status || "pending";
      var badgeClass = paymentStatus === "paid" ? "badge-success" : paymentStatus === "overdue" ? "badge-danger" : "badge-warning";
      html += '<tr>' +
        '<td class="text-mono">' + escapeHtml(p.period_id || "—") + '</td>' +
        '<td>' + escapeHtml(p.winner || "—") + '</td>' +
        '<td class="text-mono">$' + formatNumber(p.winning_bid || 0) + '</td>' +
        '<td><span class="badge ' + badgeClass + '">' + escapeHtml(paymentStatus) + '</span></td>' +
        '</tr>';
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  function renderManualActions() {
    var container = $("manual-actions");
    if (!owner || !repo) return;

    var actions = [
      {
        name: "Update Analytics",
        desc: "Trigger a manual analytics refresh (normally runs every 6 hours).",
        url: buildWorkflowUrl("update-analytics.yml"),
        label: "Run Workflow"
      },
      {
        name: "Open Bidding",
        desc: "Manually trigger a new bidding period.",
        url: buildWorkflowUrl("schedule-bidding.yml"),
        label: "Run Workflow"
      },
      {
        name: "Close Bidding",
        desc: "Manually close the current bidding period and select a winner.",
        url: buildWorkflowUrl("close-bidding.yml"),
        label: "Run Workflow"
      }
    ];

    var html = "";
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i];
      html += '<div class="action-row">' +
        '<div>' +
          '<strong>' + escapeHtml(a.name) + '</strong>' +
          '<div class="action-desc">' + escapeHtml(a.desc) + '</div>' +
        '</div>' +
        '<a href="' + escapeAttr(a.url) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">' + escapeHtml(a.label) + '</a>' +
        '</div>';
    }
    container.innerHTML = html;
  }

  function init() {
    if (!owner || !repo) {
      hide("loading");
      $("error").textContent = "Could not determine repository. Use ?owner=OWNER&repo=REPO in the URL.";
      show("error");
      $("subtitle").textContent = "Repository not detected";
      return;
    }

    $("subtitle").textContent = owner + "/" + repo;

    var configLoaded = false;
    var periodLoaded = false;
    var analyticsLoaded = false;
    var configText = null;
    var periodData = null;
    var analyticsData = null;

    function tryRender() {
      if (!configLoaded || !periodLoaded || !analyticsLoaded) return;

      hide("loading");

      if (!configText && !periodData && !analyticsData) {
        $("error").textContent = "No data found for this repository. Ensure BidMe is configured.";
        show("error");
        return;
      }

      show("admin");

      if (configText) {
        renderConfig(configText);
      }

      if (periodData) {
        renderBids(periodData);
        renderBiddingIssue(periodData);
      }

      var periods = [];
      if (analyticsData && analyticsData.periods) {
        periods = analyticsData.periods;
      }
      if (periodData && periodData.period_id) {
        var found = false;
        for (var i = 0; i < periods.length; i++) {
          if (periods[i].period_id === periodData.period_id) { found = true; break; }
        }
        if (!found) {
          periods = periods.concat([periodData]);
        }
      }
      renderPaymentHistory(periods);
      renderManualActions();
    }

    fetchRepoYaml(owner, repo, "bidme-config.yml")
      .then(function (text) { configText = text; })
      .catch(function () { configText = null; })
      .finally(function () { configLoaded = true; tryRender(); });

    fetchRepoData(owner, repo, "data/current-period.json")
      .then(function (data) { periodData = data; })
      .catch(function () { periodData = null; })
      .finally(function () { periodLoaded = true; tryRender(); });

    fetchRepoData(owner, repo, "data/analytics.json")
      .then(function (data) { analyticsData = data; })
      .catch(function () { analyticsData = null; })
      .finally(function () { analyticsLoaded = true; tryRender(); });
  }

  init();
})();
