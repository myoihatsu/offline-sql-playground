/* ============================================================
   SQL PLAYGROUND — Core Logic
   ============================================================ */
(function () {
  "use strict";

  /* ===== CONSTANTS ===== */
  var IDB_NAME = "SQLPlaygroundDB";
  var IDB_STORE = "sqlite_data";
  var IDB_KEY = "db_blob";
  var LS_EDITOR = "sql-playground-editor";
  var LS_THEME = "sql-playground-theme";

  /* ===== DOM REFS ===== */
  var el = {
    loadingOverlay: document.getElementById("loadingOverlay"),
    dbStatus: document.getElementById("dbStatus"),
    sqlEditor: document.getElementById("sqlEditor"),
    editorWrapper: document.getElementById("editorWrapper"),
    runBtn: document.getElementById("runBtn"),
    resetBtn: document.getElementById("resetBtn"),
    themeToggle: document.getElementById("themeToggle"),
    sampleBtn: document.getElementById("sampleBtn"),
    clearConsoleBtn: document.getElementById("clearConsoleBtn"),
    consoleOutput: document.getElementById("consoleOutput"),
    resultsOutput: document.getElementById("resultsOutput"),
    charCount: document.getElementById("charCount"),
    rowCountBadge: document.getElementById("rowCountBadge"),
    sidebar: document.getElementById("sidebar"),
    sidebarBody: document.getElementById("sidebarBody"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    lintStatus: document.getElementById("lintStatus"),
    lintTooltip: document.getElementById("lintTooltip"),
    openDbBtn: document.getElementById("openDbBtn"),
    openDbInput: document.getElementById("openDbInput"),
    saveDbBtn: document.getElementById("saveDbBtn"),
  };

  /* ===== STATE ===== */
  var db = null;
  var SQL = null;
  var isReady = false;

  /* ===== EXPORT FOR LINT.JS ===== */
  window.__sqlPlayground = {
    getDB: function () {
      return db;
    },
    isReady: function () {
      return isReady;
    },
  };

  /* ===== UTILS ===== */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function timeStr() {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  /* ===== INDEXEDDB ===== */
  function idbOpen() {
    return new Promise(function (resolve, reject) {
      var r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(IDB_STORE))
          d.createObjectStore(IDB_STORE);
      };
      r.onsuccess = function (e) {
        resolve(e.target.result);
      };
      r.onerror = function (e) {
        reject(e.target.error);
      };
    });
  }
  async function idbSave(data) {
    try {
      var d = await idbOpen();
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(data, IDB_KEY);
        tx.oncomplete = function () {
          d.close();
          resolve();
        };
        tx.onerror = function (e) {
          d.close();
          reject(e.target.error);
        };
      });
    } catch (e) {
      console.warn("IDB save failed:", e);
    }
  }
  async function idbLoad() {
    try {
      var d = await idbOpen();
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(IDB_STORE, "readonly");
        var r = tx.objectStore(IDB_STORE).get(IDB_KEY);
        r.onsuccess = function () {
          d.close();
          resolve(r.result);
        };
        r.onerror = function (e) {
          d.close();
          reject(e.target.error);
        };
      });
    } catch (e) {
      return undefined;
    }
  }
  async function idbClear() {
    try {
      var d = await idbOpen();
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        tx.oncomplete = function () {
          d.close();
          resolve();
        };
        tx.onerror = function (e) {
          d.close();
          reject(e.target.error);
        };
      });
    } catch (e) {
      /* ignore */
    }
  }

  /* ===== LOCAL STORAGE ===== */
  function lsSave() {
    try {
      localStorage.setItem(LS_EDITOR, el.sqlEditor.value);
    } catch (e) {}
  }
  function lsLoad() {
    try {
      var v = localStorage.getItem(LS_EDITOR);
      if (v != null) el.sqlEditor.value = v;
    } catch (e) {}
  }
  function lsThemeSave(t) {
    try {
      localStorage.setItem(LS_THEME, t);
    } catch (e) {}
  }
  function lsThemeLoad() {
    try {
      return localStorage.getItem(LS_THEME) || "dark";
    } catch (e) {
      return "dark";
    }
  }

  /* ===== THEME ===== */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var icons = { dark: "🌙", "simple-dark": "🌑", light: "☀️" };
    var names = {
      dark: "Dracula",
      "simple-dark": "Simple Dark",
      light: "Light",
    };
    el.themeToggle.textContent = icons[t] || "🌙";
    el.themeToggle.title = "Theme: " + names[t] + " (click to cycle)";
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme");
    var order = ["dark", "simple-dark", "light"];
    var idx = order.indexOf(cur);
    var nxt = order[(idx + 1) % 3];
    applyTheme(nxt);
    lsThemeSave(nxt);
  }

  /* ===== CONSOLE LOGGING ===== */
  function log(msg, type) {
    type = type || "info";
    var entry = document.createElement("div");
    entry.className = "log-entry log-" + type;
    entry.innerHTML =
      '<span class="log-time">' + esc(timeStr()) + "</span> " + msg;
    el.consoleOutput.prepend(entry);
    while (el.consoleOutput.children.length > 200)
      el.consoleOutput.lastChild.remove();
  }

  /* ===== RESULTS TABLE (bottom-right) ===== */
  function showResults(result) {
    var cols = result.columns,
      vals = result.values;
    var h = "<table><thead><tr>";
    for (var i = 0; i < cols.length; i++) h += "<th>" + esc(cols[i]) + "</th>";
    h += "</tr></thead><tbody>";
    for (var r = 0; r < vals.length; r++) {
      h += "<tr>";
      for (var c = 0; c < vals[r].length; c++) {
        var v = vals[r][c];
        h +=
          v == null
            ? '<td class="null-value">NULL</td>'
            : "<td>" + esc(String(v)) + "</td>";
      }
      h += "</tr>";
    }
    h += "</tbody></table>";
    el.resultsOutput.innerHTML = h;
    el.rowCountBadge.textContent =
      vals.length + " row" + (vals.length !== 1 ? "s" : "");
    el.rowCountBadge.style.display = "inline-block";
  }
  function clearResults() {
    el.resultsOutput.innerHTML =
      '<div class="results-empty">Run a <code>SELECT</code> query to see results here</div>';
    el.rowCountBadge.style.display = "none";
  }

  /* ===== TABLES PANE (left sidebar — shows actual data) ===== */
  function refreshTables() {
    if (!isReady || !db) return;
    var html = "";
    try {
      var tables = db.exec(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name",
      );
      if (tables.length === 0 || tables[0].values.length === 0) {
        html = '<div class="sidebar-empty">No tables yet</div>';
      } else {
        var rows = tables[0].values;
        for (var i = 0; i < rows.length; i++) {
          var tName = rows[i][0];
          var tType = rows[i][1];
          var icon = tType === "view" ? "\uD83D\uDC41" : "\uD83D\uDCC1";
          var LIMIT = 50;
          var totalRows = 0;

          // Get total count
          try {
            var cnt = db.exec('SELECT COUNT(*) FROM "' + tName + '"');
            if (cnt.length > 0 && cnt[0].values.length > 0)
              totalRows = cnt[0].values[0][0];
          } catch (_) {}

          // Get actual data (limited)
          var data = null;
          try {
            data = db.exec('SELECT * FROM "' + tName + '" LIMIT ' + LIMIT);
          } catch (_) {}

          html += '<div class="tbl-card">';
          html += '<div class="tbl-card-title">' + icon + " " + esc(tName);
          html +=
            '<span class="tbl-rows">' +
            totalRows +
            " row" +
            (totalRows !== 1 ? "s" : "") +
            "</span>";
          html += "</div>";

          if (data && data.length > 0 && data[0].columns.length > 0) {
            var cols = data[0].columns;
            var vals = data[0].values;
            html += '<div class="tbl-card-wrap"><table><thead><tr>';
            for (var c = 0; c < cols.length; c++)
              html += "<th>" + esc(cols[c]) + "</th>";
            html += "</tr></thead><tbody>";
            for (var r = 0; r < vals.length; r++) {
              html += "<tr>";
              for (var cc = 0; cc < vals[r].length; cc++) {
                var v = vals[r][cc];
                html +=
                  v == null
                    ? '<td class="null-value">NULL</td>'
                    : "<td>" + esc(String(v)) + "</td>";
              }
              html += "</tr>";
            }
            html += "</tbody></table></div>";
            if (totalRows > LIMIT) {
              html +=
                '<div class="tbl-card-more">Showing ' +
                LIMIT +
                " of " +
                totalRows +
                " rows</div>";
            }
          } else {
            // Empty table — still show column headers from PRAGMA
            var cols = null;
            try {
              var pragma = db.exec('PRAGMA table_info("' + tName + '")');
              if (pragma.length > 0)
                cols = pragma[0].values.map(function (r) {
                  return r[1];
                });
            } catch (_) {}
            if (cols && cols.length > 0) {
              html += '<div class="tbl-card-wrap"><table><thead><tr>';
              for (var cc2 = 0; cc2 < cols.length; cc2++)
                html += "<th>" + esc(cols[cc2]) + "</th>";
              html += "</tr></thead></table></div>";
              html += '<div class="tbl-card-empty">(empty)</div>';
            } else {
              html += '<div class="tbl-card-empty">(empty table)</div>';
            }
          }
          html += "</div>";
        }
      }
    } catch (e) {
      html = '<div class="sidebar-empty">Error loading tables</div>';
    }
    el.sidebarBody.innerHTML = html;
  }

  /* ===== QUERY EXECUTION ===== */
  function runQuery() {
    if (!isReady || !db) {
      log("\u26A0\uFE0F Database not ready. Please wait\u2026", "error");
      return;
    }
    var input = el.sqlEditor.value.trim();
    if (!input) return;
    lsSave();

    var statements = input
      .split(";")
      .map(function (s) {
        return s.trim();
      })
      .filter(function (s) {
        return s.length > 0;
      });
    if (statements.length === 0) return;

    var anySelect = false;
    var lastResult = null;

    for (var i = 0; i < statements.length; i++) {
      var stmt = statements[i];
      var preview = stmt.length > 90 ? stmt.substring(0, 90) + "\u2026" : stmt;
      try {
        var results = db.exec(stmt);
        if (results.length > 0) {
          for (var j = 0; j < results.length; j++) {
            lastResult = results[j];
            log(
              "\u2713 <b>SELECT</b> \u2192 " +
                lastResult.values.length +
                " row" +
                (lastResult.values.length !== 1 ? "s" : "") +
                ", " +
                lastResult.columns.length +
                " col" +
                (lastResult.columns.length !== 1 ? "s" : ""),
              "success",
            );
          }
          anySelect = true;
        } else {
          var upper = stmt.toUpperCase();
          var kind = "Statement";
          if (upper.startsWith("CREATE")) kind = "CREATE";
          else if (upper.startsWith("INSERT")) kind = "INSERT";
          else if (upper.startsWith("UPDATE")) kind = "UPDATE";
          else if (upper.startsWith("DELETE")) kind = "DELETE";
          else if (upper.startsWith("DROP")) kind = "DROP";
          else if (upper.startsWith("ALTER")) kind = "ALTER";
          else if (/^(BEGIN|COMMIT|ROLLBACK)/.test(upper)) kind = "Transaction";
          var aff = "";
          try {
            var cr = db.exec("SELECT changes()");
            if (cr.length > 0 && cr[0].values.length > 0) {
              var ch = cr[0].values[0][0];
              if (ch > 0)
                aff =
                  " \u2014 " +
                  ch +
                  " row" +
                  (ch !== 1 ? "s" : "") +
                  " affected";
            }
          } catch (_) {}
          log(
            "\u2713 <b>" + kind + "</b> executed successfully" + aff,
            "success",
          );
        }
      } catch (err) {
        log("\u2717 <b>Error:</b> " + esc(err.message), "error");
        log(
          '  <span style="opacity:0.6">in: ' + esc(preview) + "</span>",
          "error",
        );
      }
    }

    if (anySelect && lastResult) showResults(lastResult);
    else if (!anySelect && statements.length === 1) {
      var su = statements[0].toUpperCase();
      if (su.startsWith("DROP") || su.startsWith("ALTER")) clearResults();
    }

    try {
      idbSave(db.export());
    } catch (_) {}
    refreshTables(); // refresh left pane
  }

  /* ===== SAMPLE DATA ===== */
  function loadSampleData() {
    if (!isReady || !db) return;
    var sql =
      [
        "CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY, name TEXT NOT NULL, department TEXT, salary REAL)",
        "DELETE FROM employees",
        "INSERT INTO employees VALUES (1,'Alice','Engineering',85000)",
        "INSERT INTO employees VALUES (2,'Bob','Design',72000)",
        "INSERT INTO employees VALUES (3,'Charlie','Engineering',91000)",
        "INSERT INTO employees VALUES (4,'Diana','Marketing',68000)",
        "INSERT INTO employees VALUES (5,'Eve','Engineering',95000)",
        "INSERT INTO employees VALUES (6,'Frank','Design',78000)",
        "INSERT INTO employees VALUES (7,'Grace','Marketing',73000)",
        "INSERT INTO employees VALUES (8,'Hank','Engineering',88500)",
        "INSERT INTO employees VALUES (9,'Iris','Design',81000)",
        "INSERT INTO employees VALUES (10,'Jack','Marketing',69500)",
        "SELECT * FROM employees ORDER BY id",
      ].join(";\n") + ";";
    el.sqlEditor.value = sql;
    lsSave();
    updateCharCount();
    if (window.__lintSQL) window.__lintSQL();
    runQuery();
  }

  /* ===== RESET ===== */
  async function doReset() {
    try {
      localStorage.removeItem(LS_EDITOR);
    } catch (_) {}
    await idbClear();
    el.sqlEditor.value = "";
    el.consoleOutput.innerHTML = "";
    clearResults();
    updateCharCount();
    el.sidebarBody.innerHTML = '<div class="sidebar-empty">No tables yet</div>';
    el.editorWrapper.classList.remove("has-error", "has-warn");
    if (window.__setLint) window.__setLint("lint-ok", "\u2713 Valid", []);
    if (db) {
      try {
        db.close();
      } catch (_) {}
    }
    db = new SQL.Database();
    log(
      "\uD83D\uDD04 <b>Everything has been reset.</b> New database created.",
      "info",
    );
    updateDBStatus("ready");
    el.sqlEditor.focus();
  }

  function showResetModal() {
    var modal = document.getElementById("resetModal");
    modal.style.display = "flex";
    document.getElementById("resetConfirmBtn").onclick = function () {
      modal.style.display = "none";
      doReset();
    };
    document.getElementById("resetCancelBtn").onclick = function () {
      modal.style.display = "none";
      el.sqlEditor.focus();
    };
    // Close on backdrop click
    modal.onclick = function (e) {
      if (e.target === modal) {
        modal.style.display = "none";
        el.sqlEditor.focus();
      }
    };
  }

  /* ===== UI HELPERS ===== */
  function updateCharCount() {
    var len = el.sqlEditor.value.length;
    el.charCount.textContent = len + " char" + (len !== 1 ? "s" : "");
  }
  function updateDBStatus(state) {
    el.dbStatus.classList.remove("loading", "error");
    if (state === "loading") {
      el.dbStatus.textContent = "\u25CF Loading";
      el.dbStatus.classList.add("loading");
    } else if (state === "ready") {
      el.dbStatus.textContent = "\u25CF Ready";
      el.dbStatus.style.background = "";
    } else if (state === "error") {
      el.dbStatus.textContent = "\u25CF Error";
      el.dbStatus.classList.add("error");
    }
  }
  function toggleSidebar() {
    el.sidebar.classList.toggle("collapsed");
    el.sidebarToggle.classList.toggle(
      "active",
      !el.sidebar.classList.contains("collapsed"),
    );
  }

  /* ===== EVENT LISTENERS ===== */
  el.runBtn.addEventListener("click", runQuery);
  el.sidebarToggle.addEventListener("click", toggleSidebar);
  el.themeToggle.addEventListener("click", toggleTheme);
  el.resetBtn.addEventListener("click", showResetModal);
  el.sampleBtn.addEventListener("click", loadSampleData);
  el.clearConsoleBtn.addEventListener("click", function () {
    el.consoleOutput.innerHTML = "";
  });

  // Open local .db file
  el.openDbBtn.addEventListener("click", function () {
    el.openDbInput.click();
  });
  el.openDbInput.addEventListener("change", function () {
    var file = el.openDbInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var arr = new Uint8Array(reader.result);
        var newDb = new SQL.Database(arr);
        if (db) {
          try {
            db.close();
          } catch (_) {}
        }
        db = newDb;
        log(
          "📂 <b>Loaded:</b> " +
            esc(file.name) +
            " (" +
            (file.size / 1024).toFixed(1) +
            " KB)",
          "success",
        );
        el.consoleOutput.innerHTML = "";
        clearResults();
        refreshTables();
        if (window.__lintSQL) window.__lintSQL();
        try {
          idbSave(db.export());
        } catch (_) {}
      } catch (err) {
        log("❌ <b>Failed to open database:</b> " + esc(err.message), "error");
      }
      el.openDbInput.value = "";
    };
    reader.readAsArrayBuffer(file);
  });

  // Download current database
  el.saveDbBtn.addEventListener("click", function () {
    if (!isReady || !db) {
      log("⚠️ No database to save", "error");
      return;
    }
    var data = db.export();
    var blob = new Blob([data], { type: "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    a.href = url;
    a.download = "playground-" + ts + ".db";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log(
      "💾 <b>Database downloaded</b> (" +
        (data.byteLength / 1024).toFixed(1) +
        " KB)",
      "success",
    );
  });

  el.sqlEditor.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runQuery();
    }
  });
  el.sqlEditor.addEventListener("input", function () {
    updateCharCount();
    lsSave();
    if (window.__debounceLint) window.__debounceLint();
  });

  /* ===== RESIZE HANDLES ===== */
  var LS_SIZES = "sql-playground-sizes";
  var root = document.documentElement;
  var dragState = null;

  function loadSizes() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_SIZES));
      if (s) {
        if (s.sideW) root.style.setProperty("--side-w", s.sideW + "px");
        if (s.editH) root.style.setProperty("--edit-h", s.editH + "px");
        if (s.conF) root.style.setProperty("--con-f", s.conF);
        if (s.resF) root.style.setProperty("--res-f", s.resF);
      }
    } catch (_) {}
  }

  function saveSizes() {
    try {
      var cs = getComputedStyle(root);
      var s = {
        sideW: parseInt(cs.getPropertyValue("--side-w")) || 290,
        editH: parseInt(cs.getPropertyValue("--edit-h")) || 210,
        conF: parseFloat(cs.getPropertyValue("--con-f")) || 1,
        resF: parseFloat(cs.getPropertyValue("--res-f")) || 1,
      };
      localStorage.setItem(LS_SIZES, JSON.stringify(s));
    } catch (_) {}
  }

  function onDragMove(e) {
    if (!dragState) return;
    var d = dragState;
    var dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    // Disable transitions for snappy drag
    root.classList.add("no-transition");
    if (d.id === "resizeSide") {
      root.style.setProperty(
        "--side-w",
        Math.max(120, Math.min(600, d.startVal + dx)) + "px",
      );
    } else if (d.id === "resizeEdit") {
      root.style.setProperty(
        "--edit-h",
        Math.max(60, Math.min(500, d.startVal + dy)) + "px",
      );
    } else if (d.id === "resizeCons") {
      var tf = d.conStart + d.resStart;
      var nc = Math.max(
        0.2,
        Math.min(tf - 0.2, d.conStart + (dx / d.parentW) * tf),
      );
      root.style.setProperty("--con-f", nc);
      root.style.setProperty("--res-f", tf - nc);
    }
  }

  function onDragUp() {
    if (!dragState) return;
    dragState.el.classList.remove("dragging");
    root.classList.remove("no-transition");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    dragState = null;
    saveSizes();
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragUp);
  }

  function initResize(id) {
    var h = document.getElementById(id);
    if (!h) return;
    h.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var cs = getComputedStyle(root);
      var parentW = h.id === "resizeCons" ? h.parentElement.clientWidth : 0;
      var startVal = 0;
      if (h.id === "resizeSide")
        startVal = parseInt(cs.getPropertyValue("--side-w")) || 290;
      else if (h.id === "resizeEdit")
        startVal = parseInt(cs.getPropertyValue("--edit-h")) || 210;
      dragState = {
        id: h.id,
        el: h,
        x: e.clientX,
        y: e.clientY,
        startVal: startVal,
        conStart: parseFloat(cs.getPropertyValue("--con-f")) || 1,
        resStart: parseFloat(cs.getPropertyValue("--res-f")) || 1,
        parentW: parentW,
      };
      h.classList.add("dragging");
      document.body.style.cursor =
        h.id === "resizeEdit" ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onDragMove);
      document.addEventListener("mouseup", onDragUp);
    });
  }

  loadSizes();
  initResize("resizeSide");
  initResize("resizeEdit");
  initResize("resizeCons");

  /* ===== INIT ===== */
  async function init() {
    applyTheme(lsThemeLoad());
    lsLoad();
    updateCharCount();

    try {
      SQL = await initSqlJs({
        locateFile: function (f) {
          return f;
        },
      });
    } catch (err) {
      el.loadingOverlay.classList.add("hidden");
      updateDBStatus("error");
      log(
        "\u274C <b>Failed to load SQLite engine:</b> " + esc(err.message),
        "error",
      );
      isReady = true;
      return;
    }

    try {
      var data = await idbLoad();
      if (data && data instanceof Uint8Array && data.byteLength > 0) {
        db = new SQL.Database(data);
        log(
          "\uD83D\uDCC2 <b>Database restored</b> (" +
            (data.byteLength / 1024).toFixed(1) +
            " KB)",
          "info",
        );
      } else {
        db = new SQL.Database();
        log("\uD83C\uDD95 <b>New database</b> created", "info");
      }
      updateDBStatus("ready");
    } catch (err) {
      log("\u26A0\uFE0F Could not load saved DB: " + esc(err.message), "error");
      db = new SQL.Database();
      updateDBStatus("ready");
    }

    isReady = true;
    el.loadingOverlay.classList.add("hidden");
    el.sqlEditor.focus();
    refreshTables();
    if (window.__lintSQL) window.__lintSQL();
  }

  init().catch(function (err) {
    console.error("Init error:", err);
    el.loadingOverlay.classList.add("hidden");
    updateDBStatus("error");
    isReady = true;
  });

  setInterval(function () {
    if (isReady && db) {
      try {
        idbSave(db.export());
      } catch (_) {}
    }
  }, 30000);
})();
