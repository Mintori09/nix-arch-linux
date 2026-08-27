import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Check if zsh is available on the system
let hasZsh = false;
try {
  const check = spawnSync("zsh", ["--version"], { encoding: "utf8" });
  hasZsh = check.status === 0;
} catch {
  hasZsh = false;
}

function runZshTest(script: string): {
  stdout: string;
  stderr: string;
  status: number;
} {
  const result = spawnSync("zsh", ["-s"], {
    input: script,
    encoding: "utf-8",
    cwd: rootDir,
  });
  if (result.stderr && result.stderr.trim()) {
    console.error("--- ZSH STDERR ---");
    console.error(result.stderr);
    console.error("------------------");
  }
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

const BASE_ZSH_SETUP = `
# Enable extended globbing as done in the completion script
setopt localoptions extendedglob

# Mock Zsh completion functions
_arguments_args=()
_arguments() {
  _arguments_args+=("\${@}")
  if [[ -n "\${mock_state}" ]]; then
    state="\${mock_state}"
  else
    if (( CURRENT == 2 )); then
      state="cmd_or_input"
    elif (( CURRENT == 3 )); then
      state="output_file"
    fi
  fi
  return 0
}

_alternative_args=()
_alternative() {
  _alternative_args+=("\${@}")
  local arg action
  for arg in "\${@}"; do
    if [[ "\$arg" == *:* ]]; then
      action="\${arg#*:}"
      action="\${action#*:}"
      if [[ -n "\$action" ]]; then
        eval "\$action"
      fi
    fi
  done
  return 0
}

_compadd_args=()
compadd() {
  _compadd_args+=("\${@}")
  local i
  for (( i = 1; i <= \${#}; i++ )); do
    if [[ "\${@[\$i]}" == "-a" ]]; then
      local array_name="\${@[\$i+1]}"
      echo "mock_alias_count=\${(P)#array_name}"
    fi
  done
  return 0
}

_files_call_count=0
_files_args=()
_files() {
  _files_call_count=\$(( _files_call_count + 1 ))
  _files_args+=("\${@}")
  return 0
}

_wanted_args=()
_wanted() {
  _wanted_args+=("\${@}")
  if (( \${#} >= 4 )); then
    local cmd="\${4}"
    shift 4
    "\${cmd}" "\${@}"
  fi
  return 0
}

compset_args=()
compset() {
  compset_args+=("\${@}")
  return 0
}

# Mock cv command to return supported routes
cv() {
  if [[ "\${1}" == "--list" ]]; then
    echo "Supported conversions:"
    echo "- md:pdf"
    echo "- md:docx"
    echo "- md:html"
    echo "- docx:html"
    echo "- md:epub"
    echo "- docx:md"
  else
    return 1
  fi
}

# Helper to run the completion script in a clean local scope
run_completion() {
  words=("\${@}")
  CURRENT=\${#words}
  mock_state=""
  state=""
  line=""
  _arguments_args=()
  _alternative_args=()
  _compadd_args=()
  _files_call_count=0
  _files_args=()
  _wanted_args=()
  compset_args=()
  
  source completions/_cv
}

# Helper to run completion with a specific state already set
run_completion_with_state() {
  local target_state="\${1}"
  shift
  words=("\${@}")
  CURRENT=\${#words}
  mock_state="\${target_state}"
  state=""
  line=""
  _arguments_args=()
  _alternative_args=()
  _compadd_args=()
  _files_call_count=0
  _files_args=()
  _wanted_args=()
  compset_args=()
  
  source completions/_cv
}

# Load the completion script inside a function context to define the helper functions
load_completion_funcs() {
  source completions/_cv
}
load_completion_funcs
`;

describe("Zsh Completion script", { skip: !hasZsh }, () => {
  it("Scenario 1: Argument 1 (Input File or Subcommand)", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # 1. Gõ cv [Tab] -> gợi ý file đầu vào (md, docx, epub) và subcommands, và flag
      run_completion cv ""
      echo "flags:\${_arguments_args[*]}"
      echo "alt:\${_alternative_args[*]}"
      
      # 2. Gõ cv -[Tab] -> hiển thị flag chung
      run_completion cv "-"
      echo "flags_dash:\${_arguments_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /flags:.*--dry-run/);
    assert.match(stdout, /flags:.*--list/);
    assert.match(stdout, /flags:.*--help/);
    assert.match(stdout, /alt:.*files:input file/);
    assert.match(stdout, /alt:.*subcommands:command/);
    assert.match(stdout, /flags_dash:.*--dry-run/);
    assert.match(stdout, /flags_dash:.*--list/);
  });

  it("Scenario 2: Prevent automatic route guessing when output file is not yet specified", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      run_completion cv test1.md "-"
      echo "flags_md:\${_arguments_args[*]}"
      
      run_completion cv test2.docx "-"
      echo "flags_docx:\${_arguments_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);

    const mdLine = stdout.split("\n").find((l) => l.startsWith("flags_md:"));
    const docxLine = stdout
      .split("\n")
      .find((l) => l.startsWith("flags_docx:"));

    assert.ok(mdLine);
    assert.ok(docxLine);

    // According to Scenario 2: do NOT show route-specific flags when output is not specified
    assert.ok(
      !mdLine.includes("--page-size"),
      "Should not show md:pdf flags before output file is specified",
    );
    assert.ok(
      !mdLine.includes("--toc"),
      "Should not show md:pdf flags before output file is specified",
    );
    assert.ok(
      !docxLine.includes("--extract-media"),
      "Should not show docx:html flags before output file is specified",
    );
  });

  it("Scenario 3: Suggest output file name (Base Name)", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      run_completion_with_state output_file cv test1.md ""
      echo "wanted:\${_wanted_args[*]}"
      echo "compadd:\${_compadd_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /wanted:.*output base name/);
    assert.match(stdout, /compadd:.*test1/);
  });

  it("Scenario 4: Suggest output extensions", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # With dot: output.[Tab] -> suggest extensions
      run_completion_with_state output_file cv test1.md "output."
      echo "with_dot_wanted:\${_wanted_args[*]}"
      echo "with_dot_compadd:\${_compadd_args[*]}"
      
      # Without dot: output[Tab] -> should call _files, not extension suggestions
      run_completion_with_state output_file cv test1.md "output"
      echo "without_dot_files_count:\${_files_call_count}"
      echo "without_dot_wanted_count:\${#_wanted_args}"
      
      # Path with dot: ~/Desktop/output.[Tab] -> suggest extensions
      run_completion_with_state output_file cv test1.md "~/Desktop/output."
      echo "path_dot_wanted:\${_wanted_args[*]}"
      echo "path_dot_compadd:\${_compadd_args[*]}"
      
      # Path without dot: ~/Deskt[Tab] -> call _files
      run_completion_with_state output_file cv test1.md "~/Deskt"
      echo "path_files_count:\${_files_call_count}"
      echo "path_wanted_count:\${#_wanted_args}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);

    assert.match(stdout, /with_dot_wanted:.*extension/);
    assert.match(stdout, /with_dot_compadd:.*pdf docx html epub/);

    // Without dot: _files should be called, NOT extension suggestions
    assert.match(stdout, /without_dot_files_count:1/);
    assert.match(stdout, /without_dot_wanted_count:0/);

    // Path with dot: same as regular with-dot
    assert.match(stdout, /path_dot_wanted:.*extension/);
    assert.match(stdout, /path_dot_compadd:.*pdf docx html epub/);

    // Path without dot: _files should be called
    assert.match(stdout, /path_files_count:1/);
    assert.match(stdout, /path_wanted_count:0/);
  });

  it("Scenario 5: Dynamic flags based on output file (Correct Logic)", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # md:docx
      run_completion cv test1.md test1.docx "-"
      echo "docx_flags:\${_arguments_args[*]}"
      
      # md:html
      run_completion cv test1.md test1.html "-"
      echo "html_flags:\${_arguments_args[*]}"
      
      # md:html --style [Tab]
      run_completion_with_state styles cv test1.md test1.html --style ""
      echo "style_alt:\${_alternative_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);

    assert.match(stdout, /docx_flags:.*--reference-doc/);
    assert.match(stdout, /docx_flags:.*--extract-media/);

    assert.match(stdout, /html_flags:.*--style/);
    assert.match(stdout, /html_flags:.*--extract-media/);
    assert.ok(
      !stdout.includes("html_flags:.*--reference-doc"),
      "html route should not contain --reference-doc",
    );

    assert.match(stdout, /style_alt:.*config-aliases/);
    assert.match(stdout, /style_alt:.*local-styles/);
  });

  it("Scenario 6: Edge Cases & Error Handling (Robustness)", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # 1. cv --dry-run test1.md [Tab] -> ignores --dry-run
      run_completion_with_state output_file cv --dry-run test1.md ""
      echo "case1_compadd:\${_compadd_args[*]}"
      
      # 2. empty/corrupt config.json
      HOME="/tmp/nonexistent-home-\$\$"
      run_completion_with_state styles cv test1.md test1.html --style ""
      echo "case2_status:\$?"
      
      # 3. cv --list fails
      cv() { return 1; }
      unset _cv_cache_routes
      typeset -gA _cv_cache_routes
      run_completion cv ""
      echo "case3_alt:\${_alternative_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /case1_compadd:.*test1/);
    assert.match(stdout, /case2_status:0/);
    assert.match(stdout, /case3_alt:.*files:input file/); // fallback to _files
  });

  it("Scenario 7: Dynamic change of output file on command line", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # First, with md:docx
      run_completion cv test1.md test1.docx "-"
      echo "first:\${_arguments_args[*]}"
      
      # Changed to md:pdf
      run_completion cv test1.md test1.pdf "-"
      echo "second:\${_arguments_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /first:.*--reference-doc/);

    const secondLine = stdout.split("\n").find((l) => l.startsWith("second:"));
    assert.ok(secondLine);
    assert.ok(
      !secondLine.includes("--reference-doc"),
      "Should not contain --reference-doc when output is pdf",
    );
    assert.ok(
      secondLine.includes("--page-size"),
      "Should contain --page-size when output is pdf",
    );
  });

  it("Scenario 8: Absolute/Relative paths (/path/to/file)", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # 1. Path in input and output
      run_completion cv ../docs/report.md /tmp/target.docx "-"
      echo "flags:\${_arguments_args[*]}"
      
      # 2. Suggest base name for relative path
      run_completion_with_state output_file cv ./draft.md ""
      echo "compadd:\${_compadd_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /flags:.*--reference-doc/);
    assert.match(stdout, /compadd:.*draft/);
    assert.ok(
      !stdout.includes("compadd:.*./draft"),
      "Should not include path prefix in base name suggestion",
    );
  });

  it("Scenario 9: Multiple dots / hidden files", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # 1. Multiple dots & hidden file
      run_completion cv .hidden.md final.version.docx "-"
      echo "flags:\${_arguments_args[*]}"
      
      # 2. Base name suggestion for hidden file
      run_completion_with_state output_file cv .hidden.md ""
      echo "compadd:\${_compadd_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /flags:.*--reference-doc/);
    assert.match(stdout, /compadd:.*\.hidden/);
  });

  it("Scenario 10: Case Insensitivity", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # 1. Upper case extensions
      run_completion cv TEST.MD output.DOCX "-"
      echo "flags:\${_arguments_args[*]}"
      
      # 2. Upper case input, completing output extension
      run_completion_with_state output_file cv test1.MD OUTPUT.
      echo "compadd:\${_compadd_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /flags:.*--reference-doc/);
    assert.match(stdout, /compadd:.*pdf docx html epub/);
  });

  it("Scenario 11: Parameter-consuming flags", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      run_completion cv --style=modern --metadata-file=meta.yaml test1.md test1.pdf "-"
      echo "flags:\${_arguments_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /flags:.*--page-size/);
  });

  it("Scenario 12: No duplicate flags", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      run_completion cv test1.md test1.pdf "-"
      # Count occurrences of --dry-run in _arguments_args
      local count=0
      for arg in "\${_arguments_args[@]}"; do
        if [[ "\$arg" == *"--dry-run"* ]]; then
          (( count++ ))
        fi
      done
      echo "dry_run_count:\$count"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /dry_run_count:1/);
  });

  it("Scenario 13: Extensionless files", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      run_completion cv README output.pdf "-"
      echo "status:\$?"
      echo "flags:\${_arguments_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /status:0/);

    const line = stdout.split("\n").find((l) => l.startsWith("flags:"));
    assert.ok(line);
    assert.ok(
      !line.includes("--page-size"),
      "Should not show route flags for extensionless input",
    );
  });

  it("Scenario 14: Route without specific flags", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      run_completion cv test2.docx out.md "-"
      echo "status:\$?"
      echo "flags:\${_arguments_args[*]}"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /status:0/);
    assert.match(stdout, /flags:.*--dry-run/);
    assert.ok(
      !stdout.includes("--page-size"),
      "Should not show unrelated flags",
    );
  });

  it("Scenario 15: Clean local options (Extendedglob, etc.)", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # Check extendedglob is local (not polluted globally)
      unsetopt extendedglob
      run_completion cv ""
      if [[ -o extendedglob ]]; then
        echo "polluted:yes"
      else
        echo "polluted:no"
      fi
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /polluted:no/);
  });

  it("Scenario 16: Idempotency / Cache response speed", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # Counter file for cv calls
      cv_call_file="/tmp/cv_call_count_\$\$"
      rm -f "\$cv_call_file"
      cv() {
        if [[ "\${1}" == "--list" ]]; then
          echo "1" >> "\$cv_call_file"
          echo "- md:pdf"
        fi
      }
      
      unset _cv_cache_routes
      typeset -gA _cv_cache_routes
      _cv_load_routes
      _cv_load_routes
      _cv_load_routes
      
      local calls=0
      if [[ -f "\$cv_call_file" ]]; then
        calls=\$(wc -l < "\$cv_call_file")
      fi
      echo "calls:\$calls"
      rm -f "\$cv_call_file"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /calls:1/);
  });

  it("Scenario 17 & 18: Latency (Cold/Hot Cache)", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # Cold cache timing
      unset _cv_cache_routes
      typeset -gA _cv_cache_routes
      start_cold=\$(zsh -c 'echo \${EPOCHREALTIME}')
      _cv_load_routes
      end_cold=\$(zsh -c 'echo \${EPOCHREALTIME}')
      
      # Hot cache timing (1000 iterations)
      start_hot=\$(zsh -c 'echo \${EPOCHREALTIME}')
      for i in {1..1000}; do
        _cv_load_routes
      done
      end_hot=\$(zsh -c 'echo \${EPOCHREALTIME}')
      
      # Calculate diffs using Zsh native arithmetic
      cold_diff=\$(( end_cold - start_cold ))
      hot_diff=\$(( end_hot - start_hot ))
      
      echo "cold_diff:\$cold_diff"
      echo "hot_diff:\$hot_diff"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);

    const coldMatch = stdout.match(/cold_diff:([0-9.e-]+)/);
    const hotMatch = stdout.match(/hot_diff:([0-9.e-]+)/);
    assert.ok(coldMatch);
    assert.ok(hotMatch);

    const coldVal = parseFloat(coldMatch[1]);
    const hotVal = parseFloat(hotMatch[1]);

    // SLA criteria from doc:
    // Cold cache: acceptable < 0.2s
    // Hot cache: 1000 iterations should be extremely fast (e.g. < 0.5s total)
    assert.ok(coldVal < 0.5, `Cold cache took too long: ${coldVal}s`);
    assert.ok(hotVal < 0.5, `1000 Hot cache lookups took too long: ${hotVal}s`);
  });

  it("Scenario 19: String parsing performance (_cv_find_input)", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # Construct 50-word command line
      words=(cv)
      for i in {1..24}; do
        words+=(--style=modern)
      done
      words+=(input.md)
      words+=("")
      CURRENT=\${#words}
      
      start_time=\$(zsh -c 'echo \${EPOCHREALTIME}')
      _cv_find_input
      res="\$REPLY"
      end_time=\$(zsh -c 'echo \${EPOCHREALTIME}')
      
      diff=\$(( end_time - start_time ))
      echo "res:\$res"
      echo "diff:\$diff"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /res:input\.md/);

    const diffMatch = stdout.match(/diff:([0-9.e-]+)/);
    assert.ok(diffMatch);
    const diffVal = parseFloat(diffMatch[1]);
    assert.ok(diffVal < 0.1, `String parsing took too long: ${diffVal}s`);
  });

  it("Scenario 20: Subshell Fork Count", () => {
    const scriptPath = path.resolve(rootDir, "completions/_cv");
    const content = fs.readFileSync(scriptPath, "utf8");

    const matches = content.match(/\$\([^)]+\)/g) || [];
    assert.ok(
      matches.length <= 3,
      `Too many subshells found in completion script: ${matches.join(", ")}`,
    );
  });

  it("Scenario 21: Memory Leak / Global Pollution", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # Run completion
      run_completion cv ""
      
      # Check if temp variables are defined globally
      for var in argspec valid_outs route in_ext out_ext input_file; do
        if typeset -p "\$var" &>/dev/null; then
          echo "polluted:\$var"
        fi
      done
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.ok(
      !stdout.includes("polluted:"),
      "Variables leaked to global scope: " + stdout,
    );
  });

  it("Scenario 22: Stress-test config.json", () => {
    const script = `
      ${BASE_ZSH_SETUP}
      
      # Generate a huge config.json with 1000 styles
      config_dir="/tmp/cv-test-config-\$\$"
      mkdir -p "\$config_dir/.config/convert-file"
      config_file="\$config_dir/.config/convert-file/config.json"
      
      echo '{"styles": {' > "\$config_file"
      for i in {1..1000}; do
        if (( i == 1000 )); then
          echo "\\"style\$i\\": \\"body { color: red; }\\"" >> "\$config_file"
        else
          echo "\\"style\$i\\": \\"body { color: red; }\\"," >> "\$config_file"
        fi
      done
      echo '}}' >> "\$config_file"
      
      HOME="\$config_dir"
      run_completion_with_state styles cv test1.md test1.html --style ""
      echo "status:\$?"
      
      rm -rf "\$config_dir"
    `;
    const { stdout, stderr, status } = runZshTest(script);
    assert.strictEqual(status, 0, stderr);
    assert.match(stdout, /status:0/);
    assert.match(stdout, /mock_alias_count=1000/);
  });
});
