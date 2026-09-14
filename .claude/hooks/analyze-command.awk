# analyze-command.awk — shell-aware analysis of the Bash command in a Claude Code
# hook payload. Shared by the hooks so they reason about the same parse.
#
# Usage: awk -v home="$HOME" -v fallback_cwd="$PWD" -f analyze-command.awk < payload.json
#
# POSIX awk only (runs under gawk, mawk and BSD awk). It is deliberately
# conservative: whenever it cannot tell where a command runs, it says so ("?")
# and the caller fails closed.
#
# Output — one tab-separated record per line:
#   CWD <dir>                         session working directory the command starts in
#   TARGET <dir>|?                    a directory a `git commit`/`git push` may run in
#   GITDIR <dir>|?                    an explicit --git-dir / GIT_DIR of a commit/push
#   PUSHMAIN <refspec>                a push whose destination is main/master (or --all/--mirror)
#   PUSHUNRESOLVED <refspec>          a push destination containing shell expansion
#   DENY <rule>                       reset-hard | branch-force-delete | gh-merge-delete
#   CHECK <kind> <creditable> <dir>|? a verification command (typecheck|test); creditable=1
#                                     when its exit status decides the whole command's status
#   SEEN <dir>|?                      every directory the command may run in
#   LARGE commit-push                 the command is too large to analyse (see MAX_COMMAND)
#                                     and mentions git commit/push
#
# Directory tracking: every command starts in the session cwd. `cd`/`pushd`
# followed by `&&` moves there; after `;`, `||`, `|`, `&` or a newline the cd may
# have failed, so both directories stay possible. `( … )` and `bash -c`/`eval`
# bodies are scoped; `{ …; }`, if/while/for bodies and functions are not. Command
# substitutions may run anywhere the command visits. A set of more than
# MAX_DIRS possible directories collapses to "?".
#
# Commands longer than MAX_COMMAND bytes are not parsed (awk string building is
# quadratic and this runs on every Bash call); a conservative literal scan
# reports git commit/push (LARGE) and the always-dangerous operations instead.

BEGIN { SEP = "\034"; MAX_COMMAND = 65536; MAX_DIRS = 32 }

{ payload = (NR == 1) ? $0 : payload "\n" $0 }

END {
  cwd = json_string(payload, "cwd")
  if (!json_found || cwd == "") cwd = fallback_cwd
  print "CWD\t" cwd
  cmd = json_string(payload, "command")
  if (!json_found) exit 0
  if (json_large) {
    large_scan(cmd)
    print "SEEN\t" cwd
    exit 0
  }
  NT[1] = 0
  NT[2] = 0
  tokenize(cmd, 1, 1, 0)
  cur = cwd
  hist = cwd
  process_list(1, 0)
  # Command substitutions (and quoted git commands handed to other programs) may
  # run in any directory the command visits.
  cur = hist
  process_list(2, 1)
  n = split(hist, H, SEP)
  for (i = 1; i <= n; i++) print "SEEN\t" H[i]
}

# ---------------------------------------------------------------------------
# JSON
# ---------------------------------------------------------------------------

# json_string(s, key) — decoded value of the first `"key": "…"` pair. Inside JSON
# strings every quote is escaped, so an unescaped `"key"` followed by `:` is a key.
function json_string(s, key,    rest, m, j, n, tail, out, c, e, code) {
  rest = s
  while ((m = index(rest, "\"" key "\"")) > 0) {
    j = m + length(key) + 2
    tail = substr(rest, j)
    if (match(tail, /^[ \t\r\n]*:[ \t\r\n]*"/)) {
      j = j + RLENGTH
      n = length(rest)
      # Measure first: an oversized command is returned raw (still escaped).
      json_large = 0
      for (e = j; e <= n; e++) {
        c = substr(rest, e, 1)
        if (c == "\\") e++
        else if (c == "\"") break
      }
      if (key == "command" && e - j > MAX_COMMAND) {
        json_found = 1
        json_large = 1
        return substr(rest, j, e - j)
      }
      out = ""
      for (; j <= n; j++) {
        c = substr(rest, j, 1)
        if (c == "\\") {
          j++
          e = substr(rest, j, 1)
          if (e == "n") out = out "\n"
          else if (e == "t") out = out "\t"
          else if (e == "r") out = out "\r"
          else if (e == "b" || e == "f") out = out
          else if (e == "u") {
            code = hexval(substr(rest, j + 1, 4))
            j += 4
            out = out ((code > 0 && code < 128) ? sprintf("%c", code) : "?")
          } else out = out e
        } else if (c == "\"") {
          json_found = 1
          return out
        } else out = out c
      }
      json_found = 1
      return out
    }
    rest = substr(rest, m + 1)
  }
  json_found = 0
  return ""
}

function hexval(h,    i, d, v) {
  v = 0
  for (i = 1; i <= 4; i++) {
    d = index("0123456789abcdef", tolower(substr(h, i, 1))) - 1
    if (d < 0) return -1
    v = v * 16 + d
  }
  return v
}

# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------

function add_tok(list, type, val, ex) {
  NT[list]++
  TT[list, NT[list]] = type
  TV[list, NT[list]] = val
  TX[list, NT[list]] = ex
}

# emit_word — appends a word. The body of `bash -c`/`sh -c`/`eval` is tokenized
# in place as a scoped `( … )` group so its cd/git commands are analysed too.
function emit_word(list, w, ex,    n) {
  n = NT[list]
  if ((n >= 2 && TT[list, n] == "W" && TV[list, n] ~ /^-[a-z]*c[a-z]*$/ && TT[list, n - 1] == "W" && TV[list, n - 1] ~ /(^|\/)(bash|sh|zsh|dash|ksh)$/) \
      || (n >= 1 && TT[list, n] == "W" && TV[list, n] == "eval")) {
    add_tok(list, "W", w, ex)
    add_tok(list, "O", "(", 0)
    tokenize(w, list, 1, 0)
    add_tok(list, "O", ")", 0)
    return
  }
  add_tok(list, "W", w, ex)
}

# tokenize(s, list, start, in_subst) — splits shell text into words and operators.
# With in_subst=1 it stops at the `)` closing a `$(`, returning that index; the
# substitution body is written to list 2. Heredoc bodies are skipped.
function tokenize(s, list, start, in_subst,    i, n, c, c2, w, inword, ex, state, depth, hdn, hd, hs, j, p, delim, q) {
  n = length(s)
  w = ""; inword = 0; ex = 0; state = ""; depth = 0; hdn = 0
  for (i = start; i <= n; i++) {
    c = substr(s, i, 1)
    if (state == "sq") {
      if (c == "'") state = ""
      else w = w c
      continue
    }
    if (state == "dq") {
      if (c == "\\") {
        c2 = substr(s, i + 1, 1)
        if (c2 == "\"" || c2 == "\\" || c2 == "$" || c2 == "`") { w = w c2; i++ }
        else if (c2 == "\n") i++
        else w = w c
        continue
      }
      if (c == "\"") { state = ""; continue }
      if (c == "$" && substr(s, i + 1, 1) == "(") {
        ex = 1
        add_tok(2, "O", "\n", 0)
        i = tokenize(s, 2, i + 2, 1)
        continue
      }
      if (c == "`") { ex = 1; i = backtick(s, i); continue }
      if (c == "$") ex = 1
      w = w c
      continue
    }
    # --- unquoted ---
    if (c == "'") { state = "sq"; inword = 1; continue }
    if (c == "\"") { state = "dq"; inword = 1; continue }
    if (c == "\\") {
      c2 = substr(s, i + 1, 1)
      i++
      if (c2 != "\n") { w = w c2; inword = 1 }
      continue
    }
    if (c == " " || c == "\t" || c == "\r") {
      if (inword) emit_word(list, w, ex)
      w = ""; inword = 0; ex = 0
      continue
    }
    if (c == "#" && !inword) {
      j = index(substr(s, i), "\n")
      if (j == 0) i = n
      else i = i + j - 2
      continue
    }
    if (c == "$" && substr(s, i + 1, 1) == "(") {
      ex = 1; inword = 1
      add_tok(2, "O", "\n", 0)
      i = tokenize(s, 2, i + 2, 1)
      continue
    }
    if ((c == "<" || c == ">") && substr(s, i + 1, 1) == "(") {
      if (inword) emit_word(list, w, ex)
      w = ""; inword = 0; ex = 0
      add_tok(2, "O", "\n", 0)
      i = tokenize(s, 2, i + 2, 1)
      continue
    }
    if (c == "`") { ex = 1; inword = 1; i = backtick(s, i); continue }
    if (c == "$") { ex = 1; w = w c; inword = 1; continue }
    if (c == "~" && !inword) {
      c2 = substr(s, i + 1, 1)
      if (c2 == "/" || c2 == "" || c2 ~ /[ \t\n;&|()]/) { w = home; inword = 1; continue }
      ex = 1
    }
    if (c == "<" && substr(s, i + 1, 2) == "<<") {
      # here-string: the following word is data
      if (inword) emit_word(list, w, ex)
      w = ""; inword = 0; ex = 0
      i += 2
      continue
    }
    if (c == "<" && substr(s, i + 1, 1) == "<") {
      if (inword) emit_word(list, w, ex)
      w = ""; inword = 0; ex = 0
      j = i + 2
      hs[hdn + 1] = 0
      if (substr(s, j, 1) == "-") { hs[hdn + 1] = 1; j++ }
      while (substr(s, j, 1) == " " || substr(s, j, 1) == "\t") j++
      delim = ""
      while (j <= n) {
        q = substr(s, j, 1)
        if (q == "'" || q == "\"") {
          p = index(substr(s, j + 1), q)
          if (p == 0) { delim = delim substr(s, j + 1); j = n + 1; break }
          delim = delim substr(s, j + 1, p - 1)
          j = j + p + 1
          continue
        }
        if (q == "\\") { delim = delim substr(s, j + 1, 1); j += 2; continue }
        if (q ~ /[ \t\n;&|()<>]/) break
        delim = delim q
        j++
      }
      hdn++
      hd[hdn] = delim
      i = j - 1
      continue
    }
    if (c == "\n") {
      if (inword) emit_word(list, w, ex)
      w = ""; inword = 0; ex = 0
      add_tok(list, "O", "\n", 0)
      if (hdn > 0) { i = skip_heredocs(s, i, hd, hs, hdn); hdn = 0 }
      continue
    }
    if (c == ";" || c == "&" || c == "|" || c == "(" || c == ")") {
      if (c == "&" && inword && substr(w, length(w), 1) ~ /[<>]/) { w = w c; continue }
      if (c == "&" && substr(s, i + 1, 1) == ">") { w = w c; inword = 1; continue }
      if (c == ")" && in_subst && depth == 0) {
        if (inword) emit_word(list, w, ex)
        return i
      }
      if (inword) emit_word(list, w, ex)
      w = ""; inword = 0; ex = 0
      c2 = substr(s, i + 1, 1)
      if (c == "&" && c2 == "&") { add_tok(list, "O", "&&", 0); i++ }
      else if (c == "|" && c2 == "|") { add_tok(list, "O", "||", 0); i++ }
      else if (c == ";" && c2 == ";") { add_tok(list, "O", ";", 0); i++ }
      else if (c == "|" && c2 == "&") { add_tok(list, "O", "|", 0); i++ }
      else add_tok(list, "O", c, 0)
      if (c == "(") depth++
      if (c == ")") depth--
      continue
    }
    w = w c
    inword = 1
  }
  if (inword) emit_word(list, w, ex)
  return n + 1
}

# backtick(s, i) — tokenizes a `…` substitution body into list 2; returns the
# index of the closing backtick.
function backtick(s, i,    j, n, body, c) {
  n = length(s)
  body = ""
  for (j = i + 1; j <= n; j++) {
    c = substr(s, j, 1)
    if (c == "\\") { body = body substr(s, j + 1, 1); j++; continue }
    if (c == "`") break
    body = body c
  }
  add_tok(2, "O", "\n", 0)
  tokenize(body, 2, 1, 0)
  return j
}

# skip_heredocs — from the newline at i, skips each pending heredoc body; returns
# the index of the newline ending the last delimiter line.
function skip_heredocs(s, i, hd, hs, hdn,    k, p, j, line, n) {
  n = length(s)
  p = i + 1
  for (k = 1; k <= hdn; k++) {
    while (1) {
      if (p > n) return n
      j = index(substr(s, p), "\n")
      line = (j == 0) ? substr(s, p) : substr(s, p, j - 1)
      if (hs[k]) sub(/^\t+/, "", line)
      if (j == 0) {
        return n
      }
      p = p + j
      if (line == hd[k]) break
    }
  }
  return p - 1
}

# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

function union(a, b,    n, B, i, count) {
  if (a == "") return b
  if (b == "") return a
  n = split(b, B, SEP)
  count = gsub(SEP, SEP, a) + 1
  for (i = 1; i <= n; i++)
    if (index(SEP a SEP, SEP B[i] SEP) == 0) {
      if (++count > MAX_DIRS) return "?"
      a = a SEP B[i]
    }
  return a
}

# join_set(set, path, ex) — the directories reached by `cd path` from each
# directory in set; "?" when the path involves shell expansion.
function join_set(set, path, ex,    n, S, i, out, p) {
  if (ex) return "?"
  n = split(set, S, SEP)
  out = ""
  for (i = 1; i <= n; i++) {
    if (substr(path, 1, 1) == "/") p = path
    else if (S[i] == "?") p = "?"
    else p = S[i] "/" path
    out = union(out, p)
  }
  return out
}

function emit_set(kind, set,    n, S, i) {
  n = split(set, S, SEP)
  for (i = 1; i <= n; i++) print kind "\t" S[i]
}

function process_list(list, conservative,    k, nt, nw, op, depth, stack) {
  nw = 0
  depth = 0
  # NT[list] may grow while iterating (quoted git commands are appended to list 2).
  for (k = 1; k <= NT[list] + 1; k++) {
    nt = NT[list]
    if (k <= nt && TT[list, k] == "W") {
      nw++
      WV[nw] = TV[list, k]
      WX[nw] = TX[list, k]
      continue
    }
    op = (k <= nt) ? TV[list, k] : "END"
    if (nw > 0) handle_segment(list, k, nw, op, conservative)
    nw = 0
    if (op == "(") { depth++; stack[depth] = cur }
    else if (op == ")" && depth > 0) { cur = stack[depth]; depth-- }
  }
}

# creditable(list, k) — the segment ending at operator index k decides the exit
# status of the whole command: it is not piped onward and only `&&` follows.
function creditable(list, k,    j) {
  if (k <= NT[list] && TV[list, k] == "|") return 0
  for (j = k; j <= NT[list]; j++)
    if (TT[list, j] == "O" && TV[list, j] != "&&" && TV[list, j] != "(" && TV[list, j] != ")") return 0
  return 1
}

function handle_segment(list, k, nw, op, conservative,    i, a, allow, gitdirs, newset, j, g, kind, dirs, cmdword) {
  i = 1
  allow = 0
  gitdirs = ""
  while (i <= nw) {
    if (WV[i] ~ /^[A-Za-z_][A-Za-z0-9_]*=/) {
      if (WV[i] == "ALLOW_DANGEROUS_GIT=1") allow = 1
      if (WV[i] ~ /^GIT_DIR=/) gitdirs = union(gitdirs, join_set(cur, substr(WV[i], 9), WX[i]))
      i++
      continue
    }
    # Reserved words introducing or continuing a compound command run the next
    # word as a command in the current shell: `{ cd x && …; }`, `if cd x; then …`,
    # `while …; do cd x …`, `time cd x`, `! cd x`, and a function body `f() { … }`.
    if (WV[i] ~ /^(\{|\}|!|if|then|elif|else|fi|do|done|while|until|esac|time|-p)$/) { i++; continue }
    break
  }
  if (i > nw) return
  cmdword = WV[i]

  if (cmdword == "cd" || cmdword == "pushd") {
    j = i + 1
    while (j <= nw && WV[j] ~ /^-[LPe@]+$/) j++
    if (j <= nw && WV[j] == "--") j++
    if (j > nw || WV[j] ~ /^[0-9]*[<>]/) newset = join_set(cur, home, 0)
    else if (WV[j] == "-" || WV[j] ~ /^[+-][0-9]+$/) newset = "?"
    else newset = join_set(cur, WV[j], WX[j])
    cur = (op == "&&") ? newset : union(cur, newset)
    hist = union(hist, newset)
    return
  }
  if (cmdword == "popd") {
    cur = union(cur, hist)
    return
  }

  if (!conservative) {
    kind = verification_kind(i, nw)
    if (kind != "") {
      dirs = cur
      print "CHECK\t" kind "\t" creditable(list, k) "\t" ((index(dirs, SEP) || dirs == "") ? "?" : dirs)
    }
  }

  # git may be wrapped (timeout 60 git …, xargs git …): use its first occurrence.
  for (g = i; g <= nw; g++) {
    if (WV[g] == "git" || WV[g] ~ /\/git$/) { git_rules(g, nw, allow, gitdirs); break }
  }
  for (g = i; g + 2 <= nw; g++) {
    if (WV[g] == "gh" && WV[g + 1] == "pr" && WV[g + 2] == "merge") {
      for (j = g + 3; j <= nw; j++)
        if (WV[j] ~ /^--delete-branch(=|$)/ || (WV[j] ~ /^-[a-zA-Z]*d[a-zA-Z]*$/)) {
          if (!allow) print "DENY\tgh-merge-delete"
          break
        }
      break
    }
  }

  # A quoted git command handed to another program (watch "git commit", ssh …)
  # is analysed conservatively — except as plain data for printing/searching.
  if (cmdword !~ /^(echo|printf|grep|egrep|fgrep|rg|sed|awk|jq|cat|test|\[)$/) {
    for (j = i + 1; j <= nw; j++) {
      if (WV[j] ~ /^[ \t]*git[ \t]/ && WV[j - 1] !~ /^(-m|--message|-F|--file|-e|--grep|--body|-b|-t|--title)$/)
        tokenize(WV[j], 2, 1, 0)
    }
  }
}

function verification_kind(i, nw,    a, b, c, j) {
  a = WV[i]
  b = (i + 1 <= nw) ? WV[i + 1] : ""
  c = (i + 2 <= nw) ? WV[i + 2] : ""
  if (a == "npm" && b == "run" && c == "typecheck") return "typecheck"
  if (a == "npm" && (b == "test" || b == "t")) return "test"
  if (a == "npm" && b == "run" && c == "test") return "test"
  if ((a == "npx" && b == "meteor" && c == "test") || (a == "meteor" && b == "test")) return "test"
  if ((a == "npx" && b == "tsc") || a == "tsc") {
    for (j = i + 1; j <= nw; j++)
      if (WV[j] == "--noEmit" || WV[j] == "-p" || WV[j] == "--project") return "typecheck"
  }
  return ""
}

function git_rules(g, nw, allow, gitdirs,    j, a, dirs, subcmd, x, hasD, hasd, hasf) {
  dirs = cur
  subcmd = ""
  j = g + 1
  while (j <= nw) {
    a = WV[j]
    if ((a == "-C" || a == "-c" || a == "--git-dir" || a == "--work-tree" || a == "--namespace" || a == "--config-env") && j + 1 > nw) break
    if (a == "-C") { dirs = join_set(dirs, WV[j + 1], WX[j + 1]); j += 2; continue }
    if (a == "-c" || a == "--work-tree" || a == "--namespace" || a == "--config-env") { j += 2; continue }
    if (a == "--git-dir") { gitdirs = union(gitdirs, join_set(dirs, WV[j + 1], WX[j + 1])); j += 2; continue }
    if (a ~ /^--git-dir=/) { gitdirs = union(gitdirs, join_set(dirs, substr(a, 11), WX[j])); j++; continue }
    if (a ~ /^-/) { j++; continue }
    subcmd = a
    break
  }

  if (subcmd == "commit" || subcmd == "push") {
    if (allow) return
    if (gitdirs != "") emit_set("GITDIR", gitdirs)
    else emit_set("TARGET", dirs)
    if (subcmd == "push") push_refs(j + 1, nw)
    return
  }
  if (subcmd == "reset") {
    for (x = j + 1; x <= nw; x++)
      if (WV[x] == "--hard") { if (!allow) print "DENY\treset-hard"; return }
    return
  }
  if (subcmd == "branch") {
    hasD = 0; hasd = 0; hasf = 0
    for (x = j + 1; x <= nw; x++) {
      a = WV[x]
      if (a == "--delete") hasd = 1
      else if (a == "--force") hasf = 1
      else if (a ~ /^-[a-zA-Z]+$/) {
        if (index(a, "D")) hasD = 1
        if (index(a, "d")) hasd = 1
        if (index(a, "f")) hasf = 1
      }
    }
    if ((hasD || (hasd && hasf)) && !allow) print "DENY\tbranch-force-delete"
  }
}

function push_refs(start, nw,    j, a, pos, dst, c, repo) {
  pos = 0
  repo = 0
  for (j = start; j <= nw; j++) {
    a = WV[j]
    if (a == "--all" || a == "--mirror" || a == "--branches") { print "PUSHMAIN\t" a; continue }
    if (a == "--repo") { repo = 1; j++; continue }
    if (a ~ /^--repo=/) { repo = 1; continue }
    if (a ~ /^(-o|--push-option|--receive-pack|--exec)$/) { j++; continue }
    if (a ~ /^-/ || a ~ /^[0-9]*[<>&]/) continue
    pos++
    if (pos == 1 && !repo) continue
    if (WX[j]) { print "PUSHUNRESOLVED\t" a; continue }
    dst = a
    sub(/^\+/, "", dst)
    while ((c = index(dst, ":")) > 0) dst = substr(dst, c + 1)
    sub(/^refs\/heads\//, "", dst)
    if (dst == "main" || dst == "master") print "PUSHMAIN\t" a
  }
}

# large_scan(raw) — conservative literal scan of an oversized, still JSON-escaped
# command: any git commit/push is reported as LARGE (the caller denies it), and
# the always-dangerous operations are denied outright.
function large_scan(raw) {
  if (raw ~ /^ALLOW_DANGEROUS_GIT=1[ \t]/) return
  if (raw ~ /git[ \t]+([^;&|]*[ \t])?(commit|push)([^A-Za-z0-9_-]|$)/) print "LARGE\tcommit-push"
  if (raw ~ /git[ \t]+([^;&|]*[ \t])?reset[ \t]+([^;&|]*[ \t])?--hard/) print "DENY\treset-hard"
  if (raw ~ /git[ \t]+([^;&|]*[ \t])?branch[ \t]+([^;&|]*[ \t])?(-[a-zA-Z]*D|--delete[ \t]+--force|--force[ \t]+--delete)/) print "DENY\tbranch-force-delete"
  if (raw ~ /gh[ \t]+pr[ \t]+merge[^;&|]*(--delete-branch|[ \t]-[a-zA-Z]*d([ \t]|$))/) print "DENY\tgh-merge-delete"
}
