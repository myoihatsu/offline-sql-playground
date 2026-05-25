/* ============================================================
   SQL PLAYGROUND — Lint + Autocomplete Suggestions
   ============================================================ */
(function () {
  "use strict";

  var lintTimer = null;
  var acVisible = false;
  var acIndex = -1;
  var acItems = [];
  var acAccepting = false; // block re-entry during accept

  /* ===== DOM refs (set after DOM ready) ===== */
  var el = {};
  function cacheDOM() {
    el.editor = document.getElementById("sqlEditor");
    el.editorWrap = document.getElementById("editorWrapper");
    el.lintStatus = document.getElementById("lintStatus");
    el.lintTooltip = document.getElementById("lintTooltip");
    el.acPopup = document.getElementById("autocompletePopup");
  }

  /* ===== SQL KEYWORDS for autocomplete ===== */
  var KEYWORDS = [
    "SELECT",
    "FROM",
    "WHERE",
    "INSERT",
    "INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE",
    "CREATE",
    "TABLE",
    "DROP",
    "ALTER",
    "ADD",
    "COLUMN",
    "INDEX",
    "VIEW",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "ON",
    "AS",
    "AND",
    "OR",
    "NOT",
    "GROUP",
    "BY",
    "ORDER",
    "ASC",
    "DESC",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "DISTINCT",
    "ALL",
    "UNION",
    "INTERSECT",
    "EXCEPT",
    "EXISTS",
    "IN",
    "BETWEEN",
    "LIKE",
    "NULL",
    "IS",
    "TRUE",
    "FALSE",
    "PRIMARY",
    "KEY",
    "FOREIGN",
    "REFERENCES",
    "DEFAULT",
    "CHECK",
    "UNIQUE",
    "CASCADE",
    "CONSTRAINT",
    "BEGIN",
    "COMMIT",
    "ROLLBACK",
    "TRANSACTION",
    "COUNT",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
    "COALESCE",
    "IFNULL",
    "CAST",
    "INTEGER",
    "TEXT",
    "REAL",
    "BLOB",
    "VARCHAR",
    "BOOLEAN",
    "DATE",
    "TIMESTAMP",
    "CASE",
    "WHEN",
    "THEN",
    "ELSE",
    "END",
    "IF",
    "REPLACE",
    "ABORT",
    "FAIL",
    "IGNORE",
    "PRAGMA",
    "EXPLAIN",
    "ANALYZE",
    "VACUUM",
    "ATTACH",
    "DETACH",
  ];

  /* ===== GET DATABASE SCHEMA ===== */
  function getTables() {
    var pg = window.__sqlPlayground;
    if (!pg || !pg.isReady()) return [];
    var db = pg.getDB();
    if (!db) return [];
    try {
      var r = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      );
      if (r.length === 0) return [];
      return r[0].values.map(function (v) {
        return v[0];
      });
    } catch (e) {
      return [];
    }
  }

  function getColumns(tableName) {
    var pg = window.__sqlPlayground;
    if (!pg || !pg.isReady()) return [];
    var db = pg.getDB();
    if (!db) return [];
    try {
      var r = db.exec('PRAGMA table_info("' + tableName + '")');
      if (r.length === 0) return [];
      return r[0].values.map(function (v) {
        return v[1];
      }); // column name is index 1
    } catch (e) {
      return [];
    }
  }

  /* ===== UTILS ===== */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /** Get current word being typed + cursor position in textarea */
  function getCurrentWord() {
    var ta = el.editor;
    var pos = ta.selectionStart;
    var text = ta.value;
    // Find word start (backwards from cursor)
    var start = pos;
    while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) start--;
    // Find word end (forwards from cursor)
    var end = pos;
    while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) end++;
    return {
      word: text.substring(start, end),
      start: start,
      end: end,
      before: text.substring(0, start),
      after: text.substring(end),
    };
  }

  /** Get the line text before cursor to determine context */
  function getLineContext() {
    var ta = el.editor;
    var pos = ta.selectionStart;
    var text = ta.value;
    var lineStart = text.lastIndexOf("\n", pos - 1) + 1;
    return text.substring(lineStart, pos);
  }

  /* ===== AUTOCOMPLETE LOGIC ===== */
  function showAutocomplete() {
    var cw = getCurrentWord();
    var partial = cw.word.toLowerCase();
    var ctx = getLineContext().toUpperCase().replace(/\s+/g, " ").trim();

    var suggestions = [];

    // 1. Always suggest SQL keywords that match
    for (var i = 0; i < KEYWORDS.length; i++) {
      if (
        KEYWORDS[i].toLowerCase().startsWith(partial) &&
        KEYWORDS[i].toLowerCase() !== partial
      ) {
        suggestions.push({ text: KEYWORDS[i], type: "keyword" });
      }
    }

    // 2. Table names
    var tables = getTables();
    for (var t = 0; t < tables.length; t++) {
      if (tables[t].toLowerCase().startsWith(partial)) {
        suggestions.push({ text: tables[t], type: "table" });
      }
    }

    // 3. Column names — if we're after a table name or in certain contexts
    // Check if the context suggests we need column names (after SELECT, WHERE, etc.)
    var afterSelect =
      /SELECT(?:\s+DISTINCT)?$/i.test(ctx) ||
      /SELECT(?:\s+DISTINCT)?\s+[\w,]*$/i.test(ctx);
    var afterWhere = /\bWHERE\s+$/i.test(ctx) || /\bWHERE\s+[\w.]*$/i.test(ctx);
    var afterOn = /\bON\s+$/i.test(ctx);
    var afterSet = /\bSET\s+$/i.test(ctx);
    var afterBy = /\bBY\s+$/i.test(ctx);

    // Also detect "table." pattern for column suggestions
    var dotMatch = cw.before.match(/(\w+)\.\s*$/);
    var dotTable = dotMatch ? dotMatch[1] : null;

    if (dotTable) {
      // "tablename." — show columns of that table
      var cols = getColumns(dotTable);
      for (var c = 0; c < cols.length; c++) {
        if (cols[c].toLowerCase().startsWith(partial)) {
          suggestions.push({ text: cols[c], type: "column", table: dotTable });
        }
      }
    } else if (afterSelect || afterWhere || afterOn || afterSet || afterBy) {
      // Show all columns from all tables
      var allTables = getTables();
      for (var at = 0; at < allTables.length; at++) {
        var cols = getColumns(allTables[at]);
        for (var ac = 0; ac < cols.length; ac++) {
          if (cols[ac].toLowerCase().startsWith(partial)) {
            // Avoid duplicates
            var already = suggestions.some(function (s) {
              return s.text === cols[ac];
            });
            if (!already)
              suggestions.push({
                text: cols[ac],
                type: "column",
                table: allTables[at],
              });
          }
        }
      }
    }

    // Deduplicate by text
    var seen = {};
    suggestions = suggestions.filter(function (s) {
      if (seen[s.text]) return false;
      seen[s.text] = true;
      return true;
    });

    // Limit to 20
    suggestions = suggestions.slice(0, 20);

    if (suggestions.length === 0) {
      hideAutocomplete();
      return;
    }

    acItems = suggestions;
    acIndex = 0;

    // Render popup
    var html = "";
    for (var si = 0; si < suggestions.length; si++) {
      var s = suggestions[si];
      html +=
        '<div class="autocomplete-item' +
        (si === 0 ? " active" : "") +
        '" data-index="' +
        si +
        '">';
      html += esc(s.text);
      html +=
        '<span class="ac-type">' +
        (s.type === "keyword"
          ? "kw"
          : s.type === "table"
            ? "tbl"
            : "col" + (s.table ? ":" + s.table : "")) +
        "</span>";
      html += "</div>";
    }
    el.acPopup.innerHTML = html;

    // Position the popup near the cursor (approximate)
    var ta = el.editor;
    // Estimate position based on text size
    var charW = 8.5; // approximate monospace char width in px
    var lineH = 20; // approximate line height
    var cursorPos = ta.selectionStart;
    var textBefore = ta.value.substring(0, cursorPos);
    var lines = textBefore.split("\n");
    var curLine = lines.length;
    var curCol = lines[lines.length - 1].length + 1;

    // Position relative to editor-wrapper
    var top = Math.min(curLine * lineH, el.editorWrap.clientHeight - 200);
    var left = Math.min(curCol * charW + 14, el.editorWrap.clientWidth - 200);

    el.acPopup.style.top = top + "px";
    el.acPopup.style.left = left + "px";
    el.acPopup.style.display = "block";
    acVisible = true;
  }

  function hideAutocomplete() {
    el.acPopup.style.display = "none";
    acVisible = false;
    acIndex = -1;
    acItems = [];
  }

  function acceptAutocomplete(index) {
    if (!acVisible || acItems.length === 0) return;
    acAccepting = true;
    var idx = index !== undefined ? index : acIndex;
    if (idx < 0 || idx >= acItems.length) {
      acAccepting = false;
      return;
    }
    var item = acItems[idx];
    hideAutocomplete();
    var cw = getCurrentWord();
    var ta = el.editor;
    var before = ta.value.substring(0, cw.start);
    var after = ta.value.substring(cw.end);
    ta.value = before + item.text + after;
    var newPos = cw.start + item.text.length;
    ta.selectionStart = ta.selectionEnd = newPos;
    ta.focus();
    acAccepting = false;
    // Force highlight update
    if (window.__highlightSQL) window.__highlightSQL();
  }

  function moveAutocomplete(dir) {
    if (!acVisible || acItems.length === 0) return;
    acIndex += dir;
    if (acIndex < 0) acIndex = acItems.length - 1;
    if (acIndex >= acItems.length) acIndex = 0;
    // Update active class
    var items = el.acPopup.querySelectorAll(".autocomplete-item");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("active", i === acIndex);
    }
    // Scroll into view
    if (items[acIndex]) items[acIndex].scrollIntoView({ block: "nearest" });
  }

  /* ===== LINT LOGIC ===== */
  function lintSQL() {
    var pg = window.__sqlPlayground;
    if (!pg || !pg.isReady()) return;
    var db = pg.getDB();
    if (!db) return;

    var input = el.editor.value.trim();
    if (!input) {
      setLint("lint-ok", "\u2713 Valid", []);
      el.editorWrap.classList.remove("has-error", "has-warn");
      return;
    }

    var statements = input
      .split(";")
      .map(function (s) {
        return s.trim();
      })
      .filter(function (s) {
        return s.length > 0;
      });
    var issues = [];

    for (var i = 0; i < statements.length; i++) {
      var stmt = statements[i];
      var stmtNum = statements.length > 1 ? i + 1 : 0;

      // 1. Syntax validation
      try {
        var prep = db.prepare(stmt);
        prep.free();
      } catch (e) {
        issues.push({ type: "error", msg: esc(e.message), stmt: stmtNum });
        continue;
      }

      var upper = stmt.toUpperCase().replace(/\s+/g, " ").trim();

      // 2. Dangerous patterns
      if (/^DROP\b/.test(upper)) {
        issues.push({
          type: "warn",
          msg: "DROP statement \u2014 this will destroy data",
          stmt: stmtNum,
        });
      }
      if (/^DELETE\s+FROM\b/i.test(stmt) && !/WHERE\b/i.test(stmt)) {
        issues.push({
          type: "warn",
          msg: "DELETE without WHERE \u2014 will delete ALL rows",
          stmt: stmtNum,
        });
      }
      if (/^UPDATE\b/i.test(stmt) && !/WHERE\b/i.test(stmt)) {
        issues.push({
          type: "warn",
          msg: "UPDATE without WHERE \u2014 will update ALL rows",
          stmt: stmtNum,
        });
      }

      // 3. Keyword typos
      var firstWord = upper.split(/\s+/)[0];
      var TYPOS = {
        SELCET: "SELECT",
        SELET: "SELECT",
        SLECT: "SELECT",
        SELEKT: "SELECT",
        INSRET: "INSERT",
        INSRT: "INSERT",
        INERT: "INSERT",
        UDPATE: "UPDATE",
        UPDTE: "UPDATE",
        UDPTE: "UPDATE",
        DELTE: "DELETE",
        DLETE: "DELETE",
        DELET: "DELETE",
        CRETE: "CREATE",
        CREAT: "CREATE",
        CREAET: "CREATE",
        DROPP: "DROP",
        DOP: "DROP",
        ALTR: "ALTER",
        ALTRE: "ALTER",
      };
      if (TYPOS[firstWord]) {
        issues.push({
          type: "warn",
          msg:
            'Unknown "' +
            firstWord +
            '" \u2014 did you mean "' +
            TYPOS[firstWord] +
            '"?',
          stmt: stmtNum,
        });
      }

      // 4. Unmatched parentheses
      var op = (stmt.match(/\(/g) || []).length;
      var cp = (stmt.match(/\)/g) || []).length;
      if (op !== cp) {
        issues.push({
          type: "error",
          msg: "Unmatched parentheses (" + op + " open, " + cp + " close)",
          stmt: stmtNum,
        });
      }

      // 5. Unclosed quotes
      var q = stmt.match(/'/g);
      if (q && q.length % 2 !== 0) {
        issues.push({
          type: "error",
          msg: "Unclosed single-quoted string",
          stmt: stmtNum,
        });
      }
    }

    var hasErr = issues.some(function (x) {
      return x.type === "error";
    });
    var hasWarn = issues.some(function (x) {
      return x.type === "warn";
    });
    var label, cls;
    if (hasErr) {
      label =
        "\u274C " + issues.length + " issue" + (issues.length > 1 ? "s" : "");
      cls = "lint-error";
    } else if (hasWarn) {
      label =
        "\u26A0 " + issues.length + " warning" + (issues.length > 1 ? "s" : "");
      cls = "lint-warn";
    } else {
      label = "\u2713 Valid";
      cls = "lint-ok";
    }

    setLint(cls, label, issues);

    el.editorWrap.classList.remove("has-error", "has-warn");
    if (hasErr) el.editorWrap.classList.add("has-error");
    else if (hasWarn) el.editorWrap.classList.add("has-warn");
  }

  function setLint(cls, label, issues) {
    el.lintStatus.className = "lint-status " + cls;
    // Update first text node
    el.lintStatus.childNodes[0].textContent = label;
    var tip = "";
    if (issues.length === 0) {
      tip =
        '<div class="lint-tooltip-item" style="color:var(--green)">\u2713 No issues found</div>';
    } else {
      for (var i = 0; i < issues.length; i++) {
        var iss = issues[i];
        var badge =
          iss.type === "error"
            ? '<span class="lt-badge err">ERR</span>'
            : '<span class="lt-badge warn">WARN</span>';
        var prefix = iss.stmt ? "[Stmt " + iss.stmt + "] " : "";
        tip +=
          '<div class="lint-tooltip-item">' +
          badge +
          " " +
          esc(prefix + iss.msg) +
          "</div>";
      }
    }
    el.lintTooltip.innerHTML = tip;

    // Update lint panel (right side)
    var panelBody = document.getElementById("lintPanelBody");
    if (!panelBody) return;
    if (issues.length === 0) {
      panelBody.innerHTML =
        '<div class="lint-panel-empty">\u2713 No issues</div>';
    } else {
      var panelHTML = "";
      for (var j = 0; j < issues.length; j++) {
        var pfx = issues[j].stmt ? "[" + issues[j].stmt + "] " : "";
        var full = pfx + issues[j].msg;
        panelHTML +=
          '<div class="lint-panel-item ' +
          issues[j].type +
          '" title="' +
          esc(full) +
          '">' +
          esc(full) +
          "</div>";
      }
      panelBody.innerHTML = panelHTML;
    }
  }

  /* ===== DEBOUNCE ===== */
  function debounceLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(lintSQL, 350);
  }

  /* ===== EVENT HANDLERS ===== */
  function onEditorInput(e) {
    debounceLint();
    if (acAccepting) return; // don't re-open while accepting a suggestion

    // Show autocomplete on typing (after 2+ chars)
    var cw = getCurrentWord();
    if (cw.word.length >= 2 && /^[a-zA-Z]/.test(cw.word)) {
      showAutocomplete();
    } else {
      hideAutocomplete();
    }
  }

  function onEditorKeyDown(e) {
    // Ctrl+Space: force autocomplete
    if ((e.ctrlKey || e.metaKey) && e.key === " ") {
      e.preventDefault();
      showAutocomplete();
      return;
    }

    // Tab: accept autocomplete if visible, otherwise insert indent
    if (e.key === "Tab") {
      e.preventDefault();
      if (acVisible) {
        acceptAutocomplete();
      } else {
        insertTab();
      }
      return;
    }

    if (!acVisible) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveAutocomplete(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveAutocomplete(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      acceptAutocomplete();
    } else if (e.key === "Escape") {
      e.preventDefault();
      hideAutocomplete();
    }
  }

  function insertTab() {
    var ta = el.editor;
    var pos = ta.selectionStart;
    ta.value =
      ta.value.substring(0, pos) + "\t" + ta.value.substring(ta.selectionEnd);
    ta.selectionStart = ta.selectionEnd = pos + 1;
    if (window.__highlightSQL) window.__highlightSQL();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function onEditorClick() {
    hideAutocomplete();
  }

  /* ===== INIT ===== */
  function init() {
    cacheDOM();
    el.editor.addEventListener("input", onEditorInput);
    el.editor.addEventListener("keydown", onEditorKeyDown);
    el.editor.addEventListener("click", onEditorClick);
    // Close autocomplete on scroll or blur
    el.editor.addEventListener("blur", function () {
      setTimeout(hideAutocomplete, 150);
    });
    // Click on autocomplete items
    el.acPopup.addEventListener("click", function (e) {
      var item = e.target.closest(".autocomplete-item");
      if (item) {
        var idx = parseInt(item.getAttribute("data-index"), 10);
        acceptAutocomplete(idx);
      }
    });
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ===== EXPORT for app.js ===== */
  window.__lintSQL = lintSQL;
  window.__debounceLint = debounceLint;
  window.__setLint = setLint;
})();
